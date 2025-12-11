# Data Source Processing Flow

This document describes the complete data flow from external data sources through the backend to the frontend chart rendering.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              DATA SOURCE PROCESSING FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────┐
│   External  │───▶│   Go Backend    │───▶│   React Client  │───▶│   Chart Component   │
│   Source    │    │   Adapters      │    │   Data Layer    │    │   Rendering         │
└─────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────────┘
     │                    │                       │                        │
     │ WebSocket/         │ Normalized            │ { columns,             │ toObjects()
     │ HTTP/SQL/CSV       │ ResultSet             │   rows }               │ transformData()
     │                    │                       │                        │
     ▼                    ▼                       ▼                        ▼
  Raw Data         { columns: [],          useData hook            ECharts option
                     rows: [][] }          queryData()              series data
```

---

## 1. Backend Processing (Go Server - Port 3001)

### 1.1 Entry Point: HTTP Handler

**File:** `server-go/internal/handlers/datasource_handler.go`

When a query request arrives at `POST /api/datasources/:id/query`:

```go
func (h *DatasourceHandler) QueryDatasource(c *gin.Context) {
    id := c.Param("id")
    var req models.QueryRequest
    c.ShouldBindJSON(&req)
    response, err := h.service.QueryDatasource(ctx, id, &req)
    c.JSON(http.StatusOK, response)
}
```

### 1.2 Service Layer

**File:** `server-go/internal/service/datasource_service.go`

The service layer:
1. Retrieves datasource configuration from MongoDB
2. Creates the appropriate adapter via factory
3. Executes the query
4. Returns normalized results

```go
func (s *DatasourceService) QueryDatasource(ctx context.Context, id string, req *models.QueryRequest) (*models.QueryResponse, error) {
    // 1. Get datasource config from MongoDB
    ds, err := s.repo.FindByID(ctx, id)

    // 2. Create adapter via factory
    factory := datasource.NewDataSourceFactory()
    dataSource, err := factory.CreateFromConfig(ds)
    defer dataSource.Close()

    // 3. Execute query
    resultSet, err := dataSource.Query(ctx, req.Query)

    // 4. Return normalized response
    return &models.QueryResponse{
        Success:   true,
        ResultSet: resultSet,
        Duration:  duration,
    }, nil
}
```

### 1.3 Data Source Adapters

**Location:** `server-go/internal/datasource/`

#### Factory Pattern

**File:** `factory.go`

```go
func (f *DataSourceFactory) CreateFromConfig(ds *models.Datasource) (models.DataSource, error) {
    switch ds.Type {
    case models.DatasourceTypeSocket:
        return NewSocketDataSource(ds.Config.Socket)
    case models.DatasourceTypeAPI:
        return NewAPIDataSource(ds.Config.API)
    case models.DatasourceTypeSQL:
        return NewSQLDataSource(ds.Config.SQL)
    case models.DatasourceTypeCSV:
        return NewCSVDataSource(ds.Config.CSV)
    }
}
```

#### DataSource Interface

All adapters implement this interface:

```go
type DataSource interface {
    Query(ctx context.Context, query Query) (*ResultSet, error)
    Stream(ctx context.Context, query Query) (<-chan Record, error)
    Close() error
}
```

---

## 2. Adapter-Specific Processing

### 2.1 Socket/WebSocket Adapter

**File:** `server-go/internal/datasource/socket.go`

#### Connection Flow:
1. Establish WebSocket connection to configured URL
2. Start streaming goroutine
3. Parse incoming messages based on parser config

#### Parser Configuration:
```json
{
  "parser": {
    "data_path": "data",           // Extract array from this JSON path
    "timestamp_field": "timestamp", // Where to find timestamp
    "field_mappings": {},          // Rename fields
    "include_fields": [],          // Whitelist fields
    "exclude_fields": []           // Blacklist fields
  }
}
```

#### Message Processing:

```go
// parseMessageToRecords - handles array explosion
func (s *SocketDataSource) parseMessageToRecords(message []byte) []models.Record {
    // 1. Parse JSON
    json.Unmarshal(message, &rawData)

    // 2. Extract data from data_path (e.g., "data")
    extracted := extractByPath(rawData, parser.DataPath)

    // 3. If array, explode into multiple records
    if dataArray, ok := extracted.([]interface{}); ok {
        records := make([]models.Record, 0)
        for _, item := range dataArray {
            record := models.Record{}
            // Copy fields, ensure timestamp exists
            records = append(records, record)
        }
        return records
    }

    // 4. Otherwise return single record
    return []models.Record{s.parseMessage(message)}
}
```

#### Query Method (Batch Collection):
The `Query()` method collects streaming data for a 5-second window:

```go
func (s *SocketDataSource) Query(ctx context.Context, query models.Query) (*models.ResultSet, error) {
    // Start streaming
    recordChan, _ := s.Stream(ctx, query)

    // Collect for 5 seconds
    timeout := 5 * time.Second
    collectCtx, cancel := context.WithTimeout(ctx, timeout)

    var records []models.Record
    for {
        select {
        case record, ok := <-recordChan:
            records = append(records, record)
        case <-collectCtx.Done():
            goto processRecords
        }
    }

    // Build normalized ResultSet
    return &models.ResultSet{
        Columns: columnOrder,
        Rows:    rows,
    }, nil
}
```

### 2.2 API Adapter

**File:** `server-go/internal/datasource/api.go`

#### Configuration:
```json
{
  "api": {
    "url": "https://api.example.com/data",
    "method": "GET",
    "headers": { "Accept": "application/json" },
    "auth_type": "bearer",
    "auth_credentials": { "token": "xxx" },
    "response_path": "data.items",
    "timeout": 30,
    "retry_count": 3,
    "retry_delay": 1000
  }
}
```

#### Processing:
1. Build HTTP request with headers and auth
2. Execute with retry logic
3. Parse JSON response
4. Extract data from `response_path`
5. Convert to normalized ResultSet

### 2.3 SQL Adapter

**File:** `server-go/internal/datasource/sql.go`

#### Configuration:
```json
{
  "sql": {
    "driver": "postgres",
    "connection_string": "postgres://user:pass@host:5432/db",
    "max_connections": 10
  }
}
```

#### Processing:
1. Open database connection
2. Execute query
3. Scan rows into ResultSet format
4. Handle column types appropriately

### 2.4 CSV Adapter

**File:** `server-go/internal/datasource/csv.go`

#### Configuration:
```json
{
  "csv": {
    "path": "/data/readings.csv",
    "delimiter": ",",
    "has_header": true,
    "encoding": "utf-8"
  }
}
```

---

## 3. Normalized Response Format

All adapters return data in this normalized format:

```go
type ResultSet struct {
    Columns  []string                 // ["timestamp", "sensor_id", "value", "location"]
    Rows     [][]interface{}          // [[1234567890, "sensor-001", 25.5, "Building-A"], ...]
    Metadata map[string]interface{}   // { "row_count": 100 }
}
```

**JSON Response:**
```json
{
  "success": true,
  "result_set": {
    "columns": ["timestamp", "sensor_id", "sensor_type", "value", "unit", "location"],
    "rows": [
      [1765144678, "sensor-001", "temperature", 20.62, "°C", "Building-A/Floor-1"],
      [1765144678, "sensor-002", "humidity", 60.26, "%", "Building-A/Floor-2"]
    ],
    "metadata": {
      "row_count": 2
    }
  },
  "duration": 45
}
```

---

## 4. Frontend Processing (React Client)

### 4.1 API Client Layer

**File:** `client/src/api/dataClient.js`

```javascript
export async function queryData(datasourceId, query, useCache = true) {
    const response = await apiClient.request(`/api/datasources/${datasourceId}/query`, {
        method: 'POST',
        body: JSON.stringify({ query: query })
    });

    return {
        data: response.result_set,  // { columns, rows, metadata }
        source: useCache ? 'cache' : 'datasource'
    };
}
```

### 4.2 useData Hook

**File:** `client/src/hooks/useData.js`

The `useData` hook provides:
- Data fetching with loading/error states
- Auto-refresh via `refreshInterval`
- Caching support
- Deduplication of concurrent requests

```javascript
export function useData({ datasourceId, query, refreshInterval = null, useCache = true }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchData();
    }, [datasourceId, queryKey]);

    // Auto-refresh interval
    useEffect(() => {
        if (refreshInterval > 0) {
            intervalRef.current = setInterval(fetchData, refreshInterval);
        }
    }, [refreshInterval]);

    return { data, loading, error, refetch };
}
```

### 4.3 Data Transform Utilities

**File:** `client/src/utils/dataTransforms.js`

These utilities run AFTER data is fetched, allowing one cached dataset to serve multiple charts:

#### `transformData(data, transforms)`
Apply filters and aggregations:
```javascript
const filtered = transformData(data, {
    filters: [
        { field: 'sensor_type', op: 'eq', value: 'temperature' }
    ],
    aggregation: { type: 'last', sortBy: 'timestamp' },
    limit: 100
});
```

#### `toObjects(data)`
Convert columnar data to objects:
```javascript
const objects = toObjects(data);
// Result: [{ timestamp: 1234567890, sensor_id: "sensor-001", value: 25.5 }, ...]
```

#### `formatTimestamp(value, format)`
Format timestamps for display:
```javascript
formatTimestamp(1234567890, 'chart_time')  // "10:30 AM"
formatTimestamp(1234567890, 'short')       // "1/15/24, 10:30 AM"
```

---

## 5. Chart Component Rendering

### 5.1 DynamicComponentLoader

**File:** `client/src/components/DynamicComponentLoader.jsx`

Provides these utilities to dynamically loaded chart components:

| Utility | Purpose |
|---------|---------|
| `useData` | Fetch data from datasources |
| `toObjects` | Convert columnar to objects |
| `transformData` | Apply filters/aggregations |
| `formatTimestamp` | Format timestamps |
| `ReactECharts` | ECharts component |
| `DataTable` | Carbon DataTable components |

### 5.2 Chart Component Pattern

```javascript
const Component = ({ data }) => {
    // 1. Fetch data using useData hook
    const { data: liveData, loading, error } = useData({
        datasourceId: '6927a979b0b50773dcdccf5a',
        query: { raw: '', type: 'socket' },
        refreshInterval: 1000
    });

    // 2. Convert to objects
    const objects = toObjects(liveData);

    // 3. Filter for specific sensor type
    const temperatureReadings = objects.filter(d => d.sensor_type === 'temperature');

    // 4. Build ECharts option
    const option = {
        xAxis: { type: 'category', data: xAxisData },
        yAxis: { type: 'value' },
        series: [{
            type: 'line',
            data: temperatureReadings.map(d => [
                formatTimestamp(d.timestamp, 'chart_time'),
                d.value
            ])
        }]
    };

    // 5. Render
    return <ReactECharts option={option} />;
};
```

---

## 6. Preview vs Dashboard View

### 6.1 Preview Interface (Chart Editor)

**Location:** Chart Editor Modal, Data tab

```
┌─────────────────────────────────────────────────────────────────┐
│                    CHART EDITOR - PREVIEW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   Chart Preview                          │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │                                                   │    │    │
│  │  │         DynamicComponentLoader                   │    │    │
│  │  │         (renders component_code)                 │    │    │
│  │  │                                                   │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  Query Configuration:                                             │
│  - datasource_id: from chart settings                            │
│  - query.raw: from chart.query_config                            │
│  - query.type: from chart.query_config                           │
│  - refreshInterval: based on datasource type                     │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Data Flow:**
1. Chart's `datasource_id` is used
2. `query_config` provides query parameters
3. Component uses `useData` hook internally
4. Preview updates in real-time

