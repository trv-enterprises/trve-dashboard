# GiVi-Solution Dashboard Architecture

## System Overview

GiVi-Solution Dashboard is a full-stack application for creating, managing, and viewing dynamic data visualization dashboards. The application supports real-time data from multiple sources and features an AI-powered chart generation system.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACE                                  │
│                     React 18 + Vite + Carbon Design System                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │   Design Mode   │  │    View Mode    │  │   Manage Mode   │             │
│  │                 │  │                 │  │                 │             │
│  │ - Layouts       │  │ - Dashboard     │  │ - Settings      │             │
│  │ - Data Sources  │  │   Viewer        │  │ - Users         │             │
│  │ - Charts        │  │ - Real-time     │  │ - System Config │             │
│  │ - Dashboards    │  │   Data Updates  │  │                 │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ REST API (Port 3001)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              GO BACKEND                                      │
│                         Gin Framework + Swagger                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                           API Layer                                  │   │
│  │  /api/layouts  /api/datasources  /api/components  /api/dashboards   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Service Layer                                │   │
│  │  Layout Service │ Datasource Service │ Component Service │ Dashboard │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       Repository Layer                               │   │
│  │  MongoDB CRUD Operations │ Index Management │ Aggregation Pipelines  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌───────────┐   ┌───────────┐   ┌───────────────┐
            │  MongoDB  │   │   Redis   │   │ Data Sources  │
            │   (7.x)   │   │  (7.x)    │   │ SQL/API/CSV/  │
            │           │   │           │   │ WebSocket     │
            └───────────┘   └───────────┘   └───────────────┘
```

## Technology Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.x | UI Framework |
| Vite | 5.x | Build Tool & Dev Server |
| React Router | 6.x | Client-side Routing |
| Carbon Design System | 11.x | UI Component Library (g100 dark theme) |
| ECharts | 5.x | Data Visualization |
| echarts-for-react | 3.x | React wrapper for ECharts |
| SCSS | - | Styling with Carbon tokens |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Go | 1.23.x | Primary Language |
| Gin | 1.x | HTTP Framework |
| MongoDB Driver | 1.x | Database Operations |
| Redis | 7.x | Caching & Job Queue |
| Swaggo | 1.8.x | OpenAPI/Swagger Generation |
| Viper | 1.x | Configuration Management |

### Infrastructure
| Technology | Version | Purpose |
|------------|---------|---------|
| MongoDB | 7.x | Primary Database |
| Redis | 7.x | Cache & Background Jobs |
| Docker | - | Containerization |
| Docker Compose | - | Local Development |

## Application Modes

The dashboard operates in three distinct modes, each with its own navigation and functionality:

### 1. Design Mode
Create and configure dashboard components:
- **Layouts**: Define grid-based panel layouts (12-column system)
- **Data Sources**: Configure connections to SQL, API, CSV, WebSocket sources
- **Charts/Components**: Build React components with ECharts visualizations
- **Dashboards**: Combine layouts with components, configure settings

### 2. View Mode
End-user dashboard viewing experience:
- Dashboard selection from sidebar tiles
- Real-time data updates
- Auto-refresh based on dashboard settings
- Fullscreen viewing capability

### 3. Manage Mode (Future)
System administration:
- User configuration
- System settings
- Access control

## Data Model

### Core Entities

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA RELATIONSHIPS                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Layout    │◄────────│  Dashboard  │────────►│  Component  │
│             │         │             │         │             │
│ - id        │         │ - id        │         │ - id        │
│ - name      │         │ - name      │         │ - name      │
│ - rows      │         │ - layout_id │         │ - system    │
│ - panels[]  │         │ - components│         │ - source    │
│   - id      │         │   - comp_id │         │ - code      │
│   - x,y,w,h │         │   - panel_id│         │ - metadata  │
└─────────────┘         │ - settings  │         └─────────────┘
                        └─────────────┘                 │
                                                        │
                        ┌─────────────┐                 │
                        │ Data Source │◄────────────────┘
                        │             │      (referenced by component)
                        │ - id        │
                        │ - name      │
                        │ - type      │
                        │ - config    │
                        └─────────────┘
```

