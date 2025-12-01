package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/tviviano/dashboard/config"
	"github.com/tviviano/dashboard/internal/database"
	"github.com/tviviano/dashboard/internal/handlers"
	"github.com/tviviano/dashboard/internal/mcp"
	"github.com/tviviano/dashboard/internal/repository"
	"github.com/tviviano/dashboard/internal/service"

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
	layoutRepo := repository.NewLayoutRepository(mongodb.Database)
	datasourceRepo := repository.NewDatasourceRepository(mongodb.Database)
	componentRepo := repository.NewComponentRepository(mongodb.Database)
	chartRepo := repository.NewChartRepository(mongodb.Database)
	dashboardRepo := repository.NewDashboardRepository(mongodb.Database)

	// Create chart indexes
	if err := chartRepo.CreateIndexes(ctx); err != nil {
		log.Printf("Warning: Failed to create chart indexes: %v", err)
	}

	// Initialize services
	layoutService := service.NewLayoutService(layoutRepo)
	datasourceService := service.NewDatasourceService(datasourceRepo)
	componentService := service.NewComponentService(componentRepo)
	chartService := service.NewChartService(chartRepo)
	dashboardService := service.NewDashboardService(dashboardRepo)

	// Initialize handlers
	layoutHandler := handlers.NewLayoutHandler(layoutService)
	datasourceHandler := handlers.NewDatasourceHandler(datasourceService)
	componentHandler := handlers.NewComponentHandler(componentService)
	chartHandler := handlers.NewChartHandler(chartService)
	dashboardHandler := handlers.NewDashboardHandler(dashboardService)

	// Initialize MCP
	mcpRegistry := mcp.NewToolRegistry(datasourceService, dashboardService, chartService)
	mcpHandler := mcp.NewHandler(mcpRegistry)

	// API routes
	api := router.Group("/api")
	{
		// Health check
		api.GET("/health", healthCheck(mongodb, redisClient))

		// Layout routes
		layouts := api.Group("/layouts")
		{
			layouts.POST("", layoutHandler.CreateLayout)
			layouts.GET("", layoutHandler.ListLayouts)
			layouts.GET("/:id", layoutHandler.GetLayout)
			layouts.PUT("/:id", layoutHandler.UpdateLayout)
			layouts.DELETE("/:id", layoutHandler.DeleteLayout)
		}

		// Datasource routes
		datasources := api.Group("/datasources")
		{
			datasources.POST("", datasourceHandler.CreateDatasource)
			datasources.GET("", datasourceHandler.ListDatasources)
			datasources.GET("/:id", datasourceHandler.GetDatasource)
			datasources.PUT("/:id", datasourceHandler.UpdateDatasource)
			datasources.DELETE("/:id", datasourceHandler.DeleteDatasource)
			datasources.POST("/test", datasourceHandler.TestDatasource)
			datasources.POST("/:id/health", datasourceHandler.CheckDatasourceHealth)
			datasources.POST("/:id/query", datasourceHandler.QueryDatasource)
		}

		// Component routes (legacy - being replaced by charts)
		components := api.Group("/components")
		{
			components.GET("/systems", componentHandler.GetSystems)
			components.POST("", componentHandler.CreateComponent)
			components.GET("", componentHandler.ListComponents)
			components.GET("/:id", componentHandler.GetComponent)
			components.PUT("/:id", componentHandler.UpdateComponent)
			components.DELETE("/:id", componentHandler.DeleteComponent)
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

		// TODO: Add more routes in future phases
		// chat := api.Group("/chat")
	}

	// MCP routes (outside /api group)
	mcpHandler.SetupRoutes(router.Group(""))

	// Swagger documentation
	if cfg.Swagger.Enabled {
		router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
		fmt.Println("✓ Swagger UI enabled at http://localhost:3001/swagger/index.html")
	}

	fmt.Println("✓ MCP SSE endpoint enabled at http://localhost:3001/mcp/sse")

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
