# Asynq Task Processing

## Overview

Asynq is used for async task processing instead of Temporal for simplicity. Redis is the backing store.

## Task Types

### 1. Chart Generation Task

```go
package tasks

import (
    "context"
    "encoding/json"
    "fmt"
    "time"

    "github.com/hibiken/asynq"
    "github.com/yourusername/dashboard/agent"
    "github.com/yourusername/dashboard/database"
    "github.com/yourusername/dashboard/models"
    "github.com/yourusername/dashboard/services"
)

const (
    TypeChartGeneration     = "chart:generation"
    TypeComponentValidation = "component:validation"
    TypeDatasourceHealth    = "datasource:health"
    TypeDashboardUpdate     = "dashboard:update"
)

// Chart Generation

type ChartGenerationPayload struct {
    Prompt    string `json:"prompt"`
    UserID    string `json:"user_id"`
    SessionID string `json:"session_id"`
}

func NewChartGenerationTask(payload ChartGenerationPayload) (*asynq.Task, error) {
    data, err := json.Marshal(payload)
    if err != nil {
        return nil, err
    }

    return asynq.NewTask(
        TypeChartGeneration,
        data,
        asynq.Queue("critical"),         // High priority queue
        asynq.MaxRetry(3),               // Retry up to 3 times
        asynq.Timeout(5*time.Minute),    // 5 minute timeout
    ), nil
}

func HandleChartGeneration(ctx context.Context, t *asynq.Task) error {
    var payload ChartGenerationPayload
    if err := json.Unmarshal(t.Payload(), &payload); err != nil {
        return fmt.Errorf("unmarshal payload: %w", err)
    }

    log.Printf("[Chart Gen] Starting: %s", payload.Prompt)

    // Step 1: Generate metadata
    metadata, err := agent.GenerateMetadata(ctx, payload.Prompt)
    if err != nil {
        return fmt.Errorf("generate metadata: %w", err)
    }

    // Step 2: Generate component code via LLM
    code, err := agent.GenerateChartCode(ctx, payload.Prompt, metadata)
    if err != nil {
        return fmt.Errorf("generate code: %w", err)
    }

    // Step 3: Validate component
    validation, err := services.ValidateComponent(ctx, code)
    if err != nil {
        return fmt.Errorf("validate component: %w", err)
    }

    // If validation failed, don't save - return error for retry
    if validation.Status == "failed" {
        // Store validation failure in chat session
        services.SaveValidationFailure(ctx, payload.SessionID, validation)
        return fmt.Errorf("validation failed: %v", validation.Vulnerabilities)
    }

    // Step 4: Save component to MongoDB
    component := &models.Component{
        Name:           generateComponentName(payload.Prompt),
        System:         "generated",
        Source:         "ai",
        ComponentCode:  code,
        Metadata:       metadata,
        CurrentVersion: "1.0.0",
        Versions:       []models.ComponentVersion{},
        Validation:     validation,
        AIGenerated:    true,
        Prompt:         payload.Prompt,
        CreatedAt:      time.Now(),
        UpdatedAt:      time.Now(),
    }

    componentID, err := database.Components.InsertOne(ctx, component)
    if err != nil {
        return fmt.Errorf("save component: %w", err)
    }

    log.Printf("[Chart Gen] Success: %s", componentID)

    // Step 5: Notify client via WebSocket
    services.NotifyClient(ctx, payload.UserID, Notification{
        Type:        "component-created",
        ComponentID: componentID,
        SessionID:   payload.SessionID,
    })

    return nil
}

// Component Validation Task

type ComponentValidationPayload struct {
    ComponentID string `json:"component_id"`
    Code        string `json:"code"`
}

func NewComponentValidationTask(payload ComponentValidationPayload) (*asynq.Task, error) {
    data, err := json.Marshal(payload)
    if err != nil {
        return nil, err
    }

    return asynq.NewTask(
        TypeComponentValidation,
        data,
        asynq.Queue("default"),
        asynq.MaxRetry(1),
    ), nil
}

func HandleComponentValidation(ctx context.Context, t *asynq.Task) error {
    var payload ComponentValidationPayload
    if err := json.Unmarshal(t.Payload(), &payload); err != nil {
        return fmt.Errorf("unmarshal payload: %w", err)
    }

    validation, err := services.ValidateComponent(ctx, payload.Code)
    if err != nil {
        return fmt.Errorf("validate: %w", err)
    }

    // Update component validation status
    err = database.Components.UpdateValidation(ctx, payload.ComponentID, validation)
    if err != nil {
        return fmt.Errorf("update validation: %w", err)
    }

    return nil
}

// Datasource Health Check Task

type DatasourceHealthPayload struct {
    DatasourceID string `json:"datasource_id"`
}

func NewDatasourceHealthTask(datasourceID string) (*asynq.Task, error) {
    payload := DatasourceHealthPayload{DatasourceID: datasourceID}
    data, err := json.Marshal(payload)
    if err != nil {
        return nil, err
    }

    return asynq.NewTask(
        TypeDatasourceHealth,
        data,
        asynq.Queue("low"),
    ), nil
}

func HandleDatasourceHealth(ctx context.Context, t *asynq.Task) error {
    var payload DatasourceHealthPayload
    if err := json.Unmarshal(t.Payload(), &payload); err != nil {
        return fmt.Errorf("unmarshal payload: %w", err)
    }

    // Check datasource health
    healthy, err := services.CheckDatasourceHealth(ctx, payload.DatasourceID)
    if err != nil || !healthy {
        // Send alert
        services.SendAlert(ctx, Alert{
            Type:         "datasource-unhealthy",
            DatasourceID: payload.DatasourceID,
            Error:        err,
        })
    }

    return nil
}

// Dashboard Update Notification Task

type DashboardUpdatePayload struct {
    DashboardID string   `json:"dashboard_id"`
    ComponentID string   `json:"component_id"`
    UserIDs     []string `json:"user_ids"`
}

func NewDashboardUpdateTask(payload DashboardUpdatePayload) (*asynq.Task, error) {
    data, err := json.Marshal(payload)
    if err != nil {
        return nil, err
    }

    return asynq.NewTask(
        TypeDashboardUpdate,
        data,
        asynq.Queue("default"),
    ), nil
}

func HandleDashboardUpdate(ctx context.Context, t *asynq.Task) error {
    var payload DashboardUpdatePayload
    if err := json.Unmarshal(t.Payload(), &payload); err != nil {
        return fmt.Errorf("unmarshal payload: %w", err)
    }

    // Notify all connected users
    for _, userID := range payload.UserIDs {
        services.NotifyClient(ctx, userID, Notification{
            Type:        "dashboard-updated",
            DashboardID: payload.DashboardID,
            ComponentID: payload.ComponentID,
        })
    }

    return nil
}
```

