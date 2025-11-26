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

// NewSQLDataSource creates a new SQL datasource
func NewSQLDataSource(config *models.SQLConfig) (*SQLDataSource, error) {
	db, err := sql.Open(config.Driver, config.ConnectionString)
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
