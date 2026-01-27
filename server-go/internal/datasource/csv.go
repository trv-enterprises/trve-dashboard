// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

package datasource

import (
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/tviviano/dashboard/internal/models"
)

// CSVDataSource implements the DataSource interface for CSV files
type CSVDataSource struct {
	config  *models.CSVConfig
	columns []string
}

// NewCSVDataSource creates a new CSV datasource
func NewCSVDataSource(config *models.CSVConfig) (*CSVDataSource, error) {
	ds := &CSVDataSource{
		config: config,
	}

	// Get a reader for the CSV data (supports both local files and HTTP URLs)
	reader, cleanup, err := ds.getReader()
	if err != nil {
		return nil, err
	}
	defer cleanup()

	// Read header if present
	if config.HasHeader {
		csvReader := csv.NewReader(reader)
		if config.Delimiter != "" {
			csvReader.Comma = rune(config.Delimiter[0])
		}

		header, err := csvReader.Read()
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

// isURL checks if the path is an HTTP/HTTPS URL
func isURL(path string) bool {
	return strings.HasPrefix(path, "http://") || strings.HasPrefix(path, "https://")
}

// getReader returns an io.Reader for the CSV data, supporting both local files and HTTP URLs
// Returns the reader, a cleanup function, and any error
func (c *CSVDataSource) getReader() (io.Reader, func(), error) {
	if isURL(c.config.Path) {
		// Fetch from HTTP URL
		client := &http.Client{
			Timeout: 30 * time.Second,
		}

		resp, err := client.Get(c.config.Path)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to fetch CSV from URL: %w", err)
		}

		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			return nil, nil, fmt.Errorf("failed to fetch CSV: HTTP %d %s", resp.StatusCode, resp.Status)
		}

		cleanup := func() {
			resp.Body.Close()
		}

		return resp.Body, cleanup, nil
	}

	// Local file
	file, err := os.Open(c.config.Path)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to open CSV file: %w", err)
	}

	cleanup := func() {
		file.Close()
	}

	return file, cleanup, nil
}

// Query executes a filter query on CSV data and returns normalized results
func (c *CSVDataSource) Query(ctx context.Context, query models.Query) (*models.ResultSet, error) {
	reader, cleanup, err := c.getReader()
	if err != nil {
		return nil, err
	}
	defer cleanup()

	csvReader := csv.NewReader(reader)
	if c.config.Delimiter != "" {
		csvReader.Comma = rune(c.config.Delimiter[0])
	}

	// Skip header if present
	if c.config.HasHeader {
		if _, err := csvReader.Read(); err != nil {
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
		record, err := csvReader.Read()
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
	resultSet.Metadata["is_url"] = isURL(c.config.Path)

	return resultSet, nil
}

// Stream reads CSV data and streams records as they're read
func (c *CSVDataSource) Stream(ctx context.Context, query models.Query) (<-chan models.Record, error) {
	reader, cleanup, err := c.getReader()
	if err != nil {
		return nil, err
	}

	csvReader := csv.NewReader(reader)
	if c.config.Delimiter != "" {
		csvReader.Comma = rune(c.config.Delimiter[0])
	}

	// Skip header if present
	if c.config.HasHeader {
		if _, err := csvReader.Read(); err != nil {
			cleanup()
			return nil, fmt.Errorf("failed to read header: %w", err)
		}
	}

	recordChan := make(chan models.Record, 100) // Buffer for performance

	go func() {
		defer close(recordChan)
		defer cleanup()

		for {
			csvRecord, err := csvReader.Read()
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
