package datasource

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/tviviano/dashboard/internal/models"
)

// SocketDataSource implements the DataSource interface for socket/WebSocket streams
type SocketDataSource struct {
	config     *models.SocketConfig
	wsConn     *websocket.Conn
	tcpConn    net.Conn
	buffer     chan models.Record
	cancelFunc context.CancelFunc
}

// NewSocketDataSource creates a new Socket datasource
func NewSocketDataSource(config *models.SocketConfig) (*SocketDataSource, error) {
	ds := &SocketDataSource{
		config: config,
		buffer: make(chan models.Record, getBufferSize(config)),
	}

	if err := ds.connect(); err != nil {
		return nil, err
	}

	return ds, nil
}

func getBufferSize(config *models.SocketConfig) int {
	if config.BufferSize > 0 {
		return config.BufferSize
	}
	return 100 // default buffer size
}

// connect establishes connection based on protocol
func (s *SocketDataSource) connect() error {
	switch s.config.Protocol {
	case "websocket":
		return s.connectWebSocket()
	case "tcp":
		return s.connectTCP()
	case "udp":
		return s.connectUDP()
	default:
		return fmt.Errorf("unsupported protocol: %s", s.config.Protocol)
	}
}

// connectWebSocket establishes a WebSocket connection
func (s *SocketDataSource) connectWebSocket() error {
	dialer := websocket.Dialer{
		HandshakeTimeout: 10 * time.Second,
	}

	headers := make(map[string][]string)
	for k, v := range s.config.Headers {
		headers[k] = []string{v}
	}

	conn, _, err := dialer.Dial(s.config.URL, headers)
	if err != nil {
		return fmt.Errorf("failed to connect to WebSocket: %w", err)
	}

	s.wsConn = conn
	return nil
}

// connectTCP establishes a TCP connection
func (s *SocketDataSource) connectTCP() error {
	conn, err := net.Dial("tcp", s.config.URL)
	if err != nil {
		return fmt.Errorf("failed to connect to TCP socket: %w", err)
	}

	s.tcpConn = conn
	return nil
}

// connectUDP establishes a UDP connection
func (s *SocketDataSource) connectUDP() error {
	conn, err := net.Dial("udp", s.config.URL)
	if err != nil {
		return fmt.Errorf("failed to connect to UDP socket: %w", err)
	}

	s.tcpConn = conn // UDP uses net.Conn interface too
	return nil
}

// Query is not typically used for streaming datasources
// Instead, it collects messages over a short time period and flattens JSON fields into columns
func (s *SocketDataSource) Query(ctx context.Context, query models.Query) (*models.ResultSet, error) {
	// Start streaming
	recordChan, err := s.Stream(ctx, query)
	if err != nil {
		return nil, err
	}

	// Collect records for a limited time (e.g., 5 seconds or until context timeout)
	timeout := 5 * time.Second
	collectCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	// Collect all records first to discover all fields
	var records []models.Record
	for {
		select {
		case record, ok := <-recordChan:
			if !ok {
				// Channel closed
				break
			}
			records = append(records, record)

		case <-collectCtx.Done():
			// Timeout reached, process collected records
			goto processRecords
		}
	}

processRecords:
	// Build column list from all records (discover all unique fields)
	columnSet := make(map[string]bool)
	columnOrder := []string{"timestamp"} // timestamp always first
	columnSet["timestamp"] = true

	for _, record := range records {
		for key := range record {
			if !columnSet[key] {
				columnSet[key] = true
				columnOrder = append(columnOrder, key)
			}
		}
	}

	// If no records collected, return empty result with timestamp column
	if len(records) == 0 {
		return &models.ResultSet{
			Columns:  []string{"timestamp"},
			Rows:     make([][]interface{}, 0),
			Metadata: map[string]interface{}{"row_count": 0, "collection_timeout": timeout.String()},
		}, nil
	}

	// Build rows with flattened data
	rows := make([][]interface{}, 0, len(records))
	for _, record := range records {
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
			"row_count":          len(rows),
			"collection_timeout": timeout.String(),
		},
	}, nil
}

// flattenValue converts nested objects/arrays to JSON strings, keeps primitives as-is
func flattenValue(val interface{}) interface{} {
	switch v := val.(type) {
	case string, int, int64, float64, bool, nil:
		return v
	case map[string]interface{}, []interface{}:
		// Nested objects/arrays - convert to JSON string
		jsonBytes, err := json.Marshal(v)
		if err != nil {
			return fmt.Sprintf("%v", v)
		}
		return string(jsonBytes)
	default:
		return v
	}
}

// Stream starts streaming messages from the socket
func (s *SocketDataSource) Stream(ctx context.Context, query models.Query) (<-chan models.Record, error) {
	recordChan := make(chan models.Record, getBufferSize(s.config))

	streamCtx, cancel := context.WithCancel(ctx)
	s.cancelFunc = cancel

	go func() {
		defer close(recordChan)

		switch s.config.Protocol {
		case "websocket":
			s.streamWebSocket(streamCtx, recordChan)
		case "tcp", "udp":
			s.streamTCP(streamCtx, recordChan)
		}
	}()

	return recordChan, nil
}

