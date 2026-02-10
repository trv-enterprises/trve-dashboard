// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

package models

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// QueryType represents the type of query
type QueryType string

const (
	QueryTypeSQL          QueryType = "sql"
	QueryTypeCSVFilter    QueryType = "csv_filter"
	QueryTypeStreamFilter QueryType = "stream_filter"
	QueryTypeAPI          QueryType = "api"
	QueryTypeTSStore      QueryType = "tsstore"
	QueryTypePrometheus   QueryType = "prometheus"
	QueryTypeEdgeLake     QueryType = "edgelake"
)

// DatasourceType represents the type of data source
type DatasourceType string

const (
	DatasourceTypeSQL        DatasourceType = "sql"
	DatasourceTypeCSV        DatasourceType = "csv"
	DatasourceTypeSocket     DatasourceType = "socket"
	DatasourceTypeAPI        DatasourceType = "api"
	DatasourceTypeTSStore    DatasourceType = "tsstore"
	DatasourceTypePrometheus DatasourceType = "prometheus"
	DatasourceTypeEdgeLake  DatasourceType = "edgelake"
)

// HealthStatus represents the health status of a data source
type HealthStatus string

const (
	HealthStatusUnknown   HealthStatus = "unknown"
	HealthStatusHealthy   HealthStatus = "healthy"
	HealthStatusUnhealthy HealthStatus = "unhealthy"
	HealthStatusDegraded  HealthStatus = "degraded"
)

// SecretMaskedValue is the placeholder shown for masked secrets
// Frontend uses this to detect if a secret field has a value set
const SecretMaskedValue = "********"

// Query represents a query to execute against a datasource
type Query struct {
	Raw    string                 `json:"raw" bson:"raw"`                         // Raw query string (SQL, filter expression, etc.)
	Params map[string]interface{} `json:"params,omitempty" bson:"params,omitempty"` // Query parameters
	Type   QueryType              `json:"type" bson:"type"`                       // Query type
}

// Record represents a single record in a stream
type Record map[string]interface{}

// ResultSet represents query results in a normalized format
type ResultSet struct {
	Columns  []string                 `json:"columns" bson:"columns"`             // Column names
	Rows     [][]interface{}          `json:"rows" bson:"rows"`                   // Data rows
	Metadata map[string]interface{}   `json:"metadata,omitempty" bson:"metadata,omitempty"` // Additional metadata
}

// DataSource is the interface that all datasource implementations must satisfy
type DataSource interface {
	Query(ctx context.Context, query Query) (*ResultSet, error)
	Stream(ctx context.Context, query Query) (<-chan Record, error)
	Close() error
}

// Datasource represents a data source configuration stored in MongoDB
type Datasource struct {
	ID          primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	Name        string             `json:"name" bson:"name" binding:"required"`
	Description string             `json:"description" bson:"description"`
	Type        DatasourceType     `json:"type" bson:"type" binding:"required,oneof=sql csv socket api tsstore prometheus edgelake"`
	Config      DatasourceConfig   `json:"config" bson:"config" binding:"required"`
	Health      HealthInfo         `json:"health" bson:"health"`
	Tags        []string           `json:"tags,omitempty" bson:"tags,omitempty"`
	MaskSecrets bool               `json:"mask_secrets" bson:"mask_secrets"` // If true, secrets are masked in API responses
	CreatedAt   time.Time          `json:"created_at" bson:"created_at"`
	UpdatedAt   time.Time          `json:"updated_at" bson:"updated_at"`
}

// DatasourceConfig holds type-specific configuration
type DatasourceConfig struct {
	SQL        *SQLConfig        `json:"sql,omitempty" bson:"sql,omitempty"`
	CSV        *CSVConfig        `json:"csv,omitempty" bson:"csv,omitempty"`
	Socket     *SocketConfig     `json:"socket,omitempty" bson:"socket,omitempty"`
	API        *APIConfig        `json:"api,omitempty" bson:"api,omitempty"`
	TSStore    *TSStoreConfig    `json:"tsstore,omitempty" bson:"tsstore,omitempty"`
	Prometheus *PrometheusConfig `json:"prometheus,omitempty" bson:"prometheus,omitempty"`
	EdgeLake   *EdgeLakeConfig   `json:"edgelake,omitempty" bson:"edgelake,omitempty"`
}