### 6.2 Dashboard View

**Location:** `/view/dashboards/:id`

```
┌─────────────────────────────────────────────────────────────────┐
│                    DASHBOARD VIEWER                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Panel 1   │  │   Panel 2   │  │   Panel 3   │             │
│  │   Chart A   │  │   Chart B   │  │   Chart C   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                   │
│  Each Panel:                                                      │
│  1. Gets chart_id from dashboard.charts[].chart_id               │
│  2. Fetches chart config from API                                │
│  3. Renders via DynamicComponentLoader                           │
│  4. Component uses its own datasource_id                         │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Data Flow:**
1. Dashboard loads chart configurations
2. Each chart rendered in its panel
3. Each chart fetches its own data via `useData`
4. Independent refresh intervals per chart

### 6.3 Key Differences

| Aspect | Preview | Dashboard View |
|--------|---------|----------------|
| Context | Single chart editing | Multiple charts |
| Data Source | Chart's datasource_id | Each chart's own datasource |
| Refresh | Immediate on code change | Per-chart refresh intervals |
| Layout | Fixed preview area | Grid layout with panels |
| Props | `{ data }` passed | `{ data }` passed |

---

## 7. Data Processing Pipeline Summary

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           COMPLETE DATA PIPELINE                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘

STAGE 1: External Source
├── WebSocket sends: { "data": [{ sensor_id, value, timestamp }, ...] }
├── API returns: { "items": [...] }
├── SQL returns: rows from query
└── CSV provides: parsed file rows

    │
    ▼

STAGE 2: Go Backend Adapter
├── Socket: parseMessageToRecords() - explodes arrays
├── API: extractByPath() - navigates response_path
├── SQL: rows.Scan() - reads result set
└── CSV: csv.Reader - parses file

    │
    ▼

STAGE 3: Normalization
└── ResultSet { columns: [...], rows: [[...], [...]] }

    │
    ▼

STAGE 4: HTTP Response
└── JSON { success: true, result_set: {...}, duration: 45 }

    │
    ▼

STAGE 5: React dataClient
└── queryData() returns { data: { columns, rows }, source }

    │
    ▼

STAGE 6: useData Hook
├── Manages loading/error states
├── Handles auto-refresh
└── Returns { data, loading, error, refetch }

    │
    ▼

STAGE 7: Component Transform
├── toObjects() - converts to array of objects
├── transformData() - applies filters/aggregations
└── formatTimestamp() - formats for display

    │
    ▼

STAGE 8: Chart Rendering
├── Build ECharts option from transformed data
└── ReactECharts renders visualization
```

