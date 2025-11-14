# GiVi-Solution Dashboard - Architecture & Design

**Version**: 2.1
**Last Updated**: 2025-11-14
**Status**: Active Development - Data Layer, MCP, Interactive Patterns Complete

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Architecture Diagrams](#architecture-diagrams)
4. [Component Architecture](#component-architecture)
5. [Data Layer Architecture](#data-layer-architecture) ⭐ NEW
6. [MCP Server Integration](#mcp-server-integration) ⭐ NEW
7. [Data Flow](#data-flow)
8. [Technology Stack](#technology-stack)
9. [Design Decisions](#design-decisions)
10. [Security Considerations](#security-considerations)
11. [Performance & Scalability](#performance--scalability)
12. [Future Roadmap](#future-roadmap)

---

## Executive Summary

The GiVi-Solution Dashboard is a full-stack web application designed to monitor and manage distributed database clusters. It combines real-time monitoring capabilities with a dynamic component builder, interactive patterns, and an intelligent data layer, allowing users to:

- **Monitor cluster health** - Track nodes, queries, storage, and performance metrics in dark mode
- **Analyze queries** - View query history, execution times, and status
- **Manage nodes** - Monitor individual node resources and health
- **Build custom visualizations** - Create reusable dashboard components with full interactivity
- **Add interactive controls** - Checkboxes, dropdowns, sliders, and timeline zoom
- **Query data efficiently** - Intelligent caching with time-series gap detection
- **Use AI assistants** - MCP server for component creation and data source management

### Key Features

- **Multi-page dashboard** with Carbon Design System UI Shell (g100 dark theme)
- **IBM Cloud-style header** with utility icons and GiVi-Solution branding
- **Real-time metrics** with auto-refresh capabilities and smart caching
- **ECharts visualizations** themed for Carbon dark mode with interactive patterns
- **Dynamic component builder** for custom widgets with user controls
- **Interactive patterns** - Dynamic filtering, timeline zoom, real-time updates, multi-series ⭐ NEW
- **Intelligent data layer** with time-series caching and query optimization
- **MCP Server** for AI assistant integration
- **Component specification** with interactive pattern examples
- **File-based storage** for components and data sources (no database required)
- **RESTful API** for component and data management

---

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  React Application (Vite)                             │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  Carbon UI Shell                                 │  │  │
│  │  │  ├─ Dashboard Page (real-time metrics)          │  │  │
│  │  │  ├─ Nodes Page (cluster status)                 │  │  │
│  │  │  ├─ Queries Page (query history)                │  │  │
│  │  │  └─ Chart Design Page (component builder)       │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │                                                          │  │
│  │  React Router ←→ Components ←→ useData Hook ⭐           │  │
│  │                                      ↓                   │  │
│  │                                 API Client               │  │
│  └───────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP/REST
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Node.js Server (Express)                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  REST API Endpoints                                   │  │
│  │  ├─ /api/components (CRUD)                           │  │
│  │  ├─ /api/datasources (list systems/sources)          │  │
│  │  ├─ /api/data/query (query with caching) ⭐          │  │
│  │  └─ /health (health check)                           │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  MCP Server (Model Context Protocol) ⭐              │  │
│  │  ├─ /mcp/tools (list available tools)               │  │
│  │  ├─ /mcp/component-spec (design constraints)        │  │
│  │  └─ Tools: datasources, components, query_data      │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Service Layer ⭐                                     │  │
│  │  ├─ Data Layer Service (query execution)            │  │
│  │  ├─ Cache Coordinator (time-series caching)         │  │
│  │  ├─ Datasource Service (datasource management)      │  │
│  │  └─ File Manager (component storage)                │  │
│  └───────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │ File I/O & HTTP
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Storage & External Systems                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  File System                                        │   │
│  │  ├─ data/index.json (component registry)           │   │
│  │  ├─ data/datasources.json (datasource configs)     │   │
│  │  └─ data/{system}/{source}/{component}.json        │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  data source Cluster (External)                       │   │
│  │  ├─ REST API endpoints                             │   │
│  │  └─ Query execution                                │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### System Responsibilities

#### Frontend (Client)
- **UI Rendering** - Carbon Design System components
- **Routing** - React Router for navigation
- **State Management** - React hooks (useState, useEffect)
- **Data Fetching** - API client with hooks
- **Visualizations** - ECharts with Carbon theme
- **Dynamic Components** - Runtime code evaluation

#### Backend (Server)
- **API Layer** - Express REST endpoints
- **Storage Management** - File operations abstraction
- **Index Management** - Keep registry in sync with files
- **Health Monitoring** - Basic health check endpoint

#### Storage (File System)
- **Component Storage** - JSON files by system/source
- **Index Registry** - Master list of all components
- **Git-Friendly** - Human-readable, trackable

---

## Architecture Diagrams

### Application Flow

```
User Actions → Routes → Pages → Components → Hooks → API Client → Server → File Manager → Files

Example: View Dashboard
1. User navigates to /dashboard
2. React Router loads DashboardPage
3. DashboardPage uses mock data (currently)
4. Renders: Metric Cards + ECharts + DataTable
5. Auto-refreshes every 5 seconds

Example: Create Component
1. User clicks "+" in header
2. Navigates to /chart-design
3. Custom event triggers create mode
4. ComponentEditor renders
5. User enters code + metadata
6. Saves via API client
7. POST /api/components
8. File Manager creates JSON file
9. Updates index.json
10. Returns success
```

### Component Hierarchy

```
App.jsx (Router + UI Shell)
├─ Header (global navigation)
├─ SideNav (page navigation)
│  ├─ Dashboard link
│  ├─ Nodes link
│  ├─ Queries link
│  └─ Chart Design link
└─ Content (page routes)
   ├─ DashboardPage
   │  ├─ MetricCards (4x)
   │  ├─ ReactECharts (line chart)
   │  └─ DataTable (queries)
   ├─ NodesPage
   │  └─ NodeCards (grid)
   ├─ QueriesPage
   │  ├─ Filters (search + status)
   │  ├─ DataTable
   │  └─ Pagination
   └─ ChartDesignPage
      ├─ ComponentSelector (sidebar)
      └─ ComponentViewer | ComponentEditor
         └─ DynamicComponentLoader
```

---

## Component Architecture

### Frontend Components

#### Pages (Route Components)

**DashboardPage** (`/dashboard`)
- Purpose: Cluster monitoring overview
- Features:
  - 4 metric cards (nodes, queries/sec, storage, uptime)
  - Line chart (query latency over time)
  - Recent queries table
  - Auto-refresh every 5 seconds
- Data Source: Mock data (to be replaced with real API)
- Dependencies: Carbon (Tile, Tag, DataTable), ECharts

**NodesPage** (`/nodes`)
- Purpose: Cluster node status and resource monitoring
- Features:
  - Grid layout of node cards
  - Status indicators (active/inactive)
  - CPU and memory usage bars
  - Query count per node
- Data Source: Mock data
- Dependencies: Carbon (Tile, Tag)

**QueriesPage** (`/queries`)
- Purpose: Query history and analysis
- Features:
  - Search by query text
  - Filter by status
  - Sortable columns
  - Pagination (10/20/30/40/50 per page)
- Data Source: Mock data
- Dependencies: Carbon (DataTable, Pagination, TextInput, Select)

**ChartDesignPage** (`/chart-design`)
- Purpose: Dynamic component builder
- Features:
  - Component selector sidebar
  - Component viewer with code toggle
  - Component editor (create/edit)
  - Live preview
- Data Source: Server API
- Dependencies: ComponentSelector, ComponentViewer, ComponentEditor

#### Shared Components

**DynamicComponentLoader**
- Purpose: Evaluate and render user-created components at runtime
- How It Works:
  1. Receives component code as string
  2. Creates execution context with React hooks + ECharts
  3. Uses `new Function()` to evaluate code
  4. Renders result in error boundary
- Security: Runs in browser sandbox, same-origin policy
- Available APIs: React hooks, echarts, ReactECharts, Carbon themes

**ComponentSelector**
- Purpose: Navigate and select components
- Features: Tree view by system/source, search, create button

**ComponentViewer**
- Purpose: Display component with metadata
- Features: Live preview, code toggle, edit/delete actions

**ComponentEditor**
- Purpose: Create/edit components
- Features: Form inputs, code editor, validation, save/cancel

### Backend Components

**Express Server** (`server/server.js`)
- Port: 3001
- CORS: Enabled for localhost:5173
- Routes: /api/components, /api/datasources, /health

**File Manager** (`server/storage/fileManager.js`)
- Purpose: Abstract file system operations
- Methods:
  - `getAllComponents()` - Read index.json
  - `getComponent(system, source, name)` - Read specific file
  - `saveComponent(component)` - Write file + update index
  - `deleteComponent(system, source, name)` - Remove file + update index
  - `rebuildIndex()` - Scan file system and rebuild index

**Components API** (`server/api/components.js`)
- `GET /api/components` - List all components (optional filters)
- `GET /api/components/:system/:source/:name` - Get specific component
- `POST /api/components` - Create new component
- `PUT /api/components/:system/:source/:name` - Update component
- `DELETE /api/components/:system/:source/:name` - Delete component

**Data Sources API** (`server/api/datasources.js`)
- `GET /api/datasources` - List all systems and sources

---

## Data Flow

### Reading Components

```
1. User navigates to /chart-design
2. ComponentSelector mounts
3. useComponents hook runs
4. API client: GET /api/components
5. Server: fileManager.getAllComponents()
6. File system: read data/index.json
7. Returns: { components: [...] }
8. Hook updates state
9. ComponentSelector renders list
```

### Creating Components

```
1. User clicks "+" button
2. Navigates to /chart-design
3. ComponentEditor renders in create mode
4. User fills form (system, source, name, code, description)
5. User clicks Save
6. API client: POST /api/components
   Body: { system, source, name, component_code, description, metadata }
7. Server validates input
8. fileManager.saveComponent()
   a. Generate UUID
   b. Create directory if needed: data/{system}/{source}/
   c. Write file: data/{system}/{source}/{name}.json
   d. Update index.json
9. Returns: { success: true, component: {...} }
10. Client shows success message
11. Reloads component list
```

### Dynamic Component Execution

```
1. User selects component
2. ComponentViewer fetches component data
3. Extracts component_code string
4. Passes to DynamicComponentLoader
5. DynamicComponentLoader:
   a. Create execution context with React, ECharts, etc.
   b. Evaluate: new Function('React', 'useState', ..., component_code)
   c. Execute function to get Component
   d. Render: <Component />
6. Component renders with live data
7. User sees visualization
```

### Mock Data Generation (Current Development State)

```
1. DashboardPage mounts
2. Imports: generateQueryLatencyData(), generateRecentQueries(), getClusterMetrics()
3. mockData.js generates:
   - Latency: 61 data points (last hour, 1-minute intervals)
   - Queries: 10 random queries with status/duration/node
   - Metrics: Random values for nodes/queries/storage/uptime
4. useEffect sets interval: refresh every 5 seconds
5. Page re-renders with new mock data
```

**Note**: Mock data will be replaced with real data source API calls in production.

---

## Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.2+ | UI framework |
| Vite | 5.x | Build tool and dev server |
| React Router DOM | 6.x | Client-side routing |
| Carbon Design System | @carbon/react 1.95+ | UI component library |
| Carbon Icons | @carbon/icons-react | Icon library |
| ECharts | 6.0+ | Data visualization |
| echarts-for-react | 3.0+ | React wrapper for ECharts |
| SCSS | - | Styling with Carbon tokens |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 18+ | JavaScript runtime |
| Express | 4.x | Web framework |
| Axios | Latest | HTTP client for data source API calls ⭐ |
| UUID | - | Unique ID generation |
| CORS | - | Cross-origin support |

### Development Tools

| Tool | Purpose |
|------|---------|
| Nodemon | Auto-restart server on changes |
| ESLint | Code linting |
| Git | Version control |

### File Structure

```
dashboard/
├── client/                    # Frontend application
│   ├── public/               # Static assets
│   ├── src/
│   │   ├── api/              # API client
│   │   │   └── client.js
│   │   ├── components/       # Shared components
│   │   │   ├── ComponentEditor.jsx
│   │   │   ├── ComponentSelector.jsx
│   │   │   ├── ComponentViewer.jsx
│   │   │   └── DynamicComponentLoader.jsx
│   │   ├── hooks/            # Custom React hooks
│   │   │   ├── useComponents.js
│   │   │   └── useDataSources.js
│   │   ├── pages/            # Route components
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── NodesPage.jsx
│   │   │   ├── QueriesPage.jsx
│   │   │   └── ChartDesignPage.jsx
│   │   ├── theme/            # ECharts themes
│   │   │   └── carbonEchartsTheme.js
│   │   ├── utils/            # Utilities
│   │   │   └── mockData.js
│   │   ├── App.jsx           # Root component
│   │   ├── App.scss          # Global styles
│   │   └── main.jsx          # Entry point
│   ├── package.json
│   └── vite.config.js
│
├── server/                    # Backend application
│   ├── api/                  # API routes
│   │   ├── components.js
│   │   └── datasources.js
│   ├── services/             # Service layer ⭐ NEW
│   │   ├── dataLayerService.js      # Query execution + caching
│   │   ├── cacheCoordinator.js      # Time-series caching
│   │   └── datasourceService.js     # Datasource management
│   ├── mcp/                  # MCP Server ⭐ NEW
│   │   ├── mcpServer.js             # MCP tools and handlers
│   │   └── componentSpec.js         # Component specification
│   ├── storage/              # Storage layer
│   │   └── fileManager.js
│   ├── server.js             # Entry point
│   └── package.json
│
├── data/                      # Storage
│   ├── index.json            # Component registry
│   ├── datasources.json      # Datasource configs ⭐ NEW
│   └── {system}/
│       └── {source}/
│           └── {component}.json
│
├── package.json                        # Root package (convenience scripts)
├── ARCHITECTURE.md                     # This file
├── DATA_LAYER_IMPLEMENTATION.md        # Data layer docs ⭐ NEW
├── MCP_COMPONENT_SPEC.md              # MCP component spec docs ⭐ NEW
├── COMPONENT_SPEC_SUMMARY.md           # Quick reference ⭐ NEW
├── CLAUDE.md                           # AI assistant guide
├── README.md                           # User documentation
└── QUICKSTART.md                       # Quick start guide
```

---

## Design Decisions

### 1. Why File-Based Storage?

**Decision**: Store components as JSON files instead of using a database.

**Rationale**:
- ✅ **Simplicity** - No database setup, no connection management
- ✅ **Git-Friendly** - Version control built-in, easy diffs
- ✅ **Human-Readable** - JSON files can be edited directly
- ✅ **Portability** - Easy backup, migration, deployment
- ✅ **Low Overhead** - Perfect for 100s-1000s of components

**Trade-offs**:
- ❌ **Scalability** - May struggle with 10,000+ components
- ❌ **Concurrency** - File locking issues with multiple writers
- ❌ **Query Performance** - No indexing, full scans required

**When to Reconsider**: If component count exceeds 5,000 or concurrent writes become common.

### 2. Why Dynamic Component Loading?

**Decision**: Allow users to write React code as strings and execute at runtime.

**Rationale**:
- ✅ **Flexibility** - Users can create any visualization
- ✅ **No Rebuild** - Add components without recompiling
- ✅ **Rapid Prototyping** - Test ideas quickly
- ✅ **Version Control** - Component code stored in JSON

**Trade-offs**:
- ❌ **Security Risk** - Code execution (mitigated by browser sandbox)
- ❌ **No TypeScript** - No compile-time type checking
- ❌ **Limited IDE Support** - No autocomplete in editor

**Security Model**: Components run in browser with same-origin policy. No access to server resources.

### 3. Why React Router?

**Decision**: Use client-side routing for multi-page application.

**Rationale**:
- ✅ **Better UX** - Instant navigation, no full page reloads
- ✅ **State Preservation** - Maintain app state across routes
- ✅ **URL Management** - Deep linking, browser history
- ✅ **Code Splitting** - Load pages on demand

**Alternative Considered**: Multi-page app with server-side routing (rejected: too slow, poor UX).

### 4. Why Carbon Design System?

**Decision**: Use IBM's Carbon instead of Material UI or Bootstrap.

**Rationale**:
- ✅ **Enterprise-Grade** - Professional, accessible, tested
- ✅ **Comprehensive** - All components we need
- ✅ **Dark Theme** - Built-in g100 theme
- ✅ **Data Viz Friendly** - Works well with ECharts
- ✅ **Consistent** - Design language across all pages

**Trade-offs**:
- ❌ **Bundle Size** - Larger than minimal frameworks
- ❌ **Learning Curve** - Specific conventions to learn

### 5. Why ECharts?

**Decision**: Use ECharts for data visualizations instead of D3.js or Chart.js.

**Rationale**:
- ✅ **Feature-Rich** - 20+ chart types out of the box
- ✅ **Performance** - Canvas rendering, handles large datasets
- ✅ **Interactive** - Zoom, pan, tooltips, legend
- ✅ **Themeable** - Custom Carbon theme easy to create
- ✅ **React Integration** - echarts-for-react wrapper

**Alternative Considered**: D3.js (rejected: too low-level, steep learning curve).

### 6. Why Mock Data?

**Decision**: Use mock data generators during development.

**Rationale**:
- ✅ **Independent Development** - Frontend without backend data source API
- ✅ **Predictable Testing** - Consistent data for UI testing
- ✅ **Demo Mode** - Show capabilities without real cluster

**Future**: Replace with real data source API calls when available.

---

## Security Considerations

### Dynamic Component Execution

**Threat**: Malicious code execution via user-created components.

**Mitigations**:
1. **Browser Sandbox** - Code runs in browser context only
2. **Same-Origin Policy** - No cross-origin requests
3. **No Server Access** - Cannot access backend resources
4. **Limited API** - Only React hooks and ECharts available
5. **User Awareness** - Users should trust component code they run

**Future Enhancements**:
- Component code review/approval workflow
- Sandboxed iframe execution
- Content Security Policy headers
- Component signing/verification

### API Security

**Current State**: No authentication/authorization.

**Risks**:
- Anyone can create/edit/delete components
- No user isolation
- No audit logging

**Future Enhancements**:
- JWT-based authentication
- Role-based access control (RBAC)
- API rate limiting
- Audit logs for all mutations

### File System Security

**Current State**: Server has full file system access.

**Mitigations**:
- Path validation (prevent directory traversal)
- Restricted to `data/` directory only
- No arbitrary file operations

**Future Enhancements**:
- Chroot jail for storage directory
- File system quotas per user
- Virus scanning for uploaded content

---

## Performance & Scalability

### Current Performance Profile

#### Frontend
- **Initial Load**: ~500ms (depends on network)
- **Route Navigation**: <100ms (client-side routing)
- **Component Rendering**: <50ms for most components
- **ECharts Rendering**: 100-500ms depending on data size
- **Auto-Refresh Impact**: Minimal (only re-renders changed components)

#### Backend
- **Health Check**: <10ms
- **List Components**: 10-50ms (depends on component count)
- **Get Component**: 5-20ms (single file read)
- **Save Component**: 20-100ms (write + index update)
- **Delete Component**: 20-100ms (remove + index update)

### Scalability Limits

#### File-Based Storage
- **Theoretical Max**: 10,000+ components
- **Practical Max**: ~1,000 components (before performance degrades)
- **Bottleneck**: Index.json becomes large, slow to parse

**Solutions**:
- Implement pagination in index
- Add caching layer (Redis)
- Switch to database (PostgreSQL, MongoDB)

#### Dynamic Components
- **Max Concurrent Renders**: Limited by browser (typically 6 per domain)
- **Component Complexity**: No hard limit, but complex charts may lag

**Solutions**:
- Lazy load off-screen components
- Implement virtual scrolling for large grids
- Add loading skeletons

#### Auto-Refresh
- **Current**: Every 5 seconds for all data
- **Impact**: Acceptable for 10-20 components
- **Scalability Issue**: May overwhelm server with 100+ active users

**Solutions**:
- WebSocket for real-time updates
- Server-sent events (SSE)
- Incremental updates (only changed data)

### Optimization Opportunities

1. **Code Splitting** - Split routes into separate bundles
2. **Lazy Loading** - Load components on demand
3. **Memoization** - React.memo for expensive components
4. **Virtual Scrolling** - For long lists (queries, components)
5. **CDN** - Serve static assets from CDN
6. **Service Worker** - Cache API responses offline
7. **Index Caching** - Cache index.json in memory on server

---

## Future Roadmap

### ✅ Completed (November 2025)
- [x] **Data Layer Architecture** - Query execution with caching
- [x] **Cache Coordinator** - Time-series gap detection and merging
- [x] **Datasource Service** - Datasource configuration management
- [x] **MCP Server** - AI assistant integration
- [x] **Component Specification** - Design constraints for AI-generated components
- [x] **Multi-page Dashboard** - Dashboard, Nodes, Queries, Chart Design pages
- [x] **Carbon UI Shell** - Side navigation and professional UI
- [x] **ECharts Integration** - Charts with Carbon theme

### Phase 1: Complete Data Layer Integration (Immediate - Dec 2025)
- [ ] Convert services to ES modules (from CommonJS)
- [ ] Wire data layer services into Express server
- [ ] Implement React `useData` hook
- [ ] Update components to use real data instead of mock
- [ ] Connect to real database cluster
- [ ] Test end-to-end data flow
- [ ] Add error handling and loading states

### Phase 2: data source Integration (Q1 2025)
- [ ] Implement authentication for datasources
- [ ] Real-time metrics via WebSocket
- [ ] Query execution interface in UI
- [ ] Node management (start/stop/restart)
- [ ] Multi-cluster support

### Phase 3: Enhanced Monitoring (Q2 2025)
- [ ] Node detail drill-down page
- [ ] Query detail drill-down page
- [ ] Alert system (threshold-based)
- [ ] Email/Slack notifications
- [ ] Custom dashboards (multiple layouts)
- [ ] Dashboard templates
- [ ] Performance profiling

### Phase 4: Advanced Features (Q3 2025)
- [ ] User authentication & RBAC
- [ ] Component marketplace (share user-created components)
- [ ] Component versioning
- [ ] Collaborative editing
- [ ] Dashboard sharing (public links)
- [ ] Export dashboards (PDF, PNG)
- [ ] AI-powered query optimization suggestions

### Phase 5: Enterprise Features (Q4 2025)
- [ ] Multi-tenancy
- [ ] SSO integration (SAML, OAuth)
- [ ] Audit logs
- [ ] Backup/restore
- [ ] High availability setup
- [ ] Database migration (PostgreSQL) for scale
- [ ] Advanced caching strategies (Redis)

### Deferred / Nice-to-Have
- [ ] Mobile responsive design
- [ ] Mobile app (React Native)
- [ ] Anomaly detection with ML
- [ ] Predictive analytics
- [ ] Custom plugins system
- [ ] Natural language query interface (AI-powered)
- [ ] Advanced MCP capabilities (streaming data, webhooks)

---

## Appendix

### Glossary

- **Component** - A reusable dashboard widget created by users
- **System** - High-level category (e.g., "datasource", "analytics")
- **Source** - Subcategory within a system (e.g., "metrics", "logs")
- **Dynamic Loader** - Runtime code evaluator for user components
- **File Manager** - Server abstraction for file operations
- **Mock Data** - Simulated data for development/testing

### References

- [Carbon Design System Documentation](https://carbondesignsystem.com/)
- [ECharts Documentation](https://echarts.apache.org/)
- [React Router Documentation](https://reactrouter.com/)
- [data source Documentation](https://github.com/data source)

### Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2025-11-13 | 1.0 | Initial architecture document created |
| 2025-11-13 | 2.0 | Added Data Layer Architecture, MCP Server Integration, Component Specification |

**Version 2.0 Changes**:
- ✅ Data Layer Service with intelligent caching
- ✅ Cache Coordinator with time-series gap detection
- ✅ Datasource Service for configuration management
- ✅ MCP Server for AI assistant integration
- ✅ Component Specification Tool
- ✅ Updated technology stack (Axios)
- ✅ Updated file structure
- ✅ Updated roadmap with completed features

---

**Document Owner**: Development Team
**Review Cycle**: Quarterly
**Next Review**: 2025-02-13

---

## Data Layer Architecture

### Overview

The data layer provides intelligent query execution with time-series aware caching. It sits between React components and data source datasources, automatically optimizing data fetching and reducing load on the database.

### Components

#### 1. Data Layer Service (`server/services/dataLayerService.js`)

**Purpose**: Query orchestration, transformation, and cache management

**Key Features**:
- Query execution against REST API
- Cache-first strategy with automatic fallback
- Time-series gap detection and partial fetching
- Query transformations (filter, map, aggregate, sort)
- data source SQL query builder

**API**:
```javascript
await dataLayerService.query(datasourceId, query, useCache)
// Returns: { data, source: 'cache'|'datasource'|'partial-cache' }
```

**Query Parameters**:
```javascript
{
  table: 'sensor_data',        // Table name
  metric: 'temperature',       // Metric to query
  aggregation: 'avg',          // avg, sum, min, max, count
  interval: '5m',              // Time bucket: 1m, 5m, 1h, 1d
  startTime: Date,             // Query start time
  endTime: Date,               // Query end time
  groupBy: 'sensor_id',        // Optional grouping
  where: 'location = "A"',     // Optional SQL WHERE
  transform: {                 // Optional post-query transformations
    filter: { value: { $gt: 20 } },
    sort: { field: 'time', order: 'asc' },
    limit: 100
  }
}
```

**SQL Generation Example**:
```sql
-- Generated from query above:
SELECT AVG(temperature) as value, time_bucket('5m', timestamp) as time
FROM sensor_data
WHERE timestamp >= '2025-11-13T10:00:00Z'
  AND timestamp <= '2025-11-13T11:00:00Z'
  AND (location = "A")
GROUP BY time
ORDER BY time
```

#### 2. Cache Coordinator (`server/services/cacheCoordinator.js`)

**Purpose**: Time-series aware caching with gap detection

**Key Features**:
- Tracks exact time ranges cached for each query
- Detects missing time ranges (gaps)
- Merges data from multiple cache entries
- Adaptive TTL based on data recency:
  - Recent (< 5min): 1 minute TTL
  - Recent hour (< 1hr): 5 minute TTL  
  - Historical (> 1hr): 1 hour TTL
- Automatic cache invalidation on TTL expiry

**Cache Key Generation**:
```
key = `${datasourceId}:${metric}:${aggregation}:${interval}`
Example: "prod-cluster-123:cpu_usage:avg:5m"
```

**Gap Detection Example**:
```javascript
// Scenario: Component requests 10:00-11:00
// Cache has: 10:00-10:30, 10:45-11:00

cacheCoordinator.get(datasourceId, query)
// Returns:
{
  data: [/* 10:00-10:30 data */, /* 10:45-11:00 data */],
  missingRanges: [
    { start: '10:30:00', end: '10:45:00' }  // 15 minute gap
  ]
}

// Data layer fetches only the 15 minute gap
// Merges with cached data
// Returns complete 10:00-11:00 dataset
```

**Cache Statistics**:
```javascript
cacheCoordinator.getStats()
// Returns:
{
  totalKeys: 42,           // Unique query keys
  totalEntries: 156,       // Total cache entries
  totalDataPoints: 45000,  // Total data points cached
  expiredEntries: 12       // Entries past TTL
}
```

#### 3. Datasource Service (`server/services/datasourceService.js`)

**Purpose**: Manage datasource configurations

**Datasource Types**:
- `rest-api`: REST API endpoint
- Future: `datasource-websocket`, `generic-rest`, `static-json`

**Datasource Schema**:
```json
{
  "id": "uuid",
  "name": "Production data source Cluster",
  "type": "rest-api",
  "config": {
    "baseUrl": "http://datasource-node-1:7849",
    "auth": {
      "token": "bearer-token-here"
    },
    "timeout": 30000
  },
  "description": "Main production cluster",
  "created": "2025-11-13T...",
  "updated": "2025-11-13T..."
}
```

**CRUD Operations**:
```javascript
// Create datasource
const ds = await datasourceService.createDatasource({
  name: 'Production',
  type: 'rest-api',
  config: { baseUrl: 'http://...' }
});

// Get datasource
const ds = await datasourceService.getDatasource(id);

// Update datasource
const updated = await datasourceService.updateDatasource(id, { config: {...} });

// Delete datasource
await datasourceService.deleteDatasource(id);
```

### Data Flow with Caching

```
Component Request
  ↓
useData({ datasourceId, query, refreshInterval })
  ↓
POST /api/data/query
  ↓
Data Layer Service
  ↓
┌─────────────────────────┐
│  Cache Coordinator      │
│  Check: datasourceId +  │
│         metric + agg    │
└─────────────────────────┘
  ↓
Cache Hit?
├─ YES → Return cached data (< 50ms)
│
└─ NO / PARTIAL
   ↓
   Identify missing ranges
   ↓
   ┌─────────────────────────┐
   │  Fetch from data source    │
   │  Only missing ranges!   │
   └─────────────────────────┘
   ↓
   Merge: cached + new data
   ↓
   Sort by timestamp
   ↓
   Deduplicate
   ↓
   Store in cache (with TTL)
   ↓
   Return to component
```

### Cache Efficiency

**Example**: Dashboard with 10 charts, each querying last hour

**Without Caching**:
- 10 charts × 10 refreshes/min = 100 data source queries/min
- data source load: **HIGH**
- Dashboard latency: 500-1000ms per chart
- Network bandwidth: 10MB/min

**With Caching**:
- Initial load: 10 queries to data source
- Subsequent loads: 0 queries (cache hit) for 1 minute
- After 1 min (TTL): 10 queries for **only last 1 minute** of data
- data source load: **10 queries/min** (90% reduction)
- Dashboard latency: **<50ms** per chart (from cache)
- Network bandwidth: **1MB/min** (90% reduction)

### Time-Series Gap Handling

**Scenario**: User views dashboard, goes to lunch, comes back

```
1. Initial view (11:00): Query 10:00-11:00
   → Cache miss → Fetch all data → Cache with 5min TTL

2. At 11:05: Query 10:05-11:05 (auto-refresh)
   → Partial cache (10:00-11:00 cached)
   → Missing: 11:00-11:05
   → Fetch only 11:00-11:05 → Merge → Cache

3. At 12:00 (back from lunch): Query 11:00-12:00
   → Cache expired (TTL = 5min)
   → Fetch all 11:00-12:00 → Cache with 5min TTL

4. At 12:01: Query 11:01-12:01
   → Partial cache (11:00-12:00 cached)
   → Missing: 12:00-12:01
   → Fetch only 12:00-12:01 → Merge → Return
```

Result: **Minimal data fetching**, maximum performance

---

## MCP Server Integration

### Overview

Model Context Protocol (MCP) server integration enables AI assistants to:
- Discover and manage datasources
- Create and query dashboard components
- Query data with caching
- Understand component design constraints

### MCP Tools

#### 1. **Datasource Management**

**list_datasources**
```javascript
// Input: {}
// Output: { datasources: [...], count: N }
```

**get_datasource**
```javascript
// Input: { id: "uuid" }
// Output: { id, name, type, config, ... }
```

**create_datasource**
```javascript
// Input: { name, type, config }
// Output: { id, name, type, config, created, updated }
```

**update_datasource**
```javascript
// Input: { id, updates: {...} }
// Output: { id, name, type, config, updated }
```

**delete_datasource**
```javascript
// Input: { id }
// Output: { success: true }
```

#### 2. **Data Query**

**query_data**
```javascript
// Input: { datasourceId, query, useCache }
// Output: { data: [...], source: 'cache'|'datasource' }

// Example:
{
  datasourceId: "prod-cluster",
  query: {
    table: "metrics",
    metric: "cpu_usage",
    aggregation: "avg",
    interval: "5m",
    startTime: "2025-11-13T10:00:00Z",
    endTime: "2025-11-13T11:00:00Z"
  },
  useCache: true
}
```

**invalidate_cache**
```javascript
// Input: { datasourceId, query? }
// Output: { success: true }
```

**get_cache_stats**
```javascript
// Input: {}
// Output: { totalKeys, totalEntries, totalDataPoints, expiredEntries }
```

#### 3. **Component Management**

**list_components**
```javascript
// Input: { system?, source? }
// Output: { components: [...], count: N }
```

**get_component**
```javascript
// Input: { system, source, name }
// Output: { id, name, system, source, component_code, ... }
```

**create_component**
```javascript
// Input: { name, system, source, component_code, description, metadata }
// Output: { id, name, system, source, ..., created, updated }
```

**update_component**
```javascript
// Input: { system, source, name, updates }
// Output: { id, ..., updated }
```

**delete_component**
```javascript
// Input: { system, source, name }
// Output: { success: true }
```

#### 4. **Component Specification**

**get_component_specification**
```javascript
// Input: { section?: 'summary'|'full'|'examples'|'colors'|'charts' }
// Output: Complete design constraints for creating React components
```

Returns:
- Available APIs in component scope
- Component structure requirements
- useData hook signature and examples
- Carbon Design System colors
- Chart templates (line, bar, gauge, pie, table)
- Common mistakes to avoid
- Best practices

**Example Output** (summary):
```json
{
  "version": "1.0.0",
  "availableAPIs": ["useState", "useEffect", "useData", "echarts", "ReactECharts"],
  "requirements": [
    "Must export Component or Widget",
    "Handle loading and error states",
    "Use Carbon colors (#0f62fe, #24a148, etc.)",
    "Apply theme='carbon-light' to ReactECharts"
  ],
  "carbonColors": {
    "primary": "#0f62fe",
    "success": "#24a148",
    "error": "#da1e28",
    ...
  },
  "chartTemplates": {
    "lineChart": "Time-series with smooth lines",
    "barChart": "Categorical comparisons",
    ...
  },
  "commonMistakes": [
    "Not handling loading state",
    "Not handling error state",
    ...
  ]
}
```

### MCP Endpoints

**Base URL**: `http://localhost:3001`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/mcp/tools` | GET | List all available MCP tools |
| `/mcp/capabilities` | GET | Server capabilities |
| `/mcp/component-spec` | GET | Component design constraints (summary) |
| `/mcp/component-spec/full` | GET | Full component specification |
| `/mcp/tools/:toolName` | POST | Execute specific MCP tool |

### AI Assistant Workflow Example

**Scenario**: User asks AI to create a CPU usage chart

```
1. User: "Create a chart showing CPU usage over the last hour"

2. AI Assistant (via MCP):
   GET /mcp/component-spec
   → Learns: useData hook, Carbon colors, line chart template

3. AI Assistant:
   Generates component code following spec:
   - Uses useData({ datasourceId, query })
   - Handles loading/error states
   - Uses Carbon blue (#0f62fe)
   - Applies theme="carbon-light"
   - Includes auto-refresh

4. AI Assistant (via MCP):
   POST /mcp/tools/create_component
   Body: { name, system, source, component_code, description }
   → Component saved to data/{system}/{source}/{name}.json

5. Component available immediately in Chart Design page
   → User can view, edit, or use in dashboard

6. Component uses useData hook:
   → Automatically benefits from caching
   → Minimal data source load
   → Fast rendering
```

### Component Specification Details

**File**: `server/mcp/componentSpec.js`

Contains complete specification with:
- API documentation for all available functions
- Component structure requirements
- Design system colors, typography, spacing
- 5 complete chart templates with code
- Best practices for:
  - Data fetching
  - Performance
  - Styling
  - Error handling
  - Accessibility
- Common mistakes with solutions
- Full working example component

**Purpose**:
Ensures AI assistants generate components that:
- ✅ Work with dynamic component loader
- ✅ Use correct datasource interface
- ✅ Follow Carbon Design System
- ✅ Handle errors gracefully
- ✅ Perform well with caching
- ✅ Are maintainable and consistent

---

