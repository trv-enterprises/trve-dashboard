package models

import (
	"context"
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
)

// DatasourceType represents the type of data source
type DatasourceType string

const (
	DatasourceTypeSQL    DatasourceType = "sql"
	DatasourceTypeCSV    DatasourceType = "csv"
	DatasourceTypeSocket DatasourceType = "socket"
	DatasourceTypeAPI    DatasourceType = "api"
)

// HealthStatus represents the health status of a data source
type HealthStatus string

const (
	HealthStatusUnknown   HealthStatus = "unknown"
	HealthStatusHealthy   HealthStatus = "healthy"
	HealthStatusUnhealthy HealthStatus = "unhealthy"
	HealthStatusDegraded  HealthStatus = "degraded"
)

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
	Type        DatasourceType     `json:"type" bson:"type" binding:"required,oneof=sql csv socket api"`
	Config      DatasourceConfig   `json:"config" bson:"config" binding:"required"`
	Health      HealthInfo         `json:"health" bson:"health"`
	Tags        []string           `json:"tags,omitempty" bson:"tags,omitempty"`
	CreatedAt   time.Time          `json:"created_at" bson:"created_at"`
	UpdatedAt   time.Time          `json:"updated_at" bson:"updated_at"`
}

// DatasourceConfig holds type-specific configuration
type DatasourceConfig struct {
	SQL    *SQLConfig    `json:"sql,omitempty" bson:"sql,omitempty"`
	CSV    *CSVConfig    `json:"csv,omitempty" bson:"csv,omitempty"`
	Socket *SocketConfig `json:"socket,omitempty" bson:"socket,omitempty"`
	API    *APIConfig    `json:"api,omitempty" bson:"api,omitempty"`
}

// SQLConfig represents configuration for SQL databases
type SQLConfig struct {
	Driver          string            `json:"driver" bson:"driver" binding:"required,oneof=postgres mysql sqlite mssql oracle"`
	ConnectionString string           `json:"connection_string" bson:"connection_string" binding:"required"`
	Host            string            `json:"host,omitempty" bson:"host,omitempty"`
	Port            int               `json:"port,omitempty" bson:"port,omitempty"`
	Database        string            `json:"database,omitempty" bson:"database,omitempty"`
	Username        string            `json:"username,omitempty" bson:"username,omitempty"`
	Password        string            `json:"password,omitempty" bson:"password,omitempty"`
	SSL             bool              `json:"ssl,omitempty" bson:"ssl,omitempty"`
	MaxConnections  int               `json:"max_connections,omitempty" bson:"max_connections,omitempty"`
	Timeout         int               `json:"timeout,omitempty" bson:"timeout,omitempty"` // seconds
	Options         map[string]string `json:"options,omitempty" bson:"options,omitempty"`
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
	URL              string            `json:"url" bson:"url" binding:"required"`
	Protocol         string            `json:"protocol" bson:"protocol" binding:"required,oneof=tcp udp websocket"`
	Headers          map[string]string `json:"headers,omitempty" bson:"headers,omitempty"`
	ReconnectOnError bool              `json:"reconnect_on_error" bson:"reconnect_on_error"`
	ReconnectDelay   int               `json:"reconnect_delay,omitempty" bson:"reconnect_delay,omitempty"` // milliseconds
	PingInterval     int               `json:"ping_interval,omitempty" bson:"ping_interval,omitempty"`     // seconds
	MessageFormat    string            `json:"message_format,omitempty" bson:"message_format,omitempty"`   // json, text, binary
	BufferSize       int               `json:"buffer_size,omitempty" bson:"buffer_size,omitempty"`         // number of messages to buffer
}

// APIConfig represents configuration for REST API data sources
type APIConfig struct {
	URL             string             `json:"url" bson:"url" binding:"required,url"`
	Method          string             `json:"method" bson:"method" binding:"required,oneof=GET POST PUT DELETE PATCH"`
	Headers         map[string]string  `json:"headers,omitempty" bson:"headers,omitempty"`
	QueryParams     map[string]string  `json:"query_params,omitempty" bson:"query_params,omitempty"`
	Body            string             `json:"body,omitempty" bson:"body,omitempty"`
	AuthType        string             `json:"auth_type,omitempty" bson:"auth_type,omitempty"` // none, bearer, basic, api-key
	AuthCredentials map[string]string  `json:"auth_credentials,omitempty" bson:"auth_credentials,omitempty"`
	Timeout         int                `json:"timeout,omitempty" bson:"timeout,omitempty"` // seconds
	RetryCount      int                `json:"retry_count,omitempty" bson:"retry_count,omitempty"`
	RetryDelay      int                `json:"retry_delay,omitempty" bson:"retry_delay,omitempty"` // milliseconds
	ResponseConfig  *APIResponseConfig `json:"response_config,omitempty" bson:"response_config,omitempty"`
}

// APIResponseConfig specifies how to parse API responses
type APIResponseConfig struct {
	// DataPath is the JSON path to the array of records (e.g., "data", "results", "items")
	// If empty, assumes response is already an array or will be parsed as key-value pairs
	DataPath string `json:"data_path,omitempty" bson:"data_path,omitempty"`
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
	Type        DatasourceType   `json:"type" binding:"required,oneof=sql csv socket api"`
	Config      DatasourceConfig `json:"config" binding:"required"`
	Tags        []string         `json:"tags,omitempty"`
}

// UpdateDatasourceRequest represents request to update a data source
type UpdateDatasourceRequest struct {
	Name        string           `json:"name,omitempty"`
	Description string           `json:"description,omitempty"`
	Config      DatasourceConfig `json:"config,omitempty"`
	Tags        []string         `json:"tags,omitempty"`
}

// TestDatasourceRequest represents request to test a data source connection
type TestDatasourceRequest struct {
	Type   DatasourceType   `json:"type" binding:"required,oneof=sql csv socket api"`
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
