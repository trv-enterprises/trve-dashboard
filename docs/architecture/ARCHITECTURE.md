# TRVE Dashboards Architecture

## System Overview

TRVE Dashboards is a full-stack application for creating, managing, and viewing dynamic data visualization dashboards. The application supports real-time data from multiple sources and features an AI-powered chart generation system.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACE                                 │
│                     React 18 + Vite + Carbon Design System                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │   Design Mode   │  │    View Mode    │  │   Manage Mode   │              │
│  │                 │  │                 │  │                 │              │
│  │ - Layouts       │  │ - Dashboard     │  │ - Settings      │              │
│  │ - Data Sources  │  │   Viewer        │  │ - Users         │              │
│  │ - Charts        │  │ - Real-time     │  │ - System Config │              │
│  │ - Dashboards    │  │   Data Updates  │  │   (Future)      │              │
│  │ - AI Builder    │  │ - Fullscreen    │  │                 │              │
│  │                 │  │ - Reduce to Fit │  │                 │              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ REST API + SSE (Port 3001)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              GO BACKEND                                     │
│                         Gin Framework + Swagger                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                           API Layer                                 │    │
│  │  /api/layouts  /api/datasources  /api/charts  /api/dashboards       │    │
│  │  /api/components  /api/ai/session                                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         Service Layer                               │    │
│  │  Layout │ Datasource │ Chart │ Component │ Dashboard │ AI Session   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                       Repository Layer                              │    │
│  │  MongoDB CRUD Operations │ Index Management │ Aggregation Pipelines │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │ 
│  │                         AI Integration                              │    │
│  │  Claude API │ MCP Tools │ SSE Streaming │ Session Management        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────────────────────┐
                    ▼                               ▼
            ┌───────────────┐               ┌───────────────┐
            │    MongoDB    │               │ Data Sources  │
            │    (7.x)      │               │ SQL/API/CSV/  │
            │               │               │ WS/MQTT       │
            └───────────────┘               └───────────────┘
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
| Swaggo | 1.8.x | OpenAPI/Swagger Generation |
| Viper | 1.x | Configuration Management |
| go-anthropic | - | Claude API Client |

### Infrastructure
| Technology | Version | Purpose |
|------------|---------|---------|
| MongoDB | 7.x | Primary Database |
| Docker | - | Containerization |
| Docker Compose | - | Local Development |

## Application Modes

The dashboard operates in three distinct modes, each with its own navigation and functionality:

### 1. Design Mode
Create and configure dashboard components:
- **Connections**: Configure connections to SQL, API, CSV, WebSocket sources
- **Components**: Build displays (charts, gauges, tables) and controls (buttons, sliders) - manual or AI-assisted
- **Dashboards**: Combine components with layouts, configure settings

### 2. View Mode
End-user dashboard viewing experience:
- Dashboard selection from sidebar tiles
- Real-time data updates
- Auto-refresh based on dashboard settings
- Fullscreen viewing capability
- "Reduce to fit" mode for compact display

### 3. Manage Mode (Future)
System administration:
- User configuration
- System settings
- Access control

## Data Model

### Core Entities

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA RELATIONSHIPS                             │
└─────────────────────────────────────────────────────────────────────────────┘

                        ┌─────────────┐
                        │  Dashboard  │
                        │             │
                        │ - id        │
                        │ - name      │
                        │ - panels[]  │──────────┐
                        │ - settings  │          │
                        └─────────────┘          │
                                                 │
                                                 ▼
┌─────────────┐                          ┌─────────────┐
│   Layout    │                          │    Chart    │
│  (Legacy)   │                          │             │
│             │                          │ - id        │
│ - id        │                          │ - name      │
│ - name      │                          │ - version   │
│ - rows      │                          │ - chart_type│
│ - panels[]  │                          │ - code      │
└─────────────┘                          │ - status    │
                                         │ - settings  │
                                         └─────────────┘
                                                 │
                                                 │ (references)
                                                 ▼
                                         ┌─────────────┐
                                         │ Data Source │
                                         │             │
                                         │ - id        │
                                         │ - name      │
                                         │ - type      │
                                         │ - config    │
                                         └─────────────┘
