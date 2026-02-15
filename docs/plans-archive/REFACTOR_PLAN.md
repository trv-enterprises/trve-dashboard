# Dashboard Refactoring Plan

## Executive Summary

Refactor the dashboard application from a single-view component builder into a comprehensive three-mode system: **Design**, **View**, and **Manage**. Design Mode includes four distinct sections: Layouts, Datasources, Charts, and Dashboards.

---

## Architecture Overview

### System Components

The dashboard system consists of three primary subsystems (based on architecture diagram):

#### **D-Client (Dashboard Client)**
Browser-based client application with:
- **Chat Interaction Widget** - Conversational UI for interacting with D-Agent
- **Component Display Window** - Renders dynamic React components
- **Data Layer** - Connects to external data sources with caching
- **Notifier** - Receives real-time updates from D-Server (WebSocket/SSE)
- **Mode Selector** - Switch between Design, View, and Manage modes

#### **D-Server (Dashboard Server)**
Node.js/Express server providing:
- **Component Validation / Vulnerability Test** - Security scanning for generated components
- **Process Manager** - Manages component lifecycle and deployment
- **Notifier** - Sends real-time updates to D-Client (WebSocket/SSE)
- **Template Library Manager** - Manages layout and chart templates
- **File-based Storage** - Persists charts, dashboards, layouts, datasources
- **API Layer** - RESTful endpoints for all resources

#### **D-Agent (Dashboard Agent)**
AI-powered agent system with:
- **Metadata Generator & Validator** - Creates and validates component metadata
- **React Chart Generator & Validator** - Generates and validates React chart code
- **LLM Interface** - Connects to external LLM (Claude via MCP)
- **MCP Connector** - Model Context Protocol integration
- **Data Layer Integration Generator & Validator** - Generates data connections
- **Chat Capability** - Natural language interface for chart creation
- **Context Memory** - Maintains conversation history and context

#### **External Systems**
- **LLM** - External AI (Claude) for chart generation
- **Chart Library** - External chart templates and examples
- **Data Source** - External data systems (APIs, WebSockets, Files)

### Three Primary Modes

1. **Design Mode** - Create and configure dashboard resources
   - Layouts (grid structures with empty panels)
   - Datasources (API, WebSocket, File connections)
   - Charts (reusable chart components - existing Chart Design)
   - Dashboards (combine layouts + charts + datasources)

2. **View Mode** - View live dashboards with real-time data
   - Select and view dashboards
   - Live data updates
   - Interactive charts

3. **Manage Mode** - System administration
   - Component versioning and rollback
   - Security and vulnerability management
   - System settings
   - Monitoring and logs

### Mode Selection
- Dropdown in header (next to GiVi-Solution branding)
- Persists across sessions (localStorage)
- Changes entire navigation and page structure

### Key Architectural Flows

#### 1. AI-Generated Component Flow
```
User → Chat Widget (D-Client)
     → Natural Language Request
     → D-Agent (LLM Interface + Chart Generator)
     → Component Code + Metadata
     → D-Server (Validation + Vulnerability Test)
     → Pass: Notify D-Client → Display Component
     → Fail: Rollback + Notify User
```

#### 2. Component Versioning & Rollback
- All components versioned with metadata
- D-Server tracks component history
- Rollback capability if component fails validation or doesn't work as expected
- Version control in Component Metadata

#### 3. Real-time Notification
```
D-Server (Component Updated)
     → Notifier → WebSocket/SSE
     → D-Client Notifier
     → Update Component Display Window
```

#### 4. Data Flow
```
Component (D-Client)
     → Data Layer (D-Client)
     → Query with Caching
     → External Data Source
     → Cache & Return to Component
```

---

## Technology Stack

### **Server: Go**
- **Language**: Go 1.21+
- **API Framework**: Gin (`github.com/gin-gonic/gin`)
- **Database**: MongoDB (`go.mongodb.org/mongo-driver/mongo`)
- **Job Queue**: Asynq (`github.com/hibiken/asynq`) + Redis
- **OpenAPI/Swagger**: Swag (`github.com/swaggo/swag`, `github.com/swaggo/gin-swagger`)
- **Validation**: go-playground/validator (`github.com/go-playground/validator/v10`)
- **WebSocket**: gorilla/websocket (`github.com/gorilla/websocket`)
- **UUID**: google/uuid (`github.com/google/uuid`)
- **Configuration**: Viper (`github.com/spf13/viper`) - YAML + ENV override

### **Database: MongoDB**
- **Why MongoDB**:
  - Document structure matches data model naturally
  - Schema flexibility for varying metadata/configs
  - Embedded documents (no complex joins)
  - Excellent for versioning (store entire document history)
  - Fast read performance for View Mode
  - Native JSON support
- **Driver**: Official `mongo-go-driver` (no ORM needed)
- **Development**: MongoDB locally or Docker
- **Production**: MongoDB Atlas (managed) or self-hosted

### **Job Queue: Asynq + Redis**
- **Why Asynq over Temporal**:
  - Simpler infrastructure (just Redis, no Temporal server)
  - Lightweight async task processing
  - Built-in retry logic
  - Task persistence
  - Web UI for monitoring
  - Good enough for most workflows
- **Use Cases**:
  - AI chart generation with retries
  - Component validation pipeline
  - Datasource health checks
  - Dashboard update notifications
  - Batch operations
- **Benefits**:
  - Easy to deploy and maintain
  - Redis already needed for caching
  - Can migrate to Temporal later if needed

### **Configuration: YAML + ENV Override**
- **Base Config**: `config/config.yaml` (defaults)
- **Environment Config**: `config/config.{env}.yaml` (dev, prod, test overrides)
- **Environment Variables**: Highest priority (secrets, prod values)
- **Strategy**: Viper with automatic ENV binding
- **Prefix**: `DASHBOARD_` for all environment variables
- **Example**: `DASHBOARD_MONGODB_URI`, `DASHBOARD_LLM_API_KEY`

### **API Documentation: OpenAPI 3.0**
- **Generation**: Swag annotations in Go code
- **UI**: Swagger UI at `/swagger/`
- **Spec**: Auto-generated `swagger.json` and `swagger.yaml`
- **Client Generation**: Support for multiple languages
- **Validation**: Request/response validation from spec

### **Client: React (Unchanged)**
- React 18 + Vite 5
- Carbon Design System (g100 dark theme)
- ECharts + React wrapper
- React Router 6

