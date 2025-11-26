# Dashboard Server (Go) - Architecture Documentation

## Overview

The GiVi-Solution Dashboard server is a Go-based backend built with a clean, layered architecture following domain-driven design principles. The server provides REST APIs for managing layouts, components, datasources, and dashboards, with MongoDB for persistence and Redis for caching.

## Technology Stack

- **Language**: Go 1.23.12
- **Web Framework**: Gin (HTTP routing and middleware)
- **Database**: MongoDB 7 (document storage)
- **Cache**: Redis 7 (caching layer)
- **Configuration**: Viper (YAML + environment variables)
- **API Documentation**: Swagger/OpenAPI (swaggo)
- **Dependencies**:
  - `github.com/google/uuid` v1.6.0 - UUID generation
  - `github.com/gorilla/websocket` v1.5.3 - WebSocket support
  - `github.com/lib/pq` v1.10.9 - PostgreSQL driver
  - `github.com/go-sql-driver/mysql` v1.9.3 - MySQL driver
  - `github.com/mattn/go-sqlite3` v1.14.32 - SQLite driver

## Project Structure

```
server-go/
├── cmd/
│   ├── server/          # Main application entry point
│   │   └── main.go      # Server initialization and routing
│   ├── worker/          # Background worker (Asynq)
│   └── asynqmon/        # Asynq monitoring UI
├── config/
│   └── config.yaml      # Base configuration
├── internal/
│   ├── database/        # Database connections
│   │   ├── mongodb.go   # MongoDB client
│   │   └── redis.go     # Redis client
│   ├── models/          # Domain models
│   │   ├── layout.go
│   │   ├── component.go
│   │   ├── datasource.go
│   │   └── dashboard.go
│   ├── repository/      # Data access layer
│   │   ├── layout_repository.go
│   │   ├── component_repository.go
│   │   ├── datasource_repository.go
│   │   └── dashboard_repository.go
│   ├── service/         # Business logic layer
│   │   ├── layout_service.go
│   │   ├── component_service.go
│   │   ├── datasource_service.go
│   │   └── dashboard_service.go
│   ├── handlers/        # HTTP handlers
│   │   ├── layout_handler.go
│   │   ├── component_handler.go
│   │   ├── datasource_handler.go
│   │   └── dashboard_handler.go
│   └── datasource/      # Datasource adapters
│       ├── sql.go
│       ├── csv.go
│       ├── socket.go
│       ├── api.go
│       └── factory.go
├── docs/                # Swagger documentation (auto-generated)
└── bin/                 # Compiled binaries

```

## Architecture Layers

### 1. HTTP Layer (Handlers)

Handles HTTP requests and responses. Responsibilities:
- Request validation and binding
- Response formatting
- Error handling and status codes
- Swagger annotations

**Pattern**: Each entity (Layout, Component, Datasource, Dashboard) has its own handler.

**Example**: `internal/handlers/dashboard_handler.go`
```go
type DashboardHandler struct {
    service *service.DashboardService
}

func (h *DashboardHandler) CreateDashboard(c *gin.Context) {
    var req models.CreateDashboardRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    dashboard, err := h.service.CreateDashboard(c.Request.Context(), &req)
    // ... handle error and return response
}
```

### 2. Service Layer

Contains business logic and orchestration. Responsibilities:
- Input validation
- Business rules enforcement
- Cross-entity validation
- Transaction coordination
- Error handling

**Pattern**: Services depend on one or more repositories.

**Example**: `internal/service/dashboard_service.go`
```go
type DashboardService struct {
    repo          *repository.DashboardRepository
    layoutRepo    *repository.LayoutRepository  // For validation
    componentRepo *repository.ComponentRepository  // For validation
}

func (s *DashboardService) CreateDashboard(ctx context.Context, req *models.CreateDashboardRequest) (*models.Dashboard, error) {
    // Validate layout exists
    layout, err := s.layoutRepo.FindByID(ctx, req.LayoutID)
    if layout == nil {
        return nil, fmt.Errorf("layout '%s' not found", req.LayoutID)
    }

    // Validate components exist
    // Validate panels exist in layout
    // ... business logic

    return s.repo.Create(ctx, req)
}
```

### 3. Repository Layer

Handles data persistence and retrieval. Responsibilities:
- MongoDB CRUD operations
- Query construction
- Index management
- Data mapping (domain models <-> MongoDB documents)

**Pattern**: Each entity has its own repository with a MongoDB collection.

**Example**: `internal/repository/dashboard_repository.go`
```go
type DashboardRepository struct {
    collection *mongo.Collection
}

func (r *DashboardRepository) Create(ctx context.Context, req *models.CreateDashboardRequest) (*models.Dashboard, error) {
    dashboard := &models.Dashboard{
        ID:          uuid.New().String(),
        Name:        req.Name,
        LayoutID:    req.LayoutID,
        Components:  req.Components,
        Created:     time.Now(),
        Updated:     time.Now(),
    }

    _, err := r.collection.InsertOne(ctx, dashboard)
    return dashboard, err
}
```

