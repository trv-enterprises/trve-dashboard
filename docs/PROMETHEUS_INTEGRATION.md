# Prometheus Data Source Integration Plan

## Overview

Add Prometheus as a new data source type, enabling users to query and visualize Prometheus metrics through the dashboard. The integration maintains our existing data interface pattern while adding Prometheus-specific schema discovery and a visual query builder.

## Goals

1. **Same Interface**: Prometheus outputs normalized `{columns, rows}` format like all other data sources
2. **Schema Discovery**: Expose metrics and labels for easy selection
3. **Visual Query Builder**: Build PromQL queries through UI, not raw text
4. **AI Compatibility**: AI uses our tools/filters, not native Prometheus patterns
5. **Range + Instant**: Support both query types, differentiated at chart level

---

## Architecture

### Data Flow
```
┌─────────────────────────────────────────────────────────────────┐
│                    Prometheus Server                             │
│  /api/v1/query_range, /api/v1/query, /api/v1/labels, etc.       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              PrometheusDataSource Adapter (Go)                   │
│  - Executes PromQL queries                                       │
│  - Normalizes response to ResultSet {columns, rows}              │
│  - Implements SchemaProvider for metric discovery                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Existing Data Pipeline                         │
│  - useData hook fetches normalized data                          │
│  - transformData applies filters/aggregations                    │
│  - Chart components receive standard format                      │
└─────────────────────────────────────────────────────────────────┘
```

### Normalized Output Format

Prometheus returns nested time series. We flatten to columnar format:

**Prometheus Response:**
```json
{
  "result": [
    {"metric": {"job": "api"}, "values": [[1000, "10"], [1001, "11"]]},
    {"metric": {"job": "web"}, "values": [[1000, "20"], [1001, "21"]]}
  ]
}
```

**Normalized ResultSet:**
```go
ResultSet{
  Columns: ["timestamp", "value", "job"],
  Rows: [
    [1000, 10.0, "api"],
    [1001, 11.0, "api"],
    [1000, 20.0, "web"],
    [1001, 21.0, "web"],
  ]
}
```

Labels become columns. Existing `group_by` in data mapping handles series splitting for charts.

---

## Configuration

### PrometheusConfig
```go
type PrometheusConfig struct {
    URL      string `json:"url"`      // Prometheus server URL
    Username string `json:"username"` // Basic auth (optional)
    Password string `json:"password"` // Basic auth (optional)
    Timeout  int    `json:"timeout"`  // Query timeout in seconds
}
```

### Query Parameters
```go
type PrometheusQueryParams struct {
    QueryType string `json:"query_type"` // "instant" or "range"
    Start     string `json:"start"`      // RFC3339 or relative: "now-1h"
    End       string `json:"end"`        // RFC3339 or relative: "now"
    Step      string `json:"step"`       // Duration: "15s", "1m", "5m"
}
```

The `Query.Raw` field holds the PromQL expression. Parameters control time range and resolution.

---

## Schema Discovery

### Prometheus API Endpoints Used
| Endpoint | Purpose |
|----------|---------|
| `/api/v1/label/__name__/values` | List all metric names |
| `/api/v1/labels` | List all label names |
| `/api/v1/label/{label}/values` | Values for a specific label |
| `/api/v1/metadata` | Metric type and help text |

### Schema Response Structure
```go
type PrometheusSchemaInfo struct {
    Metrics []PrometheusMetricInfo `json:"metrics"`
    Labels  []string               `json:"labels"`
}

type PrometheusMetricInfo struct {
    Name   string   `json:"name"`   // "http_requests_total"
    Type   string   `json:"type"`   // "counter", "gauge", "histogram", "summary"
    Help   string   `json:"help"`   // Description from metadata
    Labels []string `json:"labels"` // Labels seen with this metric
}
```

---

## Visual Query Builder

### UI Components

| Field | UI Element | Purpose |
|-------|------------|---------|
| **Metric** | Searchable dropdown | Select from discovered metrics |
| **Labels** | Multi-select with values | Filter: `{job="api", method="GET"}` |
| **Query Type** | Toggle | Range (time series) or Instant (single value) |
| **Time Range** | Presets + custom | "Last 1h", "Last 24h", custom |
| **Step** | Dropdown | Resolution: "15s", "1m", "5m" |
| **Aggregation** | Dropdown | PromQL function: `sum`, `avg`, `max`, `rate` |
| **Group By** | Multi-select labels | `sum by (method) (...)` |

### Generated PromQL Preview
Show the generated PromQL in a read-only field. Advanced users can toggle to raw edit mode.

Example generation:
```
User selections:
  Metric: http_requests_total
  Labels: job="api-server"
  Aggregation: rate, 5m window
  Group by: method

Generated PromQL:
  sum by (method) (rate(http_requests_total{job="api-server"}[5m]))
```

