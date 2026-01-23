# EdgeLake Data Source - Implementation Plan

## Overview

Add EdgeLake as a new data source type for querying distributed time-series data from EdgeLake/AnyLog nodes. EdgeLake is a decentralized database optimized for IoT and edge computing with SQL query support.

## EdgeLake Architecture

```
Dashboard Frontend
        ↓
Dashboard Go Backend
        ↓
EdgeLake Node REST API (HTTP)
        ↓
EdgeLake Distributed Database Network
```

EdgeLake uses a unique REST API where commands are passed via HTTP headers rather than URL paths or body content.

## API Communication Pattern

**Key Insight**: All EdgeLake API calls use the same base URL with commands in headers:

```
Method:   GET
URL:      http://{host}:{port}/
Headers:  {
    "User-Agent": "anylog",
    "command": "{EdgeLake_command}",
    "destination": "network" (optional - for distributed queries)
}
```

**No authentication required** - EdgeLake nodes handle access control internally.

## EdgeLake Commands Reference

| Operation | Command Header | Description |
|-----------|---------------|-------------|
| List Databases | `blockchain get table` | Returns all databases from blockchain registry |
| List Tables | `blockchain get table where dbms={db}` | Returns tables for specific database |
| Get Schema | `get columns where dbms="{db}" and table="{table}" and format=json` | Column definitions |
| Execute Query | `sql {database} format = json "{query}"` | Run SQL query |
| Node Status | `get status` | Health/status check |

## Connection Validation

The `get status` command is used for validating EdgeLake connections. This command:

1. **Verifies connectivity** - Confirms the node is reachable at the specified host:port
2. **Confirms node is operational** - Returns status info only if EdgeLake is running properly
3. **Returns useful diagnostics** - Response includes version, uptime, and connection info

**Test Connection Flow:**
```
1. User enters host/port in data source editor
2. User clicks "Test Connection"
3. Backend sends: GET / with header "command: get status"
4. Success: Node returns status JSON → show success message
5. Failure: Connection refused/timeout → show error with details
```

**Example `get status` Response:**
```json
{
  "status": "running",
  "version": "1.3.2405",
  "uptime": "5 days 3:42:15",
  "connections": {
    "tcp": 32048,
    "rest": 32049,
    "broker": 32050
  }
}
```

This provides more useful feedback than a simple ping, letting users know the EdgeLake node is properly configured and operational.

## Data Model Changes

### Datasource Model

Add EdgeLake configuration to `server-go/internal/models/datasource.go`:

```go
type EdgeLakeConfig struct {
    Host                string `json:"host" bson:"host"`                                   // EdgeLake node IP/hostname
    Port                int    `json:"port" bson:"port"`                                   // REST API port (default: 32049)
    Timeout             int    `json:"timeout,omitempty" bson:"timeout,omitempty"`         // Request timeout in seconds (default: 20)
    UseDistributedQuery bool   `json:"use_distributed_query" bson:"use_distributed_query"` // Add "destination: network" header
}

type DatasourceConfig struct {
    // ... existing configs ...
    EdgeLake *EdgeLakeConfig `json:"edgelake,omitempty" bson:"edgelake,omitempty"`
}
```

### Database/Table Selection

EdgeLake requires selecting database and table before querying. Add to chart/query config:

```go
type EdgeLakeQueryConfig struct {
    Database     string   `json:"database"`                // Required: database name
    Table        string   `json:"table"`                   // Required: table name
    Columns      []string `json:"columns,omitempty"`       // Columns to select (default: *)
    Where        string   `json:"where,omitempty"`         // WHERE clause
    GroupBy      []string `json:"group_by,omitempty"`      // GROUP BY columns
    OrderBy      string   `json:"order_by,omitempty"`      // ORDER BY clause
    Limit        int      `json:"limit,omitempty"`         // LIMIT (default: 1000)
    ExtendFields []string `json:"extend_fields,omitempty"` // Metadata fields: +ip, +hostname, @table_name
}
```

## Implementation Phases

### Phase 1: Backend - EdgeLake Client

**File:** `server-go/internal/datasource/edgelake.go`

Create EdgeLake adapter implementing the datasource interface:

