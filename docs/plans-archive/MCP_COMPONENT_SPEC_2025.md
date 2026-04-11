# MCP Component Specification Tool

> **Archived 2026-04-11.** The `get_component_specification` MCP tool
> described here is no longer registered in the MCP server (verified
> via grep against `server-go/internal/mcp/`). Component generation
> for the AI Builder is now handled via the integrated AI session
> flow and system prompt rather than a discrete MCP tool. Kept for
> historical record. For the current AI builder architecture see
> `docs/architecture/backend.md` → AI Builder, or
> `docs/architecture/AI_CHART_EDITOR_ARCHITECTURE.md`.

**Created**: 2025-11-13
**Purpose**: Provide AI assistants (MCP clients) with design constraints for creating React components

## Overview

We've added a **Component Specification Tool** to the MCP server that ensures AI assistants can create properly-formed React components that:
- ✅ Work with the dynamic component loader
- ✅ Use the correct datasource interface (`useData` hook)
- ✅ Follow Carbon Design System styling
- ✅ Use proper ECharts configurations
- ✅ Handle loading and error states correctly

## MCP Tool

### Tool Name: `get_component_specification`

**Description**: Get design constraints and templates for creating React dashboard components

**Input Schema**:
```json
{
  "section": "summary | full | examples | colors | charts"
}
```

**Returns**: Complete specification with:
- Available APIs in component scope
- Component structure requirements
- useData hook signature and examples
- Carbon Design System colors
- Chart templates (line, bar, gauge, pie, table)
- Common mistakes to avoid
- Best practices

## Quick Access Endpoints

### 1. **GET /mcp/component-spec**
Returns quick reference guide with:
- Available APIs
- Requirements checklist
- useData signature
- Carbon colors
- Chart template descriptions
- Common mistakes

**Example**:
```bash
curl http://localhost:3001/mcp/component-spec
```

### 2. **GET /mcp/tools**
Lists all available MCP tools including `get_component_specification`

**Example**:
```bash
curl http://localhost:3001/mcp/tools
```

## What's Included

### 1. **Available APIs**
```javascript
// React Hooks (no import needed)
useState, useEffect, useMemo, useCallback, useRef, useContext

// Data Fetching
useData({
  datasourceId: 'uuid',
  query: {
    table: 'metrics',
    metric: 'cpu_usage',
    aggregation: 'avg',
    interval: '5m',
    startTime: new Date(),
    endTime: new Date()
  },
  refreshInterval: 5000
})

// Visualization
echarts, ReactECharts, carbonTheme, carbonDarkTheme
```

### 2. **Component Requirements**
- Must export `Component` or `Widget`
- Return valid JSX
- Handle `loading` and `error` states
- Use Carbon Design System colors
- Apply `theme="carbon-light"` to ReactECharts

### 3. **Carbon Colors** (Dark Theme - g100)
```javascript
{
  primary: '#0f62fe',      // blue60 - Primary actions
  success: '#24a148',      // green50 - Success states
  warning: '#f1c21b',      // yellow30 - Warnings
  error: '#da1e28',        // red60 - Errors
  info: '#1192e8',         // cyan50 - Info
  accent: '#8a3ffc',       // purple60 - Accent
  text: '#f4f4f4',         // gray10 - Primary text
  textSecondary: '#c6c6c6', // gray30 - Secondary text
  background: '#161616',   // gray100 - Base background
  layer01: '#262626',      // gray90 - Card backgrounds
  border: '#393939'        // gray80 - Borders
}
```

### 4. **Chart Templates**

All templates include:
- ✅ useData hook for data fetching
- ✅ Loading state handling
- ✅ Error state handling
- ✅ Carbon theme styling
- ✅ Proper ECharts configuration

**Available Templates**:
1. **Line Chart** - Time-series data with smooth lines and area fill
2. **Bar Chart** - Categorical comparisons
3. **Gauge Chart** - Single metric with min/max range
4. **Pie Chart** - Proportional distribution
5. **Data Table** - Tabular data with Carbon DataTable component

### 5. **Common Mistakes** ❌

The spec explicitly warns against:
- Not handling loading state
- Not handling error state
- Using wrong colors (not from Carbon palette)
- Forgetting to export Component
- Not using ReactECharts theme
- Querying raw data instead of aggregations

## Example: AI Assistant Workflow

### Step 1: AI queries component spec
```
MCP Client: get_component_specification(section: "summary")
Server: Returns full specification
```