---

## 8. Troubleshooting

### Common Issues

#### Duplicate Data
- **Cause:** Array not being exploded in socket adapter
- **Fix:** Ensure `parseMessageToRecords` handles arrays at `data_path`

#### Missing Timestamps
- **Cause:** `timestamp_field` not configured or wrong path
- **Fix:** Check parser config's `timestamp_field`

#### Only One Location Showing
- **Cause:** Source data only has one sensor per type
- **Fix:** Check actual data - may need multiple temperature sensors at different locations

#### Data Not Updating
- **Cause:** Missing `refreshInterval` or caching
- **Fix:** Set `refreshInterval` in `useData` call, set `useCache: false`

---

## 9. Configuration Reference

### Socket Data Source Config
```json
{
  "socket": {
    "url": "ws://localhost:8080/sensors",
    "protocol": "websocket",
    "message_format": "json",
    "reconnect_on_error": true,
    "reconnect_delay": 1000,
    "buffer_size": 100,
    "parser": {
      "data_path": "data",
      "timestamp_field": "timestamp",
      "field_mappings": {},
      "include_fields": [],
      "exclude_fields": []
    }
  }
}
```

### Query Config (Chart)
```json
{
  "query_config": {
    "raw": "",
    "type": "socket"
  }
}
```

### Data Mapping (Chart)
```json
{
  "data_mapping": {
    "x_axis": "timestamp",
    "x_axis_label": "Time",
    "y_axis": ["value"],
    "y_axis_label": "Temperature (°C)",
    "group_by": "location",
    "filters": [
      { "field": "sensor_type", "op": "eq", "value": "temperature" }
    ]
  }
}
```

