# TRVE Dashboards

A full-stack application for creating, managing, and viewing dynamic data visualization dashboards with AI-powered chart generation.

## Overview

This system allows you to:
- Create dashboards with customizable grid layouts
- Build React components with ECharts visualizations
- Connect to multiple data sources (SQL, API, CSV, WebSocket)
- Generate charts using AI assistance
- View dashboards with real-time data updates
- Auto-refresh dashboards at configurable intervals

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Port 5173)                                 │
│                    React 18 + Vite + Carbon Design System                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Design Mode          │  View Mode            │  Manage Mode                │
│  - Layouts            │  - Dashboard Viewer   │  - Settings (Future)        │
│  - Data Sources       │  - Real-time Data     │  - User Config (Future)     │
│  - Charts             │  - Auto-refresh       │                             │
│  - Dashboards         │  - Fullscreen         │                             │
│  - AI Builder         │  - Reduce to Fit      │                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ REST API + SSE
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      GO BACKEND (Port 3001)                                  │
│                    Gin + MongoDB + Redis + Swagger                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  /api/layouts    │  /api/datasources  │  /api/charts     │  /api/dashboards │
│                  │                    │  /api/components │  /api/ai/session │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              ┌──────────┐   ┌──────────┐   ┌───────────────┐
              │ MongoDB  │   │  Redis   │   │ Data Sources  │
              │   7.x    │   │   7.x    │   │ SQL/API/CSV/WS│
              └──────────┘   └──────────┘   └───────────────┘
```

## Technology Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.x | UI Framework |
| Vite | 5.x | Build Tool & Dev Server |
| React Router | 6.x | Client-side Routing |
| Carbon Design System | 11.x | UI Components (g100 dark theme) |
| ECharts | 5.x | Data Visualization |
| SCSS | - | Styling with Carbon tokens |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Go | 1.23.x | Primary Language |
| Gin | 1.x | HTTP Framework |
| MongoDB | 7.x | Primary Database |
| Redis | 7.x | Caching |
| Swaggo | 1.8.x | API Documentation |

## Quick Start

### Prerequisites

- Go 1.23+ (via Homebrew on macOS: `brew install go@1.23`)
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
export PATH="/opt/homebrew/opt/go@1.23/bin:$PATH"
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
- **Layouts** - Define 12-column grid layouts with resizable panels
- **Data Sources** - Configure SQL, API, CSV, WebSocket connections
- **Charts** - Build React components with ECharts, or use AI Builder
- **Dashboards** - Combine layouts with charts and configure settings

### View Mode (`/view/*`)
End-user dashboard viewing:
- Dashboard selection from sidebar tiles
- Real-time data with auto-refresh
- Fullscreen viewing capability
- "Reduce to fit" mode for compact display

### Manage Mode (`/manage`) - Future
System administration and user configuration.

## Key Features

### AI Chart Builder
Create charts using natural language:
1. Navigate to Design → Charts → Create with AI
2. Describe the chart you want (e.g., "Create a bar chart showing sales by region")
3. AI generates the ECharts component code
4. Preview, refine with follow-up messages, and save

### Chart Versioning
- Charts support version history (version 1, 2, 3...)
- Compare and revert to previous versions
- Latest version shown by default in lists

### Data Source Types
- **SQL**: PostgreSQL, MySQL, SQLite, MSSQL, Oracle
- **API**: REST APIs with authentication (Bearer, Basic, API-Key)
- **CSV**: File-based with filtering and header detection
- **WebSocket**: Real-time data streams with parser configuration

### MCP Server (Model Context Protocol)
A standalone MCP server allows external AI agents (like Claude Desktop) to query your data sources:

```bash
# Build the MCP server
cd server-go
go build -o bin/mcp-server cmd/mcp-server/main.go

# Add to Claude Desktop config (~/Library/Application Support/Claude/claude_desktop_config.json):
{
  "mcpServers": {
    "dashboard-datasources": {
      "command": "/path/to/dashboard/server-go/bin/mcp-server",
      "args": []
    }
  }
}
```

**Available MCP Tools:**
| Tool | Description |
|------|-------------|
| `list_datasources` | List all data sources with types and descriptions |
| `get_datasource` | Get detailed info about a specific data source |
| `get_schema` | Get database schema for SQL data sources |
| `query_datasource` | Execute queries against any data source type |

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
│   │   ├── api/              # API client
│   │   ├── components/       # Reusable components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── pages/            # Page components
│   │   ├── theme/            # ECharts Carbon theme
│   │   └── App.jsx           # Main app with routing
│   ├── build.json            # Build number tracker
│   └── package.json
│
├── server-go/                 # Go Backend
│   ├── cmd/
│   │   ├── server/main.go    # Main API server entry point
│   │   └── mcp-server/main.go # MCP server for external AI agents
│   ├── internal/
│   │   ├── database/         # MongoDB, Redis connections
│   │   ├── datasource/       # SQL, API, CSV, Socket adapters
│   │   ├── handlers/         # HTTP handlers
│   │   ├── models/           # Data models
│   │   ├── repository/       # Database operations
│   │   ├── service/          # Business logic
│   │   └── ai/               # AI session management
│   └── docs/                  # Swagger documentation
│
└── docs/                      # Documentation
    ├── ARCHITECTURE.md
    ├── AI_BUILDER_PLAN.md
    └── TECH_STACK_SUMMARY.md
```

## API Endpoints

### Core Resources
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/layouts` | Layout CRUD |
| GET/POST | `/api/datasources` | Data source CRUD |
| GET/POST | `/api/charts` | Chart CRUD (with versioning) |
| GET/POST | `/api/components` | Legacy component CRUD |
| GET/POST | `/api/dashboards` | Dashboard CRUD |

### AI Builder
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/session` | Start AI session |
| GET | `/api/ai/session/:id/stream` | SSE event stream |
| POST | `/api/ai/session/:id/message` | Send message |
| POST | `/api/ai/session/:id/save` | Save chart |
| DELETE | `/api/ai/session/:id` | Cancel session |

### Swagger Documentation
Access at: http://localhost:3001/swagger/index.html

## Development

### Regenerate Swagger Docs
```bash
cd server-go
$GOPATH/bin/swag init -g cmd/server/main.go -o docs --parseDependency --parseInternal
```

### Build Tracking
Every code change increments the build number in `client/build.json`. Current build: **201**

## Documentation

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - System architecture details
- [AI_BUILDER_PLAN.md](docs/AI_BUILDER_PLAN.md) - AI Builder implementation phases
- [TECH_STACK_SUMMARY.md](docs/TECH_STACK_SUMMARY.md) - Technology decisions

## License

MIT
