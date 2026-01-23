package datasource

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/tviviano/dashboard/internal/models"
)

// TSStoreDataSource implements the DataSource interface for TSStore timeseries databases.
// TSStore stores arbitrary JSON objects at timestamps - data has no predefined schema.
// Schema is discovered by reading the first N records and analyzing their JSON structure.
// Uses the /json/* endpoints which return data directly (no base64 encoding).
type TSStoreDataSource struct {
	config     *models.TSStoreConfig
	httpClient *http.Client
}

// NewTSStoreDataSource creates a new TSStore datasource
func NewTSStoreDataSource(config *models.TSStoreConfig) (*TSStoreDataSource, error) {
	timeout := 30 * time.Second
	if config.Timeout > 0 {
		timeout = time.Duration(config.Timeout) * time.Second
	}

	ds := &TSStoreDataSource{
		config: config,
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}

	return ds, nil
}

// jsonObjectResponse matches the TSStore JSON API response
type jsonObjectResponse struct {
	Timestamp       int64           `json:"timestamp"`
	PrimaryBlockNum uint32          `json:"primary_block_num"`
	TotalSize       uint32          `json:"total_size"`
	BlockCount      uint32          `json:"block_count"`
	Data            json.RawMessage `json:"data"` // Raw JSON, not base64
}

// jsonListResponse matches the TSStore JSON API list response
type jsonListResponse struct {
	Objects []jsonObjectResponse `json:"objects"`
	Count   int                  `json:"count"`
}

// Query fetches data from TSStore using the JSON API.
// For TSStore, the query.Raw can specify:
// - "newest" or empty: fetch the N newest objects (default 10)
// - "oldest": fetch the N oldest objects
// - "since:DURATION": fetch objects from the last duration (e.g., "since:30m", "since:2h", "since:7d")
// - "range:START_TIME:END_TIME": fetch objects in time range (epoch nanoseconds)
// Query params can include "limit" to control count.
// Supported duration formats: 30s, 15m, 2h, 7d, 1w
func (t *TSStoreDataSource) Query(ctx context.Context, query models.Query) (*models.ResultSet, error) {
	// Get limit from params, default depends on query type
	var limit int
	hasExplicitLimit := false
	if l, ok := query.Params["limit"].(float64); ok {
		limit = int(l)
		hasExplicitLimit = true
	} else if l, ok := query.Params["limit"].(int); ok {
		limit = l
		hasExplicitLimit = true
	}

	var objects []jsonObjectResponse
	var err error

	queryType := query.Raw
	if queryType == "" {
		queryType = "newest"
	}

	switch {
	case queryType == "newest":
		if !hasExplicitLimit {
			limit = 10 // Default for newest
		}
		objects, err = t.fetchNewestJSON(ctx, limit, "")
	case queryType == "oldest":
		if !hasExplicitLimit {
			limit = 10 // Default for oldest
		}
		objects, err = t.fetchOldestJSON(ctx, limit)
	case len(queryType) > 6 && queryType[:6] == "since:":
		// Relative time query: "since:30m", "since:2h", "since:7d"
		// For time-based queries, default to a high limit to get all data in the window
		if !hasExplicitLimit {
			limit = 100000 // High default for time-range queries
		}
		since := queryType[6:]
		objects, err = t.fetchJSONSince(ctx, since, limit)
	case len(queryType) > 6 && queryType[:6] == "range:":
		// Absolute time range: "range:START:END"
		// For time-based queries, default to a high limit to get all data in the window
		if !hasExplicitLimit {
			limit = 100000
		}
		var startTime, endTime int64
		if _, parseErr := fmt.Sscanf(queryType, "range:%d:%d", &startTime, &endTime); parseErr == nil {
			objects, err = t.fetchJSONInRange(ctx, startTime, endTime, limit)
		} else {
			return nil, fmt.Errorf("invalid range format, expected 'range:START_TIME:END_TIME'")
		}
	default:
		// Default to newest with low limit
		if !hasExplicitLimit {
			limit = 10
		}
		objects, err = t.fetchNewestJSON(ctx, limit, "")
	}

	if err != nil {
		return nil, err
	}

	// Convert objects to ResultSet by discovering schema from JSON data
	return t.jsonToResultSet(objects)
}