---

## 10. WebSocket Connection Lifecycle (End-to-End)

This section provides a detailed view of what happens when a chart using a WebSocket data source renders.

### 10.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    WEBSOCKET CONNECTION LIFECYCLE                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘

EXTERNAL                     GO BACKEND                         REACT CLIENT
SIMULATOR                    (Port 3001)                        (Port 5173)
    │                            │                                   │
    │                            │                                   │
    │  ╔════════════════════════════════════════════════════════════════════════╗
    │  ║                     Chart Initialization                                ║
    │  ╚════════════════════════════════════════════════════════════════════════╝
    │                            │                                   │
    │                            │    ┌─────────────────────────┐   │
    │                            │    │ DynamicComponentLoader  │   │
    │                            │    │ renders component_code  │   │
    │                            │    └───────────┬─────────────┘   │
    │                            │                │                  │
    │                            │    ┌───────────▼─────────────┐   │
    │                            │    │  useData hook called    │   │
    │                            │    │  with datasource_id     │   │
    │                            │    └───────────┬─────────────┘   │
    │                            │                │                  │
    │  ╔════════════════════════════════════════════════════════════════════════╗
    │  ║                     Query Request Phase                                 ║
    │  ╚════════════════════════════════════════════════════════════════════════╝
    │                            │                │                  │
    │                            │    ┌───────────▼─────────────┐   │
    │                            │◄───│ POST /api/datasources/  │   │
    │                            │    │      :id/query          │   │
    │                            │    └─────────────────────────┘   │
    │                            │                                   │
    │  ╔════════════════════════════════════════════════════════════════════════╗
    │  ║              Backend Creates NEW WebSocket Connection                   ║
    │  ╚════════════════════════════════════════════════════════════════════════╝
    │                            │                                   │
    │    ┌───────────────────────┤                                   │
    │    │ 1. Factory creates    │                                   │
    │    │    SocketDataSource   │                                   │
    │    │                       │                                   │
    │◄───┼─2. Dials WebSocket────┤                                   │
    │    │    connection to      │                                   │
    │    │    configured URL     │                                   │
    │    │                       │                                   │
    │────┼─3. Simulator sends────▶                                   │
    │    │    messages           │                                   │
    │    │                       │                                   │
    │    │ 4. Stream() starts    │                                   │
    │    │    goroutine to read  │                                   │
    │    │    messages           │                                   │
    │    │                       │                                   │
    │    │ 5. Query() collects   │                                   │
    │    │    for 5 seconds      │                                   │
    │    │                       │                                   │
    │    │ 6. Timeout fires      │                                   │
    │    └───────────────────────┤                                   │
    │                            │                                   │
    │  ╔════════════════════════════════════════════════════════════════════════╗
    │  ║              Connection Closed, Response Sent                           ║
    │  ╚════════════════════════════════════════════════════════════════════════╝
    │                            │                                   │
    │    ┌───────────────────────┤                                   │
    │    │ 7. dataSource.Close() │                                   │
    │    │    closes WebSocket   │                                   │
    │    └───────────────────────┤                                   │
    │                            │                                   │
    │                            │────▶ JSON Response ──────────────▶│
    │                            │      { columns, rows }            │
    │                            │                                   │
    │  ╔════════════════════════════════════════════════════════════════════════╗
    │  ║              Client Refresh Cycle (repeat)                              ║
    │  ╚════════════════════════════════════════════════════════════════════════╝
    │                            │                                   │
    │                            │    ┌─────────────────────────┐   │
    │                            │    │ refreshInterval fires   │   │
    │                            │    │ (e.g., every 1000ms)    │   │
    │                            │    └───────────┬─────────────┘   │
    │                            │                │                  │
    │                            │◄───────────────┘                  │
    │                            │    (NEW query, NEW connection)    │
    │                            │                                   │
