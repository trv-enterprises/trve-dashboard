# CLAUDE.md - AI Assistant Guide

This file provides context and guidance for AI assistants (like Claude) working on this project.

## TODO - Next Feature: AI-Generated Component Tiles

**Priority**: High
**Status**: Planning

### Feature Overview
Enable users to create dashboard components through natural language chat interface with AI-generated code.

### Implementation Tasks

1. **Blank Tile Selection**
   - [ ] Add "Add Component" blank tile to dashboard
   - [ ] Tile should be clickable and visually distinct (dashed border, plus icon)
   - [ ] Position in component grid alongside existing components

2. **Chat Dialog Interface**
   - [ ] Create modal/dialog component for chat interaction
   - [ ] Include text input for user requests
   - [ ] Display conversation history (user messages + AI responses)
   - [ ] Show "thinking" state while AI generates component
   - [ ] Option to request "new component" or "variation of existing component"

3. **AI Component Generation**
   - [ ] Integrate with MCP server for component specification
   - [ ] Send user request + context to AI (Claude via API)
   - [ ] AI generates component code following spec
   - [ ] Validate generated code before saving
   - [ ] Create component with unique ID and metadata

4. **Server Notification System**
   - [ ] Implement WebSocket or Server-Sent Events (SSE) for real-time updates
   - [ ] Server notifies client when component generation is complete
   - [ ] Handle generation errors gracefully
   - [ ] Show progress indicators during generation

5. **Component Display**
   - [ ] Auto-render new component in the tile position
   - [ ] Show success notification
   - [ ] Allow user to edit component after generation
   - [ ] Option to regenerate if result is unsatisfactory

### Technical Considerations

- **Component ID Generation**: Use UUID for unique IDs (already implemented)
- **Metadata**: Include `aiGenerated: true`, `prompt: "user request"`, `generatedAt: timestamp`
- **Validation**: Ensure generated code includes required exports, handles errors
- **Rate Limiting**: Prevent abuse of AI generation API
- **Fallback**: Handle API failures gracefully with error messages

### Related Files
- `client/src/components/ComponentViewer.jsx` - May need blank tile support
- `client/src/components/ComponentEditor.jsx` - For post-generation editing
- `server/mcp/componentSpec.js` - Component specification for AI
- `server/services/` - May need new service for AI integration

---

## Project Overview

**Monitoring Dashboard** - A full-stack application for monitoring distributed database clusters with dynamic component creation. The dashboard provides:

1. **Real-time Monitoring** - Multi-page dashboard for cluster health, node status, and query analytics
2. **Dynamic Chart Builder** - Create and manage custom React components and visualizations through a web UI
3. **File-Based Storage** - All components stored as JSON files in a hierarchical file system

## Architecture Summary

```
Client (React + Vite + React Router)  →  Server (Node.js + Express)  →  File Storage (JSON)
     ↓                                       ↓                              ↓
Carbon UI Shell (4 pages)              REST API                    data/{system}/{source}/
├─ Dashboard (metrics + charts)        File Manager                {component}.json
├─ Nodes (cluster status)              CRUD Operations             index.json
├─ Queries (query history)
└─ Chart Design (component builder)

ECharts Visualizations (Carbon themed)
Dynamic Component Loader
```

### Key Components

1. **Server** (`server/`)
   - Express REST API
   - File-based storage manager (`server/storage/fileManager.js`)
   - No database - all data in JSON files
   - Endpoints: `/api/components`, `/api/datasources`

2. **Client** (`client/`)
   - React 18 with Vite 5
   - React Router for multi-page navigation
   - Carbon Design System UI Shell with side navigation
   - Four main pages: Dashboard, Nodes, Queries, Chart Design
   - ECharts for data visualizations with Carbon theme
   - Dynamic component loader (evaluates code at runtime)

3. **Data Storage** (`data/`)
   - Structure: `data/{system}/{source}/{component}.json`
   - Master index: `data/index.json`
   - Git-tracked, human-readable

## Critical Design Decisions

### 1. File-Based Storage (Not Database)
- **Why**: Simplicity, no infrastructure, git-friendly, human-readable
- **When to question**: If scaling beyond 1000s of components
- Components stored as individual JSON files
- Master index for fast lookups

### 2. Dynamic Component Loading
- **Location**: `client/src/components/DynamicComponentLoader.jsx`
- **How**: Uses `new Function()` to evaluate component code at runtime
- **Available in component scope**:
  - React hooks: `useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`, `useContext`
  - echarts: ECharts core library for chart configurations
  - ReactECharts: ECharts React wrapper component
  - carbonTheme: Carbon Design System light theme for ECharts
  - carbonDarkTheme: Carbon Design System dark theme for ECharts
