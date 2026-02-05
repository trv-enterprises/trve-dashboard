// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/tviviano/dashboard/config"
	"github.com/tviviano/dashboard/internal/ai"
	"github.com/tviviano/dashboard/internal/database"
	"github.com/tviviano/dashboard/internal/handlers"
	"github.com/tviviano/dashboard/internal/hub"
	"github.com/tviviano/dashboard/internal/mcp"
	"github.com/tviviano/dashboard/internal/middleware"
	"github.com/tviviano/dashboard/internal/repository"
	"github.com/tviviano/dashboard/internal/service"
	"github.com/tviviano/dashboard/internal/streaming"

	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	_ "github.com/tviviano/dashboard/docs" // Swagger docs
)

// @title GiVi-Solution Dashboard API
// @version 1.0
// @description Dashboard system with AI-powered chart generation
// @contact.name Dashboard Team
// @contact.email support@example.com
// @host localhost:3001
// @BasePath /api
func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Set Gin mode
	if cfg.Server.Mode == "release" {
		gin.SetMode(gin.ReleaseMode)
	} else {
		gin.SetMode(gin.DebugMode)
	}

	// Initialize MongoDB
	mongodb, err := database.NewMongoDB(cfg.MongoDB)
	if err != nil {
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}
	defer mongodb.Disconnect()

	// Create indexes
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := mongodb.CreateIndexes(ctx); err != nil {
		log.Fatalf("Failed to create MongoDB indexes: %v", err)
	}

	// Initialize Redis
	redisClient, err := database.NewRedis(cfg.Redis)
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	defer redisClient.Close()

	// Create Gin router
	router := gin.Default()

	// Setup CORS
	router.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.CORS.AllowedOrigins,
		AllowMethods:     cfg.CORS.AllowedMethods,
		AllowHeaders:     cfg.CORS.AllowedHeaders,
		ExposeHeaders:    cfg.CORS.ExposeHeaders,
		AllowCredentials: cfg.CORS.AllowCredentials,
		MaxAge:           time.Duration(cfg.CORS.MaxAge) * time.Second,
	}))

	// Health check endpoint
	router.GET("/health", healthCheck(mongodb, redisClient))

	// Initialize repositories
	datasourceRepo := repository.NewDatasourceRepository(mongodb.Database)
	chartRepo := repository.NewChartRepository(mongodb.Database)
	dashboardRepo := repository.NewDashboardRepository(mongodb.Database)
	aiSessionRepo := repository.NewAISessionRepository(redisClient.Client)
	configRepo := repository.NewConfigRepository(mongodb.Database)
	userRepo := repository.NewUserRepository(mongodb.Database)
	settingsRepo := repository.NewSettingsItemRepository(mongodb.Database)

	// Create chart indexes
	if err := chartRepo.CreateIndexes(ctx); err != nil {
		log.Printf("Warning: Failed to create chart indexes: %v", err)
	}

	// Create config indexes
	if err := configRepo.CreateIndexes(ctx); err != nil {
		log.Printf("Warning: Failed to create config indexes: %v", err)
	}

	// Create user indexes
	if err := userRepo.CreateIndexes(ctx); err != nil {
		log.Printf("Warning: Failed to create user indexes: %v", err)
	}

	// Create settings indexes
	if err := settingsRepo.CreateIndexes(ctx); err != nil {
		log.Printf("Warning: Failed to create settings indexes: %v", err)
	}

	// Initialize services
	datasourceService := service.NewDatasourceService(datasourceRepo)
	chartService := service.NewChartService(chartRepo)
	dashboardService := service.NewDashboardService(dashboardRepo, mongodb.Database)
	aiSessionService := service.NewAISessionService(aiSessionRepo, chartRepo)
	configService := service.NewConfigService(configRepo, cfg)
	userService := service.NewUserService(userRepo)

	// Load user-configurable settings from separate YAML file
	userConfig, err := config.LoadUserConfigurableSettings()
	if err != nil {
		log.Printf("Warning: Failed to load user-configurable settings: %v", err)
		userConfig = nil // Will use empty settings
	}
	settingsService := service.NewSettingsService(settingsRepo, userConfig)

	// Sync user-configurable settings from YAML file to MongoDB on startup
	if err := settingsService.SyncSettingsFromConfig(ctx); err != nil {
		log.Printf("Warning: Failed to sync settings from config: %v", err)
	} else {
		fmt.Println("✓ User-configurable settings synced to MongoDB")
	}

	// Seed pseudo users (Admin, Designer, Support)
	if err := userService.SeedPseudoUsers(ctx); err != nil {
		log.Printf("Warning: Failed to seed pseudo users: %v", err)
	} else {
		fmt.Println("✓ Pseudo users seeded (Admin, Designer, Support)")
	}

	// Get the global ChartHub for real-time chart update broadcasts
	chartHub := hub.GetChartHub()
	fmt.Println("✓ ChartHub initialized for real-time chart updates")

	// Initialize StreamManager for socket datasource streaming
	streamManager := streaming.NewManager(datasourceRepo, streaming.DefaultManagerConfig())
	fmt.Println("✓ StreamManager initialized for socket datasource streaming")

	// Initialize inbound WebSocket handler for ts-store push connections
	inboundHandler := streaming.GetInboundHandler()
	_ = inboundHandler // Used in routes below
	fmt.Println("✓ InboundHandler initialized for ts-store push connections")

	// Initialize AI agent (optional - requires ANTHROPIC_API_KEY)
	toolExecutor := ai.NewToolExecutor(chartRepo, datasourceRepo, datasourceService, chartHub)
	var aiAgent *ai.Agent
	agent, err := ai.NewAgent(toolExecutor, aiSessionService, nil) // nil uses default config
	if err != nil {
		log.Printf("⚠️  AI Agent disabled: %v", err)
		log.Printf("   Set ANTHROPIC_API_KEY environment variable to enable AI features")
	} else {
		aiAgent = agent
		fmt.Println("✓ AI Agent enabled (Anthropic SDK)")
	}

	// Initialize handlers
	datasourceHandler := handlers.NewDatasourceHandler(datasourceService)
	chartHandler := handlers.NewChartHandler(chartService)
	dashboardHandler := handlers.NewDashboardHandler(dashboardService)
	aiSessionHandler := handlers.NewAISessionHandler(aiSessionService, aiAgent, chartHub)
	debugHandler := handlers.NewDebugHandler()
	streamHandler := handlers.NewStreamHandler(streamManager)
	configHandler := handlers.NewConfigHandler(configService)
	authHandler := handlers.NewAuthHandler(userService)
	settingsHandler := handlers.NewSettingsHandler(settingsService)

	// Initialize auth middleware
	authMiddleware := middleware.NewAuthMiddleware(userService)

	// Initialize MCP
	mcpRegistry := mcp.NewToolRegistry(datasourceService, dashboardService, chartService)
	mcpHandler := mcp.NewHandler(mcpRegistry)

	// API routes with authentication and authorization middleware
	api := router.Group("/api")
	api.Use(authMiddleware.Authenticate()) // Authenticate all API requests
	api.Use(authMiddleware.Authorize())    // Check route permissions
	{
		// Health check
		api.GET("/health", healthCheck(mongodb, redisClient))

		// Auth routes (for getting current user capabilities)
		auth := api.Group("/auth")
		{
			auth.GET("/me", authHandler.GetMe)
		}

		// User management routes (admin only - enforced by middleware)
		users := api.Group("/users")
		{
			users.GET("", authHandler.ListUsers)
			users.GET("/:id", authHandler.GetUser)
			users.POST("", authHandler.CreateUser)
			users.PUT("/:id", authHandler.UpdateUser)
			users.DELETE("/:id", authHandler.DeleteUser)
		}

		// Datasource routes
		datasources := api.Group("/datasources")
		{
			datasources.POST("", datasourceHandler.CreateDatasource)
			datasources.GET("", datasourceHandler.ListDatasources)
			datasources.GET("/streams", streamHandler.ListActiveStreams) // Before /:id to avoid conflict
			datasources.GET("/:id", datasourceHandler.GetDatasource)
			datasources.PUT("/:id", datasourceHandler.UpdateDatasource)
			datasources.DELETE("/:id", datasourceHandler.DeleteDatasource)
			datasources.POST("/test", datasourceHandler.TestDatasource)
			datasources.POST("/:id/health", datasourceHandler.CheckDatasourceHealth)
			datasources.POST("/:id/query", datasourceHandler.QueryDatasource)
			datasources.GET("/:id/schema", datasourceHandler.GetDatasourceSchema)
			datasources.GET("/:id/prometheus/labels/:label/values", datasourceHandler.GetPrometheusLabelValues) // Prometheus label values
			datasources.GET("/:id/edgelake/databases", datasourceHandler.GetEdgeLakeDatabases)                     // EdgeLake databases
			datasources.GET("/:id/edgelake/tables", datasourceHandler.GetEdgeLakeTables)                           // EdgeLake tables
			datasources.GET("/:id/edgelake/schema", datasourceHandler.GetEdgeLakeSchema)                           // EdgeLake table schema
			datasources.GET("/:id/stream", streamHandler.StreamDatasource)                                      // SSE streaming
			datasources.GET("/:id/stream/status", streamHandler.GetStreamStatus)                 // Stream status
			datasources.POST("/:id/stream/aggregated", streamHandler.StreamAggregatedDatasource) // SSE aggregated streaming
			datasources.GET("/aggregators", streamHandler.GetAggregatorStats)                    // Aggregator stats
		}

		// Chart routes
		charts := api.Group("/charts")
		{
			charts.GET("/summaries", chartHandler.GetChartSummaries)
			charts.POST("", chartHandler.CreateChart)
			charts.GET("", chartHandler.ListCharts)
			charts.GET("/:id", chartHandler.GetChart)
			charts.PUT("/:id", chartHandler.UpdateChart)
			charts.DELETE("/:id", chartHandler.DeleteChart)
			// Versioning endpoints
			charts.GET("/:id/versions", chartHandler.ListChartVersions)
			charts.GET("/:id/versions/:version", chartHandler.GetChartVersion)
			charts.DELETE("/:id/versions/:version", chartHandler.DeleteChartVersion)
			charts.GET("/:id/version-info", chartHandler.GetChartVersionInfo)
			charts.GET("/:id/draft", chartHandler.GetChartDraft)
			charts.DELETE("/:id/draft", chartHandler.DeleteChartDraft)
		}

		// Dashboard routes
		dashboards := api.Group("/dashboards")
		{
			dashboards.POST("", dashboardHandler.CreateDashboard)
			dashboards.GET("", dashboardHandler.ListDashboards)
			dashboards.GET("/:id", dashboardHandler.GetDashboard)
			dashboards.PUT("/:id", dashboardHandler.UpdateDashboard)
			dashboards.DELETE("/:id", dashboardHandler.DeleteDashboard)
		}

		// AI Session routes
		aiSessions := api.Group("/ai/sessions")
		{
			aiSessions.POST("", aiSessionHandler.CreateSession)
			aiSessions.GET("/:id", aiSessionHandler.GetSession)
			aiSessions.POST("/:id/messages", aiSessionHandler.SendMessage)
			aiSessions.GET("/:id/ws", aiSessionHandler.HandleWebSocket)
			aiSessions.POST("/:id/save", aiSessionHandler.SaveSession)
			aiSessions.DELETE("/:id", aiSessionHandler.CancelSession)
		}

		// AI Debug routes
		aiDebug := api.Group("/ai/debug")
		{
			aiDebug.GET("", debugHandler.HandleDebugWebSocket)
			aiDebug.GET("/status", debugHandler.GetDebugStatus)
		}

		// Config routes
		configRoutes := api.Group("/config")
		{
			configRoutes.GET("/system", configHandler.GetSystemConfig)
			configRoutes.PUT("/system", configHandler.UpdateSystemConfig)
			configRoutes.GET("/user/:user_id", configHandler.GetUserConfig)
			configRoutes.PUT("/user/:user_id", configHandler.UpdateUserConfig)
		}

		// Settings routes (new settings management system)
		settingsHandler.RegisterRoutes(api)
	}

	// MCP routes (outside /api group)
	mcpHandler.SetupRoutes(router.Group(""))

	// Inbound WebSocket endpoint for ts-store push connections (outside /api group, no auth required)
	// ts-store dials out to this endpoint to push data
	router.GET("/api/streams/inbound/:datasourceId", inboundHandler.HandleInboundWebSocket)

	// Swagger documentation
	if cfg.Swagger.Enabled {
		router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
		fmt.Println("✓ Swagger UI enabled at http://localhost:3001/swagger/index.html")
	}

	fmt.Println("✓ MCP SSE endpoint enabled at http://localhost:3001/mcp/sse")
	fmt.Println("✓ AI Debug WebSocket enabled at ws://localhost:3001/api/ai/debug")
	fmt.Println("✓ TSStore inbound WebSocket at ws://localhost:3001/api/streams/inbound/:datasourceId")

	// Static file serving for SPA (production mode)
	if cfg.StaticFiles.Enabled {
		staticPath := cfg.StaticFiles.Path
		if !filepath.IsAbs(staticPath) {
			// Make relative paths relative to the server-go directory
			staticPath = filepath.Join(".", staticPath)
		}

		// Verify the static files directory exists
		if _, err := os.Stat(staticPath); os.IsNotExist(err) {
			log.Printf("⚠️  Static files directory not found: %s", staticPath)
			log.Printf("   Run 'npm run build' in the client directory to create it")
		} else {
			// Serve static files for any route not matched by API endpoints
			router.NoRoute(func(c *gin.Context) {
				path := c.Request.URL.Path

				// Skip API routes - they should return 404 if not found
				if strings.HasPrefix(path, "/api/") || strings.HasPrefix(path, "/mcp/") || strings.HasPrefix(path, "/swagger/") {
					c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
					return
				}

				// Try to serve the exact file
				filePath := filepath.Join(staticPath, path)
				if info, err := os.Stat(filePath); err == nil && !info.IsDir() {
					c.File(filePath)
					return
				}

				// For SPA routing: serve index.html for all other routes
				indexPath := filepath.Join(staticPath, "index.html")
				c.File(indexPath)
			})

			// Serve static assets directory
			router.Static("/assets", filepath.Join(staticPath, "assets"))

			fmt.Printf("✓ Static file serving enabled from %s\n", staticPath)
		}
	}

	// Create HTTP server
	srv := &http.Server{
		Addr:         fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port),
		Handler:      router,
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
	}

	// Start server in goroutine
	go func() {
		fmt.Printf("\n🚀 Dashboard Server starting on http://%s:%d\n", cfg.Server.Host, cfg.Server.Port)
		fmt.Printf("📡 Mode: %s\n", cfg.Server.Mode)
		fmt.Printf("📊 MongoDB: %s\n", cfg.MongoDB.Database)
		fmt.Printf("⚡ Redis: %s\n", cfg.Redis.Addr)
		fmt.Println("\nPress Ctrl+C to stop\n")

		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal for graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	fmt.Println("\n🛑 Shutting down server...")

	// Stop StreamManager
	streamManager.Stop()
	fmt.Println("✓ StreamManager stopped")

	// Graceful shutdown
	ctx, cancel = context.WithTimeout(context.Background(), cfg.Server.ShutdownTimeout)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}

	fmt.Println("✓ Server stopped gracefully")
}