### **Infrastructure Summary**
```
Development:
├─ Go Server (single binary)
├─ MongoDB (Docker or local)
└─ Redis (Docker or local)

Production:
├─ Go Server (containerized)
├─ MongoDB Atlas (managed) or self-hosted
└─ Redis (managed or self-hosted)

Deployment:
├─ Single Go binary
├─ Config via YAML + ENV
├─ Docker Compose for local dev
└─ Kubernetes ready (ConfigMaps + Secrets)
```

---

## Data Structures

### MongoDB Collections & Models

**Collections:**
- `layouts` - Grid layout definitions
- `datasources` - Data source configurations
- `components` - Chart components (with embedded versions)
- `dashboards` - Dashboard definitions (with embedded panel mappings)
- `chat_sessions` - D-Agent conversation history

### Layout
```go
package models

import (
    "time"
    "go.mongodb.org/mongo-driver/bson/primitive"
)

type Layout struct {
    ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
    Name        string             `bson:"name" json:"name" validate:"required"`
    Description string             `bson:"description" json:"description"`
    Panels      []Panel            `bson:"panels" json:"panels"` // Embedded array
    Config      LayoutConfig       `bson:"config" json:"config"` // Embedded document
    CreatedAt   time.Time          `bson:"created_at" json:"created_at"`
    UpdatedAt   time.Time          `bson:"updated_at" json:"updated_at"`
}

type Panel struct {
    ID        string `bson:"id" json:"id"`
    X         int    `bson:"x" json:"x"`
    Y         int    `bson:"y" json:"y"`
    Width     int    `bson:"width" json:"width"`
    Height    int    `bson:"height" json:"height"`
    MinWidth  int    `bson:"min_width" json:"min_width"`
    MinHeight int    `bson:"min_height" json:"min_height"`
    MaxWidth  int    `bson:"max_width" json:"max_width"`
    MaxHeight int    `bson:"max_height" json:"max_height"`
}

type LayoutConfig struct {
    MaxWidth           int `bson:"max_width" json:"max_width"`
    MaxHeight          int `bson:"max_height" json:"max_height"`
    Spacing            int `bson:"spacing" json:"spacing"`
    DefaultPanelWidth  int `bson:"default_panel_width" json:"default_panel_width"`
    DefaultPanelHeight int `bson:"default_panel_height" json:"default_panel_height"`
}

// MongoDB index definitions
func (Layout) Indexes() []mongo.IndexModel {
    return []mongo.IndexModel{
        {
            Keys:    bson.D{{Key: "name", Value: 1}},
            Options: options.Index().SetUnique(true),
        },
        {
            Keys: bson.D{{Key: "created_at", Value: -1}},
        },
    }
}
```

**JSON Response Example:**
```json
{
  "id": "507f1f77bcf86cd799439011",
  "name": "layout-name",
  "description": "Layout description",
  "panels": [
    {
      "id": "panel-1",
      "x": 0,
      "y": 0,
      "width": 320,
      "height": 256,
      "min_width": 160,
      "min_height": 160,
      "max_width": 1280,
      "max_height": 1280
    }
  ],
  "config": {
    "max_width": 1920,
    "max_height": 1080,
    "spacing": 32,
    "default_panel_width": 320,
    "default_panel_height": 256
  },
  "created_at": "2025-11-20T10:00:00Z",
  "updated_at": "2025-11-20T10:00:00Z"
}
```

### Datasource
```go
type Datasource struct {
    ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
    Name        string             `bson:"name" json:"name" validate:"required"`
    Description string             `bson:"description" json:"description"`
    Type        string             `bson:"type" json:"type" validate:"required,oneof=api websocket file"`
    Config      interface{}        `bson:"config" json:"config"` // Stores type-specific config
    CreatedAt   time.Time          `bson:"created_at" json:"created_at"`
    UpdatedAt   time.Time          `bson:"updated_at" json:"updated_at"`
}

// Type-specific config structures (embedded in Config field)
type APIConfig struct {
    URL             string            `bson:"url" json:"url" validate:"required,url"`
    Method          string            `bson:"method" json:"method" validate:"required,oneof=GET POST PUT DELETE"`
    Headers         map[string]string `bson:"headers" json:"headers"`
    Authentication  AuthConfig        `bson:"authentication" json:"authentication"`
    QueryParams     map[string]string `bson:"query_params" json:"query_params"`
    ResponseMapping ResponseMapping   `bson:"response_mapping" json:"response_mapping"`
}

type WebSocketConfig struct {
    URL            string     `bson:"url" json:"url" validate:"required"`
    Protocol       string     `bson:"protocol" json:"protocol"`
    MessageFormat  string     `bson:"message_format" json:"message_format" validate:"oneof=json text"`
    Authentication AuthConfig `bson:"authentication" json:"authentication"`
}

type FileConfig struct {
    Path            string `bson:"path" json:"path" validate:"required"`
    Format          string `bson:"format" json:"format" validate:"required,oneof=json csv xml"`
    RefreshInterval int    `bson:"refresh_interval" json:"refresh_interval"` // milliseconds
}

type AuthConfig struct {
    Type        string                 `bson:"type" json:"type" validate:"oneof=none bearer basic apikey"`
    Credentials map[string]interface{} `bson:"credentials" json:"credentials"`
}

type ResponseMapping struct {
    DataPath string            `bson:"data_path" json:"data_path"`
    Fields   map[string]string `bson:"fields" json:"fields"`
}

// MongoDB indexes
func (Datasource) Indexes() []mongo.IndexModel {
    return []mongo.IndexModel{
        {
            Keys:    bson.D{{Key: "name", Value: 1}},
            Options: options.Index().SetUnique(true),
        },
        {
            Keys: bson.D{{Key: "type", Value: 1}},
        },
    }
}
```

**JSON Response Example:**
```json
{
  "id": "507f1f77bcf86cd799439012",
  "name": "datasource-name",
  "description": "Datasource description",
  "type": "api",
  "config": {
    "url": "https://api.example.com",
    "method": "GET",
    "headers": {},
    "authentication": {"type": "bearer", "credentials": {}},
    "response_mapping": {"data_path": "data.results", "fields": {}}
  },
  "created_at": "2025-11-20T10:00:00Z",
  "updated_at": "2025-11-20T10:00:00Z"
}
```