// streamWebSocket reads messages from WebSocket
func (s *SocketDataSource) streamWebSocket(ctx context.Context, recordChan chan<- models.Record) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
			_, message, err := s.wsConn.ReadMessage()
			if err != nil {
				if s.config.ReconnectOnError {
					time.Sleep(time.Duration(s.config.ReconnectDelay) * time.Millisecond)
					if err := s.connectWebSocket(); err != nil {
						continue
					}
					continue
				}
				return
			}

			record := s.parseMessage(message)
			select {
			case recordChan <- record:
			case <-ctx.Done():
				return
			}
		}
	}
}

// streamTCP reads messages from TCP/UDP socket
func (s *SocketDataSource) streamTCP(ctx context.Context, recordChan chan<- models.Record) {
	buffer := make([]byte, 4096)

	for {
		select {
		case <-ctx.Done():
			return
		default:
			s.tcpConn.SetReadDeadline(time.Now().Add(1 * time.Second))
			n, err := s.tcpConn.Read(buffer)
			if err != nil {
				if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
					continue
				}

				if s.config.ReconnectOnError {
					time.Sleep(time.Duration(s.config.ReconnectDelay) * time.Millisecond)
					if s.config.Protocol == "tcp" {
						s.connectTCP()
					} else {
						s.connectUDP()
					}
					continue
				}
				return
			}

			if n > 0 {
				record := s.parseMessage(buffer[:n])
				select {
				case recordChan <- record:
				case <-ctx.Done():
					return
				}
			}
		}
	}
}

// parseMessage converts raw bytes to a Record based on MessageFormat and parser config
func (s *SocketDataSource) parseMessage(message []byte) models.Record {
	record := make(models.Record)

	switch s.config.MessageFormat {
	case "json":
		if err := json.Unmarshal(message, &record); err != nil {
			// If JSON parsing fails, store as raw data
			record["data"] = string(message)
			record["error"] = err.Error()
		} else {
			// Apply parser config if available
			record = s.applyParserConfig(record)
		}
	case "text":
		record["data"] = string(message)
	case "binary":
		record["data"] = message
		record["length"] = len(message)
	default:
		// Try JSON first, fallback to text
		if err := json.Unmarshal(message, &record); err != nil {
			record["data"] = string(message)
		} else {
			// Apply parser config if available
			record = s.applyParserConfig(record)
		}
	}

	record["timestamp"] = time.Now().Unix()
	return record
}

// applyParserConfig applies the parser configuration to extract and transform data
func (s *SocketDataSource) applyParserConfig(record models.Record) models.Record {
	parser := s.config.Parser
	if parser == nil {
		return record
	}

	// Step 1: Extract timestamp from original record BEFORE data extraction
	// This allows timestamp to be at a different path than the data
	var extractedTimestamp interface{}
	if parser.TimestampField != "" {
		extractedTimestamp = extractByPath(record, parser.TimestampField)
	}

	// Step 2: Extract data from data_path if specified
	if parser.DataPath != "" {
		extracted := extractByPath(record, parser.DataPath)
		if extracted != nil {
			// If extraction returns a map, use it as the new record
			if dataMap, ok := extracted.(map[string]interface{}); ok {
				record = dataMap
			} else {
				// If it's not a map, wrap it
				record = models.Record{"value": extracted}
			}
		}
	}

	// Step 3: Add the extracted timestamp to the record
	if extractedTimestamp != nil {
		record["timestamp"] = extractedTimestamp
	}

	// Apply field mappings (rename fields)
	if len(parser.FieldMappings) > 0 {
		for oldName, newName := range parser.FieldMappings {
			if val, exists := record[oldName]; exists {
				record[newName] = val
				delete(record, oldName)
			}
		}
	}

	// Apply include fields filter (whitelist)
	if len(parser.IncludeFields) > 0 {
		filtered := make(models.Record)
		for _, field := range parser.IncludeFields {
			if val, exists := record[field]; exists {
				filtered[field] = val
			}
		}
		// Always preserve timestamp if it was extracted
		if extractedTimestamp != nil {
			filtered["timestamp"] = extractedTimestamp
		}
		record = filtered
	}

	// Apply exclude fields filter (blacklist)
	if len(parser.ExcludeFields) > 0 {
		for _, field := range parser.ExcludeFields {
			delete(record, field)
		}
	}

	return record
}

// extractByPath navigates a map using dot notation (e.g., "data", "payload.readings")
func extractByPath(data map[string]interface{}, path string) interface{} {
	if path == "" {
		return data
	}

	parts := strings.Split(path, ".")
	var current interface{} = data

	for _, part := range parts {
		switch v := current.(type) {
		case map[string]interface{}:
			val, exists := v[part]
			if !exists {
				return nil
			}
			current = val
		default:
			// Can't navigate further
			return nil
		}
	}

	return current
}

// Close closes the socket connection
func (s *SocketDataSource) Close() error {
	if s.cancelFunc != nil {
		s.cancelFunc()
	}

	if s.wsConn != nil {
		return s.wsConn.Close()
	}

	if s.tcpConn != nil {
		return s.tcpConn.Close()
	}

	return nil
}
