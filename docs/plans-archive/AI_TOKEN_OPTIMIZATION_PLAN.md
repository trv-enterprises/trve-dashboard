# AI Token Optimization Plan

This document analyzes each tool and the system prompt to identify optimization opportunities.

## Current Token Estimates

| Component | Tokens | % of Request |
|-----------|--------|--------------|
| System Prompt | ~4,500 | 45-60% |
| Tool Definitions (17 tools) | ~2,000 | 20-25% |
| Message History | Variable | 15-30% |
| User Message | ~50-200 | <5% |

---

## System Prompt Analysis

### Current Structure (~4,500 tokens)

| Section | Lines | Est. Tokens | Keep/Optimize |
|---------|-------|-------------|---------------|
| Critical Rules | 1-21 | ~300 | Keep (essential) |
| Your Capabilities | 22-37 | ~150 | Keep (brief) |
| Available Data Sources | 38-43 | ~80 | Keep |
| **Prometheus Data Sources** | 45-82 | ~500 | **Move to tool** |
| **EdgeLake Data Sources** | 84-122 | ~500 | **Move to tool** |
| ECharts Reference | 124-131 | ~100 | Keep |
| Design System Colors | 133-149 | ~200 | Keep |
| Available APIs | 151-209 | ~600 | Keep (code gen needs this) |
| **Chart Templates** | 211-414 | ~2,000 | **Move to new tool** |
| Best Practices | 416-422 | ~100 | Keep |
| **Tooltip Formatting** | 424-458 | ~400 | **Move to template tool** |
| Common Mistakes | 460-467 | ~100 | Keep |
| Workflow | 469-487 | ~150 | Keep |

### Optimization: Move Templates to `get_chart_template` Tool

**New Tool**: `get_chart_template`

```go
{
    Name:        "get_chart_template",
    Description: "Get a React component template for a specific chart type. Call this AFTER setting chart_type with update_chart_config. Returns ready-to-use code with Carbon g100 dark theme styling.",
    InputSchema: {
        Properties: {
            "chart_type": {
                "type": "string",
                "description": "Chart type to get template for",
                "enum": ["line", "bar", "area", "pie", "scatter", "gauge", "heatmap", "radar", "funnel", "dataview"]
            }
        },
        Required: ["chart_type"]
    }
}
```

**Savings**: ~2,400 tokens removed from system prompt (templates + tooltip formatting)

### Optimization: Conditional Data Source Documentation

Only include Prometheus/EdgeLake sections if those data source types exist.

```go
func BuildSystemPrompt(ctx context.Context, datasourceTypes map[string]bool) string {
    prompt := CorePrompt  // ~1,500 tokens

    if datasourceTypes["prometheus"] {
        prompt += PrometheusSection  // ~500 tokens
    }
    if datasourceTypes["edgelake"] {
        prompt += EdgeLakeSection  // ~500 tokens
    }

    prompt += APIsAndWorkflow  // ~850 tokens

    return prompt
}
```

**Savings**: Up to ~1,000 tokens if neither Prometheus nor EdgeLake sources exist

---

## Tool-by-Tool Analysis

### Chart Configuration Tools

| Tool | Current Output | Optimization | Savings |
|------|---------------|--------------|---------|
| `update_chart_config` | `{"success":true,"message":"Updated chart config: [description, chart_type]","chart_updated":true}` | Already minimal | None |
| `update_data_mapping` | Same pattern | Already minimal | None |
| `update_query_config` | Same pattern | Already minimal | None |
| `update_filters` | `{"success":true,"message":"Updated filters: 2 filter(s) applied","chart_updated":true}` | Already minimal | None |
| `update_aggregation` | Same pattern | Already minimal | None |
| `update_sliding_window` | Same pattern | Already minimal | None |
| `update_time_bucket` | Same pattern | Already minimal | None |
| `update_chart_options` | Same pattern | Already minimal | None |
| `set_custom_code` | Same pattern | Already minimal | None |

**Assessment**: Configuration tools are already optimized - they return success/failure only.

---

### Data Discovery Tools (HIGH IMPACT)

#### `list_datasources`

**Current Output**:
```json
{
  "success": true,
  "message": "Found 5 data source(s)",
  "data": [
    {"id": "abc123", "name": "PostgreSQL Main", "type": "sql", "description": "Production database with sensor readings"},
    {"id": "def456", "name": "Prometheus Metrics", "type": "prometheus", "description": "Infrastructure metrics"},
    {"id": "ghi789", "name": "IoT WebSocket", "type": "socket", "description": "Real-time sensor stream"},
    {"id": "jkl012", "name": "EdgeLake Cluster", "type": "edgelake", "description": "Distributed edge database"},
    {"id": "mno345", "name": "CSV Data", "type": "csv", "description": "Historical export files"}
  ]
}
```

**Optimization**: Already reasonably sized. Could omit description if > 5 sources.

---

#### `query_datasource` (HIGHEST IMPACT)