### Chart (Component)
```go
type Component struct {
    ID             primitive.ObjectID `bson:"_id,omitempty" json:"id"`
    Name           string             `bson:"name" json:"name" validate:"required"`
    System         string             `bson:"system" json:"system" validate:"required"`
    Source         string             `bson:"source" json:"source" validate:"required"`
    Description    string             `bson:"description" json:"description"`
    ComponentCode  string             `bson:"component_code" json:"component_code" validate:"required"`
    Metadata       ComponentMetadata  `bson:"metadata" json:"metadata"` // Embedded
    CurrentVersion string             `bson:"current_version" json:"current_version"`
    Versions       []ComponentVersion `bson:"versions" json:"versions"` // Embedded array for history
    Validation     ValidationResult   `bson:"validation" json:"validation"` // Embedded
    AIGenerated    bool               `bson:"ai_generated" json:"ai_generated"`
    Prompt         string             `bson:"prompt,omitempty" json:"prompt,omitempty"`
    CreatedAt      time.Time          `bson:"created_at" json:"created_at"`
    UpdatedAt      time.Time          `bson:"updated_at" json:"updated_at"`
}

type ComponentVersion struct {
    Version          string            `bson:"version" json:"version"`
    ComponentCode    string            `bson:"component_code" json:"component_code"`
    Metadata         ComponentMetadata `bson:"metadata" json:"metadata"`
    ValidationStatus string            `bson:"validation_status" json:"validation_status"`
    CreatedAt        time.Time         `bson:"created_at" json:"created_at"`
}

type ValidationResult struct {
    Status          string              `bson:"status" json:"status"` // passed, failed, pending
    LastChecked     time.Time           `bson:"last_checked" json:"last_checked"`
    Vulnerabilities []Vulnerability     `bson:"vulnerabilities" json:"vulnerabilities"`
    Warnings        []string            `bson:"warnings" json:"warnings"`
}

type Vulnerability struct {
    Severity string `bson:"severity" json:"severity"` // high, medium, low
    Pattern  string `bson:"pattern" json:"pattern"`
    Line     int    `bson:"line" json:"line"`
    Message  string `bson:"message" json:"message"`
}

// Metadata structure (embedded)
type ComponentMetadata struct {
    DataSource  map[string]interface{} `bson:"data_source,omitempty" json:"data_source,omitempty"`
    Tags        []string               `bson:"tags" json:"tags"`
    Custom      map[string]interface{} `bson:"custom,omitempty" json:"custom,omitempty"`
    GeneratedAt time.Time              `bson:"generated_at,omitempty" json:"generated_at,omitempty"`
}

// MongoDB indexes
func (Component) Indexes() []mongo.IndexModel {
    return []mongo.IndexModel{
        {
            Keys: bson.D{
                {Key: "system", Value: 1},
                {Key: "source", Value: 1},
                {Key: "name", Value: 1},
            },
            Options: options.Index().SetUnique(true),
        },
        {
            Keys: bson.D{{Key: "ai_generated", Value: 1}},
        },
        {
            Keys: bson.D{{Key: "validation.status", Value: 1}},
        },
    }
}
```

**JSON Response Example:**
```json
{
  "id": "507f1f77bcf86cd799439013",
  "name": "component-name",
  "system": "system-name",
  "source": "source-name",
  "description": "Brief description",
  "component_code": "const Component = () => { ... };",
  "metadata": {
    "data_source": {},
    "tags": ["chart", "line"],
    "custom": {}
  },
  "current_version": "1.2.0",
  "versions": [
    {
      "version": "1.0.0",
      "component_code": "old code",
      "metadata": {},
      "validation_status": "passed",
      "created_at": "2025-11-19T10:00:00Z"
    },
    {
      "version": "1.1.0",
      "component_code": "updated code",
      "metadata": {},
      "validation_status": "passed",
      "created_at": "2025-11-20T09:00:00Z"
    }
  ],
  "validation": {
    "status": "passed",
    "last_checked": "2025-11-20T10:00:00Z",
    "vulnerabilities": [],
    "warnings": []
  },
  "ai_generated": true,
  "prompt": "Create a line chart showing temperature over time",
  "created_at": "2025-11-19T10:00:00Z",
  "updated_at": "2025-11-20T10:00:00Z"
}
```

### Dashboard
```go
type Dashboard struct {
    ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
    Name        string             `bson:"name" json:"name" validate:"required"`
    Description string             `bson:"description" json:"description"`
    LayoutID    primitive.ObjectID `bson:"layout_id" json:"layout_id"`
    Panels      []DashboardPanel   `bson:"panels" json:"panels"` // Embedded array
    CreatedAt   time.Time          `bson:"created_at" json:"created_at"`
    UpdatedAt   time.Time          `bson:"updated_at" json:"updated_at"`
}

type DashboardPanel struct {
    PanelID         string      `bson:"panel_id" json:"panel_id"` // References Layout.Panel.ID
    ChartID         string      `bson:"chart_id" json:"chart_id"` // References Component.ID
    DatasourceID    string      `bson:"datasource_id,omitempty" json:"datasource_id,omitempty"`
    DataMapping     DataMapping `bson:"data_mapping" json:"data_mapping"` // Embedded
    RefreshInterval int         `bson:"refresh_interval" json:"refresh_interval"` // milliseconds
}

type DataMapping struct {
    Fields      []string               `bson:"fields" json:"fields"`
    Filters     map[string]interface{} `bson:"filters" json:"filters"`
    Aggregation string                 `bson:"aggregation" json:"aggregation" validate:"oneof=none sum avg min max"`
}

// MongoDB indexes
func (Dashboard) Indexes() []mongo.IndexModel {
    return []mongo.IndexModel{
        {
            Keys:    bson.D{{Key: "name", Value: 1}},
            Options: options.Index().SetUnique(true),
        },
        {
            Keys: bson.D{{Key: "layout_id", Value: 1}},
        },
        {
            Keys: bson.D{{Key: "panels.chart_id", Value: 1}},
        },
    }
}
```

**JSON Response Example:**
```json
{
  "id": "507f1f77bcf86cd799439014",
  "name": "dashboard-name",
  "description": "Dashboard description",
  "layout_id": "507f1f77bcf86cd799439011",
  "panels": [
    {
      "panel_id": "panel-1",
      "chart_id": "507f1f77bcf86cd799439013",
      "datasource_id": "507f1f77bcf86cd799439012",
      "data_mapping": {
        "fields": ["temperature", "timestamp"],
        "filters": {"facility": "Factory-A"},
        "aggregation": "avg"
      },
      "refresh_interval": 5000
    }
  ],
  "created_at": "2025-11-20T10:00:00Z",
  "updated_at": "2025-11-20T10:00:00Z"
}
```