```go
package datasource

import (
    "encoding/json"
    "fmt"
    "net/http"
    "strings"
    "time"
)

type EdgeLakeAdapter struct {
    config *models.EdgeLakeConfig
    client *http.Client
}

func NewEdgeLakeAdapter(config *models.EdgeLakeConfig) *EdgeLakeAdapter {
    timeout := config.Timeout
    if timeout == 0 {
        timeout = 20
    }
    return &EdgeLakeAdapter{
        config: config,
        client: &http.Client{Timeout: time.Duration(timeout) * time.Second},
    }
}

// ExecuteCommand sends a command to EdgeLake via headers
func (a *EdgeLakeAdapter) ExecuteCommand(command string, distributed bool) ([]byte, error) {
    url := fmt.Sprintf("http://%s:%d/", a.config.Host, a.config.Port)

    req, err := http.NewRequest("GET", url, nil)
    if err != nil {
        return nil, err
    }

    req.Header.Set("User-Agent", "anylog")
    req.Header.Set("command", command)

    if distributed {
        req.Header.Set("destination", "network")
    }

    resp, err := a.client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    // Read response body...
}

// ListDatabases returns all databases from blockchain
func (a *EdgeLakeAdapter) ListDatabases() ([]string, error) {
    data, err := a.ExecuteCommand("blockchain get table", false)
    // Parse response and extract unique database names...
}

// ListTables returns tables for a specific database
func (a *EdgeLakeAdapter) ListTables(database string) ([]string, error) {
    data, err := a.ExecuteCommand("blockchain get table", false)
    // Parse and filter tables by database...
}

// GetSchema returns column definitions for a table
func (a *EdgeLakeAdapter) GetSchema(database, table string) ([]Column, error) {
    cmd := fmt.Sprintf(`get columns where dbms="%s" and table="%s" and format=json`, database, table)
    data, err := a.ExecuteCommand(cmd, false)
    // Parse column definitions...
}

// Query executes SQL query and returns results
func (a *EdgeLakeAdapter) Query(database, query string) ([]map[string]interface{}, error) {
    cmd := fmt.Sprintf(`sql %s format = json "%s"`, database, query)
    data, err := a.ExecuteCommand(cmd, a.config.UseDistributedQuery)
    // Parse JSON results...
}

// TestConnection verifies connectivity
func (a *EdgeLakeAdapter) TestConnection() error {
    _, err := a.ExecuteCommand("get status", false)
    return err
}
```

**Estimated scope:** ~200-250 lines

### Phase 2: Backend - Factory & Handler Updates

**Files to modify:**

1. `server-go/internal/datasource/factory.go`
   - Add "edgelake" case to CreateAdapter()
   - Return EdgeLakeAdapter instance

2. `server-go/internal/service/datasource_service.go`
   - Add EdgeLake validation rules
   - Handle EdgeLake test connection
   - Add EdgeLake query execution

3. `server-go/internal/handlers/datasource_handler.go`
   - Ensure existing endpoints work with EdgeLake type