**Current Output** (10 rows default):
```json
{
  "success": true,
  "message": "Query returned 10 rows",
  "data": {
    "columns": ["timestamp", "sensor_type", "value", "location", "unit"],
    "rows": [
      [1707350400, "temperature", 72.5, "building-a-floor-1-room-101", "fahrenheit"],
      [1707350401, "temperature", 72.6, "building-a-floor-1-room-101", "fahrenheit"],
      [1707350402, "humidity", 45.2, "building-a-floor-1-room-102", "percent"],
      [1707350403, "temperature", 71.8, "building-b-floor-2-room-203", "fahrenheit"],
      [1707350404, "temperature", 72.1, "building-a-floor-1-room-101", "fahrenheit"],
      [1707350405, "humidity", 46.1, "building-b-floor-2-room-204", "percent"],
      [1707350406, "temperature", 73.0, "building-a-floor-1-room-103", "fahrenheit"],
      [1707350407, "temperature", 72.4, "building-b-floor-2-room-203", "fahrenheit"],
      [1707350408, "humidity", 44.8, "building-a-floor-1-room-102", "percent"],
      [1707350409, "temperature", 72.7, "building-a-floor-1-room-101", "fahrenheit"]
    ]
  }
}
```

**Optimizations**:

1. **Reduce default row limit**: 10 → 3
   - LLM only needs to see data structure, not many examples
   - Savings: ~60% of data payload

2. **Truncate long string values**: Max 50 chars
   - `"building-a-floor-1-room-101"` → `"building-a-floor-1-room-..."`
   - Savings: ~20% on string-heavy data

3. **Add column types to eliminate need for multiple queries**:
   ```json
   {
     "columns": [
       {"name": "timestamp", "type": "integer"},
       {"name": "sensor_type", "type": "string"},
       {"name": "value", "type": "float"},
       {"name": "location", "type": "string"}
     ],
     "rows": [[1707350400, "temperature", 72.5, "building-a..."], ...]
   }
   ```

**Implementation**:
```go
const (
    MaxRowsForAI = 3
    MaxStringLength = 50
)

func (e *ToolExecutor) executeQueryDatasource(...) (*ToolResult, error) {
    // Force max rows
    limit := 3
    if params.Limit != nil && *params.Limit < limit {
        limit = *params.Limit
    }

    // Truncate strings in results
    for i, row := range response.ResultSet.Rows {
        for j, val := range row {
            if str, ok := val.(string); ok && len(str) > MaxStringLength {
                response.ResultSet.Rows[i][j] = str[:MaxStringLength-3] + "..."
            }
        }
    }
}
```

---

#### `get_datasource_schema`

**Current Output**:
```json
{
  "success": true,
  "message": "Found 15 table(s) in database",
  "data": {
    "tables": [
      {
        "name": "sensor_readings",
        "columns": [
          {"name": "id", "type": "integer", "nullable": false},
          {"name": "timestamp", "type": "timestamp", "nullable": false},
          {"name": "sensor_id", "type": "varchar(50)", "nullable": false},
          {"name": "value", "type": "float", "nullable": true},
          ...
        ]
      },
      ... 14 more tables
    ]
  }
}
```

**Optimization**: Limit to 5 most relevant tables, or require table name parameter.

```go
// Add table_filter parameter
{
    "table_filter": {
        "type": "string",
        "description": "Optional: filter tables by name pattern (e.g., 'sensor%')"
    }
}
```

---

#### `get_prometheus_schema`

**Current Output**:
```json
{
  "success": true,
  "message": "Found 150 metric(s) and 25 label(s) in Prometheus",
  "data": {
    "metrics": ["cpu_usage", "memory_bytes", "http_requests_total", ...],  // 150 items
    "labels": ["job", "instance", "method", "status", ...]  // 25 items
  }
}
```

**Optimization**:
- Limit metrics to 20 most common
- Add `metric_filter` parameter for targeted discovery

---

#### `get_edgelake_schema`

**Current Output**: Already paginated (databases → tables → columns). Good design.

**Minor Optimization**: Limit columns to essential info (name, type).

---

#### `preview_data`

**Same as `query_datasource`** - apply same row limit and truncation.

---

#### `get_chart_state`

**Current Output**: Returns FULL chart object including:
- componentCode (potentially 2KB+ of JavaScript)
- All options
- All data mapping
- All filters

**Optimization**: Return summary only, unless full state requested.

```go
// Default: summary
{
    "id": "chart-uuid",
    "chart_type": "line",
    "datasource_id": "ds-uuid",
    "has_custom_code": true,
    "has_filters": true,
    "filter_count": 2,
    "x_axis": "timestamp",
    "y_axis": ["value"]
}

// Optional: full state with parameter
{
    "include_code": true  // Then include componentCode
}
```

---

### Utility Tools

#### `suggest_missing_tools`

Already minimal - just echoes back feature + suggestion.

---

## New Tool: `get_chart_template`

### Definition

```go
{
    Name:        "get_chart_template",
    Description: `Get a ready-to-use React component template for a specific chart type.