// SQLConfig represents configuration for SQL databases
type SQLConfig struct {
	Driver         string `json:"driver" bson:"driver" binding:"required,oneof=postgres mysql sqlite mssql oracle"`
	Host           string `json:"host,omitempty" bson:"host,omitempty"`
	Port           int    `json:"port,omitempty" bson:"port,omitempty"`
	Database       string `json:"database,omitempty" bson:"database,omitempty"`
	Username       string `json:"username,omitempty" bson:"username,omitempty"`
	Password       string `json:"password,omitempty" bson:"password,omitempty"`
	SSL            bool   `json:"ssl,omitempty" bson:"ssl,omitempty"`
	MaxConnections int    `json:"max_connections,omitempty" bson:"max_connections,omitempty"`
	Timeout        int    `json:"timeout,omitempty" bson:"timeout,omitempty"` // seconds
	Options        string `json:"options,omitempty" bson:"options,omitempty"` // Optional connection parameters (e.g., "sslmode=require&connect_timeout=10")
}

// CSVConfig represents configuration for CSV files
type CSVConfig struct {
	Path         string   `json:"path" bson:"path" binding:"required"`
	Delimiter    string   `json:"delimiter,omitempty" bson:"delimiter,omitempty"` // default: ","
	HasHeader    bool     `json:"has_header" bson:"has_header"`                   // default: true
	Columns      []string `json:"columns,omitempty" bson:"columns,omitempty"`     // explicit column names
	WatchChanges bool     `json:"watch_changes" bson:"watch_changes"`
	Encoding     string   `json:"encoding,omitempty" bson:"encoding,omitempty"` // utf-8, ascii, etc.
}

// SocketConfig represents configuration for socket/WebSocket streams
type SocketConfig struct {
	URL              string              `json:"url" bson:"url" binding:"required"`
	Protocol         string              `json:"protocol" bson:"protocol" binding:"required,oneof=tcp udp websocket"`
	Headers          map[string]string   `json:"headers,omitempty" bson:"headers,omitempty"`
	ReconnectOnError bool                `json:"reconnect_on_error" bson:"reconnect_on_error"`
	ReconnectDelay   int                 `json:"reconnect_delay,omitempty" bson:"reconnect_delay,omitempty"` // milliseconds
	PingInterval     int                 `json:"ping_interval,omitempty" bson:"ping_interval,omitempty"`     // seconds
	MessageFormat    string              `json:"message_format,omitempty" bson:"message_format,omitempty"`   // json, text, binary
	BufferSize       int                 `json:"buffer_size,omitempty" bson:"buffer_size,omitempty"`         // number of messages to buffer
	Parser           *SocketParserConfig `json:"parser,omitempty" bson:"parser,omitempty"`                   // parser configuration
}

// SocketParserConfig specifies how to parse incoming socket messages into tabular data
type SocketParserConfig struct {
	// DataPath is the JSON path to the data payload (e.g., "data", "payload", "message.readings")
	// Supports dot notation for nested paths. If empty, treats entire message as the data object.
	DataPath string `json:"data_path,omitempty" bson:"data_path,omitempty"`

	// TimestampField specifies which field contains the timestamp (default: use server receive time)
	TimestampField string `json:"timestamp_field,omitempty" bson:"timestamp_field,omitempty"`

	// TimestampFormat is the Go time format string for parsing timestamps (default: RFC3339)
	// Common formats: "2006-01-02T15:04:05Z07:00" (RFC3339), "2006-01-02 15:04:05", unix timestamp
	TimestampFormat string `json:"timestamp_format,omitempty" bson:"timestamp_format,omitempty"`

	// FieldMappings renames fields in the output (e.g., {"temp": "temperature", "ts": "timestamp"})
	FieldMappings map[string]string `json:"field_mappings,omitempty" bson:"field_mappings,omitempty"`

	// IncludeFields limits output to only these fields (empty = include all)
	IncludeFields []string `json:"include_fields,omitempty" bson:"include_fields,omitempty"`

	// ExcludeFields removes these fields from output
	ExcludeFields []string `json:"exclude_fields,omitempty" bson:"exclude_fields,omitempty"`
}

