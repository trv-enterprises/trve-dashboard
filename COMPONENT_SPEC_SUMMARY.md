# Component Specification for MCP Clients

**Purpose**: Design constraints and templates for creating React dashboard components

## Quick Reference

### Available in Component Scope
- **React Hooks**: `useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`, `useContext`
- **useData Hook**: Fetch data from datasources with caching
- **ECharts**: `echarts`, `ReactECharts` for visualizations
- **Carbon Theme**: `carbonTheme`, `carbonDarkTheme` for ECharts

### Component Requirements
✅ Must export `Component` or `Widget`
✅ Return valid JSX
✅ Handle loading and error states
✅ Use Carbon Design System colors
✅ Apply `theme="carbon-light"` to ReactECharts

### useData Hook Signature
```javascript
const { data, loading, error, refetch } = useData({
  datasourceId: 'uuid',  // Required
  query: {               // Required
    table: 'metrics',
    metric: 'cpu_usage',
    aggregation: 'avg',  // avg, sum, min, max, count
    interval: '5m',      // Time bucket: 1m, 5m, 1h, etc.
    startTime: new Date(Date.now() - 3600000),
    endTime: new Date(),
    groupBy: 'node_id',  // Optional
    where: 'status = "active"'  // Optional SQL WHERE
  },
  refreshInterval: 5000  // Optional: auto-refresh in ms
});
```

### Carbon Colors (Dark Theme)
```javascript
{
  primary: '#0f62fe',    // blue60
  success: '#24a148',    // green50
  warning: '#f1c21b',    // yellow30
  error: '#da1e28',      // red60
  info: '#1192e8',       // cyan50
  accent: '#8a3ffc',     // purple60
  text: '#f4f4f4',       // gray10
  textSecondary: '#c6c6c6',  // gray30
  background: '#161616', // gray100
  layer01: '#262626',    // gray90
  border: '#393939'      // gray80
}
```

### Chart Templates

**Line Chart** (time-series):
```javascript
const { data, loading } = useData({ datasourceId, query });
if (loading) return <Loading />;

const option = {
  xAxis: { type: 'category', data: data.map(d => d.time) },
  yAxis: { type: 'value' },
  series: [{ data: data.map(d => d.value), type: 'line', smooth: true }]
};
return <ReactECharts option={option} theme="carbon-light" style={{ height: '400px' }} />;
```

**Bar Chart** (categorical):
```javascript
series: [{ data: data.map(d => d.count), type: 'bar', itemStyle: { color: '#0f62fe' } }]
```

**Gauge Chart** (single metric):
```javascript
series: [{ type: 'gauge', data: [{ value: 75, name: 'Usage' }] }]
```

**Pie Chart** (proportional):
```javascript
series: [{ type: 'pie', data: data.map(d => ({ name: d.category, value: d.count })) }]
```

### Common Mistakes to Avoid
❌ Not handling loading state → Always check `if (loading)`
❌ Not handling error state → Always check `if (error)`
❌ Wrong colors → Use Carbon color palette
❌ Missing export → Always have `const Component = () => ...`
❌ No ECharts theme → Add `theme="carbon-light"`
❌ Querying raw data → Use aggregations when possible

### Full Specification
For complete documentation, request the MCP tool: `get_component_specification`