Call this AFTER setting chart_type with update_chart_config.
Returns Carbon g100 dark theme styled code that you can customize.
Available types: line, bar, area, pie, scatter, gauge, heatmap, radar, funnel, dataview`,
    InputSchema: anthropic.ToolInputSchemaParam{
        Properties: map[string]interface{}{
            "chart_type": map[string]interface{}{
                "type": "string",
                "description": "Chart type to get template for",
                "enum": []string{"line", "bar", "area", "pie", "scatter", "gauge", "heatmap", "radar", "funnel", "dataview"},
            },
            "include_tooltip_formatter": map[string]interface{}{
                "type": "boolean",
                "description": "Include time-series tooltip formatter (recommended for time-based data)",
                "default": false,
            },
        },
        Required: []string{"chart_type"},
    },
}
```

### Implementation

```go
var chartTemplates = map[string]string{
    "line": `const Component = ({ data }) => {
  const chartData = toObjects(data);
  if (!chartData.length) return <div style={{color: '#f4f4f4', padding: '20px'}}>No data available</div>;

  const option = {
    backgroundColor: 'transparent',
    // ... full template
  };

  return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />;
};`,
    "bar": `...`,
    "gauge": `...`,
    // etc.
}

var tooltipFormatter = `tooltip: {
  trigger: 'axis',
  backgroundColor: '#262626',
  // ... formatter code
}`

func (e *ToolExecutor) executeGetChartTemplate(input json.RawMessage) (*ToolResult, error) {
    var params struct {
        ChartType string `json:"chart_type"`
        IncludeTooltip bool `json:"include_tooltip_formatter"`
    }
    json.Unmarshal(input, &params)

    template, exists := chartTemplates[params.ChartType]
    if !exists {
        return &ToolResult{
            Success: false,
            Error: fmt.Sprintf("No template for chart type: %s. Use set_custom_code to write custom component.", params.ChartType),
        }, nil
    }

    result := map[string]interface{}{
        "template": template,
    }
    if params.IncludeTooltip {
        result["tooltip_formatter"] = tooltipFormatter
    }

    return &ToolResult{
        Success: true,
        Message: fmt.Sprintf("Template for %s chart. Customize column names to match your data.", params.ChartType),
        Data: result,
    }, nil
}
```

---

## Updated System Prompt (Optimized)

After moving templates to `get_chart_template`:

```go
const SystemPromptCore = `You are an AI assistant helping users create data visualization charts.

## Critical Rules

- ALWAYS call tools - never just respond with text
- When creating a chart: call list_datasources AND update_chart_config immediately
- NEVER set chart name - user provides it when saving
- ALWAYS call query_datasource BEFORE generating code to discover actual column names
- Use update_filters for data filtering - NEVER filter in component code
- After setting chart_type, call get_chart_template to get starter code

## Capabilities

1. **Chart Types**: bar, line, area, pie, scatter, gauge, heatmap, radar, funnel, dataview
2. **Data Mapping**: X/Y axes, grouping, axis labels
3. **Filters**: Apply data filters (shown in UI, editable by users)
4. **Aggregation**: first, last, min, max, avg, sum, count

## Data Sources

Use list_datasources to see available sources. Types: sql, api, csv, socket, prometheus, edgelake

For Prometheus: use get_prometheus_schema to discover metrics/labels
For EdgeLake: use get_edgelake_schema progressively (databases → tables → columns)

## Design System - Carbon g100 (Dark Theme)

Colors: Background #161616, Layer #262626, Text #f4f4f4, Secondary #c6c6c6, Primary #0f62fe
Font: "IBM Plex Sans"

## Available APIs in Component Scope

React: useState, useEffect, useMemo, useCallback, useRef
Data: useData({ datasourceId, query, refreshInterval })
Transforms: toObjects(data), getValue(data, col), formatTimestamp(ts, format)
Charts: ReactECharts, echarts, carbonTheme

## Workflow

1. Call list_datasources
2. Call update_chart_config to set chart type
3. Call query_datasource to discover column names
4. Call get_chart_template to get starter code
5. Call update_data_mapping with actual column names
6. Call set_custom_code with customized template
7. Use update_filters if data needs filtering`
```

**Estimated tokens**: ~800 (down from ~4,500)

---

## Summary: Optimization Impact

| Optimization | Token Savings | Implementation Effort |
|--------------|---------------|----------------------|
| Move templates to tool | ~2,400 | Medium |
| Reduce query_datasource rows (10→3) | ~60% per query | Low |
| Truncate string values | ~20% per query | Low |
| Conditional Prometheus/EdgeLake docs | ~500-1,000 | Medium |
| Summarize get_chart_state | ~500+ per call | Low |
| Limit schema results | ~200-500 | Low |

**Total Potential Savings**: 50-70% reduction in tokens per session

---

## Implementation Priority

1. **Phase 1 (Quick Wins)**
   - Reduce `query_datasource` row limit to 3
   - Truncate long strings in query results
   - Add row limit enforcement in `preview_data`

2. **Phase 2 (Template Tool)**
   - Implement `get_chart_template` tool
   - Move templates out of system prompt
   - Update system prompt to reference new tool

3. **Phase 3 (Dynamic Prompt)**
   - Implement conditional data source documentation
   - Optimize `get_chart_state` output
   - Add filters to schema discovery tools

---

*Last Updated: 2026-02-08*
