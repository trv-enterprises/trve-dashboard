package datasource

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
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
// Instead, it collects messages over a short time period
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

	resultSet := &models.ResultSet{
		Columns:  []string{"timestamp", "data"},
		Rows:     make([][]interface{}, 0),
		Metadata: make(map[string]interface{}),
	}

	rowCount := 0
	for {
		select {
		case record, ok := <-recordChan:
			if !ok {
				// Channel closed
				resultSet.Metadata["row_count"] = rowCount
				return resultSet, nil
			}

			// Convert record to row
			timestamp := time.Now().Format(time.RFC3339)
			dataJSON, _ := json.Marshal(record)
			row := []interface{}{timestamp, string(dataJSON)}
			resultSet.Rows = append(resultSet.Rows, row)
			rowCount++

		case <-collectCtx.Done():
			resultSet.Metadata["row_count"] = rowCount
			resultSet.Metadata["collection_timeout"] = timeout.String()
			return resultSet, nil
		}
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

// parseMessage converts raw bytes to a Record based on MessageFormat
func (s *SocketDataSource) parseMessage(message []byte) models.Record {
	record := make(models.Record)

	switch s.config.MessageFormat {
	case "json":
		if err := json.Unmarshal(message, &record); err != nil {
			// If JSON parsing fails, store as raw data
			record["data"] = string(message)
			record["error"] = err.Error()
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
		}
	}

	record["timestamp"] = time.Now().Unix()
	return record
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
