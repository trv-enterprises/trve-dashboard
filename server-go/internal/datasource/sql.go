// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

package datasource

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/tviviano/dashboard/internal/models"

	_ "github.com/go-sql-driver/mysql"
	_ "github.com/lib/pq"
	_ "github.com/mattn/go-sqlite3"
)

// SQLDataSource implements the DataSource interface for SQL databases
type SQLDataSource struct {
	db     *sql.DB
	config *models.SQLConfig
}

// mapDriverName converts user-facing driver names to Go driver names
func mapDriverName(driver string) string {
	driverMap := map[string]string{
		"sqlite": "sqlite3", // User-facing "sqlite" -> Go driver "sqlite3"
	}
	if mapped, ok := driverMap[driver]; ok {
		return mapped
	}
	return driver
}

// buildConnectionString constructs a connection string from individual config fields
func buildConnectionString(config *models.SQLConfig) string {
	switch config.Driver {
	case "postgres":
		// PostgreSQL format: host=localhost port=5432 user=postgres password=secret dbname=mydb sslmode=disable
		connStr := fmt.Sprintf("host=%s port=%d user=%s dbname=%s",
			config.Host, config.Port, config.Username, config.Database)
		if config.Password != "" {
			connStr += fmt.Sprintf(" password=%s", config.Password)
		}
		if config.SSL {
			connStr += " sslmode=require"
		} else {
			connStr += " sslmode=disable"
		}
		if config.Timeout > 0 {
			connStr += fmt.Sprintf(" connect_timeout=%d", config.Timeout)
		}
		if config.Options != "" {
			// Options should be space-separated key=value pairs for postgres
			connStr += " " + config.Options
		}
		return connStr

	case "mysql":
		// MySQL format: user:password@tcp(host:port)/dbname?params
		connStr := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s",
			config.Username, config.Password, config.Host, config.Port, config.Database)
		params := []string{}
		if config.SSL {
			params = append(params, "tls=true")
		}
		if config.Timeout > 0 {
			params = append(params, fmt.Sprintf("timeout=%ds", config.Timeout))
		}
		if config.Options != "" {
			params = append(params, config.Options)
		}
		if len(params) > 0 {
			connStr += "?" + joinParams(params, "&")
		}
		return connStr

	case "sqlite":
		// SQLite format: file path or :memory:
		connStr := config.Database
		if config.Options != "" {
			connStr += "?" + config.Options
		}
		return connStr

	case "mssql":
		// MSSQL format: sqlserver://user:password@host:port?database=dbname
		connStr := fmt.Sprintf("sqlserver://%s:%s@%s:%d?database=%s",
			config.Username, config.Password, config.Host, config.Port, config.Database)
		if config.SSL {
			connStr += "&encrypt=true"
		}
		if config.Timeout > 0 {
			connStr += fmt.Sprintf("&connection+timeout=%d", config.Timeout)
		}
		if config.Options != "" {
			connStr += "&" + config.Options
		}
		return connStr

	case "oracle":
		// Oracle format: user/password@host:port/database
		connStr := fmt.Sprintf("%s/%s@%s:%d/%s",
			config.Username, config.Password, config.Host, config.Port, config.Database)
		return connStr

	default:
		// Fallback - try postgres-style
		return fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s",
			config.Host, config.Port, config.Username, config.Password, config.Database)
	}
}

// joinParams joins parameters with a separator
func joinParams(params []string, sep string) string {
	result := ""
	for i, p := range params {
		if i > 0 {
			result += sep
		}
		result += p
	}
	return result
}

// NewSQLDataSource creates a new SQL datasource
func NewSQLDataSource(config *models.SQLConfig) (*SQLDataSource, error) {
	driverName := mapDriverName(config.Driver)
	connectionString := buildConnectionString(config)
	db, err := sql.Open(driverName, connectionString)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Configure connection pool
	if config.MaxConnections > 0 {
		db.SetMaxOpenConns(config.MaxConnections)
		db.SetMaxIdleConns(config.MaxConnections / 2)
	}

	// Test connection
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return &SQLDataSource{
		db:     db,
		config: config,
	}, nil
}