## Worker Setup

```go
// cmd/worker/main.go
package main

import (
    "log"
    "os"
    "os/signal"
    "syscall"

    "github.com/hibiken/asynq"
    "github.com/yourusername/dashboard/config"
    "github.com/yourusername/dashboard/tasks"
)

func main() {
    // Load configuration
    cfg, err := config.Load()
    if err != nil {
        log.Fatalf("Failed to load config: %v", err)
    }

    // Create Redis connection
    redisOpt := asynq.RedisClientOpt{
        Addr:     cfg.Redis.Addr,
        Password: cfg.Redis.Password,
        DB:       cfg.Redis.DB,
    }

    // Create Asynq server
    srv := asynq.NewServer(
        redisOpt,
        asynq.Config{
            Concurrency: cfg.Asynq.Concurrency,
            Queues:      cfg.Asynq.Queues, // map[string]int{"critical": 6, "default": 3, "low": 1}
            ErrorHandler: asynq.ErrorHandlerFunc(func(ctx context.Context, task *asynq.Task, err error) {
                log.Printf("Task %s failed: %v", task.Type(), err)
            }),
            Logger: log.New(os.Stdout, "[asynq] ", log.LstdFlags),
        },
    )

    // Create task mux
    mux := asynq.NewServeMux()

    // Register handlers
    mux.HandleFunc(tasks.TypeChartGeneration, tasks.HandleChartGeneration)
    mux.HandleFunc(tasks.TypeComponentValidation, tasks.HandleComponentValidation)
    mux.HandleFunc(tasks.TypeDatasourceHealth, tasks.HandleDatasourceHealth)
    mux.HandleFunc(tasks.TypeDashboardUpdate, tasks.HandleDashboardUpdate)

    // Start server
    go func() {
        if err := srv.Run(mux); err != nil {
            log.Fatalf("Failed to run worker: %v", err)
        }
    }()

    log.Println("Worker started. Press Ctrl+C to stop.")

    // Wait for interrupt signal
    sigChan := make(chan os.Signal, 1)
    signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
    <-sigChan

    log.Println("Shutting down worker...")
    srv.Shutdown()
}
```