### Layout Schema
```json
{
  "id": "uuid",
  "name": "Main Dashboard",
  "description": "Primary monitoring layout",
  "rows": 50,
  "panels": [
    {
      "id": "panel-1",
      "x": 0, "y": 0,
      "w": 6, "h": 8
    }
  ],
  "created": "ISO-8601",
  "updated": "ISO-8601"
}
```

### Data Source Schema
```json
{
  "id": "uuid",
  "name": "Production Database",
  "type": "sql",
  "description": "PostgreSQL production metrics",
  "config": {
    "connection_string": "...",
    "driver": "postgres"
  },
  "created": "ISO-8601",
  "updated": "ISO-8601"
}
```

### Component Schema
```json
{
  "id": "uuid",
  "name": "cpu-usage-chart",
  "system": "monitoring",
  "source": "metrics",
  "description": "Real-time CPU usage visualization",
  "component_code": "const Component = () => {...}",
  "metadata": {
    "category": "visualization",
    "tags": ["cpu", "real-time"],
    "visualization": {
      "type": "line",
      "library": "echarts"
    }
  },
  "created": "ISO-8601",
  "updated": "ISO-8601"
}
```

### Dashboard Schema
```json
{
  "id": "uuid",
  "name": "Infrastructure Monitor",
  "description": "Server health monitoring",
  "layout_id": "layout-uuid",
  "components": [
    {
      "id": "placement-uuid",
      "component_id": "component-uuid",
      "panel_id": "panel-1",
      "config": {},
      "props": {}
    }
  ],
  "settings": {
    "theme": "dark",
    "refresh_interval": 30,
    "timezone": "UTC"
  },
  "created": "ISO-8601",
  "updated": "ISO-8601"
}
```

## API Endpoints

### Base URL: `http://localhost:3001/api`

| Method | Endpoint | Description |
|--------|----------|-------------|
| **Layouts** |||
| GET | `/layouts` | List all layouts (paginated) |
| POST | `/layouts` | Create new layout |
| GET | `/layouts/:id` | Get layout by ID |
| PUT | `/layouts/:id` | Update layout |
| DELETE | `/layouts/:id` | Delete layout |
| **Data Sources** |||
| GET | `/datasources` | List all data sources (paginated) |
| POST | `/datasources` | Create new data source |
| GET | `/datasources/:id` | Get data source by ID |
| PUT | `/datasources/:id` | Update data source |
| DELETE | `/datasources/:id` | Delete data source |
| POST | `/datasources/test` | Test data source connection |
| POST | `/datasources/:id/health` | Check data source health |
| POST | `/datasources/:id/query` | Execute query |
| **Components** |||
| GET | `/components` | List all components (paginated) |
| GET | `/components/systems` | Get system/source hierarchy |
| POST | `/components` | Create new component |
| GET | `/components/:id` | Get component by ID |
| PUT | `/components/:id` | Update component |
| DELETE | `/components/:id` | Delete component |
| **Dashboards** |||
| GET | `/dashboards` | List all dashboards (paginated) |
| POST | `/dashboards` | Create new dashboard |
| GET | `/dashboards/:id` | Get dashboard by ID |
| GET | `/dashboards/:id/details` | Get dashboard with expanded layout/components |
| PUT | `/dashboards/:id` | Update dashboard |
| DELETE | `/dashboards/:id` | Delete dashboard |
| **System** |||
| GET | `/health` | Health check endpoint |

## Frontend Architecture