### 4. Models Layer

Defines domain entities and data structures. Responsibilities:
- Domain model definitions
- Request/response DTOs
- Validation tags (binding, bson, json)
- Swagger annotations

**Pattern**: One file per entity with all related types.

**Example**: `internal/models/dashboard.go`
```go
type Dashboard struct {
    ID          string                 `json:"id" bson:"_id"`
    Name        string                 `json:"name" bson:"name" binding:"required"`
    LayoutID    string                 `json:"layout_id" bson:"layout_id" binding:"required"`
    Components  []DashboardComponent   `json:"components" bson:"components"`
    Settings    DashboardSettings      `json:"settings" bson:"settings"`
    Created     time.Time              `json:"created" bson:"created"`
    Updated     time.Time              `json:"updated" bson:"updated"`
}
```

## Domain Entities

### 1. Layouts

**Purpose**: Define the grid structure and panel positions for dashboards.

**Collections**: `layouts`

**Key Concepts**:
- 12-column grid system with configurable row height
- Panels positioned with x, y, width, height
- Grid unit of 32px (Carbon Design $spacing-08)
- Validation ensures panels don't overlap and stay within bounds

**API**: `/api/layouts`

### 2. Components

**Purpose**: Store React component code as reusable widgets.

**Collections**: `components`

**Key Concepts**:
- System/Source organization (e.g., "visualization/charts")
- JSX/React code stored as strings
- Metadata for tags, categories, visualization config
- Unique names within system/source

**API**: `/api/components`

### 3. Datasources

**Purpose**: Unified interface for connecting to various data sources.

**Collections**: `datasources`

**Key Concepts**:
- Four datasource types: SQL, CSV, Socket, API
- Adapter pattern with unified `DataSource` interface
- Query normalization into `ResultSet`
- Connection pooling and health checks

**API**: `/api/datasources`

**Architecture**:
```
DataSource Interface (Query/Stream/Close)
    ↓
Adapters: SQLDataSource | CSVDataSource | SocketDataSource | APIDataSource
    ↓
DataSourceFactory (creates instances from config)
```

### 4. Dashboards

**Purpose**: Combine layouts and components into complete dashboard configurations.

**Collections**: `dashboards`

**Key Concepts**:
- References layout by ID
- Maps components to specific panels
- Dashboard-level settings (theme, refresh, timezone)
- Cross-entity validation (layout exists, components exist, panels valid)

**API**: `/api/dashboards`

**Relationships**:
```
Dashboard
    ├── layout_id → Layout (1:1)
    └── components[] → DashboardComponent
            ├── component_id → Component (N:1)
            └── panel_id → Panel in Layout (N:1)
```

## Data Flow

### Example: Creating a Dashboard

```
1. HTTP Request
   POST /api/dashboards
   Body: { name, layout_id, components[] }
   ↓
2. Handler Layer (dashboard_handler.go)
   - Bind JSON to CreateDashboardRequest
   - Validate request structure
   ↓
3. Service Layer (dashboard_service.go)
   - Validate layout exists (via layoutRepo)
   - Validate all components exist (via componentRepo)
   - Validate all panel IDs exist in layout
   - Check dashboard name uniqueness
   ↓
4. Repository Layer (dashboard_repository.go)
   - Generate UUID for dashboard
   - Generate UUIDs for dashboard components
   - Insert into MongoDB
   ↓
5. MongoDB
   - Store in "dashboards" collection
   ↓
6. Response
   { id, name, layout_id, components, created, updated }
```

## Cross-Entity Validation

The service layer enforces referential integrity:

1. **Dashboards → Layouts**: Validates layout_id exists in layouts collection
2. **Dashboards → Components**: Validates all component_ids exist in components collection
3. **Dashboards → Panels**: Validates all panel_ids exist in the referenced layout's panels array
4. **Name Uniqueness**: Dashboards, layouts, and components enforce unique names

This validation prevents:
- Dangling references
- Broken dashboards with missing layouts/components
- Components mapped to non-existent panels

## Configuration

Configuration uses Viper with cascading priority:

1. Environment variables (highest)
2. `config/config.yaml` (base)

**Example**:
```yaml
server:
  host: 0.0.0.0
  port: 3001
  mode: debug

mongodb:
  uri: mongodb://localhost:27017
  database: dashboard

redis:
  addr: localhost:6379
  db: 0

cors:
  allowed_origins:
    - http://localhost:5173
```

## Database Design

### MongoDB Collections

1. **layouts**
   - Primary key: `_id` (UUID string)
   - Indexes: `name` (unique), `updated_at`

2. **components**
   - Primary key: `_id` (UUID string)
   - Indexes: `{ system, source, name }` (unique compound), `updated`

3. **datasources**
   - Primary key: `_id` (UUID string)
   - Indexes: `name` (unique), `type`, `updated_at`

4. **dashboards**
   - Primary key: `_id` (UUID string)
   - Indexes: `name` (unique), `settings.is_public`, `updated`