```

### 10.2 Key Insight: Connection Per Query

**IMPORTANT:** The current architecture creates a NEW WebSocket connection for EACH query request. There is no persistent connection.

```go
// datasource_service.go:509-529
func (s *DatasourceService) QueryDatasource(ctx context.Context, id string, req *models.QueryRequest) (*models.QueryResponse, error) {
    // 1. Get datasource config from MongoDB
    ds, err := s.repo.FindByID(ctx, id)

    // 2. Create NEW adapter (opens NEW connection)
    factory := datasource.NewDataSourceFactory()
    dataSource, err := factory.CreateFromConfig(ds)

    // 3. Close connection when done
    defer dataSource.Close()  // <-- Connection closed after each query!

    // 4. Execute query (collects for 5 seconds)
    resultSet, err := dataSource.Query(ctx, req.Query)

    return &models.QueryResponse{...}, nil
}
```

### 10.3 Detailed Flow: Chart Renders

#### Step 1: Component Renders in DynamicComponentLoader

```javascript
// DynamicComponentLoader.jsx
// The chart's component_code is evaluated and rendered
// Example component_code calls useData:

const Component = ({ data }) => {
    const { data: liveData, loading, error } = useData({
        datasourceId: '6927a979b0b50773dcdccf5a',  // Socket datasource ID
        query: { raw: '', type: 'socket' },
        refreshInterval: 1000,  // Poll every second
        useCache: false
    });
    // ... render chart
};
```

#### Step 2: useData Hook Initiates Fetch

```javascript
// useData.js:34-67
const fetchData = useCallback(async () => {
    const result = await queryData(datasourceId, query, useCache);
    setData(result.data);
}, [datasourceId, queryKey, useCache]);