### Directory Structure
```
client/
├── src/
│   ├── api/
│   │   └── client.js              # API client wrapper
│   ├── components/
│   │   ├── mode/
│   │   │   ├── ModeToggle.jsx     # Mode selector component
│   │   │   └── ModeSelector.jsx
│   │   ├── navigation/
│   │   │   ├── DesignModeNav.jsx  # Design mode sidebar
│   │   │   ├── ViewModeNav.jsx    # View mode sidebar (dashboard tiles)
│   │   │   └── ManageModeNav.jsx  # Manage mode sidebar
│   │   ├── DynamicComponentLoader.jsx  # Runtime component evaluation
│   │   ├── ComponentEditor.jsx
│   │   ├── ComponentViewer.jsx
│   │   └── ComponentSelector.jsx
│   ├── config/
│   │   └── layoutConfig.js        # Mode definitions, grid settings
│   ├── pages/
│   │   ├── LayoutsPage.jsx        # Layout list view
│   │   ├── LayoutDetailPage.jsx   # Layout editor
│   │   ├── DatasourcesPage.jsx    # Data source list view
│   │   ├── DatasourceDetailPage.jsx # Data source editor
│   │   ├── ChartsListPage.jsx     # Component list view
│   │   ├── ChartDetailPage.jsx    # Component editor
│   │   ├── DashboardsListPage.jsx # Dashboard list view
│   │   ├── DashboardDetailPage.jsx # Dashboard editor
│   │   └── DashboardViewerPage.jsx # Dashboard viewer (View Mode)
│   ├── theme/
│   │   └── carbonEchartsTheme.js  # ECharts Carbon theme
│   ├── App.jsx                    # Main app with routing
│   └── App.scss                   # Global styles
├── build.json                     # Build number tracker
└── package.json
```

### Dynamic Component Loading

Components are stored as JavaScript code strings and evaluated at runtime:

```javascript
// DynamicComponentLoader.jsx
const scope = {
  React,
  useState, useEffect, useMemo, useCallback, useRef, useContext,
  echarts,
  ReactECharts,
  carbonTheme,
  carbonDarkTheme
};

const Component = new Function(...Object.keys(scope), code);
```

**Available in Component Scope:**
- React hooks: `useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`, `useContext`
- ECharts: `echarts`, `ReactECharts`
- Carbon themes: `carbonTheme`, `carbonDarkTheme`

### Routing Structure

```
/                           → Redirects to first dashboard (View Mode)
/design/layouts             → Layout list
/design/layouts/:id         → Layout editor
/design/datasources         → Data source list
/design/datasources/:id     → Data source editor
/design/charts              → Component list
/design/charts/:id          → Component editor
/design/dashboards          → Dashboard list
/design/dashboards/:id      → Dashboard editor
/view/dashboards            → Dashboard selection
/view/dashboards/:id        → Dashboard viewer
/manage                     → System settings (future)
```

## Backend Architecture

### Directory Structure
```
server-go/
├── cmd/
│   └── server/
│       └── main.go                # Application entry point
├── config/
│   ├── config.go                  # Configuration loading
│   └── config.yaml                # Default configuration
├── internal/
│   ├── database/
│   │   ├── mongodb.go             # MongoDB connection & indexes
│   │   └── redis.go               # Redis connection
│   ├── datasource/
│   │   ├── api.go                 # REST API adapter
│   │   ├── csv.go                 # CSV file adapter
│   │   ├── factory.go             # Data source factory
│   │   ├── socket.go              # WebSocket adapter
│   │   └── sql.go                 # SQL database adapter
│   ├── handlers/
│   │   ├── layout_handler.go
│   │   ├── datasource_handler.go
│   │   ├── component_handler.go
│   │   └── dashboard_handler.go
│   ├── models/
│   │   ├── layout.go
│   │   ├── datasource.go
│   │   ├── component.go
│   │   └── dashboard.go
│   ├── repository/
│   │   ├── layout_repository.go
│   │   ├── datasource_repository.go
│   │   ├── component_repository.go
│   │   └── dashboard_repository.go
│   └── service/
│       ├── layout_service.go
│       ├── datasource_service.go
│       ├── component_service.go
│       └── dashboard_service.go
├── docs/                          # Generated Swagger docs
├── go.mod
└── go.sum
```