// Query executes a SQL query and returns normalized results
func (s *SQLDataSource) Query(ctx context.Context, query models.Query) (*models.ResultSet, error) {
	// Build parameter slice from map
	var args []interface{}
	if query.Params != nil {
		for _, v := range query.Params {
			args = append(args, v)
		}
	}

	rows, err := s.db.QueryContext(ctx, query.Raw, args...)
	if err != nil {
		return nil, fmt.Errorf("query execution failed: %w", err)
	}
	defer rows.Close()

	// Get column names
	columns, err := rows.Columns()
	if err != nil {
		return nil, fmt.Errorf("failed to get columns: %w", err)
	}

	// Prepare result set
	resultSet := &models.ResultSet{
		Columns:  columns,
		Rows:     make([][]interface{}, 0),
		Metadata: make(map[string]interface{}),
	}

	// Scan rows
	for rows.Next() {
		// Create slice of interface{} to hold each column value
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}

		// Convert byte slices to strings
		for i, v := range values {
			if b, ok := v.([]byte); ok {
				values[i] = string(b)
			}
		}

		resultSet.Rows = append(resultSet.Rows, values)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("row iteration error: %w", err)
	}

	resultSet.Metadata["row_count"] = len(resultSet.Rows)
	resultSet.Metadata["column_count"] = len(columns)

	return resultSet, nil
}

// Stream executes a SQL query and streams results
func (s *SQLDataSource) Stream(ctx context.Context, query models.Query) (<-chan models.Record, error) {
	// Build parameter slice from map
	var args []interface{}
	if query.Params != nil {
		for _, v := range query.Params {
			args = append(args, v)
		}
	}

	rows, err := s.db.QueryContext(ctx, query.Raw, args...)
	if err != nil {
		return nil, fmt.Errorf("query execution failed: %w", err)
	}

	// Get column names
	columns, err := rows.Columns()
	if err != nil {
		rows.Close()
		return nil, fmt.Errorf("failed to get columns: %w", err)
	}

	recordChan := make(chan models.Record, 100) // Buffer for performance

	go func() {
		defer close(recordChan)
		defer rows.Close()

		for rows.Next() {
			// Create slice of interface{} to hold each column value
			values := make([]interface{}, len(columns))
			valuePtrs := make([]interface{}, len(columns))
			for i := range values {
				valuePtrs[i] = &values[i]
			}

			if err := rows.Scan(valuePtrs...); err != nil {
				// Log error but continue streaming
				continue
			}

			// Build record map
			record := make(models.Record)
			for i, col := range columns {
				val := values[i]
				// Convert byte slices to strings
				if b, ok := val.([]byte); ok {
					val = string(b)
				}
				record[col] = val
			}

			select {
			case recordChan <- record:
			case <-ctx.Done():
				return
			}
		}
	}()

	return recordChan, nil
}

// Close closes the database connection
func (s *SQLDataSource) Close() error {
	if s.db != nil {
		return s.db.Close()
	}
	return nil
}

// GetSchema implements SchemaProvider interface for SQL databases
// Returns database schema including tables and columns with dialect-specific queries
func (s *SQLDataSource) GetSchema(ctx context.Context) (*models.SchemaInfo, error) {
	schema := &models.SchemaInfo{
		Database: s.config.Database,
		Tables:   make([]models.TableInfo, 0),
	}

	// Get tables based on driver
	tables, err := s.getTables(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get tables: %w", err)
	}

	// Get columns for each table
	for _, table := range tables {
		columns, err := s.getColumns(ctx, table.Name, table.Schema)
		if err != nil {
			// Log error but continue with other tables
			continue
		}
		table.Columns = columns
		schema.Tables = append(schema.Tables, table)
	}

	return schema, nil
}

// getTables returns all tables in the database based on driver dialect
func (s *SQLDataSource) getTables(ctx context.Context) ([]models.TableInfo, error) {
	var query string
	var tables []models.TableInfo

	switch s.config.Driver {
	case "postgres":
		query = `
			SELECT table_name, table_schema
			FROM information_schema.tables
			WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
			AND table_type = 'BASE TABLE'
			ORDER BY table_schema, table_name`
	case "mysql":
		query = `
			SELECT table_name, table_schema
			FROM information_schema.tables
			WHERE table_schema = DATABASE()
			AND table_type = 'BASE TABLE'
			ORDER BY table_name`
	case "sqlite":
		query = `
			SELECT name as table_name, '' as table_schema
			FROM sqlite_master
			WHERE type = 'table'
			AND name NOT LIKE 'sqlite_%'
			ORDER BY name`
	case "mssql":
		query = `
			SELECT TABLE_NAME as table_name, TABLE_SCHEMA as table_schema
			FROM INFORMATION_SCHEMA.TABLES
			WHERE TABLE_TYPE = 'BASE TABLE'
			ORDER BY TABLE_SCHEMA, TABLE_NAME`
	default:
		return nil, fmt.Errorf("unsupported driver for schema discovery: %s", s.config.Driver)
	}

	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query tables: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var tableName, schemaName string
		if err := rows.Scan(&tableName, &schemaName); err != nil {
			return nil, fmt.Errorf("failed to scan table row: %w", err)
		}
		tables = append(tables, models.TableInfo{
			Name:    tableName,
			Schema:  schemaName,
			Columns: make([]models.ColumnInfo, 0),
		})
	}

	return tables, rows.Err()
}

