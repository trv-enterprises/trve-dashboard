# Streaming Architecture for Socket Data Sources

> **Archived 2026-04-11.** Historical planning document for the
> server-side SSE streaming proxy. The feature shipped and its
> current-state documentation lives at
> [`docs/architecture/streaming.md`](../architecture/streaming.md).
> The "Phase 1–4" implementation plan and "Future Enhancements"
> sections below reflect the original design intent, not the final
> implementation — see the current streaming doc for the real
> MQTT stream, retained-state cache, and aggregator details.

This document describes the server-side streaming proxy architecture for WebSocket/socket data sources.

## Problem Statement

The current architecture creates a new WebSocket connection for each query request:
- Connection overhead: ~50-100ms per request
- 5-second collection window adds latency
- Effective refresh rate limited to ~5-6 seconds regardless of `refreshInterval`
- Not true real-time streaming

## Solution: Server-Side Streaming Proxy

Maintain persistent connections to socket data sources on the backend, with SSE (Server-Sent Events) fan-out to clients.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         STREAMING PROXY ARCHITECTURE                         │
└─────────────────────────────────────────────────────────────────────────────┘

EXTERNAL SIMULATORS              GO BACKEND                    REACT CLIENTS
       │                              │                              │
       │                              │                              │
┌──────▼──────┐                       │                              │
│ Simulator A │◄─────────┐            │                              │
│ ws://...    │          │            │                              │
└─────────────┘          │            │                              │
                         │     ┌──────▼───────────────────────┐      │
┌─────────────┐          │     │      StreamManager           │      │
│ Simulator B │◄─────────┼─────│                              │      │
│ ws://...    │          │     │  ┌─────────────────────────┐ │      │
└─────────────┘          │     │  │ streams map             │ │      │
                         │     │  │                         │ │      │
┌─────────────┐          │     │  │ ds_id_1 → Stream{       │ │      │
│ Simulator C │◄─────────┘     │  │   wsConn: *websocket    │ │      │
│ ws://...    │                │  │   subscribers: []chan   │ │      │
└─────────────┘                │  │   buffer: []Record      │ │      │
                               │  │ }                       │ │      │
                               │  │                         │ │      │
                               │  │ ds_id_2 → Stream{...}   │ │      │
                               │  └─────────────────────────┘ │      │
                               │                              │      │
                               │  Methods:                    │      │
                               │  - Subscribe(dsId) chan      │      │
                               │  - Unsubscribe(dsId, chan)   │      │
                               │  - GetBuffer(dsId) []Record  │      │
                               └──────────────┬───────────────┘      │
                                              │                      │
                               ┌──────────────▼───────────────┐      │
                               │  GET /api/datasources/:id/   │      │
                               │       stream                 │      │
                               │  (SSE Endpoint)              │◄─────┤
                               │                              │      │
                               │  - Sets Content-Type: SSE    │      │
                               │  - Subscribes to stream      │      │
                               │  - Pushes records as events  │      │
                               │  - Unsubscribes on close     │      │
                               └──────────────────────────────┘      │
                                                                     │
                                                                     │
                               ┌──────────────────────────────┐      │
                               │  useStreamData hook          │◄─────┘
                               │                              │
                               │  - Uses EventSource API      │
                               │  - Auto-reconnect on error   │
                               │  - Accumulates data in state │
                               └──────────────────────────────┘
```

## Components

### 1. StreamManager (Go Service)

**Location:** `server-go/internal/streaming/manager.go`

**Responsibilities:**
- Maintain ONE persistent WebSocket connection per active socket datasource
- Auto-reconnect on disconnect with exponential backoff
- Buffer last N records per stream (configurable, default 100)
- Fan-out incoming records to all subscribers
- Lazy initialization (connect when first subscriber arrives)
- Cleanup (disconnect when last subscriber leaves, with grace period)

**Interface:**
```go
type StreamManager struct {
    streams map[string]*Stream
    mu      sync.RWMutex
    repo    *repository.DatasourceRepository
}

type Stream struct {
    datasourceID string
    config       *models.SocketConfig
    wsConn       *websocket.Conn
    subscribers  map[chan models.Record]struct{}
    buffer       *RingBuffer
    mu           sync.RWMutex
    cancelFunc   context.CancelFunc
}

// Subscribe returns a channel that receives records
func (m *StreamManager) Subscribe(ctx context.Context, datasourceID string) (<-chan models.Record, error)

// Unsubscribe removes a subscriber
func (m *StreamManager) Unsubscribe(datasourceID string, ch <-chan models.Record)

// GetBuffer returns the last N records (for initial state)
func (m *StreamManager) GetBuffer(datasourceID string) []models.Record
```

### 2. SSE Handler

**Location:** `server-go/internal/handlers/stream_handler.go`

**Endpoint:** `GET /api/datasources/:id/stream`

**Responsibilities:**
- Validate datasource exists and is socket type
- Set SSE headers (`Content-Type: text/event-stream`)
- Subscribe to StreamManager
- Send buffered records immediately (for initial state)
- Stream new records as SSE events
- Handle client disconnect gracefully

**SSE Event Format:**
```
event: record
data: {"columns":["timestamp","sensor_id","value"],"row":[1234567890,"sensor-001",25.5]}

event: record
data: {"columns":["timestamp","sensor_id","value"],"row":[1234567891,"sensor-002",26.1]}

