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
- Use "connection" (not "data source" or "datasource") for external data connections in UI text
- Internal code can use `datasource` for backwards compatibility with existing database records
- API endpoints: `/api/connections` is preferred, `/api/datasources` kept as deprecated alias
- Use "display" (not "chart") for data visualization components in UI text
- Use "control" for interactive components (buttons, sliders, toggles)
- Internal code uses `component_type: 'chart'` in DB for displays (backward compatibility), but UI shows "Display"
- "Component" is the umbrella term for both displays and controls

### 4. Full-Stack Awareness
- **Always consider frontend impact**: When making backend changes (API endpoints, models, response formats), identify and implement the corresponding frontend changes (API client, components, forms, types).
- Backend model changes typically require updates to:
  - `client/src/api/client.js` - API client methods
  - Form components that create/edit the entity
  - Display components that show the entity
  - Any TypeScript types or PropTypes if used
- Don't leave the frontend out of sync with backend changes.

### 5. Testing Reminder
- **Triggers**: Session start, server restart, or daylog write
- **Action**: Immediately remind the user to test:
  - "Don't forget to test! Test plan: [docs/TEST_PLAN.md](docs/TEST_PLAN.md)"
- For session start: Show reminder as first response
- For daylog write: Show reminder immediately after confirming daylog was written

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

**TRVE Dashboards** - A full-stack application for creating, managing, and viewing dynamic data visualization dashboards. The application features:

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
│  - Connections        │  - Real-time Data     │  - User Config (Future)     │
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
│  /api/layouts    │  /api/connections  │  /api/components  │  /api/dashboards│
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              ┌──────────┐   ┌──────────┐   ┌───────────────┐
              │ MongoDB  │   │  Redis   │   │  Connections  │
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
| Go | 1.25.x | Primary Language |
| Gin | 1.x | HTTP Framework |
| MongoDB | 7.x | Primary Database |
| Redis | 7.x | Caching |
| Swaggo | 1.8.x | API Documentation |

## Application Modes

### Design Mode (`/design/*`)
Create and configure dashboard components:
- **Layouts** (`/design/layouts`) - Define 12-column grid layouts with panels
- **Connections** (`/design/connections`) - Configure SQL, API, CSV, WebSocket connections
- **Components** (`/design/charts`) - Build displays (charts, gauges, tables) and controls (buttons, sliders)
- **Dashboards** (`/design/dashboards`) - Combine components with layouts

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
| **Connections** |||
| GET | `/api/connections` | List connections |
| POST | `/api/connections` | Create connection |
| GET | `/api/connections/:id` | Get connection |
| PUT | `/api/connections/:id` | Update connection |
| DELETE | `/api/connections/:id` | Delete connection |
| POST | `/api/connections/test` | Test connection |
| POST | `/api/connections/:id/query` | Execute query |
| **Controls** |||
| POST | `/api/controls/:id/execute` | Execute control command |
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
- Go 1.25+ (via Homebrew on macOS)
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
# Go 1.25 is now the default, no PATH override needed
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

## Current Status (2026-02-13)

### ✅ Completed
- Go backend with MongoDB (layouts, connections, components, dashboards, charts)
- React frontend with three modes (Design, View, Manage placeholder)
- Design Mode: All CRUD pages for layouts, connections, charts, dashboards
- View Mode: Dashboard viewer with real-time refresh, sidebar tiles, reduce-to-fit mode
- Carbon Design System theming throughout (g100 dark theme)
- Auto-redirect to first dashboard on app load
- **Chart Editor**: Full chart builder with live preview, data mapping, filters, aggregation
- **Control Components**: Button, toggle, slider, text input controls that send commands to bidirectional connections
- **Socket Connections**: WebSocket connections with parser config (data_path extraction, JSON/regex parsing)
- **Axis Labels**: Configurable X/Y axis labels for charts (e.g., "Temperature (°F)")
- **Timestamp Formatting**: Utility functions for consistent date/time display in charts
- **Chart Versioning**: Version tracking with increment on save, status (draft/final)
- **AI Builder (Phases 1-7)**: Full-page AI chat with SSE streaming, MCP tools, session management
- **AI Session API**: Start, message, save, cancel endpoints with `/api/ai/session`
- **Custom AI Icon**: Replaced WatsonxAi with custom sparkle icon component
- **SQL Connection Refactor**: Removed connection_string field; connection strings now built from individual fields (host, port, database, username, password, ssl, options)
- **Prometheus Connection**: Full Prometheus integration with schema discovery, visual PromQL builder, and AI tool support
- **EdgeLake Connection**: Full EdgeLake integration with distributed query support, cascading schema discovery (database → table → columns), visual query builder, and AI tool support
- **Terminology Rename**: "Data Sources" renamed to "Connections" throughout UI and API (`/api/connections`)
- **Terminology Rename**: "Chart" renamed to "Display" in UI (DB still uses `component_type: 'chart'` for backward compatibility)

### 🚧 In Progress
- AI Builder Phase 8: Polish & Testing
- Error handling improvements
- Performance optimization

### 📋 Planned
- **Fix Component Tile View Thumbnails**: The component list page tile view shows placeholder icons instead of actual component preview images. Need to generate/capture chart thumbnails when saving components.
- **Fix AI Chart Builder 429 Rate Limit Error**: Hitting Anthropic's 30k input tokens/minute limit after just a few messages. Options: implement retry-with-backoff on 429 errors, trim conversation history to last N messages, or summarize older context to reduce token usage.
- **Tabbed Panel Layout**: Allow panels to contain multiple charts with tabs to switch between
- **Connection Testing in Editor**: Add connection test capability to connection editor UI (backend API already exists at `/api/connections/test`)
- **Dashboard Design Preset Sizes**: Implement solution for layout dimensions/aspect ratios for fullscreen viewing
- **Fix `include_connections` Aggregation**: The `ListWithDatasources` MongoDB aggregation in `dashboard_repository.go` has a bug where `panel_count` returns 0. Currently worked around by fetching dashboards, charts, and connections separately client-side. Fix the aggregation to reduce API calls as dashboard count grows.
- Manage Mode implementation
- User authentication
- ModeContext for shared state (replace localStorage-based mode switching)
- ErrorBoundary component for crash recovery
- Entity-specific hooks (useDashboard, useCharts, etc.)

### ⚠️ Known Issues
- **Firefox: MenuButton alignment** - On the Charts List page, the Create MenuButton has extra spacing from the right edge in Firefox. Works correctly in Chrome and Safari. Root cause: Firefox renders Carbon's MenuButton container differently. Low priority due to Firefox's small market share (~3%).

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
- [EDGELAKE_DATASOURCE_PLAN.md](docs/EDGELAKE_DATASOURCE_PLAN.md) - EdgeLake data source integration plan
- Swagger UI: http://localhost:3001/swagger/index.html

---

**Last Updated**: 2026-01-28
**Build**: 459

## Simulator Services

Simulators are hosted on **trv-srv-001 (100.127.19.27)** with port range 21xxx:

| Service | Endpoint |
|---------|----------|
| ts-store | http://100.127.19.27:21080 |
| WebSocket | ws://100.127.19.27:21081/ws |
| REST API | http://100.127.19.27:21082 |
| CSV Server | http://100.127.19.27:21083 |
| PostgreSQL | 100.127.19.27:21432 |

See `simulators/README.md` for full documentation.