- **Security**: Components run in browser context with same origin policy

### 3. System/Source Hierarchy
- **System**: High-level category (e.g., "analytics", "datasource")
- **Source**: Data source or subcategory (e.g., "cpu-metrics", "sales")
- **Component**: Individual widget name (e.g., "usage-chart")
- Path: `data/{system}/{source}/{component}.json`
- Once created, system/source/name cannot be changed

### 4. UI Framework: Carbon Design System
- IBM's open-source design system
- Professional component library with accessibility built-in
- Consistent design language across all components
- SCSS-based theming with CSS custom properties
- Use Carbon components (Button, Tile, Tag, TextInput, etc.) - don't create custom components
- Import styles: `@use '@carbon/react'` in SCSS files
- Main theme: 'g100' (dark theme) - can be customized

### 5. Visualization: ECharts with Carbon Theme
- Enterprise-grade charting library
- Available in dynamic components via `echarts` and `ReactECharts`
- Custom Carbon Design System theme (`carbonTheme`, `carbonDarkTheme`)
- Theme location: `client/src/theme/carbonEchartsTheme.js`
- Supports all ECharts chart types: line, bar, pie, scatter, gauge, sankey, etc.
- Use ReactECharts wrapper for easier integration
- No manual cleanup needed with ReactECharts wrapper

### 6. Multi-Page Architecture (React Router)
- **Dashboard Page** (`/dashboard`) - Default landing page
  - 4 metric cards: Active Nodes, Queries/Sec, Storage, Uptime
  - ECharts line chart: Query latency over last hour
  - Carbon DataTable: Recent queries with status tags
  - Auto-refreshes every 5 seconds
- **Nodes Page** (`/nodes`)
  - Grid view of all cluster nodes
  - Node status (active/inactive) with visual indicators
  - CPU and memory usage bars
  - Total query count per node
- **Queries Page** (`/queries`)
  - Paginated query history table
  - Search by query text
  - Filter by status (completed/running/failed)
  - Sortable columns
- **Chart Design Page** (`/chart-design`)
  - Original dynamic component builder
  - Component selector sidebar
  - Component viewer/editor
  - Create/edit/delete components
- **Navigation**: Carbon UI Shell with persistent side nav
- **Header**: Global "+" button to create new components (navigates to Chart Design)

## Component Structure

```json
{
  "id": "unique-uuid",
  "name": "component-name",
  "system": "system-name",
  "source": "source-name",
  "description": "Brief description",
  "component_code": "const Component = () => { ... };",
  "metadata": {
    "dataSource": { ... },
    "tags": [],
    "custom": "fields"
  },
  "created": "ISO-8601",
  "updated": "ISO-8601"
}
```

## Common Tasks

### Adding a New Component Example

1. Create JSON file in `data/{system}/{source}/{name}.json`
2. Update `data/index.json` to include:
   - Add to `systems.{system}.{source}` array
   - Add entry to `components` array with id, name, system, source, path, updated
3. Component code must export `Component` or `Widget`

### Adding a New API Endpoint

1. Add route to `server/api/components.js` or `server/api/datasources.js`
2. Use fileManager for all file operations
3. Follow REST conventions
4. Return `{ success: true, data: ... }` format

### Adding New Libraries to Dynamic Components

1. Import library in `client/src/components/DynamicComponentLoader.jsx`
2. Add to `new Function()` parameters
3. Pass to function execution
4. Document in README.md and CLAUDE.md

### Updating UI Components

- Use Carbon Design System components (Button, Tile, Form, Select, TextInput, etc.)
- Check existing components for patterns
- Use icons from `@carbon/icons-react`
- Create accompanying SCSS files using `@use '@carbon/react'`
- Use Carbon design tokens for colors, spacing, and typography
- Maintain consistent styling across all components

## File Locations Reference

### Server
- Main: `server/server.js`
- File Manager: `server/storage/fileManager.js`
- Components API: `server/api/components.js`
- Data Sources API: `server/api/datasources.js`

### Client
- Main App: `client/src/App.jsx` (UI Shell + Routing)
- **Pages**:
  - Dashboard: `client/src/pages/DashboardPage.jsx` (metrics, latency chart, query table)
  - Nodes: `client/src/pages/NodesPage.jsx` (cluster node status)
  - Queries: `client/src/pages/QueriesPage.jsx` (query history with filters)
  - Chart Design: `client/src/pages/ChartDesignPage.jsx` (component builder)