## Enqueueing Tasks from API

```go
// api/chart.go
package api

import (
    "net/http"

    "github.com/gin-gonic/gin"
    "github.com/hibiken/asynq"
    "github.com/yourusername/dashboard/tasks"
)

type ChartController struct {
    asynqClient *asynq.Client
}

// @Summary Generate chart with AI
// @Description Start AI-powered chart generation task
// @Tags Charts
// @Accept json
// @Produce json
// @Param request body ChartGenerationRequest true "Chart generation request"
// @Success 202 {object} TaskResponse
// @Failure 400 {object} ErrorResponse
// @Router /api/charts/generate [post]
func (ctrl *ChartController) GenerateChart(c *gin.Context) {
    var req ChartGenerationRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    // Create task
    task, err := tasks.NewChartGenerationTask(tasks.ChartGenerationPayload{
        Prompt:    req.Prompt,
        UserID:    req.UserID,
        SessionID: req.SessionID,
    })
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    // Enqueue task
    info, err := ctrl.asynqClient.Enqueue(task)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusAccepted, gin.H{
        "task_id": info.ID,
        "queue":   info.Queue,
        "message": "Chart generation started",
    })
}
```

## Asynq Web UI

Asynq provides a web UI for monitoring tasks:

```go
// cmd/asynqmon/main.go
package main

import (
    "log"

    "github.com/hibiken/asynq"
    "github.com/hibiken/asynqmon"
)

func main() {
    h := asynqmon.New(asynqmon.Options{
        RootPath: "/asynq",
        RedisConnOpt: asynq.RedisClientOpt{
            Addr: "localhost:6379",
        },
    })

    log.Println("Asynq Monitor running on http://localhost:8080/asynq")
    http.ListenAndServe(":8080", h)
}
```

Access at: `http://localhost:8080/asynq`

## Periodic Tasks (Cron Jobs)

```go
// Use asynq scheduler for periodic tasks
func setupScheduler() {
    scheduler := asynq.NewScheduler(
        asynq.RedisClientOpt{Addr: "localhost:6379"},
        nil,
    )

    // Health check every 5 minutes
    scheduler.Register("*/5 * * * *", tasks.NewDatasourceHealthTask("all"))

    // Cleanup old chat sessions daily at midnight
    scheduler.Register("0 0 * * *", tasks.NewCleanupTask())

    if err := scheduler.Run(); err != nil {
        log.Fatal(err)
    }
}
```

## Benefits

1. **Simple Infrastructure**: Just Redis (already needed for caching)
2. **Reliable**: Tasks persist in Redis
3. **Retries**: Automatic exponential backoff
4. **Monitoring**: Web UI included
5. **Priority Queues**: Critical tasks processed first
6. **Performance**: Can handle thousands of tasks/second
7. **Lightweight**: Much simpler than Temporal

## Migration Path to Temporal

If workflows become complex, migration is straightforward:
- Asynq task types → Temporal activities
- Task handlers → Activity functions
- Add workflow orchestration layer
- Keep Redis for caching