event: heartbeat
data: {"timestamp":1234567892}
```

### 3. useStreamData Hook (React)

**Location:** `client/src/hooks/useStreamData.js`

**Responsibilities:**
- Use EventSource API for SSE connection
- Accumulate records in state (with configurable max buffer)
- Handle reconnection on error/disconnect
- Provide loading/error states
- Convert SSE records to standard `{ columns, rows }` format

**Interface:**
```javascript
function useStreamData({ datasourceId, maxBuffer = 1000 }) {
  const [data, setData] = useState({ columns: [], rows: [] });
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);

  // Returns accumulated data in same format as useData
  return { data, connected, error, clearBuffer };
}
```

### 4. Updated useData Hook

**Location:** `client/src/hooks/useData.js` (modified)

**Changes:**
- Detect datasource type (socket vs others)
- For socket: delegate to `useStreamData`
- For others: use existing polling behavior

```javascript
export function useData({ datasourceId, query, refreshInterval, useCache }) {
  const [datasourceType, setDatasourceType] = useState(null);

  // Fetch datasource config to determine type
  useEffect(() => {
    apiClient.getDatasource(datasourceId).then(ds => {
      setDatasourceType(ds.type);
    });
  }, [datasourceId]);

  // Delegate based on type
  if (datasourceType === 'socket') {
    return useStreamData({ datasourceId });
  }

  // Existing polling logic for API/SQL/CSV
  // ...
}
```

## Data Flow

### Connection Lifecycle

```
1. Chart mounts, calls useData({ datasourceId: 'abc123' })
2. useData fetches datasource config, sees type='socket'
3. useData delegates to useStreamData
4. useStreamData opens EventSource to /api/datasources/abc123/stream
5. SSE handler subscribes to StreamManager for 'abc123'
6. StreamManager checks if stream exists:
   a. If exists: add subscriber, return
   b. If not: create stream, connect WebSocket, start reading
7. StreamManager sends buffered records to new subscriber
8. StreamManager streams new records to all subscribers
9. SSE handler sends records as SSE events
10. useStreamData receives events, accumulates in state
11. Chart re-renders with new data
12. On unmount: EventSource closes, SSE handler unsubscribes
13. StreamManager cleanup (if no subscribers after grace period)
```

### Record Format

**Incoming WebSocket message (from simulator):**
```json
{"timestamp": 1234567890, "data": [
  {"sensor_id": "sensor-001", "value": 25.5, "location": "Building-A"},
  {"sensor_id": "sensor-002", "value": 26.1, "location": "Building-B"}
]}
```

**After array explosion (StreamManager):**
```go
[]models.Record{
  {"timestamp": 1234567890, "sensor_id": "sensor-001", "value": 25.5, "location": "Building-A"},
  {"timestamp": 1234567890, "sensor_id": "sensor-002", "value": 26.1, "location": "Building-B"},
}
```

**SSE event (to client):**
```
event: record
data: {"timestamp":1234567890,"sensor_id":"sensor-001","value":25.5,"location":"Building-A"}

event: record
data: {"timestamp":1234567890,"sensor_id":"sensor-002","value":26.1,"location":"Building-B"}
```

**useStreamData state:**
```javascript
{
  columns: ["timestamp", "sensor_id", "value", "location"],
  rows: [
    [1234567890, "sensor-001", 25.5, "Building-A"],
    [1234567890, "sensor-002", 26.1, "Building-B"]
  ]
}
```

## Configuration

### StreamManager Config

```yaml
streaming:
  buffer_size: 100           # Records to buffer per stream
  reconnect_delay: 1000      # Initial reconnect delay (ms)
  max_reconnect_delay: 30000 # Max reconnect delay (ms)
  cleanup_grace_period: 60   # Seconds to keep stream alive with no subscribers
  heartbeat_interval: 30     # Seconds between heartbeat events
```

### Datasource Config (unchanged)

Socket datasources continue to use existing config:
```json
{
  "socket": {
    "url": "ws://localhost:8080/sensors",
    "protocol": "websocket",
    "parser": {
      "data_path": "data",
      "timestamp_field": "timestamp"
    }
  }
}
```

## Implementation Steps

### Phase 1: Backend StreamManager
1. Create `internal/streaming/manager.go` - StreamManager struct
2. Create `internal/streaming/stream.go` - Stream struct with WebSocket handling
3. Create `internal/streaming/buffer.go` - Ring buffer for record storage
4. Integrate existing `parseMessageToRecords` logic from socket.go

### Phase 2: SSE Endpoint
1. Create `internal/handlers/stream_handler.go`
2. Add route `GET /api/datasources/:id/stream`
3. Wire StreamManager as dependency
4. Handle SSE protocol (headers, event format, keep-alive)

### Phase 3: Frontend Integration
1. Create `client/src/hooks/useStreamData.js`
2. Modify `useData` to detect socket type and delegate
3. Update chart components (should work automatically with same data format)

### Phase 4: Testing
1. Test single subscriber flow
2. Test multiple subscribers to same stream
3. Test reconnection on WebSocket disconnect
4. Test cleanup on subscriber disconnect
5. Performance test with high message rates

## Backward Compatibility

- Existing `/api/datasources/:id/query` endpoint remains unchanged
- Non-socket datasources (API, SQL, CSV) continue to use polling
- Chart components don't need changes (same data format)
- Only `useData` hook needs modification

## Future Enhancements

1. **WebSocket client option**: For browsers that support it, offer direct WebSocket to client instead of SSE
2. **Filtering at stream level**: Allow subscribers to filter records server-side
3. **Compression**: Enable gzip for SSE responses
4. **Metrics**: Track subscriber count, message rate, buffer utilization

---

Last Updated: 2025-12-07