// getColumns returns column information for a specific table
func (s *SQLDataSource) getColumns(ctx context.Context, tableName, schemaName string) ([]models.ColumnInfo, error) {
	var query string
	var args []interface{}
	var columns []models.ColumnInfo

	switch s.config.Driver {
	case "postgres":
		query = `
			SELECT
				c.column_name,
				c.data_type,
				CASE WHEN c.is_nullable = 'YES' THEN true ELSE false END as nullable,
				CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_pk,
				COALESCE(c.column_default, '') as col_default
			FROM information_schema.columns c
			LEFT JOIN (
				SELECT ku.column_name
				FROM information_schema.table_constraints tc
				JOIN information_schema.key_column_usage ku
					ON tc.constraint_name = ku.constraint_name
				WHERE tc.constraint_type = 'PRIMARY KEY'
				AND ku.table_name = $1
				AND ku.table_schema = $2
			) pk ON c.column_name = pk.column_name
			WHERE c.table_name = $1
			AND c.table_schema = $2
			ORDER BY c.ordinal_position`
		args = []interface{}{tableName, schemaName}

	case "mysql":
		query = `
			SELECT
				COLUMN_NAME,
				DATA_TYPE,
				CASE WHEN IS_NULLABLE = 'YES' THEN true ELSE false END as nullable,
				CASE WHEN COLUMN_KEY = 'PRI' THEN true ELSE false END as is_pk,
				COALESCE(COLUMN_DEFAULT, '') as col_default
			FROM information_schema.columns
			WHERE table_name = ?
			AND table_schema = DATABASE()
			ORDER BY ORDINAL_POSITION`
		args = []interface{}{tableName}

	case "sqlite":
		// SQLite uses PRAGMA for column info
		query = fmt.Sprintf("PRAGMA table_info('%s')", tableName)
		rows, err := s.db.QueryContext(ctx, query)
		if err != nil {
			return nil, fmt.Errorf("failed to get column info: %w", err)
		}
		defer rows.Close()

		for rows.Next() {
			var cid int
			var name, colType string
			var notNull, pk int
			var dfltValue interface{}
			if err := rows.Scan(&cid, &name, &colType, &notNull, &dfltValue, &pk); err != nil {
				return nil, fmt.Errorf("failed to scan column: %w", err)
			}
			defaultStr := ""
			if dfltValue != nil {
				defaultStr = fmt.Sprintf("%v", dfltValue)
			}
			columns = append(columns, models.ColumnInfo{
				Name:       name,
				Type:       colType,
				Nullable:   notNull == 0,
				PrimaryKey: pk == 1,
				Default:    defaultStr,
			})
		}
		return columns, rows.Err()

	case "mssql":
		query = `
			SELECT
				c.COLUMN_NAME,
				c.DATA_TYPE,
				CASE WHEN c.IS_NULLABLE = 'YES' THEN 1 ELSE 0 END as nullable,
				CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as is_pk,
				COALESCE(c.COLUMN_DEFAULT, '') as col_default
			FROM INFORMATION_SCHEMA.COLUMNS c
			LEFT JOIN (
				SELECT ku.COLUMN_NAME
				FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
				JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
					ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
				WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
				AND ku.TABLE_NAME = @p1
				AND ku.TABLE_SCHEMA = @p2
			) pk ON c.COLUMN_NAME = pk.COLUMN_NAME
			WHERE c.TABLE_NAME = @p1
			AND c.TABLE_SCHEMA = @p2
			ORDER BY c.ORDINAL_POSITION`
		args = []interface{}{tableName, schemaName}

	default:
		return nil, fmt.Errorf("unsupported driver for column discovery: %s", s.config.Driver)
	}

	// Execute query for non-SQLite databases
	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query columns: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var name, colType, defaultVal string
		var nullable, isPK bool
		if err := rows.Scan(&name, &colType, &nullable, &isPK, &defaultVal); err != nil {
			return nil, fmt.Errorf("failed to scan column row: %w", err)
		}
		columns = append(columns, models.ColumnInfo{
			Name:       name,
			Type:       colType,
			Nullable:   nullable,
			PrimaryKey: isPK,
			Default:    defaultVal,
		})
	}

	return columns, rows.Err()
}
