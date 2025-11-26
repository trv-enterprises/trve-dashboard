package datasource

import (
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/tviviano/dashboard/internal/models"
)

// CSVDataSource implements the DataSource interface for CSV files
type CSVDataSource struct {
	config  *models.CSVConfig
	columns []string
}

// NewCSVDataSource creates a new CSV datasource
func NewCSVDataSource(config *models.CSVConfig) (*CSVDataSource, error) {
	// Verify file exists and is readable
	file, err := os.Open(config.Path)
	if err != nil {
		return nil, fmt.Errorf("failed to open CSV file: %w", err)
	}
	defer file.Close()

	ds := &CSVDataSource{
		config: config,
	}

	// Read header if present
	if config.HasHeader {
		reader := csv.NewReader(file)
		if config.Delimiter != "" {
			reader.Comma = rune(config.Delimiter[0])
		}

		header, err := reader.Read()
		if err != nil {
			return nil, fmt.Errorf("failed to read CSV header: %w", err)
		}
		ds.columns = header
	} else if len(config.Columns) > 0 {
		// Use explicitly provided column names
		ds.columns = config.Columns
	}

	return ds, nil
}

// Query executes a filter query on CSV data and returns normalized results
func (c *CSVDataSource) Query(ctx context.Context, query models.Query) (*models.ResultSet, error) {
	file, err := os.Open(c.config.Path)
	if err != nil {
		return nil, fmt.Errorf("failed to open CSV file: %w", err)
	}
	defer file.Close()

	reader := csv.NewReader(file)
	if c.config.Delimiter != "" {
		reader.Comma = rune(c.config.Delimiter[0])
	}

	// Skip header if present
	if c.config.HasHeader {
		if _, err := reader.Read(); err != nil {
			return nil, fmt.Errorf("failed to read header: %w", err)
		}
	}

	resultSet := &models.ResultSet{
		Columns:  c.columns,
		Rows:     make([][]interface{}, 0),
		Metadata: make(map[string]interface{}),
	}

	// Read all records (filtering logic can be added based on query.Raw)
	rowCount := 0
	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("error reading CSV row: %w", err)
		}

		// Apply simple filter if query.Raw is provided
		if query.Raw != "" && !c.matchesFilter(record, query.Raw) {
			continue
		}

		// Convert string slice to interface{} slice
		row := make([]interface{}, len(record))
		for i, v := range record {
			row[i] = v
		}

		resultSet.Rows = append(resultSet.Rows, row)
		rowCount++

		// Check context cancellation
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}
	}

	resultSet.Metadata["row_count"] = rowCount
	resultSet.Metadata["column_count"] = len(c.columns)
	resultSet.Metadata["file_path"] = c.config.Path

	return resultSet, nil
}

// Stream reads CSV data and streams records as they're read
func (c *CSVDataSource) Stream(ctx context.Context, query models.Query) (<-chan models.Record, error) {
	file, err := os.Open(c.config.Path)
	if err != nil {
		return nil, fmt.Errorf("failed to open CSV file: %w", err)
	}

	reader := csv.NewReader(file)
	if c.config.Delimiter != "" {
		reader.Comma = rune(c.config.Delimiter[0])
	}

	// Skip header if present
	if c.config.HasHeader {
		if _, err := reader.Read(); err != nil {
			file.Close()
			return nil, fmt.Errorf("failed to read header: %w", err)
		}
	}

	recordChan := make(chan models.Record, 100) // Buffer for performance

	go func() {
		defer close(recordChan)
		defer file.Close()

		for {
			csvRecord, err := reader.Read()
			if err == io.EOF {
				break
			}
			if err != nil {
				// Log error but continue
				continue
			}

			// Apply simple filter if query.Raw is provided
			if query.Raw != "" && !c.matchesFilter(csvRecord, query.Raw) {
				continue
			}

			// Build record map
			record := make(models.Record)
			for i, value := range csvRecord {
				var columnName string
				if i < len(c.columns) {
					columnName = c.columns[i]
				} else {
					columnName = fmt.Sprintf("column_%d", i)
				}
				record[columnName] = value
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

// matchesFilter is a simple string-based filter
// For production, you'd want a more sophisticated query language
func (c *CSVDataSource) matchesFilter(record []string, filter string) bool {
	// Simple contains-based filtering
	// Format: "column:value" or just "value" to match any column
	if strings.Contains(filter, ":") {
		parts := strings.SplitN(filter, ":", 2)
		columnName := strings.TrimSpace(parts[0])
		searchValue := strings.TrimSpace(parts[1])

		// Find column index
		colIndex := -1
		for i, col := range c.columns {
			if col == columnName {
				colIndex = i
				break
			}
		}

		if colIndex >= 0 && colIndex < len(record) {
			return strings.Contains(strings.ToLower(record[colIndex]), strings.ToLower(searchValue))
		}
		return false
	}

	// Search all columns
	searchValue := strings.ToLower(filter)
	for _, value := range record {
		if strings.Contains(strings.ToLower(value), searchValue) {
			return true
		}
	}
	return false
}

// Close closes any open resources
func (c *CSVDataSource) Close() error {
	// CSV datasource doesn't maintain persistent connections
	return nil
}