### Redis Cache

Currently used for:
- Session data (future)
- Rate limiting (future)
- Temporary data storage

## API Design

### REST Conventions

All APIs follow RESTful conventions:

- `POST /api/{entity}` - Create
- `GET /api/{entity}` - List (with pagination)
- `GET /api/{entity}/:id` - Get by ID
- `PUT /api/{entity}/:id` - Update
- `DELETE /api/{entity}/:id` - Delete

### Pagination

List endpoints support pagination:
```
GET /api/dashboards?page=1&page_size=20

Response:
{
  "dashboards": [...],
  "total": 42,
  "page": 1,
  "page_size": 20
}
```

### Error Handling

Standard error format:
```json
{
  "error": "dashboard with name 'Test' already exists"
}
```

HTTP status codes:
- `200` - Success
- `201` - Created
- `204` - No Content (delete success)
- `400` - Bad Request (validation errors)
- `404` - Not Found
- `500` - Internal Server Error

## Swagger Documentation

Swagger docs are auto-generated from code annotations:

```go
// @Summary Create a new dashboard
// @Description Create a new dashboard combining layout and components
// @Tags dashboards
// @Accept json
// @Produce json
// @Param dashboard body models.CreateDashboardRequest true "Dashboard data"
// @Success 201 {object} models.Dashboard
// @Failure 400 {object} map[string]interface{}
// @Router /dashboards [post]
func (h *DashboardHandler) CreateDashboard(c *gin.Context) { ... }
```

**Regenerate docs**:
```bash
$GOPATH/bin/swag init -g cmd/server/main.go -d ./ -o docs
```

**View docs**: http://localhost:3001/swagger/index.html

## Development Workflow

### Starting the Server

```bash
# Start MongoDB and Redis
docker compose up -d mongodb redis

# Build and run server
go build -o bin/server cmd/server/main.go
./bin/server

# Or use Make
make run
```

### Adding a New Entity

1. **Create model**: `internal/models/new_entity.go`
   - Define struct with json/bson tags
   - Add request/response DTOs
   - Add Swagger annotations

2. **Create repository**: `internal/repository/new_entity_repository.go`
   - Implement CRUD operations
   - Use MongoDB collection
   - Handle errors

3. **Create service**: `internal/service/new_entity_service.go`
   - Implement business logic
   - Add validation
   - Inject required repositories

4. **Create handler**: `internal/handlers/new_entity_handler.go`
   - Implement HTTP handlers
   - Add Swagger annotations
   - Handle request/response

5. **Add routes**: `cmd/server/main.go`
   - Initialize repo, service, handler
   - Register routes in API group

6. **Regenerate Swagger**: Run swag init

7. **Test**: Create test data, verify CRUD operations

## Security Considerations

- **Input Validation**: All inputs validated at handler layer
- **MongoDB Injection**: Using parameterized queries (bson.M)
- **CORS**: Configurable allowed origins
- **Rate Limiting**: Planned with Redis
- **Authentication**: Planned for future phases

## Performance Considerations

- **MongoDB Indexes**: Created on frequently queried fields
- **Connection Pooling**: MongoDB driver handles connection pooling
- **Context Timeouts**: All DB operations use context with timeouts
- **Pagination**: Prevents loading large datasets into memory
- **Streaming**: Datasource adapters support streaming for large datasets

## Testing Strategy

### Unit Tests
- Service layer: Business logic validation
- Repository layer: MongoDB operations (use testcontainers)
- Handlers: HTTP request/response handling (use httptest)

### Integration Tests
- End-to-end API tests
- Cross-entity validation
- MongoDB integration

### Load Tests
- Concurrent request handling
- Database connection pooling
- Memory usage under load

## Deployment

### Environment Variables

```bash
SERVER_HOST=0.0.0.0
SERVER_PORT=3001
MONGODB_URI=mongodb://mongo:27017
MONGODB_DATABASE=dashboard
REDIS_ADDR=redis:6379
```

### Docker Deployment

```bash
# Build image
docker build -t dashboard-server .

# Run with docker-compose
docker compose up -d
```

## Future Enhancements

1. **Authentication & Authorization**: JWT-based auth, role-based access control
2. **Caching Layer**: Redis caching for frequently accessed data
3. **Real-time Updates**: WebSocket support for live dashboard updates
4. **Metrics & Monitoring**: Prometheus metrics, distributed tracing
5. **Data Versioning**: Component and dashboard versioning
6. **Audit Logging**: Track all create/update/delete operations
7. **Bulk Operations**: Batch create/update/delete endpoints
8. **Search**: Full-text search across components and dashboards
9. **Export/Import**: Dashboard templates and sharing

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Development status and phase completion
- [docs/REFACTOR_PLAN.md](./REFACTOR_PLAN.md) - 8-phase refactoring plan
- [Swagger UI](http://localhost:3001/swagger/index.html) - Interactive API documentation

---

**Last Updated**: 2025-11-20
**Version**: 1.0 (Phases 1-5 Complete)
