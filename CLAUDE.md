# CLAUDE.md - AI Assistant Guide

This file provides context and guidance for AI assistants working on this project.

## Development Rules

### 1. Build Number Increment
- **CRITICAL**: After every code change that affects functionality, increment the build number in `/client/build.json`
- Report the new build number to the user after incrementing
- Build number helps track changes and ensures proper cache busting
- Format: `{ "buildNumber": N }` where N is an integer

### 2. Code Commit Standards
- Don't mention "Claude" or "AI" in commit messages
- Never include AI mentions in commits

### 3. Terminology
- Don't mention "datasource" (single word) in code or documentation
- Use "data source" (two words) or "source system" instead

---

## React Architecture Rules

These rules establish consistent patterns for the React frontend. Based on 2025 best practices.

### 1. State Management

| State Type | Tool | When to Use |
|------------|------|-------------|
| **Local UI State** | `useState` | Toggles, form inputs, modal open/close, component-specific state |
| **Shared Client State** | `useContext` + `useReducer` | App-wide state (mode, theme, user preferences) |
| **Server/Remote State** | Custom hooks wrapping `apiClient` | Data from backend APIs |

**Rules:**
- Keep state as local as possible - lift only when needed
- Mode state should use Context (not localStorage alone)
- Never duplicate server state in multiple components - use shared hooks

**Future:** Consider TanStack Query for server state caching and background refresh.

### 2. Data Fetching

**ALWAYS use `apiClient`** from `src/api/client.js` - never raw `fetch()` in components.

**Pattern for pages:**
```javascript
// Good - use apiClient
const data = await apiClient.getDashboard(id);

// Bad - raw fetch
const response = await fetch(`http://localhost:3001/api/dashboards/${id}`);
```

**Create entity-specific hooks:**
```javascript
// src/hooks/useDashboard.js
function useDashboard(id) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiClient.getDashboard(id)
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [id]);

  return { data, loading, error, refetch: () => {...} };
}
```

**Existing hooks to use:** `useData`, `useComponents`, `useSources` in `src/hooks/`

### 3. Component Organization

| Type | Location | Responsibility | Max Lines |
|------|----------|----------------|-----------|
| **Pages** | `src/pages/` | Route handling, layout composition, data orchestration | ~400 |
| **Components** | `src/components/` | Reusable UI, receive data via props | ~200 |
| **Hooks** | `src/hooks/` | Reusable logic (data fetching, subscriptions) | ~100 |

**Rules:**
- Pages should NOT contain complex business logic - extract to hooks
- Components should be presentational where possible
- If a component exceeds 400 lines, break it into smaller components

### 4. File Structure (Target)

```
src/
├── api/
│   └── client.js           # API client singleton (ALWAYS use this)
├── hooks/
│   ├── useData.js          # Generic data fetching hook
│   ├── useDashboard.js     # Dashboard-specific hook
│   ├── useCharts.js        # Charts-specific hook
│   └── useDatasources.js   # Data sources-specific hook
├── context/
│   ├── ModeContext.jsx     # App mode (Design/View/Manage)
│   └── ThemeContext.jsx    # Theme preferences (future)
├── components/
│   ├── mode/               # Mode toggle components
│   ├── navigation/         # Nav components per mode
│   ├── charts/             # Chart-related components
│   └── shared/             # Truly shared components
├── pages/                  # Route components
├── utils/                  # Pure utility functions
└── config/                 # Configuration constants
```

### 5. Error Handling

**Rules:**
- **Never use `alert()`** - use Carbon `InlineNotification` or `Modal`
- Wrap app in `ErrorBoundary` component for crash recovery
- Data fetching errors: Show inline notification with retry option
- Form validation errors: Show per-field errors, not just form-level

**Pattern:**
```javascript
// Good
{error && (
  <InlineNotification
    kind="error"
    title="Failed to load"
    subtitle={error.message}
    actions={<Button onClick={refetch}>Retry</Button>}
  />
)}