// APIConfig represents configuration for REST API data sources
type APIConfig struct {
	URL             string             `json:"url" bson:"url" binding:"required"`                       // Full API endpoint URL
	Method          string             `json:"method" bson:"method"`                                    // HTTP method (GET, POST, etc.)
	Headers         map[string]string  `json:"headers,omitempty" bson:"headers,omitempty"`              // Request headers
	AuthType        string             `json:"auth_type,omitempty" bson:"auth_type,omitempty"`          // none, bearer, basic, api-key
	AuthCredentials map[string]string  `json:"auth_credentials,omitempty" bson:"auth_credentials,omitempty"`
	QueryParams     map[string]string  `json:"query_params,omitempty" bson:"query_params,omitempty"`    // Query parameters
	Body            string             `json:"body,omitempty" bson:"body,omitempty"`                    // Request body template
	Timeout         int                `json:"timeout,omitempty" bson:"timeout,omitempty"`              // seconds
	RetryCount      int                `json:"retry_count,omitempty" bson:"retry_count,omitempty"`
	RetryDelay      int                `json:"retry_delay,omitempty" bson:"retry_delay,omitempty"`      // milliseconds
	ResponseConfig  *APIResponseConfig `json:"response_config,omitempty" bson:"response_config,omitempty"` // Response parsing config
}

// APIResponseConfig specifies how to parse API responses
type APIResponseConfig struct {
	// DataPath is the JSON path to the array of records (e.g., "data", "results", "items")
	// If empty, assumes response is already an array or will be parsed as key-value pairs
	DataPath string `json:"data_path,omitempty" bson:"data_path,omitempty"`
}

// TSStoreDataType represents the data type stored in a TSStore
type TSStoreDataType string

const (
	TSStoreDataTypeJSON   TSStoreDataType = "json"   // Arbitrary JSON objects
	TSStoreDataTypeSchema TSStoreDataType = "schema" // Schema-defined compact JSON
	TSStoreDataTypeText   TSStoreDataType = "text"   // UTF-8 text
)

// TSStoreProtocol represents the protocol for TSStore connections
type TSStoreProtocol string

const (
	TSStoreProtocolHTTP  TSStoreProtocol = "http"  // HTTP/WS (unencrypted)
	TSStoreProtocolHTTPS TSStoreProtocol = "https" // HTTPS/WSS (encrypted)
)

// TSStoreConfig represents configuration for TSStore (timeseries store) data sources
// TSStore stores arbitrary objects at timestamps, using a block-based storage system.
// Data does not have a predefined schema - schema is inferred from the first N records.
type TSStoreConfig struct {
	Protocol  TSStoreProtocol   `json:"protocol" bson:"protocol" binding:"required,oneof=http https"` // Protocol: "http" (HTTP/WS) or "https" (HTTPS/WSS)
	Host      string            `json:"host" bson:"host" binding:"required"`                          // Hostname or IP address
	Port      int               `json:"port" bson:"port" binding:"required"`                          // Port number
	StoreName string            `json:"store_name" bson:"store_name" binding:"required"`              // Name of the store to query
	DataType  TSStoreDataType   `json:"data_type,omitempty" bson:"data_type,omitempty"`               // Store data type: json, schema, text (default: json)
	APIKey    string            `json:"api_key,omitempty" bson:"api_key,omitempty"`                   // Optional API key for authentication
	Headers   map[string]string `json:"headers,omitempty" bson:"headers,omitempty"`                   // Additional HTTP headers
	Timeout   int               `json:"timeout,omitempty" bson:"timeout,omitempty"`                   // Request timeout in seconds (default: 30)

	// Push connection configuration for streaming (ts-store v0.2.2+)
	// When streaming is enabled, dashboard calls ts-store API to create a push connection
	// and ts-store dials out to dashboard's inbound WebSocket endpoint
	Push *TSStorePushConfig `json:"push,omitempty" bson:"push,omitempty"`
}