// fetchNewestJSON retrieves the N newest JSON objects
// If since is provided (e.g., "30m", "2h"), it filters to objects within that duration
func (t *TSStoreDataSource) fetchNewestJSON(ctx context.Context, limit int, since string) ([]jsonObjectResponse, error) {
	url := fmt.Sprintf("%s/api/stores/%s/json/newest?limit=%d", t.config.URL, t.config.StoreName, limit)
	if since != "" {
		url += "&since=" + since
	}

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	t.addHeaders(req)

	resp, err := t.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch newest JSON objects: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("TSStore API error (status %d): %s", resp.StatusCode, string(body))
	}

	var listResp jsonListResponse
	if err := json.NewDecoder(resp.Body).Decode(&listResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return listResp.Objects, nil
}

// fetchJSONSince retrieves JSON objects from the last duration using the /json/newest endpoint with since parameter
func (t *TSStoreDataSource) fetchJSONSince(ctx context.Context, since string, limit int) ([]jsonObjectResponse, error) {
	url := fmt.Sprintf("%s/api/stores/%s/json/newest?since=%s&limit=%d", t.config.URL, t.config.StoreName, since, limit)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	t.addHeaders(req)

	resp, err := t.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch JSON objects since %s: %w", since, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("TSStore API error (status %d): %s", resp.StatusCode, string(body))
	}

	var listResp jsonListResponse
	if err := json.NewDecoder(resp.Body).Decode(&listResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return listResp.Objects, nil
}

// fetchOldestJSON retrieves the N oldest JSON objects
func (t *TSStoreDataSource) fetchOldestJSON(ctx context.Context, limit int) ([]jsonObjectResponse, error) {
	url := fmt.Sprintf("%s/api/stores/%s/json/oldest?limit=%d", t.config.URL, t.config.StoreName, limit)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	t.addHeaders(req)

	resp, err := t.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch oldest JSON objects: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("TSStore API error (status %d): %s", resp.StatusCode, string(body))
	}

	var listResp jsonListResponse
	if err := json.NewDecoder(resp.Body).Decode(&listResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return listResp.Objects, nil
}

// fetchJSONInRange retrieves JSON objects within a time range using the direct JSON range endpoint
func (t *TSStoreDataSource) fetchJSONInRange(ctx context.Context, startTime, endTime int64, limit int) ([]jsonObjectResponse, error) {
	url := fmt.Sprintf("%s/api/stores/%s/json/range?start_time=%d&end_time=%d&limit=%d",
		t.config.URL, t.config.StoreName, startTime, endTime, limit)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	t.addHeaders(req)

	resp, err := t.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch JSON objects in range: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("TSStore API error (status %d): %s", resp.StatusCode, string(body))
	}

	var listResp jsonListResponse
	if err := json.NewDecoder(resp.Body).Decode(&listResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return listResp.Objects, nil
}

// fetchJSONByTime retrieves a single JSON object by timestamp
func (t *TSStoreDataSource) fetchJSONByTime(ctx context.Context, timestamp int64) (*jsonObjectResponse, error) {
	url := fmt.Sprintf("%s/api/stores/%s/json/time/%d", t.config.URL, t.config.StoreName, timestamp)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	t.addHeaders(req)

	resp, err := t.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("TSStore API error (status %d): %s", resp.StatusCode, string(body))
	}

	var obj jsonObjectResponse
	if err := json.NewDecoder(resp.Body).Decode(&obj); err != nil {
		return nil, err
	}

	return &obj, nil
}