// Bad
catch (err) {
  alert(err.message);
}
```

### 6. Forms

**Current:** Controlled components with individual `useState` calls.

**Rules:**
- Use Carbon form components exclusively
- Validate on blur/submit, not on every keystroke
- Track dirty state with single `hasChanges` boolean
- Show field-level validation errors

**Future:** Consider React Hook Form for complex forms to reduce boilerplate.

### 7. Styling

**Rules:**
- One SCSS file per component, co-located (e.g., `Page.jsx` + `Page.scss`)
- Use Carbon CSS variables: `var(--cds-text-primary)`, `var(--cds-background)`
- Use Carbon spacing tokens: `spacing.$spacing-05`
- Never hardcode colors - use Carbon tokens
- Minimal inline styles (only for truly dynamic values like dimensions)

**Carbon Token Hierarchy (prefer abstract tokens):**

Use the most abstract (semantic) token available. This ensures theme compatibility if switching between light/dark modes:

| Level | Example | When to Use |
|-------|---------|-------------|
| **Semantic tokens** (best) | `theme.$button-disabled`, `var(--cds-text-primary)` | Always prefer - adapts to theme |
| **Role tokens** | `var(--cds-layer-01)`, `var(--cds-border-subtle-01)` | For layout/structural elements |
| **Primitive colors** (avoid) | `$gray-70`, `#525252` | Only when no semantic token exists |

**SCSS Pattern for Theme Tokens:**
```scss
@use 'sass:map';
@use '@carbon/styles/scss/themes' as themes;
@use '@carbon/styles/scss/theme' as theme with (
  $theme: themes.$g100
);

// Good - extract from theme map (theme-aware, change themes.$g100 to switch themes)
--cds-button-disabled: #{map.get(themes.$g100, 'button-disabled')};

// Bad - hardcoded hex value
--cds-button-disabled: #525252;
```

**CSS Variable Overrides:**
- Set global overrides on `:root` in `App.scss` (not component-level) for portal compatibility
- Use `map.get(themes.$g100, 'token-name')` to extract values from the theme map
- To switch themes, change `themes.$g100` to `themes.$white`, `themes.$g10`, or `themes.$g90`

---

## Project Overview

**GiVi-Solution Dashboard** - A full-stack application for creating, managing, and viewing dynamic data visualization dashboards. The application features:

1. **Three Operating Modes**: Design, View, and Manage
2. **Dynamic Chart Builder**: Create React components with ECharts visualizations
3. **Multi-Source Data**: Connect to SQL, API, CSV, and WebSocket data sources
4. **Real-time Updates**: Auto-refresh dashboards with configurable intervals

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Port 5173)                                 │
│                    React 18 + Vite + Carbon Design System                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Design Mode          │  View Mode            │  Manage Mode                │
│  - Layouts            │  - Dashboard Viewer   │  - Settings (Future)        │
│  - Data Sources       │  - Real-time Data     │  - User Config (Future)     │
│  - Charts/Components  │  - Auto-refresh       │                             │
│  - Dashboards         │  - Fullscreen         │                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ REST API
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      GO BACKEND (Port 3001)                                  │
│                    Gin + MongoDB + Redis + Swagger                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  /api/layouts    │  /api/datasources  │  /api/components  │  /api/dashboards│
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

### Backend (Go)
| Technology | Version | Purpose |
|------------|---------|---------|
| Go | 1.23.x | Primary Language |
| Gin | 1.x | HTTP Framework |
| MongoDB | 7.x | Primary Database |
| Redis | 7.x | Caching |
| Swaggo | 1.8.x | API Documentation |

## Application Modes

### Design Mode (`/design/*`)
Create and configure dashboard components:
- **Layouts** (`/design/layouts`) - Define 12-column grid layouts with panels
- **Data Sources** (`/design/datasources`) - Configure SQL, API, CSV, WebSocket connections
- **Charts** (`/design/charts`) - Build React components with ECharts
- **Dashboards** (`/design/dashboards`) - Combine layouts with components

### View Mode (`/view/*`)
End-user dashboard viewing:
- **Dashboard Viewer** (`/view/dashboards/:id`) - View dashboards with real-time data
- Sidebar shows selectable dashboard tiles
- Auto-refresh based on dashboard settings
- Fullscreen viewing capability

### Manage Mode (`/manage`) - Future
System administration and user configuration.

## File Structure

```
dashboard/
├── client/                    # React Frontend
│   ├── src/
│   │   ├── api/              # API client
│   │   ├── components/
│   │   │   ├── mode/         # ModeToggle, ModeSelector
│   │   │   ├── navigation/   # DesignModeNav, ViewModeNav, ManageModeNav
│   │   │   └── ...           # DynamicComponentLoader, etc.
│   │   ├── config/           # layoutConfig.js (MODES enum)
│   │   ├── pages/            # All page components
│   │   ├── theme/            # carbonEchartsTheme.js
│   │   ├── App.jsx           # Main app with routing
│   │   └── App.scss          # Global styles
│   ├── build.json            # Build number tracker
│   └── package.json
│
├── server-go/                 # Go Backend (Main API + AI Integration)
│   ├── cmd/server/main.go    # Entry point
│   ├── config/               # Configuration (Viper)
│   ├── internal/
│   │   ├── ai/               # AI agent, tools, system prompt
│   │   ├── database/         # MongoDB, Redis connections
│   │   ├── datasource/       # SQL, API, CSV, Socket adapters
│   │   ├── handlers/         # HTTP handlers
│   │   ├── mcp/              # MCP SSE endpoint
│   │   ├── models/           # Data models
│   │   ├── repository/       # Database operations
│   │   └── service/          # Business logic
│   └── docs/                  # Swagger documentation
│
└── docs/                      # Documentation
    ├── ARCHITECTURE.md
    ├── TECH_STACK_SUMMARY.md
    └── REFACTOR_PLAN.md
```

