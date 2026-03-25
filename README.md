# TRVE Dashboards

A full-stack application for creating, managing, and viewing dynamic data visualization dashboards with AI-powered component generation, real-time streaming, and smart device control.

## Overview

This system allows you to:
- Create dashboards with customizable 12-column grid layouts
- Build displays (charts, gauges, tables) and controls (buttons, sliders, dimmers) with ECharts
- Connect to multiple data sources: SQL, REST API, CSV, WebSocket, MQTT, Prometheus, EdgeLake, TSStore, and Frigate NVR
- Generate components using AI assistance (Anthropic Claude)
- View dashboards with real-time data updates via SSE streaming
- Control smart home devices (Zigbee, Caseta) through bidirectional connections
- Manage users with role-based access control

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Port 5173)                                 │
│                    React 19 + Vite + Carbon Design System                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Design Mode          │  View Mode            │  Manage Mode                │
│  - Layouts            │  - Dashboard Viewer   │  - Users                    │
│  - Connections        │  - Real-time Data     │  - Settings                 │
│  - Components         │  - Auto-refresh       │  - Devices                  │
│  - Dashboards         │  - Fullscreen         │                             │
│  - AI Builder         │  - Reduce to Fit      │                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ REST API + SSE + WebSocket
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      GO BACKEND (Port 3001)                                  │
│                    Gin + MongoDB + Redis + Swagger                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  /api/connections  │  /api/charts      │  /api/dashboards  │  /api/devices  │
│  /api/registry     │  /api/ai/sessions │  /api/frigate     │  /api/users    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              ┌──────────┐   ┌──────────┐   ┌─────────────────────────┐
              │ MongoDB  │   │  Redis   │   │      Connections        │
              │   7.x    │   │   7.x    │   │ SQL/API/CSV/WS/MQTT/    │
              └──────────┘   └──────────┘   │ Prometheus/EdgeLake/    │
                                            │ TSStore/Frigate         │
                                            └─────────────────────────┘
```

## Technology Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.x | UI Framework |
| Vite | 7.x | Build Tool & Dev Server |
| React Router | 7.x | Client-side Routing |
| Carbon Design System | 11.x | UI Components (g100 dark theme) |
| ECharts | 6.x | Data Visualization |
| SCSS | - | Styling with Carbon tokens |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Go | 1.24.x | Primary Language |
| Gin | 1.x | HTTP Framework |
| MongoDB | 7.x | Primary Database |
| Redis | 7.x | Caching & Sessions |
| Swaggo | 1.8.x | API Documentation |

## Quick Start

### Prerequisites

- Go 1.24+
- Node.js 18+
- Docker & Docker Compose
- MongoDB 7.x
- Redis 7.x

### Installation & Running

```bash
# Clone the repository
git clone <your-repo-url>
cd dashboard

# Start infrastructure
docker compose up -d mongodb redis

# Start Go backend (Terminal 1)
cd server-go
go build -o bin/server cmd/server/main.go && ./bin/server
# Server runs on http://localhost:3001