// TSStorePushConfig configures the outbound WebSocket push from ts-store to dashboard
// See ts-store docs: /docs/outbound-data-ws.md
type TSStorePushConfig struct {
	// From is the starting timestamp in nanoseconds (0 = oldest data, -1 = current time/realtime only)
	From int64 `json:"from" bson:"from"`

	// Format specifies the message format: "full" (default) or "compact" (for schema stores)
	Format string `json:"format,omitempty" bson:"format,omitempty"`

	// Filter is an optional substring filter - only send matching records
	Filter string `json:"filter,omitempty" bson:"filter,omitempty"`

	// FilterIgnoreCase enables case-insensitive filter matching
	FilterIgnoreCase bool `json:"filter_ignore_case,omitempty" bson:"filter_ignore_case,omitempty"`

	// AggWindow is the aggregation window duration (e.g., "1m", "5m", "1h")
	// When set, records are aggregated over this time window before sending
	AggWindow string `json:"agg_window,omitempty" bson:"agg_window,omitempty"`

	// AggFields specifies per-field aggregation functions (e.g., "temp:avg,count:sum")
	AggFields string `json:"agg_fields,omitempty" bson:"agg_fields,omitempty"`

	// AggDefault is the default aggregation function for fields not in AggFields
	// Options: avg, sum, min, max, first, last, count
	AggDefault string `json:"agg_default,omitempty" bson:"agg_default,omitempty"`

	// ConnectionID stores the active push connection ID returned by ts-store
	// This is set when the push connection is created and used to manage/delete it
	ConnectionID string `json:"connection_id,omitempty" bson:"connection_id,omitempty"`
}

// BaseURL returns the HTTP base URL built from protocol, host, and port
func (c *TSStoreConfig) BaseURL() string {
	protocol := string(c.Protocol)
	if protocol == "" {
		protocol = "http"
	}
	return fmt.Sprintf("%s://%s:%d", protocol, c.Host, c.Port)
}

// WebSocketURL returns the WebSocket base URL built from protocol, host, and port
func (c *TSStoreConfig) WebSocketURL() string {
	wsProtocol := "ws"
	if c.Protocol == TSStoreProtocolHTTPS {
		wsProtocol = "wss"
	}
	return fmt.Sprintf("%s://%s:%d", wsProtocol, c.Host, c.Port)
}

// PrometheusConfig represents configuration for Prometheus data sources
type PrometheusConfig struct {
	URL      string `json:"url" bson:"url" binding:"required"`           // Prometheus server URL (e.g., "http://localhost:9090")
	Username string `json:"username,omitempty" bson:"username,omitempty"` // Basic auth username (optional)
	Password string `json:"password,omitempty" bson:"password,omitempty"` // Basic auth password (optional)
	Timeout  int    `json:"timeout,omitempty" bson:"timeout,omitempty"`   // Query timeout in seconds (default: 30)
}

// EdgeLakeConfig represents configuration for EdgeLake data sources
type EdgeLakeConfig struct {
	Host                string `json:"host" bson:"host" binding:"required"`                                   // EdgeLake node IP/hostname
	Port                int    `json:"port" bson:"port" binding:"required"`                                   // REST API port (default: 32049)
	Timeout             int    `json:"timeout,omitempty" bson:"timeout,omitempty"`                             // Request timeout in seconds (default: 20)
	UseDistributedQuery bool   `json:"use_distributed_query" bson:"use_distributed_query"`                     // Add "destination: network" header
}