---

## Range vs Instant Queries

| Query Type | Use Case | Chart Types |
|------------|----------|-------------|
| **Range** | Time series data | Line, Area, Bar (time-based) |
| **Instant** | Current values | Gauge, Number, Pie |

Stored in chart's `query_config.params`:
```json
{
  "raw": "http_requests_total{job='api'}",
  "type": "prometheus",
  "params": {
    "query_type": "range",
    "step": "1m",
    "start": "now-1h",
    "end": "now"
  }
}
```

---

## AI Integration

### Preventing Native PromQL Patterns

The AI should use our data interface, not write raw PromQL. System prompt additions:

```
## Prometheus Data Sources

When working with Prometheus data sources:
- Use query_datasource to discover available metrics and sample data
- Data is normalized to columns: [timestamp, value, ...labels]
- Use update_filters for label filtering, NOT PromQL label selectors in code
- The query builder handles PromQL generation - focus on data mapping
- Range queries are used for time-series charts (line, area, bar)
- Instant queries are used for single-value displays (gauge, number)
```

### New AI Tool
```go
{
    Name: "get_prometheus_schema",
    Description: "Get available metrics and labels from a Prometheus data source",
    InputSchema: {
        Properties: {
            "datasource_id": {"type": "string", "description": "ID of the Prometheus data source"}
        },
        Required: ["datasource_id"]
    }
}
```

---

## Implementation Phases

### Phase 1: Backend Adapter
- [ ] Add `DatasourceTypePrometheus` constant to `models/datasource.go`
- [ ] Create `PrometheusConfig` struct in `models/datasource.go`
- [ ] Implement `prometheus.go` adapter with Query() and Close()
- [ ] Add Prometheus case to factory `CreateFromConfig()`
- [ ] Basic health check endpoint support

### Phase 2: Schema Discovery
- [ ] Implement `PrometheusSchemaProvider` interface
- [ ] Add `/api/datasources/:id/prometheus-schema` endpoint
- [ ] Fetch and cache metric metadata
- [ ] Return structured schema for UI consumption

### Phase 3: Query Execution
- [ ] Implement range query with time parameters
- [ ] Implement instant query
- [ ] Normalize matrix/vector responses to ResultSet
- [ ] Handle error responses and timeouts

### Phase 4: Frontend - Data Source Config
- [ ] Add "Prometheus" option to data source type selector
- [ ] Create Prometheus config form (URL, auth, timeout)
- [ ] Test connection functionality

### Phase 5: Frontend - Query Builder
- [ ] Create `PrometheusQueryBuilder.jsx` component
- [ ] Metric selector with search
- [ ] Label filter builder
- [ ] Time range and step controls
- [ ] Aggregation and group by options
- [ ] PromQL preview display
- [ ] Integrate into ChartEditor

### Phase 6: AI Integration
- [ ] Add `get_prometheus_schema` tool
- [ ] Update system prompt with Prometheus guidance
- [ ] Test AI interaction with Prometheus data sources

### Phase 7: Streaming (Optional/Future)
- [ ] Implement polling-based Stream() method
- [ ] Use instant queries at configurable intervals
- [ ] Consider Prometheus Remote Write receiver for true push

---

## Files to Create

| File | Purpose |
|------|---------|
| `server-go/internal/datasource/prometheus.go` | Prometheus adapter implementation |
| `client/src/components/PrometheusQueryBuilder.jsx` | Visual query builder |
| `client/src/components/PrometheusQueryBuilder.scss` | Query builder styles |

## Files to Modify

| File | Changes |
|------|---------|
| `server-go/internal/models/datasource.go` | Add Prometheus types and config |
| `server-go/internal/datasource/factory.go` | Add Prometheus case |
| `server-go/internal/handlers/datasource_handler.go` | Schema endpoint |
| `server-go/internal/ai/system_prompt.go` | Prometheus guidance |
| `server-go/internal/ai/tools.go` | Schema discovery tool |
| `client/src/pages/DatasourcesPage.jsx` | Prometheus config form |
| `client/src/components/ChartEditor.jsx` | Query builder integration |

---

## Open Questions

1. **Label value loading**: Fetch all label values upfront or lazy-load on selection?
   - Recommendation: Lazy-load (some labels have thousands of values)

2. **Histogram/Summary metrics**: Special handling needed?
   - Defer to Phase 2, use basic queries first

3. **Schema caching**: How long to cache metric metadata?
   - Suggestion: 5 minutes, with manual refresh option

---

## References

- [Prometheus HTTP API](https://prometheus.io/docs/prometheus/latest/querying/api/)
- [PromQL Documentation](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Existing SQL Schema Discovery](server-go/internal/datasource/sql.go)

---

**Created**: 2025-12-15
**Status**: Planning