### Chat Session (for D-Agent Context Memory)
```go
type ChatSession struct {
    ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
    UserID    string             `bson:"user_id" json:"user_id"`
    Context   string             `bson:"context" json:"context"` // "chart-creation", "dashboard-design"
    Messages  []ChatMessage      `bson:"messages" json:"messages"` // Embedded array
    Metadata  map[string]interface{} `bson:"metadata,omitempty" json:"metadata,omitempty"`
    CreatedAt time.Time          `bson:"created_at" json:"created_at"`
    UpdatedAt time.Time          `bson:"updated_at" json:"updated_at"`
}

type ChatMessage struct {
    Role      string    `bson:"role" json:"role"` // "user", "assistant", "system"
    Content   string    `bson:"content" json:"content"`
    Timestamp time.Time `bson:"timestamp" json:"timestamp"`
}

// MongoDB indexes
func (ChatSession) Indexes() []mongo.IndexModel {
    return []mongo.IndexModel{
        {
            Keys: bson.D{{Key: "user_id", Value: 1}, {Key: "created_at", Value: -1}},
        },
    }
}
```

---


## Asynq Tasks & Job Processing

### Async Task Processing with Asynq

**Asynq** (https://github.com/hibiken/asynq) is a lightweight, Redis-based distributed task queue that provides:
- Automatic retries with exponential backoff
- Task persistence (survives server restarts)
- Priority queues (critical, default, low)
- Web UI for monitoring tasks
- Much simpler infrastructure than Temporal

### Task Types

1. **Chart Generation** - AI-powered chart creation with validation
2. **Component Validation** - Security scanning and code validation
3. **Datasource Health** - Periodic health checks
4. **Dashboard Updates** - Notify clients of changes

### Benefits Over Temporal

- ✅ Simpler infrastructure (just Redis, no additional servers)
- ✅ Easy to deploy and operate
- ✅ Built-in web UI for monitoring
- ✅ Automatic retries with configurable backoff
- ✅ Task persistence in Redis
- ✅ Good enough for most use cases
- ✅ Can migrate to Temporal later if needed

### Implementation Details

See **[ASYNQ_TASKS.md](./ASYNQ_TASKS.md)** for:
- Complete task definitions
- Handler implementations
- Worker setup
- API integration examples
- Monitoring and debugging
- Periodic task scheduling (cron jobs)

### Quick Example

```go
// Enqueue task from API
task, _ := tasks.NewChartGenerationTask(tasks.ChartGenerationPayload{
    Prompt: "Create a line chart showing temperature",
    UserID: "user-123",
})
client.Enqueue(task)

// Handler (runs in worker)
func HandleChartGeneration(ctx context.Context, t *asynq.Task) error {
    // 1. Generate metadata
    // 2. Call LLM to generate code
    // 3. Validate component
    // 4. Save to MongoDB
    // 5. Notify client via WebSocket
    return nil
}
```

---

## Configuration Management

### YAML Configuration with ENV Override

Configuration uses Viper with three-layer hierarchy:

1. **Base Config** (`config/config.yaml`) - Default values
2. **Environment Config** (`config/config.{env}.yaml`) - Environment-specific overrides
3. **Environment Variables** (`DASHBOARD_*`) - Runtime overrides (highest priority)

### Configuration Structure

```yaml
# config/config.yaml
server:
  port: 3001
  host: 0.0.0.0
  mode: release
  read_timeout: 30s
  write_timeout: 30s

mongodb:
  uri: mongodb://localhost:27017
  database: dashboard
  connection_timeout: 10s
  max_pool_size: 100

redis:
  addr: localhost:6379
  password: ""
  db: 0
  pool_size: 10

asynq:
  concurrency: 10
  queues:
    critical: 6
    default: 3
    low: 1
  retry_max_attempts: 3

websocket:
  read_buffer_size: 1024
  write_buffer_size: 1024
  ping_interval: 30s

llm:
  provider: anthropic
  api_key: ${LLM_API_KEY}  # From environment
  model: claude-sonnet-4-5
  max_tokens: 4096
  temperature: 0.7

validation:
  max_code_size: 100000
  dangerous_patterns:
    - eval
    - Function
    - innerHTML

layout:
  spacing: 32  # $spacing-08
  max_width: 1920
  max_height: 1080
  default_panel_width: 320
  default_panel_height: 256

logging:
  level: info
  format: json
  output: stdout

cors:
  allowed_origins:
    - http://localhost:5173
  allowed_methods:
    - GET
    - POST
    - PUT
    - DELETE

swagger:
  enabled: true
  title: Dashboard API
  version: 1.0
```

### Environment Variable Override

```bash
# Override MongoDB URI
export DASHBOARD_MONGODB_URI="mongodb://prod:27017"

# Override LLM API key  
export DASHBOARD_LLM_API_KEY="sk-ant-..."

# Override server port
export DASHBOARD_SERVER_PORT=8080

# Nested values use underscores
export DASHBOARD_SERVER_MODE="release"
export DASHBOARD_REDIS_PASSWORD="secret"
```

### Go Configuration Loading

```go
package config

import (
    "github.com/spf13/viper"
)

type Config struct {
    Server     ServerConfig     `mapstructure:"server"`
    MongoDB    MongoDBConfig    `mapstructure:"mongodb"`
    Redis      RedisConfig      `mapstructure:"redis"`
    Asynq      AsynqConfig      `mapstructure:"asynq"`
    WebSocket  WebSocketConfig  `mapstructure:"websocket"`
    LLM        LLMConfig        `mapstructure:"llm"`
    Validation ValidationConfig `mapstructure:"validation"`
    Layout     LayoutConfig     `mapstructure:"layout"`
    Logging    LoggingConfig    `mapstructure:"logging"`
    CORS       CORSConfig       `mapstructure:"cors"`
    Swagger    SwaggerConfig    `mapstructure:"swagger"`
}

func Load() (*Config, error) {
    viper.SetConfigName("config")
    viper.SetConfigType("yaml")
    viper.AddConfigPath("./config")
    viper.AddConfigPath(".")

    if err := viper.ReadInConfig(); err != nil {
        return nil, err
    }

    // Load environment-specific config
    env := viper.GetString("ENV")
    if env == "" {
        env = "development"
    }

    viper.SetConfigName(fmt.Sprintf("config.%s", env))
    viper.MergeInConfig()  // Merge, don't replace

    // Enable ENV variable override
    viper.AutomaticEnv()
    viper.SetEnvPrefix("DASHBOARD")
    viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))

    var cfg Config
    if err := viper.Unmarshal(&cfg); err != nil {
        return nil, err
    }

    return &cfg, nil
}
```

### Docker / Kubernetes Deployment

```yaml
# docker-compose.yml
services:
  dashboard:
    image: dashboard-server:latest
    environment:
      - ENV=production
      - DASHBOARD_MONGODB_URI=mongodb://mongo:27017
      - DASHBOARD_REDIS_ADDR=redis:6379
      - DASHBOARD_LLM_API_KEY=${LLM_API_KEY}
    volumes:
      - ./config:/app/config:ro

# Kubernetes ConfigMap + Secret
apiVersion: v1
kind: ConfigMap
metadata:
  name: dashboard-config
data:
  config.production.yaml: |
    server:
      port: 3001
---
apiVersion: v1
kind: Secret
metadata:
  name: dashboard-secrets
stringData:
  DASHBOARD_LLM_API_KEY: sk-ant-...
  DASHBOARD_MONGODB_URI: mongodb://...
```

---

## File Structure

### Data Storage
```
data/
├── index.json (existing - components registry)
├── layouts/
│   ├── index.json
│   └── {layout-id}.json
├── datasources/
│   ├── index.json
│   └── {datasource-id}.json
├── dashboards/
│   ├── index.json
│   └── {dashboard-id}.json
└── {system}/{source}/ (existing - charts/components)
    └── {component}.json
```

### Client Structure
```
client/src/
├── App.jsx (updated with mode switching)
├── config/
│   └── layoutConfig.js (spacing, dimensions)
├── pages/
│   ├── design/
│   │   ├── LayoutsListPage.jsx
│   │   ├── LayoutDetailPage.jsx
│   │   ├── DatasourcesListPage.jsx
│   │   ├── DatasourceDetailPage.jsx
│   │   ├── ChartsListPage.jsx (migrate from ChartDesignPage)
│   │   ├── ChartDetailPage.jsx
│   │   ├── DashboardsListPage.jsx
│   │   └── DashboardDetailPage.jsx
│   ├── view/
│   │   ├── DashboardsListPage.jsx
│   │   └── DashboardViewPage.jsx
│   ├── manage/
│   │   └── ManagePage.jsx (placeholder)
│   └── [existing pages for backward compatibility]
├── components/
│   ├── mode/
│   │   └── ModeSelector.jsx
│   ├── navigation/
│   │   ├── DesignModeNav.jsx
│   │   ├── ViewModeNav.jsx
│   │   └── ManageModeNav.jsx
│   ├── layout/
│   │   ├── LayoutBuilder.jsx
│   │   ├── Panel.jsx
│   │   └── PanelControls.jsx
│   ├── dashboard/
│   │   ├── DashboardDesigner.jsx
│   │   ├── PanelEditor.jsx
│   │   └── DatasourcePicker.jsx
│   ├── list/
│   │   ├── ListViewTable.jsx
│   │   └── ActionMenu.jsx (three-dot menu)
│   └── [existing components]
└── hooks/
    ├── useLayouts.js
    ├── useDatasources.js
    └── useDashboards.js
```

### Server Structure
```
server/
├── api/
│   ├── layouts.js (new)
│   ├── datasources.js (enhance existing)
│   ├── dashboards.js (new)
│   ├── components.js (existing)
│   └── chat.js (new - D-Agent interface)
├── storage/
│   ├── layoutManager.js (new)
│   ├── datasourceManager.js (new)
│   ├── dashboardManager.js (new)
│   └── fileManager.js (existing)
├── services/
│   ├── dataLayerService.js (existing)
│   ├── datasourceService.js (existing)
│   ├── validationService.js (new)
│   ├── versioningService.js (new)
│   └── notificationService.js (new)
├── agent/
│   ├── agentCore.js (D-Agent core logic)
│   ├── metadataGenerator.js (generates component metadata)
│   ├── chartGenerator.js (generates React chart code)
│   ├── dataLayerGenerator.js (generates data layer integration)
│   ├── contextMemory.js (maintains conversation context)
│   └── mcpConnector.js (MCP integration - existing)
└── mcp/
    ├── mcpServer.js (existing)
    ├── mcpSSE.js (existing)
    └── componentSpec.js (existing)
```

---

## Implementation Phases

### Phase 1: Foundation & Configuration
**Goal**: Set up configuration system and mode switching infrastructure

1. Create `client/src/config/layoutConfig.js`
   - Define `$spacing-08` equivalent (32px)
   - Max layout dimensions (1920x1080)
   - Default panel size (320x256)
   - Min/max panel dimensions
   - Grid snap settings

2. Update `App.jsx`
   - Add mode state (design|view|manage)
   - Add ModeSelector dropdown in header
   - Conditional navigation rendering
   - Mode persistence (localStorage)

3. Create navigation components
   - `DesignModeNav.jsx` (4 sections)
   - `ViewModeNav.jsx` (placeholder)
   - `ManageModeNav.jsx` (placeholder)

**Deliverables**:
- ✅ Configuration system
- ✅ Mode switching UI
- ✅ Navigation framework

---

### Phase 2: Layouts System
**Goal**: Implement layout creation and editing

1. Server-side
   - Create `server/storage/layoutManager.js`
   - Create `server/api/layouts.js`
   - Endpoints: GET, POST, PUT, DELETE `/api/layouts`
   - Create `data/layouts/` directory and index

2. Client-side hooks
   - Create `hooks/useLayouts.js`
   - CRUD operations for layouts

3. Layouts List Page
   - Table with Name, Description, Last Modified
   - Three-dot menu: Create, View, Edit, Delete
   - Navigation to detail page

4. Layout Detail Page
   - Header with layout name
   - "+" icon to add new panel
   - Empty panels rendered on canvas
   - Panel controls:
     - Drag handle (center, circle with X)
     - Resize handle (bottom-right corner)
     - Snap to grid ($spacing-08 increments)
   - Save/Cancel buttons with confirmation dialogs

5. Layout Builder Component
   - Canvas with configurable max dimensions
   - Panel positioning logic
   - Auto-placement algorithm (top-left available space)
   - Collision detection
   - Grid snapping

**Deliverables**:
- ✅ Layout data structure
- ✅ Layout CRUD API
- ✅ Layout List/Detail pages
- ✅ Drag-and-drop layout builder

---

### Phase 3: Datasources System
**Goal**: Implement datasource configuration

1. Server-side
   - Enhance `server/storage/datasourceManager.js`
   - Enhance `server/api/datasources.js`
   - Support API, WebSocket, File types
   - Create `data/datasources/` directory and index

2. Client-side hooks
   - Create `hooks/useDatasources.js`
   - CRUD operations for datasources

3. Datasources List Page
   - Table with Name, Type, Description, Last Modified
   - Three-dot menu: Create, View, Edit, Delete

4. Datasource Detail Page
   - Type selector dropdown (API, WebSocket, File)
   - Type-specific configuration forms
   - Type immutability after save
   - Confirmation dialog on type change with unsaved data
   - Save/Cancel buttons

5. Type-specific forms
   - **API Form**: URL, method, headers, auth, query params, response mapping
   - **WebSocket Form**: URL, protocol, message format, auth
   - **File Form**: Path, format, refresh interval

**Deliverables**:
- ✅ Datasource data structure
- ✅ Datasource CRUD API
- ✅ Datasource List/Detail pages
- ✅ Type-specific configuration forms

---

### Phase 4: Charts Migration
**Goal**: Migrate existing Chart Design into Design Mode

1. Create Charts List Page
   - Migrate functionality from `ChartDesignPage.jsx`
   - Table with Name, System, Source, Description, Last Modified
   - Three-dot menu: Create, View, Edit, Delete
   - Filter by system/source

2. Create Chart Detail Page
   - Migrate ComponentViewer/ComponentEditor
   - Keep existing dynamic component functionality
   - AI-assisted chart creation (existing)

3. Update navigation
   - Add "Charts" to Design Mode nav
   - Route to new Charts pages

**Deliverables**:
- ✅ Charts List/Detail pages in Design Mode
- ✅ Existing chart functionality preserved
- ✅ Navigation updated

---

### Phase 5: Dashboards System
**Goal**: Implement dashboard designer combining layouts, charts, and datasources

1. Server-side
   - Create `server/storage/dashboardManager.js`
   - Create `server/api/dashboards.js`
   - Endpoints: GET, POST, PUT, DELETE `/api/dashboards`
   - Create `data/dashboards/` directory and index

2. Client-side hooks
   - Create `hooks/useDashboards.js`
   - CRUD operations for dashboards

3. Dashboards List Page
   - Table with Name, Description, Datasources (comma-separated), Last Modified
   - Three-dot menu: Create, View, Edit, Delete

4. Dashboard Detail Page - Create/Edit Flow
   - **Top Left**: Template dropdown
     - List existing layouts
     - "Define Layout" option
   - **Top Left Icons**: Layout/Dashboard mode toggle
     - Layout icon: Switch to layout builder submode
     - Dashboard icon: Switch to dashboard designer submode

5. Layout Builder Submode (within Dashboard Designer)
   - Full layout builder (same as Layouts section)
   - "Save Layout" button to save for reuse
   - Switch to Dashboard submode to configure panels

6. Dashboard Designer Submode
   - Show selected layout with panels
   - Each panel has 3 icons (top-right):
     - **Datasource icon**: Open datasource picker dialog
     - **Chart type icon**: Open chart picker dialog
     - **AI icon**: Open AI chat for custom chart generation
   - All 3 icons always available (can change anytime)
   - Save/Cancel buttons

7. Panel Configuration
   - **Datasource Picker Dialog**:
     - List available datasources
     - Show datasource fields/schema
     - Select fields to use in chart
     - Configure filters/aggregations
   - **Chart Picker Dialog**:
     - List available charts from Charts library
     - Preview chart
     - Select chart for panel
   - **AI Chat Dialog**:
     - Conversational interface
     - Send datasource + chart type to agent
     - Agent generates chart component
     - Preview and accept/modify

8. Live Preview in Design Mode
   - Populate panels with sample/live data
   - Render charts in panels
   - Show data connections

**Deliverables**:
- ✅ Dashboard data structure
- ✅ Dashboard CRUD API
- ✅ Dashboard List/Detail pages
- ✅ Layout/Dashboard submode switching
- ✅ Panel configuration UI
- ✅ Datasource/Chart pickers
- ✅ AI chat integration
- ✅ Live preview with data

---

### Phase 6: View Mode
**Goal**: Implement live dashboard viewing

1. View Mode Navigation
   - List of available dashboards
   - Filter/search dashboards

2. Dashboard View Page
   - Load dashboard configuration
   - Load layout
   - Render charts in panels
   - Connect to datasources
   - Live data updates
   - Responsive layout

3. Real-time Updates
   - WebSocket connections
   - Polling for API datasources
   - Auto-refresh at configured intervals

**Deliverables**:
- ✅ Dashboard viewer
- ✅ Live data rendering
- ✅ Real-time updates

---

### Phase 7: D-Agent Integration & Security
**Goal**: Implement AI-powered chart generation with validation and versioning

1. **Validation Service** (`server/services/validationService.js`)
   - Component code validation (syntax, exports)
   - Security vulnerability scanning
   - Detect dangerous patterns (eval, innerHTML, etc.)
   - Check for required exports (Component/Widget)
   - Validate metadata schema

2. **Versioning Service** (`server/services/versioningService.js`)
   - Version numbering (semantic versioning)
   - Store version history
   - Rollback to previous versions
   - Compare versions
   - Track validation status per version

3. **Notification Service** (`server/services/notificationService.js`)
   - WebSocket/SSE server setup
   - Client connection management
   - Broadcast component updates
   - Notify on validation results
   - Real-time status updates

4. **D-Agent Core** (`server/agent/`)
   - **agentCore.js** - Main agent orchestration
   - **metadataGenerator.js** - Generate component metadata from conversation
   - **chartGenerator.js** - Generate React chart code using LLM
   - **dataLayerGenerator.js** - Generate data layer integration code
   - **contextMemory.js** - Maintain conversation history and context
   - **mcpConnector.js** - Enhanced MCP integration

5. **Chat API** (`server/api/chat.js`)
   - POST `/api/chat/message` - Send message to D-Agent
   - GET `/api/chat/history/:sessionId` - Get conversation history
   - POST `/api/chat/session` - Create new chat session
   - DELETE `/api/chat/session/:sessionId` - End session

6. **Client Chat Widget**
   - Create `components/chat/ChatWidget.jsx`
   - Message input and history
   - Thinking/loading states
   - Component preview
   - Accept/Reject generated component
   - Request modifications

7. **Component Validation Flow**
   - D-Agent generates component
   - Validation service checks for vulnerabilities
   - If passed: Save with version, notify client
   - If failed: Return errors to chat, allow retry
   - Rollback option if deployed component fails

8. **Integration Points**
   - Add Chat Widget to Dashboard Designer (AI icon)
   - Add Chat Widget to Charts section (create new chart)
   - Add validation to component save flow
   - Add version history viewer to Chart Detail page
   - Add rollback UI to Chart Detail page

**Deliverables**:
- ✅ Validation and vulnerability scanning
- ✅ Component versioning system
- ✅ Real-time notification system (WebSocket/SSE)
- ✅ D-Agent core with LLM integration
- ✅ Chat widget UI
- ✅ AI-powered chart generation flow
- ✅ Rollback capability

---

### Phase 8: Manage Mode
**Goal**: Create administration interface for system management

1. **Manage Mode Navigation**
   - Component Management
   - Security & Validation
   - System Settings
   - Monitoring & Logs

2. **Component Management Page**
   - View all components with versions
   - Validation status for each component
   - Bulk operations (re-validate, rollback)
   - Component usage tracking (which dashboards use it)

3. **Security & Validation Page**
   - Validation rules configuration
   - Vulnerability scan results
   - Failed validation log
   - Security policies

4. **System Settings Page**
   - Layout configuration (spacing, max dimensions)
   - AI/LLM settings (model, temperature, etc.)
   - Notification settings
   - Data layer cache settings

5. **Monitoring & Logs Page**
   - System health metrics
   - Component generation logs
   - Validation logs
   - Data source connection status
   - Error logs

**Deliverables**:
- ✅ Manage Mode navigation
- ✅ Component management interface
- ✅ Security management interface
- ✅ System settings editor
- ✅ Monitoring dashboard

---

## UI/UX Specifications

### Carbon Design System Usage
- All UI components use Carbon Design System (g100 dark theme)
- Spacing based on `$spacing-08` (32px)
- Colors: Carbon design tokens
- Icons: `@carbon/icons-react`

### List View Pattern
All list pages (Layouts, Datasources, Charts, Dashboards) share common pattern:
- Carbon DataTable with sortable columns
- Columns: Name, Description, Last Modified (+ type/system specific)
- Three-dot OverflowMenu on each row
- Actions: Create (header), View, Edit, Delete (row menus)
- Confirmation dialogs for destructive actions

### Detail Page Pattern
- Page header with resource name
- Action buttons in top-right (Save/Cancel)
- Confirmation dialogs if unsaved changes
- Form validation
- Error handling and display

### Layout Builder Controls
- **Add Panel**: "+" icon in page header
  - Drops panel in top-left available space
  - Default size from config
- **Move Panel**: Click/drag center handle (circle with X)
  - Shows ghost outline while dragging
  - Snaps to grid
  - Collision detection
- **Resize Panel**: Click/drag bottom-right corner
  - Respects min/max dimensions
  - Snaps to grid increments
  - Shows dimensions while resizing

### Dashboard Designer Controls
- **Mode Toggle**: Icons in top-left
  - Layout icon (grid): Switch to layout builder
  - Dashboard icon (chart): Switch to dashboard designer
- **Panel Icons**: Top-right of each panel
  - Datasource icon (database)
  - Chart icon (chart-line-smooth)
  - AI icon (watson/ai)
  - Icons persist after selection (can change anytime)

---

## Technical Considerations

### Grid System
- Base unit: `$spacing-08` = 32px
- All positioning/sizing in multiples of 32px
- Canvas coordinates: pixels
- Snap to grid on drag/resize

### State Management
- React hooks for local state
- Context for mode state (if needed)
- localStorage for mode persistence
- Server as source of truth for all resources

### API Design
RESTful endpoints for all resources:
```
GET    /api/layouts          - List all layouts
GET    /api/layouts/:id      - Get layout by ID
POST   /api/layouts          - Create layout
PUT    /api/layouts/:id      - Update layout
DELETE /api/layouts/:id      - Delete layout

GET    /api/datasources      - List all datasources
GET    /api/datasources/:id  - Get datasource by ID
POST   /api/datasources      - Create datasource
PUT    /api/datasources/:id  - Update datasource
DELETE /api/datasources/:id  - Delete datasource

GET    /api/dashboards       - List all dashboards
GET    /api/dashboards/:id   - Get dashboard by ID
POST   /api/dashboards       - Create dashboard
PUT    /api/dashboards/:id   - Update dashboard
DELETE /api/dashboards/:id   - Delete dashboard

POST   /api/chat/message     - Send message to D-Agent
POST   /api/chat/session     - Create chat session
GET    /api/chat/history/:id - Get chat history
DELETE /api/chat/session/:id - End chat session

POST   /api/components/:id/rollback/:version - Rollback to version
GET    /api/components/:id/versions - Get version history

[Existing /api/components endpoints remain unchanged]
```

### Security & Validation

#### Component Validation (D-Server)
**Validation checks before component deployment:**

1. **Syntax Validation**
   - Valid JavaScript/JSX syntax
   - No parsing errors
   - Proper React component structure

2. **Export Validation**
   - Must export `Component` or `Widget`
   - Export is a valid React component

3. **Security Scanning**
   - **Dangerous patterns blocked:**
     - `eval()`, `Function()` constructor
     - `innerHTML`, `dangerouslySetInnerHTML` (without sanitization)
     - `<script>` tags
     - Dynamic imports of external URLs
     - File system access attempts
     - Process/OS access
   - **Allowed patterns:**
     - React hooks (useState, useEffect, etc.)
     - ECharts rendering
     - Data fetching via Data Layer only
     - Carbon components

4. **Dependency Validation**
   - Only allowed dependencies available
   - No external package imports
   - Use only approved APIs

5. **Metadata Validation**
   - Required fields present
   - Valid datasource references
   - Proper field mappings

**Validation Response:**
```json
{
  "valid": true|false,
  "errors": [],
  "warnings": [],
  "vulnerabilities": [
    {
      "severity": "high|medium|low",
      "pattern": "eval()",
      "line": 42,
      "message": "Use of eval() is prohibited"
    }
  ]
}
```

#### Code Execution Sandbox (D-Client)
- Components run in browser sandbox
- Same-origin policy enforced
- No access to parent window context
- Data layer provides controlled data access
- No direct external network access from components

#### Versioning for Safety
- All component changes create new version
- Rollback to any previous version
- Track which dashboards use which versions
- Can test new version before deployment
- Atomic updates (all or nothing)

### Error Handling
- Form validation on client
- Schema validation on server
- User-friendly error messages
- Rollback on save failures
- Validation errors shown in chat widget
- Detailed error logs in Manage Mode

### Performance
- Lazy load panels/charts
- Debounce drag/resize updates
- Cache datasource responses
- Optimize re-renders with React.memo
- WebSocket connection pooling
- Component code caching

---

## Migration Strategy

### Backward Compatibility
- Existing components/charts remain functional
- Old routes redirect to new structure
- Existing data files preserved
- No breaking changes to component format

### Migration Steps
1. Add new features alongside existing
2. Update navigation to include both old and new
3. Migrate users gradually
4. Eventually deprecate old routes

---

## Testing Strategy

### Unit Tests
- Layout positioning logic
- Grid snapping algorithms
- Collision detection
- Data structure validation

### Integration Tests
- CRUD operations for all resources
- Mode switching
- Navigation flow
- Data persistence

### E2E Tests
- Create layout → Create dashboard flow
- Configure datasource → Connect to dashboard
- Create chart → Add to dashboard
- View dashboard with live data

---

## Future Enhancements

### Phase 8+
- User authentication and authorization
- Dashboard sharing and permissions
- Dashboard versioning
- Component marketplace
- Dashboard templates library
- Advanced data transformations
- Custom themes
- Export/import dashboards
- Collaborative editing
- Dashboard analytics
- Mobile responsive layouts

---

## Open Questions

1. **D-Agent LLM Connection**:
   - Should we use the existing MCP SSE setup for LLM communication?
   - Or implement a direct API connection to Claude?
   - What's the optimal way to pass Chart Spec and context?

2. **Component Validation Depth**:
   - How strict should vulnerability scanning be?
   - Should we use static analysis libraries (ESLint, etc.)?
   - Allow user override of warnings (but not errors)?

3. **Datasource Authentication**:
   - Should credentials be encrypted at rest?
   - Use environment variables for sensitive data?
   - Implement secrets management system?

4. **Real-time Notification Protocol**:
   - WebSocket vs Server-Sent Events (SSE)?
   - Current system uses SSE for MCP - extend that?
   - Connection persistence and reconnection strategy?

5. **Multi-user Considerations**:
   - Should we plan for concurrent editing?
   - Lock mechanism for resources being edited?
   - Conflict resolution strategy?

6. **Dashboard/Layout Versioning**:
   - Should dashboards and layouts also be versioned?
   - Currently only components have versioning
   - Would add complexity but improve safety

7. **Template Library**:
   - Should we provide pre-built layouts?
   - Pre-built chart templates beyond examples?
   - Template marketplace/sharing?

8. **Context Memory Persistence**:
   - Should D-Agent conversation history persist across sessions?
   - Store in file system like other resources?
   - Per-user or per-component?

9. **Rollback UI Flow**:
   - Should rollback be automatic on validation failure?
   - Or require user confirmation?
   - Show diff between versions before rollback?

10. **Data Layer Security**:
    - How to prevent components from accessing unauthorized datasources?
    - Role-based access control for datasources?
    - Audit log for data access?

---

## Success Criteria

### Server-Side (Go) - COMPLETE ✅
- ✅ Layouts API (CRUD endpoints)
- ✅ Datasources API (SQL, CSV, Socket, API adapters)
- ✅ Components API (React component storage)
- ✅ Dashboards API (Combining layouts + components)
- ✅ MongoDB integration with indexes
- ✅ Redis integration
- ✅ Configuration system (YAML + ENV override)
- ✅ Swagger documentation
- ✅ Health checks

### Client-Side - NOT STARTED ❌

#### Core Functionality
- ❌ Users can create layouts with drag-and-drop panels
- ❌ Users can configure datasources (API, WebSocket, File)
- ❌ Users can create/edit charts (existing functionality preserved)
- ❌ Users can create dashboards combining layouts + charts + datasources
- ❌ Users can view live dashboards with real-time data
- ❌ Mode switching (Design/View/Manage) is seamless
- ❌ Data persists correctly via API calls to server

#### AI & Security (D-Agent)
- ❌ Users can generate charts via natural language chat
- ❌ D-Agent generates valid React components with metadata
- ❌ All generated components pass validation before deployment
- ❌ Security vulnerabilities are detected and blocked
- ❌ Components are versioned automatically
- ❌ Users can rollback to previous versions
- ❌ Real-time notifications work (component updates, validation results)

#### User Experience
- ❌ Clean, intuitive UI following Carbon Design System (g100 dark theme)
- ❌ Chat interface is conversational and helpful
- ❌ Validation errors are clear and actionable
- ❌ All existing functionality continues to work
- ❌ No breaking changes to existing components

#### System Health
- ❌ Components run safely in browser sandbox
- ❌ No security vulnerabilities in generated code
- ❌ System handles validation failures gracefully
- ❌ Performance is acceptable (lazy loading, caching work)
- ❌ Error messages are user-friendly

---

## Architecture Diagram Integration

This refactoring plan integrates the architecture diagram (`dashboard-component-diagram.png`) which defines:

**Key Integration Points:**

1. **D-Agent System** - New AI agent subsystem
   - Metadata Generator & Validator
   - React Chart Generator & Validator
   - LLM Interface (external Claude integration)
   - MCP Connector (existing, enhanced)
   - Data Layer Integration Generator
   - Chat Capability
   - Context Memory

2. **D-Server Enhancements**
   - Component Validation / Vulnerability Test (new security layer)
   - Process Manager (component lifecycle)
   - Notifier (real-time client updates)
   - Template Library Manager

3. **D-Client Components**
   - Chat Interaction Widget (conversational UI)
   - Component Display Window (existing, enhanced)
   - Notifier (receive updates)
   - Data Layer (existing, enhanced)

4. **Resource Definitions** (inputs to system)
   - Chart Spec (existing componentSpec.js)
   - Chart, Dashboard, Layout Definitions (new data structures)
   - Component Metadata with Versioning (enhanced)
   - Source Definition (datasources)

5. **External Systems**
   - LLM (Claude API via MCP)
   - Chart Library (reference examples)
   - Data Source (API/WebSocket/File)

**Flow Integration:**
- User interacts via Chat Widget → D-Agent
- D-Agent generates component using LLM + Chart Spec
- D-Server validates and tests for vulnerabilities
- Pass: Deploy and notify client
- Fail: Return to chat with errors, allow retry/rollback
- Client receives notification and displays component

This architecture ensures:
- **Safety**: All AI-generated code is validated
- **Traceability**: Versioning and rollback capability
- **User Control**: Conversational refinement of components
- **Real-time Updates**: Notification system keeps UI in sync

---

**Document Version**: 2.0
**Last Updated**: 2025-11-20
**Status**: Ready for Implementation
**Architecture**: Integrated with dashboard-component-diagram.png