// Initial fetch on mount
useEffect(() => {
    fetchData();
}, [datasourceId, queryKey]);
```

#### Step 3: dataClient Makes HTTP Request

```javascript
// dataClient.js:15-28
export async function queryData(datasourceId, query, useCache = true) {
    const response = await apiClient.request(`/api/datasources/${datasourceId}/query`, {
        method: 'POST',
        body: JSON.stringify({ query: query })
    });
    return { data: response.result_set, source: 'datasource' };
}
```

#### Step 4: Backend Handler Receives Request

```go
// datasource_handler.go:240-260
func (h *DatasourceHandler) QueryDatasource(c *gin.Context) {
    id := c.Param("id")
    var req models.QueryRequest
    c.ShouldBindJSON(&req)

    response, err := h.service.QueryDatasource(c.Request.Context(), id, &req)
    c.JSON(http.StatusOK, response)
}
```

#### Step 5: Service Creates Socket Adapter

```go
// datasource_service.go:521-523
factory := datasource.NewDataSourceFactory()
dataSource, err := factory.CreateFromConfig(ds)
defer dataSource.Close()  // Will close after query completes

// factory.go:112-116 - For socket type:
case models.DatasourceTypeSocket:
    return NewSocketDataSource(ds.Config.Socket)
```

#### Step 6: Socket Adapter Connects and Streams

```go
// socket.go:25-36 - NewSocketDataSource
func NewSocketDataSource(config *models.SocketConfig) (*SocketDataSource, error) {
    ds := &SocketDataSource{
        config: config,
        buffer: make(chan models.Record, getBufferSize(config)),
    }
    // Establishes WebSocket connection immediately
    if err := ds.connect(); err != nil {
        return nil, err
    }
    return ds, nil
}