**New API Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/datasources/:id/edgelake/databases` | List available databases |
| GET | `/api/datasources/:id/edgelake/tables?database={db}` | List tables in database |
| GET | `/api/datasources/:id/edgelake/schema?database={db}&table={tbl}` | Get table schema |

**Estimated scope:** ~150 lines

### Phase 3: Frontend - Data Source Editor UI

**File:** `client/src/pages/DatasourceDetailPage.jsx`

Add EdgeLake configuration form:

```jsx
{type === 'edgelake' && (
  <Stack gap={5}>
    <TextInput
      id="edgelake-host"
      labelText="Host"
      value={edgelakeConfig.host || ''}
      onChange={(e) => updateConfig('edgelake.host', e.target.value)}
      placeholder="192.168.1.100 or edgelake.example.com"
      required
    />
    <NumberInput
      id="edgelake-port"
      label="Port"
      value={edgelakeConfig.port || 32049}
      onChange={(e, { value }) => updateConfig('edgelake.port', value)}
      min={1}
      max={65535}
    />
    <NumberInput
      id="edgelake-timeout"
      label="Timeout (seconds)"
      value={edgelakeConfig.timeout || 20}
      onChange={(e, { value }) => updateConfig('edgelake.timeout', value)}
      min={1}
      max={300}
      helperText="Request timeout in seconds"
    />
    <Toggle
      id="edgelake-distributed"
      labelText="Distributed Query"
      labelA="Single Node"
      labelB="Network"
      toggled={edgelakeConfig.use_distributed_query || false}
      onToggle={(checked) => updateConfig('edgelake.use_distributed_query', checked)}
    />
  </Stack>
)}
```

**Estimated scope:** ~100 lines

### Phase 4: Frontend - Schema Discovery UI

**New Component:** `client/src/components/EdgeLakeSchemaSelector.jsx`

A cascading selector for database → table → columns:

```jsx
const EdgeLakeSchemaSelector = ({ datasourceId, onSchemaSelect }) => {
  const [databases, setDatabases] = useState([]);
  const [tables, setTables] = useState([]);
  const [columns, setColumns] = useState([]);
  const [selected, setSelected] = useState({ database: '', table: '' });

  // Fetch databases on mount
  useEffect(() => {
    apiClient.get(`/datasources/${datasourceId}/edgelake/databases`)
      .then(res => setDatabases(res.data.databases));
  }, [datasourceId]);

  // Fetch tables when database selected
  useEffect(() => {
    if (selected.database) {
      apiClient.get(`/datasources/${datasourceId}/edgelake/tables?database=${selected.database}`)
        .then(res => setTables(res.data.tables));
    }
  }, [selected.database]);

  // Fetch schema when table selected
  useEffect(() => {
    if (selected.database && selected.table) {
      apiClient.get(`/datasources/${datasourceId}/edgelake/schema?database=${selected.database}&table=${selected.table}`)
        .then(res => {
          setColumns(res.data.columns);
          onSchemaSelect({ ...selected, columns: res.data.columns });
        });
    }
  }, [selected.table]);

  return (
    <Stack gap={4}>
      <Dropdown
        id="edgelake-database"
        titleText="Database"
        items={databases}
        selectedItem={selected.database}
        onChange={({ selectedItem }) => setSelected({ database: selectedItem, table: '' })}
      />
      <Dropdown
        id="edgelake-table"
        titleText="Table"
        items={tables}
        selectedItem={selected.table}
        onChange={({ selectedItem }) => setSelected({ ...selected, table: selectedItem })}
        disabled={!selected.database}
      />
      {columns.length > 0 && (
        <div className="schema-columns">
          <p>Columns:</p>
          <ul>
            {columns.map(col => (
              <li key={col.name}>{col.name}: {col.type}</li>
            ))}
          </ul>
        </div>
      )}
    </Stack>
  );
};
```

**Estimated scope:** ~150 lines

### Phase 5: Frontend - Query Builder Integration

**File:** `client/src/components/SQLQueryBuilder.jsx`

Add EdgeLake-specific query building:

1. Database/table selection (using EdgeLakeSchemaSelector)
2. Column selection with checkboxes
3. WHERE clause builder
4. GROUP BY selection
5. ORDER BY configuration
6. LIMIT input
7. Extended fields toggle (+ip, +hostname, @table_name)

```jsx
// EdgeLake query configuration panel
{datasourceType === 'edgelake' && (
  <Stack gap={4}>
    <EdgeLakeSchemaSelector
      datasourceId={datasourceId}
      onSchemaSelect={handleSchemaSelect}
    />

    {schema && (
      <>
        <MultiSelect
          id="edgelake-columns"
          titleText="Columns"
          items={schema.columns.map(c => c.name)}
          selectedItems={queryConfig.columns}
          onChange={({ selectedItems }) => updateQuery('columns', selectedItems)}
        />

        <TextArea
          id="edgelake-where"
          labelText="WHERE Clause"
          value={queryConfig.where || ''}
          onChange={(e) => updateQuery('where', e.target.value)}
          placeholder="e.g., timestamp > NOW() - INTERVAL '1 hour'"
        />

        <MultiSelect
          id="edgelake-groupby"
          titleText="GROUP BY"
          items={schema.columns.map(c => c.name)}
          selectedItems={queryConfig.group_by}
          onChange={({ selectedItems }) => updateQuery('group_by', selectedItems)}
        />

        <NumberInput
          id="edgelake-limit"
          label="Limit"
          value={queryConfig.limit || 1000}
          onChange={(e, { value }) => updateQuery('limit', value)}
          min={1}
          max={100000}
        />

        <Checkbox
          id="edgelake-extend-ip"
          labelText="Include node IP (+ip)"
          checked={queryConfig.extend_fields?.includes('+ip')}
          onChange={(_, { checked }) => toggleExtendField('+ip', checked)}
        />
        <Checkbox
          id="edgelake-extend-hostname"
          labelText="Include hostname (+hostname)"
          checked={queryConfig.extend_fields?.includes('+hostname')}
          onChange={(_, { checked }) => toggleExtendField('+hostname', checked)}
        />
      </>
    )}
  </Stack>
)}
```

**Estimated scope:** ~200 lines

### Phase 6: Chart Editor Integration

**File:** `client/src/components/ChartEditor.jsx`

1. Detect when datasource type is "edgelake"
2. Show EdgeLake-specific query configuration
3. Build SQL from configuration
4. Preview data using EdgeLake query endpoint

**Estimated scope:** ~100 lines

### Phase 7: AI System Prompt Updates

**File:** `server-go/internal/ai/system_prompt.go`

Add EdgeLake to AI component building capabilities:

```go
// EdgeLake Data Source
// - Distributed time-series database for IoT/edge data
// - Requires database and table selection
// - Supports SQL with aggregations, GROUP BY, ORDER BY
// - Extended fields: +ip, +hostname, @table_name for distributed query metadata
// - Query execution: POST /api/datasources/:id/query with edgelake query config
```

**Estimated scope:** ~50 lines

### Phase 8: Testing & Documentation

1. Test connection to EdgeLake node
2. Test database/table discovery
3. Test schema retrieval
4. Test query execution with various SQL patterns
5. Test distributed query mode
6. Test error handling (node offline, invalid queries)
7. Update CLAUDE.md with EdgeLake documentation

## Response Format Handling

EdgeLake responses can come in multiple formats. The backend must handle:

### 1. JSON Array (Query Results)
```json
{
  "Query": [
    {"device_id": "sensor_001", "temperature": 25.5},
    {"device_id": "sensor_002", "temperature": 26.1}
  ]
}
```

### 2. Blockchain Table Response (Text)
```
Database   | Table name
-----------|-----------
new_company| rand_data
new_company| ping_sensor
```

### 3. Column Schema (JSON)
```json
{
  "columns": [
    {"name": "row_id", "type": "SERIAL"},
    {"name": "timestamp", "type": "TIMESTAMP"},
    {"name": "value", "type": "decimal"}
  ]
}
```

The EdgeLake adapter must detect format and parse accordingly.

## SQL Query Building

Build SQL from query configuration:

```go
func BuildEdgeLakeQuery(config *EdgeLakeQueryConfig) string {
    var sb strings.Builder

    // SELECT
    sb.WriteString("SELECT ")
    if len(config.ExtendFields) > 0 {
        sb.WriteString(strings.Join(config.ExtendFields, ", "))
        sb.WriteString(", ")
    }
    if len(config.Columns) == 0 {
        sb.WriteString("*")
    } else {
        sb.WriteString(strings.Join(config.Columns, ", "))
    }

    // FROM
    sb.WriteString(" FROM ")
    sb.WriteString(config.Table)

    // WHERE
    if config.Where != "" {
        sb.WriteString(" WHERE ")
        sb.WriteString(config.Where)
    }

    // GROUP BY
    if len(config.GroupBy) > 0 {
        sb.WriteString(" GROUP BY ")
        sb.WriteString(strings.Join(config.GroupBy, ", "))
    }

    // ORDER BY
    if config.OrderBy != "" {
        sb.WriteString(" ORDER BY ")
        sb.WriteString(config.OrderBy)
    }

    // LIMIT
    limit := config.Limit
    if limit == 0 {
        limit = 1000
    }
    sb.WriteString(fmt.Sprintf(" LIMIT %d", limit))

    return sb.String()
}
```

## Data Type Mapping

| EdgeLake Type | Go Type | JS Type | Chart Axis |
|---------------|---------|---------|------------|
| SERIAL | int64 | number | value |
| INT | int64 | number | value |
| TIMESTAMP | time.Time | Date | time |
| CHAR/VARCHAR | string | string | category |
| decimal/float | float64 | number | value |

## Error Handling

Handle EdgeLake-specific errors:

1. **Connection refused**: Node offline or wrong port
2. **Invalid database**: Database not in blockchain
3. **Invalid table**: Table not found in database
4. **Query syntax error**: Invalid SQL
5. **Timeout**: Query taking too long
6. **No data**: Query returned empty results

## Total Estimated Effort

| Phase | Description | Lines |
|-------|-------------|-------|
| 1 | EdgeLake Client | ~250 |
| 2 | Factory & Handlers | ~150 |
| 3 | Data Source UI | ~100 |
| 4 | Schema Discovery | ~150 |
| 5 | Query Builder | ~200 |
| 6 | Chart Editor | ~100 |
| 7 | AI Prompts | ~50 |
| 8 | Testing | - |
| **Total** | | **~1000 lines** |

## Dependencies

- No external Go packages required (uses net/http)
- No external JS packages required

## Migration

- No database migration needed
- Existing datasources unaffected
- New type available immediately after deployment

## Configuration Example

```json
{
  "name": "Production EdgeLake",
  "type": "edgelake",
  "config": {
    "edgelake": {
      "host": "192.168.1.106",
      "port": 32049,
      "timeout": 30,
      "use_distributed_query": true
    }
  },
  "mask_secrets": true
}
```

## Open Questions

1. Should we support multiple EdgeLake nodes for failover?
2. Do we need to implement query result caching?
3. Should extended fields be auto-enabled for distributed queries?
4. How should we handle very large result sets (streaming)?

---

**Status:** Ready for Implementation
**Created:** 2026-01-15
**Priority:** High (user requested)