## API Endpoints

### Go Backend (Port 3001)

| Method | Endpoint | Description |
|--------|----------|-------------|
| **Layouts** |||
| GET | `/api/layouts` | List layouts (paginated) |
| POST | `/api/layouts` | Create layout |
| GET | `/api/layouts/:id` | Get layout |
| PUT | `/api/layouts/:id` | Update layout |
| DELETE | `/api/layouts/:id` | Delete layout |
| **Data Sources** |||
| GET | `/api/datasources` | List data sources |
| POST | `/api/datasources` | Create data source |
| GET | `/api/datasources/:id` | Get data source |
| PUT | `/api/datasources/:id` | Update data source |
| DELETE | `/api/datasources/:id` | Delete data source |
| POST | `/api/datasources/test` | Test connection |
| POST | `/api/datasources/:id/query` | Execute query |
| **Components** |||
| GET | `/api/components` | List components |
| GET | `/api/components/systems` | Get system hierarchy |
| POST | `/api/components` | Create component |
| GET | `/api/components/:id` | Get component |
| PUT | `/api/components/:id` | Update component |
| DELETE | `/api/components/:id` | Delete component |
| **Charts** |||
| GET | `/api/charts` | List charts |
| POST | `/api/charts` | Create chart |
| GET | `/api/charts/:id` | Get chart |
| PUT | `/api/charts/:id` | Update chart |
| DELETE | `/api/charts/:id` | Delete chart |
| **Dashboards** |||
| GET | `/api/dashboards` | List dashboards |
| POST | `/api/dashboards` | Create dashboard |
| GET | `/api/dashboards/:id` | Get dashboard |
| GET | `/api/dashboards/:id/details` | Get with expanded data |
| PUT | `/api/dashboards/:id` | Update dashboard |
| DELETE | `/api/dashboards/:id` | Delete dashboard |
| **AI Sessions** |||
| POST | `/api/ai/sessions` | Create AI session |
| GET | `/api/ai/sessions/:id` | Get session state |
| POST | `/api/ai/sessions/:id/messages` | Send message (SSE streaming) |
| GET | `/api/ai/sessions/:id/ws` | WebSocket connection |
| POST | `/api/ai/sessions/:id/save` | Save session |
| DELETE | `/api/ai/sessions/:id` | Cancel session |
| **MCP** |||
| GET | `/mcp/sse` | SSE connection for MCP |
| POST | `/mcp/message` | Send MCP message |

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

# Start Go backend (Terminal 1)
cd server-go
export PATH="/opt/homebrew/opt/go@1.23/bin:$PATH"
go build -o bin/server cmd/server/main.go && ./bin/server

# Start React frontend (Terminal 2)
cd client
npm install
npm run dev
```

### URLs
- Frontend: http://localhost:5173
- Go API: http://localhost:3001
- Swagger UI: http://localhost:3001/swagger/index.html

## UI Framework: Carbon Design System

**Enforced Dark Mode**: g100 theme

**CRITICAL**: Always use Carbon React components - never create custom UI components.

### Common Components
- Forms: `TextInput`, `Select`, `NumberInput`, `Checkbox`, `Toggle`
- Buttons: `Button`, `IconButton`
- Data: `DataTable`, `Tag`, `Tile`
- Feedback: `Modal`, `Loading`, `InlineNotification`
- Navigation: `Header`, `SideNav`, `SideNavLink`

### Color Tokens
- Primary Blue: `#0f62fe` (blue60)
- Green: `#24a148` (green50)
- Red: `#da1e28` (red60)
- Gray: `#161616` to `#f4f4f4`

Use CSS variables: `var(--cds-text-primary)`, `var(--cds-background)`, etc.

## Dynamic Component Loading

Components are stored as JavaScript code strings and evaluated at runtime.