// healthCheck returns a health check handler
// @Summary Health check
// @Description Check if the server and dependencies are healthy
// @Tags System
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 503 {object} map[string]interface{}
// @Router /health [get]
func healthCheck(mongodb *database.MongoDB, redis *database.Redis) gin.HandlerFunc {
	return func(c *gin.Context) {
		status := gin.H{
			"status":    "ok",
			"timestamp": time.Now().Format(time.RFC3339),
			"services":  gin.H{},
		}

		// Check MongoDB
		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()

		if err := mongodb.Client.Ping(ctx, nil); err != nil {
			status["status"] = "degraded"
			status["services"].(gin.H)["mongodb"] = gin.H{
				"status": "unhealthy",
				"error":  err.Error(),
			}
		} else {
			status["services"].(gin.H)["mongodb"] = gin.H{
				"status": "healthy",
			}
		}

		// Check Redis
		if err := redis.Client.Ping(ctx).Err(); err != nil {
			status["status"] = "degraded"
			status["services"].(gin.H)["redis"] = gin.H{
				"status": "unhealthy",
				"error":  err.Error(),
			}
		} else {
			status["services"].(gin.H)["redis"] = gin.H{
				"status": "healthy",
			}
		}

		// Return appropriate status code
		if status["status"] == "ok" {
			c.JSON(http.StatusOK, status)
		} else {
			c.JSON(http.StatusServiceUnavailable, status)
		}
	}
}