### Layered Architecture

```
HTTP Request
     │
     ▼
┌─────────────────┐
│    Handlers     │  ← Request validation, HTTP response formatting
│   (handlers/)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Services     │  ← Business logic, cross-entity validation
│   (service/)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Repositories   │  ← Database operations, queries, indexes
│  (repository/)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    MongoDB      │  ← Data persistence
└─────────────────┘
```

### Data Source Adapters

The system supports multiple data source types through a unified interface:

```go
type DataSource interface {
    Query(ctx context.Context, query *Query) (*ResultSet, error)
    Stream(ctx context.Context, query *Query) (<-chan Record, error)
    Close() error
}
```

**Supported Types:**
- **SQL**: PostgreSQL, MySQL, SQLite, MSSQL, Oracle
- **API**: REST APIs with authentication (Bearer, Basic, API-Key)
- **CSV**: File-based with filtering and header detection
- **WebSocket**: TCP, UDP, WebSocket with reconnection

## Development Setup

### Prerequisites
- Go 1.23+ (via Homebrew on macOS)
- Node.js 18+
- Docker & Docker Compose
- MongoDB 7.x
- Redis 7.x

### Quick Start

```bash
# Start infrastructure
docker compose up -d mongodb redis

# Start Go backend
cd server-go
export PATH="/opt/homebrew/opt/go@1.23/bin:$PATH"
go build -o bin/server cmd/server/main.go
./bin/server

# Start React frontend
cd client
npm install
npm run dev
```

### Environment Variables

```bash
# Go backend
export DASHBOARD_SERVER_PORT=3001
export DASHBOARD_MONGODB_URI=mongodb://localhost:27017
export DASHBOARD_MONGODB_DATABASE=dashboard
export DASHBOARD_REDIS_ADDR=localhost:6379

# Frontend
VITE_API_URL=http://localhost:3001
```

### Swagger Documentation

Access the API documentation at:
```
http://localhost:3001/swagger/index.html
```

Regenerate Swagger docs:
```bash
cd server-go
$GOPATH/bin/swag init -g cmd/server/main.go -o docs
```

## Grid System

The layout system uses a 12-column grid with configurable row height:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Column: 1    2    3    4    5    6    7    8    9   10   11   12        │
├──────────────────────────────────────────────────────────────────────────┤
│ Row 0  ┌─────────────────────┐  ┌────────────────────────────────────┐  │
│        │      Panel A        │  │            Panel B                 │  │
│ Row 1  │    (x:0, w:6)       │  │         (x:6, w:6)                 │  │
│        │                     │  │                                    │  │
│ Row 2  └─────────────────────┘  │                                    │  │
│                                 │                                    │  │
│ Row 3  ┌──────────────────────────────────────────────────────────┐ │  │
│        │                       Panel C                             │ │  │
│ Row 4  │                    (x:0, w:12)                            │ │  │
│        │                                                           │ │  │
│ Row 5  └───────────────────────────────────────────────────────────┘ │  │
└──────────────────────────────────────────────────────────────────────────┘

Panel positions: x, y (0-indexed)
Panel dimensions: w (1-12 columns), h (row units)
Row height: 32px (based on Carbon $spacing-08)
```

## Future Enhancements

### Phase 6: Chat/AI Integration
- Natural language dashboard creation
- AI-powered chart generation
- Component suggestions

### Phase 7: Asynq Workers
- Background job processing
- Data source health monitoring
- Scheduled dashboard updates

### Phase 8: Testing & Documentation
- Unit tests for all layers
- Integration tests
- E2E tests with Playwright

### Phase 9: SQL Metadata Discovery
- Schema introspection
- Query builder assistance
- Column type detection

### Phase 10: EdgeLake Integration
- Distributed database queries
- Cluster monitoring
- AnyLog/EdgeLake commands

---

**Document Version**: 2.0
**Last Updated**: 2025-11-25
**Build**: 27