// EdgeLakeSchemaInfo represents EdgeLake schema information
type EdgeLakeSchemaInfo struct {
	Databases []string              `json:"databases"`           // Available databases
	Tables    []EdgeLakeTableInfo   `json:"tables,omitempty"`    // Tables (populated when database is selected)
}

// EdgeLakeTableInfo represents information about an EdgeLake table
type EdgeLakeTableInfo struct {
	Database string                `json:"database"`
	Name     string                `json:"name"`
	Columns  []EdgeLakeColumnInfo  `json:"columns,omitempty"`
}

// EdgeLakeColumnInfo represents a column in an EdgeLake table
type EdgeLakeColumnInfo struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
}

// PrometheusQueryType represents the type of Prometheus query
type PrometheusQueryType string

const (
	PrometheusQueryTypeInstant PrometheusQueryType = "instant" // Single point in time
	PrometheusQueryTypeRange   PrometheusQueryType = "range"   // Time series over a range
)

// PrometheusQueryParams holds parameters for Prometheus queries
type PrometheusQueryParams struct {
	QueryType PrometheusQueryType `json:"query_type"` // "instant" or "range"
	Start     string              `json:"start"`      // Start time: RFC3339, unix timestamp, or relative ("now-1h")
	End       string              `json:"end"`        // End time: RFC3339, unix timestamp, or relative ("now")
	Step      string              `json:"step"`       // Query resolution step: "15s", "1m", "5m"
}

// HealthInfo represents health check information
type HealthInfo struct {
	Status       HealthStatus `json:"status" bson:"status"`
	LastCheck    time.Time    `json:"last_check,omitempty" bson:"last_check,omitempty"`
	LastSuccess  time.Time    `json:"last_success,omitempty" bson:"last_success,omitempty"`
	ErrorMessage string       `json:"error_message,omitempty" bson:"error_message,omitempty"`
	ResponseTime int64        `json:"response_time,omitempty" bson:"response_time,omitempty"` // milliseconds
}

// CreateDatasourceRequest represents request to create a data source
type CreateDatasourceRequest struct {
	Name        string           `json:"name" binding:"required"`
	Description string           `json:"description"`
	Type        DatasourceType   `json:"type" binding:"required,oneof=sql csv socket api tsstore prometheus edgelake"`
	Config      DatasourceConfig `json:"config" binding:"required"`
	Tags        []string         `json:"tags,omitempty"`
	MaskSecrets *bool            `json:"mask_secrets,omitempty"` // If true, secrets are masked in API responses (default: true)
}

// UpdateDatasourceRequest represents request to update a data source
type UpdateDatasourceRequest struct {
	Name        string           `json:"name,omitempty"`
	Description string           `json:"description,omitempty"`
	Config      DatasourceConfig `json:"config,omitempty"`
	Tags        []string         `json:"tags,omitempty"`
	MaskSecrets *bool            `json:"mask_secrets,omitempty"` // If provided, updates secret masking setting
}

// TestDatasourceRequest represents request to test a data source connection
type TestDatasourceRequest struct {
	Type   DatasourceType   `json:"type" binding:"required,oneof=sql csv socket api tsstore prometheus edgelake"`
	Config DatasourceConfig `json:"config" binding:"required"`
}

// TestDatasourceResponse represents response from testing a data source
type TestDatasourceResponse struct {
	Success      bool         `json:"success"`
	Status       HealthStatus `json:"status"`
	Message      string       `json:"message,omitempty"`
	ResponseTime int64        `json:"response_time,omitempty"` // milliseconds
	Data         interface{}  `json:"data,omitempty"`
}

// QueryRequest represents a request to query a datasource
type QueryRequest struct {
	Query Query `json:"query" binding:"required"`
}