- **Components**:
  - Dynamic Loader: `client/src/components/DynamicComponentLoader.jsx`
  - Component Selector: `client/src/components/ComponentSelector.jsx`
  - Component Viewer: `client/src/components/ComponentViewer.jsx`
  - Component Editor: `client/src/components/ComponentEditor.jsx`
- **Utilities**:
  - Mock Data: `client/src/utils/mockData.js` (generates sample metrics/queries)
  - ECharts Theme: `client/src/theme/carbonEchartsTheme.js`
  - API Client: `client/src/api/client.js`
  - Hooks: `client/src/hooks/useComponents.js`, `useDataSources.js`
- **Styles**: Page and component-level SCSS files (e.g., `DashboardPage.scss`)

### Data
- Master Index: `data/index.json`
- Components: `data/{system}/{source}/{name}.json`
- Sample Counter: `data/example/demo/counter.json`
- Sample Charts: `data/visualization/charts/`

## Development Workflow

### Starting Development

```bash
# Terminal 1 - Server
cd server && npm run dev

# Terminal 2 - Client
cd client && npm run dev
```

### Adding Dependencies

```bash
# Server dependencies
cd server && npm install <package>

# Client dependencies
cd client && npm install <package>
```

### Testing Changes

1. Create/modify component via UI
2. Check browser console for errors
3. Verify file system changes in `data/`
4. Test component loading and rendering

## Important Gotchas

### 1. Dynamic Component Code Requirements
- Must export `Component` or `Widget` (case-sensitive)
- React hooks available without import
- ECharts available via `echarts` and `ReactECharts`
- ReactECharts wrapper handles cleanup automatically (no manual destroy needed)
- Carbon themes available as `carbonTheme` and `carbonDarkTheme`

### 2. File Manager Operations
- Always use `fileManager` for file operations
- Don't manipulate files directly
- Updates both file AND index.json
- Async operations - use await

### 3. Component Editing Restrictions
- System, source, and name are immutable after creation
- ID is UUID, generated on creation
- Can edit: description, component_code, metadata

### 4. Index.json Consistency
- Must stay in sync with actual files
- Updated automatically by fileManager
- Contains flat component list + hierarchical systems tree

### 5. ECharts in Dynamic Components
- Use ReactECharts wrapper component for easy integration
- No manual cleanup required (handled by wrapper)
- Specify theme using `theme="carbon-light"` prop
- Configure charts using ECharts option object
- All ECharts chart types supported (line, bar, pie, scatter, gauge, sankey, etc.)

### 6. Carbon Design System Colors
- **Primary Blue**: `#0f62fe` (blue60) - Primary actions, links
- **Red**: `#da1e28` (red60) - Errors, destructive actions
- **Green**: `#24a148` (green50) - Success states
- **Purple**: `#8a3ffc` (purple60) - Secondary accent
- **Cyan**: `#1192e8` (cyan50) - Info states
- **Yellow**: `#f1c21b` (yellow30) - Warnings
- **Gray Scale**: `#161616` (gray100) to `#f4f4f4` (gray10)
- Use CSS custom properties: `var(--cds-text-primary)`, `var(--cds-background)`, etc.
- Reference: `client/node_modules/@carbon/colors/lib/index.js`

## Code Patterns

### Dynamic Component with ECharts

```javascript
const Component = () => {
  const data = [
    { category: 'A', value: 120 },
    { category: 'B', value: 200 },
    { category: 'C', value: 150 },
  ];

  const option = {
    title: {
      text: 'Sample Chart',
    },
    tooltip: {
      trigger: 'axis',
    },
    xAxis: {
      type: 'category',
      data: data.map(item => item.category),
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        data: data.map(item => item.value),
        type: 'bar',
      },
    ],
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: '400px' }}
      theme="carbon-light"
    />
  );
};
```

### Dynamic Component with Line Chart

```javascript
const Component = () => {
  const [data, setData] = useState([
    { date: '2024-01', value: 120 },
    { date: '2024-02', value: 150 },
    { date: '2024-03', value: 170 },
  ]);

  const option = {
    xAxis: {
      type: 'category',
      data: data.map(d => d.date),
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        data: data.map(d => d.value),
        type: 'line',
        smooth: true,
      },
    ],
  };

  return <ReactECharts option={option} theme="carbon-light" />;
};
```

### Dynamic Component with Gauge

```javascript
const Component = () => {
  const option = {
    series: [
      {
        type: 'gauge',
        detail: {
          formatter: '{value}%',
        },
        data: [{ value: 75, name: 'Utilization' }],
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: '300px' }} theme="carbon-light" />;
};
```

### API Call Pattern