// socket.go:60-77 - connectWebSocket
func (s *SocketDataSource) connectWebSocket() error {
    dialer := websocket.Dialer{HandshakeTimeout: 10 * time.Second}
    conn, _, err := dialer.Dial(s.config.URL, headers)
    s.wsConn = conn
    return nil
}
```

#### Step 7: Query Collects for 5 Seconds

```go
// socket.go:103-178 - Query method
func (s *SocketDataSource) Query(ctx context.Context, query models.Query) (*models.ResultSet, error) {
    // Start streaming in background goroutine
    recordChan, err := s.Stream(ctx, query)

    // Collect for 5 seconds
    timeout := 5 * time.Second
    collectCtx, cancel := context.WithTimeout(ctx, timeout)
    defer cancel()

    var records []models.Record
    for {
        select {
        case record, ok := <-recordChan:
            if !ok { break }
            records = append(records, record)
        case <-collectCtx.Done():
            goto processRecords  // Timeout fires after 5 seconds
        }
    }

processRecords:
    // Build normalized ResultSet from collected records
    return &models.ResultSet{
        Columns: columnOrder,
        Rows:    rows,
    }, nil
}
```

#### Step 8: Connection Closed, Response Returned

After `Query()` returns, the `defer dataSource.Close()` in the service layer closes the WebSocket connection.

```go
// socket.go:477-491
func (s *SocketDataSource) Close() error {
    if s.cancelFunc != nil {
        s.cancelFunc()
    }
    if s.wsConn != nil {
        return s.wsConn.Close()
    }
    return nil
}
```

#### Step 9: Client Receives Data, Schedules Next Fetch

```javascript
// useData.js:106-117 - Auto-refresh interval
useEffect(() => {
    if (refreshInterval && refreshInterval > 0) {
        intervalRef.current = setInterval(() => {
            fetchData();  // New query → new connection
        }, refreshInterval);
    }
    // Cleanup on unmount
    return () => clearInterval(intervalRef.current);
}, [refreshInterval, fetchData]);
```

### 10.4 Connection Timeline Example

For a chart with `refreshInterval: 1000` (1 second):

```
Time     Client                    Server                      Simulator
─────────────────────────────────────────────────────────────────────────
0ms      Chart mounts
         useData() called
100ms    POST /query ────────────▶
150ms                              Factory creates adapter
200ms                              WebSocket connect ─────────▶ [Connection 1]
200ms-                             Collecting messages         Messages arrive
5200ms                             (5 second window)
5200ms                             Query complete
5250ms                             Close WebSocket ───────────▶ [Connection 1 closed]
5300ms   ◀──────────────────────── JSON Response
5300ms   setData(), re-render
─────────────────────────────────────────────────────────────────────────
6300ms   refreshInterval fires
6350ms   POST /query ────────────▶
6400ms                              WebSocket connect ─────────▶ [Connection 2]
...                                (repeat cycle)
```

### 10.5 Implications of This Architecture

#### Advantages:
- Simple stateless backend - no session management
- Each query is independent
- Clean resource management with defer Close()

#### Disadvantages:
- High connection overhead (new WS connect every query)
- 5-second collection window adds latency
- Not true real-time (batch collection model)

#### Future Consideration: Persistent Connections
For true real-time streaming, consider:
1. Server-side WebSocket proxy that maintains persistent connection
2. SSE (Server-Sent Events) endpoint for client
3. Client connects once, receives continuous updates

### 10.6 Comparing Raw Simulator vs Query API

To verify data integrity, you can compare:

**1. Raw WebSocket from Simulator:**
```bash
# Connect directly to simulator WebSocket
websocat ws://localhost:8080/sensors
# Output: {"timestamp":1765145305,"data":[{...},...]}
```

**2. Query API Output:**
```bash
curl -X POST http://localhost:3001/api/datasources/<id>/query \
  -H "Content-Type: application/json" \
  -d '{"query":{"raw":"","type":"socket"}}'
# Output: {"success":true,"result_set":{"columns":[...],"rows":[...]}}
```

The Query API should return the same data as raw WebSocket, but:
- Collected over 5-second window
- Arrays exploded into individual records
- Timestamps preserved from source
- Normalized to columnar format

---

Last Updated: 2025-12-07