// QueryResponse represents a response from querying a datasource
type QueryResponse struct {
	Success   bool       `json:"success"`
	ResultSet *ResultSet `json:"result_set,omitempty"`
	Error     string     `json:"error,omitempty"`
	Duration  int64      `json:"duration"` // milliseconds
}

// SchemaProvider is an optional interface for datasources that support schema discovery
// SQL databases implement this; CSV/API/Socket do not
type SchemaProvider interface {
	GetSchema(ctx context.Context) (*SchemaInfo, error)
}

// SchemaInfo represents database schema information
type SchemaInfo struct {
	Database string      `json:"database"`          // Current database name
	Tables   []TableInfo `json:"tables"`            // Tables in the database
}

// TableInfo represents a database table
type TableInfo struct {
	Name    string       `json:"name"`              // Table name
	Schema  string       `json:"schema,omitempty"`  // Schema/namespace (e.g., "public" for PostgreSQL)
	Columns []ColumnInfo `json:"columns"`           // Columns in the table
}

// ColumnInfo represents a database column
type ColumnInfo struct {
	Name       string `json:"name"`                  // Column name
	Type       string `json:"type"`                  // Data type (e.g., "varchar", "integer")
	Nullable   bool   `json:"nullable"`              // Whether column allows NULL
	PrimaryKey bool   `json:"primary_key,omitempty"` // Whether column is part of primary key
	Default    string `json:"default,omitempty"`     // Default value if any
}

// SchemaResponse represents the API response for schema discovery
type SchemaResponse struct {
	Success          bool                    `json:"success"`
	Schema           *SchemaInfo             `json:"schema,omitempty"`              // For SQL datasources
	PrometheusSchema *PrometheusSchemaInfo   `json:"prometheus_schema,omitempty"`   // For Prometheus datasources
	Error            string                  `json:"error,omitempty"`
	Duration         int64                   `json:"duration"` // milliseconds
}

// PrometheusSchemaInfo represents Prometheus schema information
type PrometheusSchemaInfo struct {
	Metrics []PrometheusMetricInfo `json:"metrics"` // Available metrics
	Labels  []string               `json:"labels"`  // All label names
}

// PrometheusMetricInfo represents information about a Prometheus metric
type PrometheusMetricInfo struct {
	Name   string   `json:"name"`             // Metric name (e.g., "http_requests_total")
	Type   string   `json:"type,omitempty"`   // Metric type: "counter", "gauge", "histogram", "summary"
	Help   string   `json:"help,omitempty"`   // Description from metadata
	Labels []string `json:"labels,omitempty"` // Labels seen with this metric
}

// PrometheusSchemaProvider is an interface for Prometheus schema discovery
type PrometheusSchemaProvider interface {
	GetMetrics(ctx context.Context) ([]string, error)
	GetLabels(ctx context.Context) ([]string, error)
	GetLabelValues(ctx context.Context, labelName string) ([]string, error)
}

// UnifiedSchemaResponse is the response format for the get_schema tool
// It provides a consistent schema format for all datasource types
type UnifiedSchemaResponse struct {
	Datasource UnifiedSchemaSourceInfo `json:"datasource"`
	Schema     UnifiedSchema           `json:"schema"`
}

// UnifiedSchemaSourceInfo contains basic info about the datasource
type UnifiedSchemaSourceInfo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Type string `json:"type"`
}

// UnifiedSchema represents schema information in a unified format
type UnifiedSchema struct {
	// For datasources without tables (API, CSV, Socket, TSStore)
	Columns []UnifiedSchemaColumn `json:"columns,omitempty"`

	// For datasources with tables (SQL, EdgeLake)
	Tables []UnifiedSchemaTable `json:"tables,omitempty"`

	// For Prometheus - metrics and labels
	Metrics []string `json:"metrics,omitempty"`
	Labels  []string `json:"labels,omitempty"`

	// Row count (when available from sample data)
	RowCount int `json:"row_count,omitempty"`
}

