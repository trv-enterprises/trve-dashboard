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
	dashboardRepo := repository.NewDashboardRepository(mongodb.Database)

	// Initialize services
	layoutService := service.NewLayoutService(layoutRepo)
	datasourceService := service.NewDatasourceService(datasourceRepo)
	componentService := service.NewComponentService(componentRepo)
	dashboardService := service.NewDashboardService(dashboardRepo, layoutRepo, componentRepo)

	// Initialize handlers
	layoutHandler := handlers.NewLayoutHandler(layoutService)
	datasourceHandler := handlers.NewDatasourceHandler(datasourceService)
	componentHandler := handlers.NewComponentHandler(componentService)
	dashboardHandler := handlers.NewDashboardHandler(dashboardService)

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

		// Component routes
		components := api.Group("/components")
		{
			components.GET("/systems", componentHandler.GetSystems)
			components.POST("", componentHandler.CreateComponent)
			components.GET("", componentHandler.ListComponents)
			components.GET("/:id", componentHandler.GetComponent)
			components.PUT("/:id", componentHandler.UpdateComponent)
			components.DELETE("/:id", componentHandler.DeleteComponent)
		}

		// Dashboard routes
		dashboards := api.Group("/dashboards")
		{
			dashboards.POST("", dashboardHandler.CreateDashboard)
			dashboards.GET("", dashboardHandler.ListDashboards)
			dashboards.GET("/:id", dashboardHandler.GetDashboard)
			dashboards.GET("/:id/details", dashboardHandler.GetDashboardWithDetails)
			dashboards.PUT("/:id", dashboardHandler.UpdateDashboard)
			dashboards.DELETE("/:id", dashboardHandler.DeleteDashboard)
		}

		// TODO: Add more routes in future phases
		// chat := api.Group("/chat")
	}

	// Swagger documentation
	if cfg.Swagger.Enabled {
		router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
		fmt.Println("✓ Swagger UI enabled at http://localhost:3001/swagger/index.html")
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