**Available in component scope:**
- React hooks: `useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`
- ECharts: `echarts`, `ReactECharts`
- Themes: `carbonTheme`, `carbonDarkTheme`

**Example Component:**
```javascript
const Component = () => {
  const option = {
    xAxis: { type: 'category', data: ['A', 'B', 'C'] },
    yAxis: { type: 'value' },
    series: [{ data: [120, 200, 150], type: 'bar' }]
  };
  return <ReactECharts option={option} theme="carbon-dark" />;
};
```

## Grid System

12-column grid with 32px row height (based on Carbon $spacing-08):

```
┌────────────────────────────────────────────────────────────────┐
│  1   2   3   4   5   6   7   8   9  10  11  12                │
├────────────────────────────────────────────────────────────────┤
│ Panel A (x:0, y:0, w:6, h:8)  │  Panel B (x:6, y:0, w:6, h:4) │
│                               ├────────────────────────────────┤
│                               │  Panel C (x:6, y:4, w:6, h:4) │
└───────────────────────────────┴────────────────────────────────┘
```

## Current Status (2025-12-06)

### ✅ Completed
- Go backend with MongoDB (layouts, data sources, components, dashboards, charts)
- React frontend with three modes (Design, View, Manage placeholder)
- Design Mode: All CRUD pages for layouts, data sources, charts, dashboards
- View Mode: Dashboard viewer with real-time refresh, sidebar tiles, reduce-to-fit mode
- Carbon Design System theming throughout (g100 dark theme)
- Auto-redirect to first dashboard on app load
- **Chart Editor**: Full chart builder with live preview, data mapping, filters, aggregation
- **Socket Data Sources**: WebSocket connections with parser config (data_path extraction, JSON/regex parsing)
- **Axis Labels**: Configurable X/Y axis labels for charts (e.g., "Temperature (°F)")
- **Timestamp Formatting**: Utility functions for consistent date/time display in charts
- **Chart Versioning**: Version tracking with increment on save, status (draft/final)
- **AI Builder (Phases 1-7)**: Full-page AI chat with SSE streaming, MCP tools, session management
- **AI Session API**: Start, message, save, cancel endpoints with `/api/ai/session`
- **Custom AI Icon**: Replaced WatsonxAi with custom sparkle icon component

### 🚧 In Progress
- AI Builder Phase 8: Polish & Testing
- Error handling improvements
- Performance optimization

### 📋 Planned
- **Tabbed Panel Layout**: Allow panels to contain multiple charts with tabs to switch between
- **Data Source Testing in Editor**: Add connection test capability to data source editor UI (backend API already exists at `/api/datasources/test`)
- **Dashboard Design Preset Sizes**: Implement solution for layout dimensions/aspect ratios for fullscreen viewing
- **Fix `include_datasources` Aggregation**: The `ListWithDatasources` MongoDB aggregation in `dashboard_repository.go` has a bug where `panel_count` returns 0. Currently worked around by fetching dashboards, charts, and datasources separately client-side. Fix the aggregation to reduce API calls as dashboard count grows.
- **Prometheus Data Source**: Add Prometheus as a new data source type with schema discovery, visual query builder, and AI integration. See [docs/PROMETHEUS_INTEGRATION.md](docs/PROMETHEUS_INTEGRATION.md) for full plan.
- Manage Mode implementation
- User authentication
- EdgeLake integration
- ModeContext for shared state (replace localStorage-based mode switching)
- ErrorBoundary component for crash recovery
- Entity-specific hooks (useDashboard, useCharts, etc.)
---

## Key Files to Understand

1. `client/src/App.jsx` - Main app with routing and mode switching
2. `client/src/pages/DashboardViewerPage.jsx` - Dashboard rendering in View Mode
3. `client/src/components/DynamicComponentLoader.jsx` - Runtime component evaluation
4. `server-go/cmd/server/main.go` - Go backend entry point
5. `server-go/internal/handlers/` - API request handlers
6. `server-go/internal/ai/system_prompt.go` - AI component specification

## Documentation

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - System architecture
- [TECH_STACK_SUMMARY.md](docs/TECH_STACK_SUMMARY.md) - Technology decisions
- [REFACTOR_PLAN.md](docs/REFACTOR_PLAN.md) - Refactoring roadmap
- [PROMETHEUS_INTEGRATION.md](docs/PROMETHEUS_INTEGRATION.md) - Prometheus data source integration plan
- Swagger UI: http://localhost:3001/swagger/index.html

---

**Last Updated**: 2025-12-15
**Build**: 337
- Capture Simulator Websocket: websocat ws://100.74.102.38:8081/ws