// UnifiedSchemaTable represents a table with its columns
type UnifiedSchemaTable struct {
	Name    string                `json:"name"`
	Columns []UnifiedSchemaColumn `json:"columns"`
}

// UnifiedSchemaColumn represents a column with inferred type and metadata
type UnifiedSchemaColumn struct {
	Name string `json:"name"`
	Type string `json:"type"` // timestamp, integer, float, string, boolean, mixed

	// For string columns with limited unique values (≤20)
	UniqueValues []interface{} `json:"unique_values,omitempty"`
	UniqueCount  int           `json:"unique_count,omitempty"`

	// For numeric columns
	Min interface{} `json:"min,omitempty"`
	Max interface{} `json:"max,omitempty"`

	// Sample value (first non-null value seen)
	Sample interface{} `json:"sample,omitempty"`
}

// SanitizeForAPI returns a copy of the datasource with sensitive fields masked.
// This should be called before returning datasource data via API responses.
// Sensitive fields are replaced with SecretMaskedValue ("********") if they have a value.
func (d *Datasource) SanitizeForAPI() *Datasource {
	if !d.MaskSecrets {
		return d
	}

	// Create a deep copy to avoid modifying the original
	sanitized := *d

	// Sanitize SQL config
	if d.Config.SQL != nil {
		sqlCopy := *d.Config.SQL
		if sqlCopy.Password != "" {
			sqlCopy.Password = SecretMaskedValue
		}
		sanitized.Config.SQL = &sqlCopy
	}

	// Sanitize API config
	if d.Config.API != nil {
		apiCopy := *d.Config.API
		if len(apiCopy.AuthCredentials) > 0 {
			maskedCreds := make(map[string]string)
			for k := range apiCopy.AuthCredentials {
				maskedCreds[k] = SecretMaskedValue
			}
			apiCopy.AuthCredentials = maskedCreds
		}
		// Also mask Authorization header if present
		if len(apiCopy.Headers) > 0 {
			headersCopy := make(map[string]string)
			for k, v := range apiCopy.Headers {
				if k == "Authorization" || k == "authorization" || k == "X-API-Key" || k == "x-api-key" {
					headersCopy[k] = SecretMaskedValue
				} else {
					headersCopy[k] = v
				}
			}
			apiCopy.Headers = headersCopy
		}
		sanitized.Config.API = &apiCopy
	}

	// Sanitize TSStore config
	if d.Config.TSStore != nil {
		tsCopy := *d.Config.TSStore
		if tsCopy.APIKey != "" {
			tsCopy.APIKey = SecretMaskedValue
		}
		sanitized.Config.TSStore = &tsCopy
	}

	// Sanitize Socket config (headers may contain auth tokens)
	if d.Config.Socket != nil {
		socketCopy := *d.Config.Socket
		if len(socketCopy.Headers) > 0 {
			headersCopy := make(map[string]string)
			for k, v := range socketCopy.Headers {
				if k == "Authorization" || k == "authorization" || k == "X-API-Key" || k == "x-api-key" {
					headersCopy[k] = SecretMaskedValue
				} else {
					headersCopy[k] = v
				}
			}
			socketCopy.Headers = headersCopy
		}
		sanitized.Config.Socket = &socketCopy
	}

	return &sanitized
}

// HasSecret checks if a field currently has a secret value set (not empty).
// Used by frontend to show "********" vs empty field.
func (d *Datasource) HasSecret(fieldPath string) bool {
	switch fieldPath {
	case "sql.password":
		return d.Config.SQL != nil && d.Config.SQL.Password != ""
	case "api.auth_credentials":
		return d.Config.API != nil && len(d.Config.API.AuthCredentials) > 0
	case "tsstore.api_key":
		return d.Config.TSStore != nil && d.Config.TSStore.APIKey != ""
	default:
		return false
	}
}