```

### Dashboard Schema (Current)
```json
{
  "id": "uuid",
  "name": "Infrastructure Monitor",
  "description": "Server health monitoring",
  "panels": [
    {
      "id": "panel-uuid",
      "x": 0, "y": 0,
      "w": 6, "h": 8,
      "chart_id": "chart-uuid"
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

### Chart Schema (with Versioning)
```json
{
  "id": "uuid",
  "name": "CPU Usage Chart",
  "version": 3,
  "chart_type": "line",
  "description": "Real-time CPU usage visualization",
  "component_code": "const Component = () => {...}",
  "status": "final",
  "settings": {
    "x_axis_label": "Time",
    "y_axis_label": "Percentage (%)",
    "data_source_id": "datasource-uuid",
    "refresh_interval": 5
  },
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
  "parser_config": {
    "data_path": "results.data",
    "parse_type": "json"
  },
  "created": "ISO-8601",
  "updated": "ISO-8601"
}
```

### AI Session Schema
```json
{
  "id": "uuid",
  "chart_id": "chart-uuid or null",
  "status": "active",
  "messages": [
    {
      "id": "msg-uuid",
      "role": "user",
      "content": "Create a bar chart",
      "timestamp": "ISO-8601"
    },
    {
      "id": "msg-uuid",
      "role": "assistant",
      "content": "I'll create a bar chart...",
      "tool_calls": [...],
      "timestamp": "ISO-8601"
    }
  ],
  "chart": {
    "name": "Untitled Chart",
    "component_code": "...",
    "chart_type": "bar"
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
| POST | `/datasources/:id/query` | Execute query |
| **Charts** |||
| GET | `/charts` | List all charts (latest versions) |
| POST | `/charts` | Create new chart |
| GET | `/charts/:id` | Get chart by ID |
| PUT | `/charts/:id` | Update chart (creates new version) |
| DELETE | `/charts/:id` | Delete chart |
| GET | `/charts/:id/versions` | Get version history |
| **Components (Legacy)** |||
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
| GET | `/dashboards/:id/details` | Get dashboard with expanded charts |
| PUT | `/dashboards/:id` | Update dashboard |
| DELETE | `/dashboards/:id` | Delete dashboard |
| **AI Session** |||
| POST | `/ai/session` | Start new AI session |
| GET | `/ai/session/:id` | Get session status |
| GET | `/ai/session/:id/stream` | SSE event stream |
| POST | `/ai/session/:id/message` | Send message to AI |
| POST | `/ai/session/:id/save` | Save chart from session |
| DELETE | `/ai/session/:id` | Cancel/delete session |
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
│   │   ├── icons/
│   │   │   └── AiIcon.jsx         # Custom AI icon component
│   │   ├── DynamicComponentLoader.jsx  # Runtime component evaluation
│   │   ├── AIChartPreview.jsx     # AI Builder preview panel
│   │   ├── ChartEditorModal.jsx   # Modal for editing charts
│   │   └── ChartDeleteDialog.jsx  # Deletion confirmation
│   ├── hooks/
│   │   ├── useAISession.js        # AI session state management
│   │   ├── useData.js             # Generic data fetching
│   │   └── useComponents.js       # Component fetching
│   ├── config/
│   │   └── layoutConfig.js        # Mode definitions, grid settings
│   ├── pages/
│   │   ├── LayoutsPage.jsx        # Layout list view
│   │   ├── LayoutDetailPage.jsx   # Layout editor
│   │   ├── DatasourcesPage.jsx    # Data source list view
│   │   ├── DatasourceDetailPage.jsx # Data source editor
│   │   ├── ChartsListPage.jsx     # Chart list view
│   │   ├── ChartDetailPage.jsx    # Chart editor (manual)
│   │   ├── AIBuilderPage.jsx      # AI chart builder
│   │   ├── DashboardsListPage.jsx # Dashboard list view
│   │   ├── DashboardDetailPage.jsx # Dashboard editor
│   │   ├── DashboardViewerPage.jsx # Dashboard viewer (View Mode)
│   │   └── ViewDashboardsPage.jsx  # Dashboard selection tiles
│   ├── theme/
│   │   └── carbonEchartsTheme.js  # ECharts Carbon theme
│   ├── utils/
│   │   └── dataTransforms.js      # Data transformation utilities
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
/design/charts              → Chart list
/design/charts/:id          → Chart editor (manual)
/design/charts/ai/new       → AI Builder (new chart)
/design/charts/ai/:id       → AI Builder (edit existing)
/design/dashboards          → Dashboard list
/design/dashboards/:id      → Dashboard editor
/view/dashboards            → Dashboard selection tiles
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
│   ├── ai/
│   │   ├── session.go             # AI session management
│   │   ├── mcp_tools.go           # MCP tool definitions
│   │   └── stream.go              # SSE streaming
│   ├── database/
│   │   └── mongodb.go             # MongoDB connection & indexes
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
│   │   ├── chart_handler.go
│   │   ├── dashboard_handler.go
│   │   └── ai_session_handler.go
│   ├── models/
│   │   ├── layout.go
│   │   ├── datasource.go
│   │   ├── component.go
│   │   ├── chart.go
│   │   ├── dashboard.go
│   │   └── ai_session.go
│   ├── repository/
│   │   ├── layout_repository.go
│   │   ├── datasource_repository.go
│   │   ├── component_repository.go
│   │   ├── chart_repository.go
│   │   └── dashboard_repository.go
│   └── service/
│       ├── layout_service.go
│       ├── datasource_service.go
│       ├── component_service.go
│       ├── chart_service.go
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
- **WebSocket**: TCP, UDP, WebSocket with reconnection and parser config

## AI Builder Architecture

### Session Flow

```
┌──────────────┐     ┌───────────────┐     ┌──────────────┐
│   Frontend   │────▶│  Go Backend   │────▶│  Claude API  │
│  AIBuilder   │     │  AI Handler   │     │  (Anthropic) │
│    Page      │◀────│  SSE Stream   │◀────│              │
└──────────────┘     └───────────────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   MongoDB    │
                     │ (Sessions,   │
                     │  Charts)     │
                     └──────────────┘
```

### SSE Event Types
- `session_created` - New session started
- `message` - Message added (user or assistant)
- `thinking` - AI is processing
- `chart_updated` - Chart code/settings changed
- `tool_use` - AI invoked a tool
- `error` - Error occurred
- `done` - Response complete

### MCP Tools Available to AI
- `update_chart` - Set chart component code
- `update_chart_name` - Set chart name
- `update_chart_type` - Set chart type
- `list_data_sources` - Get available data sources
- `query_data_source` - Execute data source query
- `get_chart_info` - Get current chart state

## Grid System

The layout system uses a 12-column grid with configurable row height:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Column: 1    2    3    4    5    6    7    8    9   10   11   12         │
├──────────────────────────────────────────────────────────────────────────┤
│ Row 0  ┌─────────────────────┐  ┌────────────────────────────────────┐   │
│        │      Panel A        │  │            Panel B                 │   │
│ Row 1  │    (x:0, w:6)       │  │         (x:6, w:6)                 │   │
│        │                     │  │                                    │   │
│ Row 2  └─────────────────────┘  │                                    │   │
│                                 └────────────────────────────────────┘   │
│ Row 3  ┌────────────────────────────────────────────────────────-──┐     │
│        │                       Panel C                             │     │
│ Row 4  │                    (x:0, w:12)                            │     │
│        │                                                           │     │
│ Row 5  └───────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────────────┘

Panel positions: x, y (0-indexed)
Panel dimensions: w (1-12 columns), h (row units)
Row height: 32px (based on Carbon $spacing-08)
```

## Development Setup

### Prerequisites
- Go 1.24+ (via Homebrew on macOS)
- Node.js 18+
- Docker & Docker Compose
- MongoDB 7.x

### Quick Start

```bash
# Start infrastructure
docker compose up -d mongodb

# Start Go backend
cd server-go
export PATH="/opt/homebrew/opt/go@1.23/bin:$PATH"
go build -o bin/server cmd/server/main.go
ANTHROPIC_API_KEY="your-key" ./bin/server

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
export ANTHROPIC_API_KEY=your-api-key

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
$GOPATH/bin/swag init -g cmd/server/main.go -o docs --parseDependency --parseInternal
```

## Implementation Status

### Completed (Phases 1-7)
- Go backend with MongoDB (layouts, data sources, components, charts, dashboards)
- React frontend with three modes (Design, View, Manage placeholder)
- Design Mode: All CRUD pages for layouts, data sources, charts, dashboards
- View Mode: Dashboard viewer with real-time refresh, sidebar tiles
- Chart Editor: Full chart builder with live preview, data mapping
- Socket Data Sources: WebSocket connections with parser config
- Chart Versioning: Version tracking with increment on save
- AI Builder: Full-page AI chat with SSE streaming
- AI Session API: Start, message, save, cancel endpoints
- MCP Tools: Chart updates, data source queries
- Custom AI Icon: Replaced WatsonxAi with custom sparkle icon

### In Progress (Phase 8)
- Polish & Testing
- Error handling improvements
- Performance optimization

### Planned
- **Tabbed Panel Layout**: Allow panels to contain multiple charts with tabs
- **Manage Mode**: User configuration and system settings
- **User Authentication**: Login, roles, permissions
- **EdgeLake Integration**: Distributed database queries

---

**Document Version**: 4.0
**Last Updated**: 2026-04-05
**Build**: 662