```javascript
// In hooks
const { components, loading, error } = useComponents({ system, source });

// Direct API call
const response = await apiClient.getComponents({ system: 'analytics' });
```

### File Manager Pattern

```javascript
// Save component
await fileManager.saveComponent(component);

// Get component
const component = await fileManager.getComponent(system, source, name);

// Delete component
await fileManager.deleteComponent(system, source, name);

// Index is automatically updated
```

## Testing

### Manual Testing Checklist

- [ ] Create new component via UI
- [ ] Edit existing component
- [ ] Delete component
- [ ] View component with code toggle
- [ ] Filter by system/source
- [ ] Create component with chart
- [ ] Verify file system changes
- [ ] Check index.json updated correctly

### Common Test Scenarios

1. **Counter Component** - Tests basic state management and Carbon styling
2. **Chart Component** - Tests ECharts integration with Carbon theme
3. **Multi-System** - Tests filtering and organization
4. **Gauge Component** - Tests gauge charts for resource utilization
5. **Line Chart Component** - Tests time-series data visualization

## Future Enhancement Ideas

- [ ] Component versioning
- [ ] Real-time data source connections
- [ ] Component templates library
- [ ] Search functionality
- [ ] Component sharing/export
- [ ] Drag-and-drop dashboard builder
- [ ] Component dependency management
- [ ] Multi-dashboard support
- [ ] User authentication
- [ ] Component marketplace

## When to Ask User

- Adding database (challenges file-based architecture)
- Changing component storage format
- Adding authentication/authorization
- Modifying dynamic component security model
- Adding external data source connections
- Changing URL structure or API contracts

## Helpful Commands

```bash
# Install all dependencies
npm run install:all

# Start server (production)
npm run server

# Start server (development with nodemon)
npm run server:dev

# Start client
npm run client

# Test API health
curl http://localhost:3001/health

# List all components
curl http://localhost:3001/api/components

# Get systems
curl http://localhost:3001/api/datasources
```

## Technology Stack

- **Backend**: Node.js 18+, Express 4, UUID
- **Frontend**: React 18, Vite 5, React Router 6, Carbon Design System (@carbon/react), ECharts, echarts-for-react
- **Design System**: Carbon Design System (IBM) - g100 theme (dark)
- **Visualization**: ECharts 6.0 with custom Carbon theme
- **Routing**: React Router DOM 6 (BrowserRouter)
- **Styling**: SCSS with Carbon tokens and mixins
- **Storage**: File system (JSON)
- **Dev Tools**: Nodemon, ESLint

## Key Files to Understand First

1. `client/src/App.jsx` - UI Shell, routing, and navigation structure
2. `client/src/pages/DashboardPage.jsx` - Main monitoring dashboard
3. `client/src/utils/mockData.js` - Mock data generators for development
4. `server/storage/fileManager.js` - All file operations
5. `client/src/components/DynamicComponentLoader.jsx` - Component evaluation with ECharts
6. `client/src/theme/carbonEchartsTheme.js` - Carbon theme for ECharts
7. `data/index.json` - Component registry
8. `server/api/components.js` - CRUD endpoints

## Notes for Future Development

- File storage is intentional - don't immediately suggest database
- Component code security relies on browser sandbox
- Keep dynamic component API minimal and stable
- Carbon Design System updates may require theme adjustments
- ECharts version updates should be tested with Carbon theme
- Carbon theme uses design tokens for maintainability
- Consider adding dark mode toggle in future (theme already supports it)
- Sankey and network graphs available for data flow visualization

---

## Current Status (2025-11-13)

### ✅ Completed
- Multi-page dashboard with Carbon UI Shell and side navigation
- Dashboard page with 4 metric cards, ECharts line chart, and query table
- Nodes page with cluster status and resource utilization
- Queries page with search, filtering, and pagination
- Chart Design page integrating original component builder
- Mock data utilities for development and testing
- React Router integration with 4 routes
- Carbon Design System theming throughout
- ECharts with Carbon blue color palette

### 🚧 In Progress
- None

### 📋 Next Steps
1. Install `react-router-dom` dependency (requires network access)
2. Connect Dashboard to real data source API endpoints (replace mock data)
3. Implement real-time data updates via WebSocket or polling
4. Add node detail view (drill-down from Nodes page)
5. Add query detail view (drill-down from Queries page)
6. Implement query execution interface
7. Add error handling and loading states
8. Add user preferences/settings page

---

**Last Updated**: 2025-11-13

For more details, see:
- [README.md](README.md) - User documentation
- [QUICKSTART.md](QUICKSTART.md) - Quick start guide
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture and design
- don't mention datasource in the code or documentation . we will use data source or source system