// jsonToResultSet converts TSStore JSON objects to a normalized ResultSet
// This discovers the schema by examining the JSON structure of the objects
// Handles both single objects and arrays of objects per timestamp
func (t *TSStoreDataSource) jsonToResultSet(objects []jsonObjectResponse) (*models.ResultSet, error) {
	if len(objects) == 0 {
		return &models.ResultSet{
			Columns:  []string{"timestamp"},
			Rows:     make([][]interface{}, 0),
			Metadata: map[string]interface{}{"row_count": 0},
		}, nil
	}

	// Discover columns from all objects (schema-less data)
	columnSet := make(map[string]bool)
	columnOrder := []string{"timestamp"} // timestamp always first
	columnSet["timestamp"] = true

	// First pass: decode all objects and discover columns
	// Each object may contain a single record OR an array of records
	decodedObjects := make([]map[string]interface{}, 0, len(objects))

	for _, obj := range objects {
		timestamp := obj.Timestamp / 1e9 // nanoseconds -> seconds for display

		// First try to parse as an array of records
		var records []map[string]interface{}
		if err := json.Unmarshal(obj.Data, &records); err == nil {
			// Data is an array - add each record with the shared timestamp
			for _, record := range records {
				record["timestamp"] = timestamp

				// Discover new columns
				for key := range record {
					if !columnSet[key] {
						columnSet[key] = true
						columnOrder = append(columnOrder, key)
					}
				}

				decodedObjects = append(decodedObjects, record)
			}
		} else {
			// Not an array, try as a single object
			var record map[string]interface{}
			if err := json.Unmarshal(obj.Data, &record); err != nil {
				// If not a JSON object, store as raw data
				record = map[string]interface{}{
					"data": string(obj.Data),
				}
			}

			// Add timestamp from object handle
			record["timestamp"] = timestamp

			// Discover new columns
			for key := range record {
				if !columnSet[key] {
					columnSet[key] = true
					columnOrder = append(columnOrder, key)
				}
			}

			decodedObjects = append(decodedObjects, record)
		}
	}

	// Second pass: build rows with consistent column order
	rows := make([][]interface{}, 0, len(decodedObjects))
	for _, record := range decodedObjects {
		row := make([]interface{}, len(columnOrder))
		for i, col := range columnOrder {
			if val, exists := record[col]; exists {
				row[i] = flattenValue(val)
			} else {
				row[i] = nil
			}
		}
		rows = append(rows, row)
	}

	return &models.ResultSet{
		Columns: columnOrder,
		Rows:    rows,
		Metadata: map[string]interface{}{
			"row_count":   len(rows),
			"store_name":  t.config.StoreName,
			"source_type": "tsstore",
		},
	}, nil
}

// addHeaders adds authentication and custom headers to requests
func (t *TSStoreDataSource) addHeaders(req *http.Request) {
	req.Header.Set("Content-Type", "application/json")

	if t.config.APIKey != "" {
		req.Header.Set("X-API-Key", t.config.APIKey)
	}

	for k, v := range t.config.Headers {
		req.Header.Set(k, v)
	}
}

// Stream implements streaming for TSStore (returns channel of records)
// TSStore doesn't have native streaming, so this polls for new data
func (t *TSStoreDataSource) Stream(ctx context.Context, query models.Query) (<-chan models.Record, error) {
	recordChan := make(chan models.Record, 100)

	go func() {
		defer close(recordChan)

		// For streaming, we poll for newest objects periodically
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()

		var lastTimestamp int64

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				objects, err := t.fetchNewestJSON(ctx, 10, "")
				if err != nil {
					continue
				}

				for _, obj := range objects {
					// Only send new records
					if obj.Timestamp > lastTimestamp {
						var record models.Record
						if err := json.Unmarshal(obj.Data, &record); err != nil {
							record = models.Record{"data": string(obj.Data)}
						}
						record["timestamp"] = obj.Timestamp / 1e9

						select {
						case recordChan <- record:
							lastTimestamp = obj.Timestamp
						case <-ctx.Done():
							return
						}
					}
				}
			}
		}
	}()

	return recordChan, nil
}

// Close closes the TSStore datasource
func (t *TSStoreDataSource) Close() error {
	// HTTP client doesn't need explicit closing
	return nil
}

// TestConnection tests the connection to TSStore
func (t *TSStoreDataSource) TestConnection(ctx context.Context) error {
	// Try to get oldest JSON objects (limit 1) to verify connectivity
	url := fmt.Sprintf("%s/api/stores/%s/json/oldest?limit=1", t.config.URL, t.config.StoreName)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return err
	}
	t.addHeaders(req)

	resp, err := t.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to connect to TSStore: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return fmt.Errorf("store '%s' not found", t.config.StoreName)
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("TSStore API error (status %d): %s", resp.StatusCode, string(body))
	}

	return nil
}