### Step 2: AI understands constraints
- Available APIs: `useData`, `useState`, `ReactECharts`
- Required structure: export Component, handle loading/error
- Colors: Use `#0f62fe` for primary, `#24a148` for success
- Charts: Use `theme="carbon-light"`

### Step 3: AI creates component
```javascript
const Component = () => {
  const { data, loading, error } = useData({
    datasourceId: 'prod-cluster',
    query: {
      table: 'metrics',
      metric: 'cpu_usage',
      aggregation: 'avg',
      interval: '5m',
      startTime: new Date(Date.now() - 3600000),
      endTime: new Date()
    },
    refreshInterval: 5000
  });

  if (loading) return <Loading />;
  if (error) return <div>Error: {error.message}</div>;

  const option = {
    xAxis: { type: 'category', data: data.map(d => d.time) },
    yAxis: { type: 'value' },
    series: [{
      data: data.map(d => d.value),
      type: 'line',
      smooth: true,
      itemStyle: { color: '#0f62fe' }
    }]
  };

  return <ReactECharts option={option} theme="carbon-light" />;
};
```

### Step 4: AI submits component
```
MCP Client: create_component({
  name: 'cpu-usage-chart',
  system: 'datasource',
  source: 'metrics',
  component_code: '...',
  description: 'Real-time CPU usage chart'
})
```

## Files Created

1. **`server/mcp/componentSpec.js`** (600+ lines)
   - Complete specification in JavaScript format
   - Available APIs, colors, templates, examples
   - Full code samples for each chart type
   - Best practices and common mistakes

2. **`COMPONENT_SPEC_SUMMARY.md`** (Quick reference)
   - Human-readable markdown summary
   - Quick lookup for developers
   - Copy-paste ready examples

3. **MCP Endpoints** (Added to `server/server.js`)
   - `GET /mcp/component-spec` - Quick reference
   - `GET /mcp/component-spec/full` - Full specification
   - `GET /mcp/tools` - Updated with new tool

## Benefits

### For AI Assistants
✅ Know exactly what APIs are available
✅ Understand component structure requirements
✅ Get working code templates
✅ Avoid common mistakes
✅ Generate components that work first try

### For Developers
✅ Consistent component structure
✅ Proper error handling across all components
✅ Uniform styling with Carbon Design
✅ Optimized data queries
✅ Maintainable codebase

### For Users
✅ Components work reliably
✅ Consistent look and feel
✅ Fast data loading with caching
✅ Professional UI/UX
✅ Accessible components

## Testing the Spec

### Test 1: View Quick Reference
```bash
curl http://localhost:3001/mcp/component-spec | python3 -m json.tool
```

### Test 2: List MCP Tools
```bash
curl http://localhost:3001/mcp/tools | python3 -m json.tool
```

### Test 3: Read Full Spec File
```bash
cat server/mcp/componentSpec.js
```

### Test 4: Read Summary
```bash
cat COMPONENT_SPEC_SUMMARY.md
```

## Integration with MCP Clients

MCP clients (AI assistants like Claude) can:

1. **Query the spec** before creating components
2. **Reference examples** for specific chart types
3. **Validate** component code against requirements
4. **Check colors** against Carbon palette
5. **Get help** with datasource queries

## Example MCP Client Usage (Claude)

```
User: "Create a chart showing query latency over the last hour"

Claude (internally):
1. Calls get_component_specification()
2. Sees useData hook example
3. Sees line chart template
4. Sees Carbon colors (#0f62fe for primary)
5. Generates component following spec

Claude (to user):
"I've created a query latency chart that:
- Fetches last hour of data with 1-minute aggregation
- Auto-refreshes every 5 seconds
- Uses Carbon blue theme
- Handles loading and error states"
```

## Future Enhancements

- [ ] Add WebSocket data source examples
- [ ] Add multi-series chart templates
- [ ] Add dashboard layout patterns
- [ ] Add component composition examples
- [ ] Add real-time data streaming patterns
- [ ] Add advanced ECharts features (zoom, brush, etc.)
- [ ] Add Carbon interaction patterns (click, hover, select)

## Related Documentation

- [DATA_LAYER_IMPLEMENTATION.md](DATA_LAYER_IMPLEMENTATION.md) - Data layer architecture
- [ARCHITECTURE.md](ARCHITECTURE.md) - Overall system architecture
- [CLAUDE.md](CLAUDE.md) - AI assistant guide
- [server/mcp/componentSpec.js](server/mcp/componentSpec.js) - Full specification source

---

**Last Updated**: 2025-11-13
**Status**: ✅ Complete and Available via MCP