# Start React frontend (Terminal 2)
cd client
npm install
npm run dev
# Client runs on http://localhost:5173
```

Then open http://localhost:5173 in your browser.

## Application Modes

### Design Mode (`/design/*`)
Create and configure dashboard components:
- **Layouts** - Define 12-column grid layouts with panels
- **Connections** - Configure data connections (SQL, API, CSV, WebSocket, MQTT, Prometheus, EdgeLake, Frigate)
- **Components** - Build displays (charts, gauges, tables) and controls (buttons, sliders, dimmers), or use AI Builder
- **Dashboards** - Combine components with layouts and configure settings

### View Mode (`/view/*`)
End-user dashboard viewing:
- Dashboard selection from sidebar tiles
- Real-time data with auto-refresh via SSE streaming
- Fullscreen viewing capability
- "Reduce to fit" mode for compact display

### Manage Mode (`/manage/*`)
System administration:
- **Users** - User management with role-based access control (Admin, Designer, Support)
- **Settings** - Configurable system settings
- **Devices** - Smart device management (Zigbee, Caseta)

## Key Features

### AI Component Builder
Create displays using natural language:
1. Navigate to Design > Components > Create with AI
2. Describe the display you want (e.g., "Create a bar chart showing sales by region")
3. AI generates the ECharts component code with SSE streaming
4. Preview, refine with follow-up messages, and save

### Component Versioning
- Components support version history (version 1, 2, 3...)
- Draft and final statuses
- Latest version shown by default in lists

### Connection Types

| Category | Type ID | Description |
|----------|---------|-------------|
| **Database** | `db.postgres` | PostgreSQL |
| | `db.mysql` | MySQL |
| | `db.sqlite` | SQLite |
| **Stream** | `stream.websocket` | WebSocket (bidirectional) |
| | `stream.mqtt` | MQTT broker with topic discovery and pub/sub |
| | `stream.tcp` | TCP socket |
| | `stream.udp` | UDP socket |
| **API** | `api.rest` | REST APIs with auth (Bearer, Basic, API-Key) |
| | `api.prometheus` | Prometheus metrics with PromQL builder |
| | `api.edgelake` | EdgeLake distributed database |
| **File** | `file.csv` | CSV with filtering and header detection |
| **Data Store** | `store.tsstore` | ts-store time-series circular buffer |
| **NVR** | `nvr.frigate` | Frigate NVR (cameras, events, recordings) |

### Device Control
- Bidirectional command execution through MQTT and WebSocket connections
- Smart device management with capability-based device types
- Built-in types: Zigbee (switch, dimmer), Caseta (switch, dimmer, shade, fan)
- Device discovery via MQTT

### MCP Server (Model Context Protocol)
A standalone MCP server allows external AI agents (like Claude Desktop) to interact with your connections:

```bash
# Build the MCP server
cd server-go
go build -o bin/mcp-server cmd/mcp-server/main.go

# Add to Claude Desktop config (~/Library/Application Support/Claude/claude_desktop_config.json):
{
  "mcpServers": {
    "dashboard-connections": {
      "command": "/path/to/dashboard/server-go/bin/mcp-server",
      "args": []
    }
  }
}
```

The main server also exposes an MCP SSE endpoint at `/mcp/sse` for integrated MCP tool access.

### Dynamic Component Loading
Components are stored as JavaScript code and evaluated at runtime with access to:
- React hooks: `useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`
- ECharts: `echarts`, `ReactECharts`
- Carbon themes: `carbonTheme`, `carbonDarkTheme`

## File Structure

```
dashboard/
├── client/                    # React Frontend
│   ├── src/
│   │   ├── api/              # API client (singleton)
│   │   ├── components/       # Reusable components
│   │   │   ├── controls/     # Control renderers (button, toggle, slider, dimmer)
│   │   │   ├── frigate/      # Frigate NVR camera viewer
│   │   │   ├── icons/        # Custom icon components
│   │   │   ├── mode/         # Mode toggle components
│   │   │   └── navigation/   # Nav components per mode
│   │   ├── config/           # Configuration constants
│   │   ├── hooks/            # Custom React hooks
│   │   ├── pages/            # Page components
│   │   ├── theme/            # ECharts Carbon theme
│   │   ├── utils/            # Utility functions
│   │   └── App.jsx           # Main app with routing
│   ├── build.json            # Build number tracker
│   └── package.json
│
├── server-go/                 # Go Backend
│   ├── cmd/
│   │   ├── server/           # Main API server
│   │   ├── mcp-server/       # Standalone MCP server
│   │   └── worker/           # Background task worker
│   ├── internal/
│   │   ├── ai/               # AI agent, tools, system prompt
│   │   ├── database/         # MongoDB, Redis connections
│   │   ├── datasource/       # Connection adapters (SQL, API, CSV, Socket, MQTT, etc.)
│   │   ├── handlers/         # HTTP handlers
│   │   ├── hub/              # ChartHub for real-time broadcasts
│   │   ├── mcp/              # MCP tool registry and handler
│   │   ├── middleware/       # Auth middleware
│   │   ├── models/           # Data models
│   │   ├── registry/         # Connection type registry
│   │   ├── repository/       # Database operations
│   │   ├── service/          # Business logic
│   │   ├── streaming/        # SSE stream manager
│   │   └── version/          # Version info
│   └── docs/                  # Swagger documentation
│
├── electron/                  # Electron desktop app wrapper
│
├── simulators/                # Test data simulators
│
└── docs/                      # Documentation
    ├── architecture/          # Architecture docs & diagrams
    ├── DEPLOYMENT.md
    ├── TEST_PLAN.md
    └── COMPONENT_SPEC_SUMMARY.md
```

## API Endpoints

All API routes (except `/auth/login`, `/health`, and `/api/ws/status`) require authentication via `X-User-ID` header.

### Connections
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/connections` | Connection CRUD |
| GET | `/api/connections/:id` | Get connection |
| PUT/DELETE | `/api/connections/:id` | Update/delete connection |
| POST | `/api/connections/test` | Test connection |
| POST | `/api/connections/:id/query` | Execute query |
| GET | `/api/connections/:id/schema` | Get schema |
| GET | `/api/connections/:id/stream` | SSE data stream |
| GET | `/api/connections/:id/mqtt/topics` | MQTT topic discovery |
| GET | `/api/connections/:id/prometheus/labels/:label/values` | Prometheus label values |
| GET | `/api/connections/:id/edgelake/databases` | EdgeLake databases |
| POST | `/api/connections/:id/command` | Execute bidirectional command |

### Charts & Components
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/charts` | Chart CRUD (with versioning) |
| GET | `/api/charts/summaries` | Chart summaries for lists |
| GET | `/api/charts/:id/versions` | List chart versions |
| POST | `/api/controls/:id/execute` | Execute control command |

### Dashboards
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/dashboards` | Dashboard CRUD |
| GET | `/api/dashboards/:id` | Get dashboard |

### Devices
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/devices` | Device CRUD |
| POST | `/api/devices/import` | Bulk import devices |
| GET/POST | `/api/device-types` | Device type CRUD |
| POST | `/api/connections/:id/discover-devices` | Discover devices on connection |

### Frigate NVR
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/frigate/:connection_id/cameras` | List cameras |
| GET | `/api/frigate/:connection_id/snapshot/:camera` | Get camera snapshot |
| GET | `/api/frigate/:connection_id/events/:camera` | Get camera events |
| GET | `/api/frigate/:connection_id/live/:camera` | Proxy live stream |

### AI Sessions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/sessions` | Create AI session |
| GET | `/api/ai/sessions/:id` | Get session state |
| POST | `/api/ai/sessions/:id/messages` | Send message (SSE streaming) |
| GET | `/api/ai/sessions/:id/ws` | WebSocket connection |
| POST | `/api/ai/sessions/:id/save` | Save session |
| DELETE | `/api/ai/sessions/:id` | Cancel session |

### Users & Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login (public) |
| GET | `/api/auth/me` | Get current user |
| GET/POST | `/api/users` | User management (admin) |

### Registry & Config
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/registry/connections` | List available connection types |
| GET | `/api/registry/categories` | List connection categories |
| GET/PUT | `/api/config/system` | System configuration |
| GET/PUT | `/api/config/user/:user_id` | User configuration |

### Status & Monitoring
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check (MongoDB, Redis status) |
| WS | `/api/ws/status` | WebSocket for real-time server status |

#### Status WebSocket

Connect to receive periodic server status updates:

```bash
# Using websocat (default 5s interval)
websocat ws://localhost:3001/api/ws/status

# Custom interval (2 seconds)
websocat "ws://localhost:3001/api/ws/status?interval=2s"

# One-shot (single response, then close)
websocat "ws://localhost:3001/api/ws/status?interval=0"
```

### Swagger Documentation
Access at: http://localhost:3001/swagger/index.html

## Development

### Regenerate Swagger Docs
```bash
cd server-go
$GOPATH/bin/swag init -g cmd/server/main.go -o docs --parseDependency --parseInternal
```

### Build Tracking
Every code change increments the build number in `client/build.json`. Current build: **612**

## Documentation

- [Architecture](docs/architecture/ARCHITECTURE.md) - System architecture details
- [Tech Stack](docs/architecture/TECH_STACK_SUMMARY.md) - Technology decisions
- [Deployment](docs/DEPLOYMENT.md) - Deployment guide
- [Test Plan](docs/TEST_PLAN.md) - Testing procedures
- [Component Spec](docs/COMPONENT_SPEC_SUMMARY.md) - Component specification

## License

Apache 2.0
