// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

package streaming

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/tviviano/dashboard/internal/models"
)

// TSStoreStream represents a streaming connection to a TSStore datasource
// Implements the Streamer interface
type TSStoreStream struct {
	datasourceID string
	config       *models.TSStoreConfig
	wsConn       *websocket.Conn
	subscribers  map[chan models.Record]struct{}
	buffer       *RingBuffer
	mu           sync.RWMutex
	cancelFunc   context.CancelFunc
	connected    bool
	lastError    error
	reconnecting bool
}

// tsStoreWSMessage represents a WebSocket message from TSStore
type tsStoreWSMessage struct {
	Type      string          `json:"type"`                // "data", "caught_up", "error"
	Timestamp int64           `json:"timestamp,omitempty"` // For data messages (nanoseconds)
	BlockNum  uint32          `json:"block_num,omitempty"` // For data messages
	Size      uint32          `json:"size,omitempty"`      // For data messages
	Data      json.RawMessage `json:"data,omitempty"`      // For data messages
	Message   string          `json:"message,omitempty"`   // For error messages
}

// NewTSStoreStream creates a new stream for a TSStore datasource
func NewTSStoreStream(datasourceID string, config *models.TSStoreConfig, streamConfig StreamConfig) Streamer {
	bufferSize := streamConfig.BufferSize
	if bufferSize <= 0 {
		bufferSize = 100
	}

	return &TSStoreStream{
		datasourceID: datasourceID,
		config:       config,
		subscribers:  make(map[chan models.Record]struct{}),
		buffer:       NewRingBuffer(bufferSize),
	}
}

// Start begins the TSStore streaming connection
func (ts *TSStoreStream) Start(ctx context.Context) error {
	streamCtx, cancel := context.WithCancel(ctx)
	ts.cancelFunc = cancel

	if err := ts.connect(); err != nil {
		return fmt.Errorf("failed to connect to TSStore: %w", err)
	}

	// Start reading goroutine
	go ts.readLoop(streamCtx)

	return nil
}

// connect establishes the WebSocket connection to TSStore
func (ts *TSStoreStream) connect() error {
	ts.mu.Lock()
	defer ts.mu.Unlock()

	wsURL := ts.buildWebSocketURL()

	dialer := websocket.Dialer{
		HandshakeTimeout: 10 * time.Second,
	}

	// Add custom headers
	headers := http.Header{}
	for k, v := range ts.config.Headers {
		headers.Set(k, v)
	}

	conn, _, err := dialer.Dial(wsURL, headers)
	if err != nil {
		ts.lastError = err
		ts.connected = false
		return fmt.Errorf("failed to connect to TSStore WebSocket: %w", err)
	}

	ts.wsConn = conn
	ts.connected = true
	ts.lastError = nil
	log.Printf("[TSStoreStream %s] Connected to %s", ts.datasourceID, wsURL)

	return nil
}

// buildWebSocketURL constructs the WebSocket URL for TSStore streaming
func (ts *TSStoreStream) buildWebSocketURL() string {
	// Get WebSocket base URL from config
	baseURL := ts.config.WebSocketURL()

	// Build query parameters
	params := url.Values{}

	// API key for authentication
	if ts.config.APIKey != "" {
		params.Set("api_key", ts.config.APIKey)
	}

	// Start from "now" for real-time streaming
	params.Set("from", "now")

	// For schema stores, request compact format
	if ts.config.DataType == models.TSStoreDataTypeSchema {
		params.Set("format", "compact")
	}

	return fmt.Sprintf("%s/api/stores/%s/ws/read?%s", baseURL, ts.config.StoreName, params.Encode())
}

// readLoop continuously reads from the WebSocket and broadcasts to subscribers
func (ts *TSStoreStream) readLoop(ctx context.Context) {
	reconnectDelay := time.Second

	for {
		select {
		case <-ctx.Done():
			ts.cleanup()
			return
		default:
			ts.mu.RLock()
			conn := ts.wsConn
			ts.mu.RUnlock()

			if conn == nil {
				time.Sleep(reconnectDelay)
				continue
			}

			// Set read deadline to allow checking context periodically
			conn.SetReadDeadline(time.Now().Add(5 * time.Second))

			_, message, err := conn.ReadMessage()
			if err != nil {
				// Check if it's a timeout (expected, allows context check)
				if netErr, ok := err.(interface{ Timeout() bool }); ok && netErr.Timeout() {
					continue
				}

				log.Printf("[TSStoreStream %s] Read error: %v", ts.datasourceID, err)

				ts.mu.Lock()
				ts.connected = false
				ts.lastError = err
				ts.mu.Unlock()

				// Always try to reconnect for TSStore
				ts.reconnect(ctx, &reconnectDelay)
				continue
			}

			// Reset reconnect delay on successful read
			reconnectDelay = time.Second

			// Parse and broadcast the message
			ts.processMessage(message)
		}
	}
}

// processMessage parses a TSStore WebSocket message and broadcasts it
func (ts *TSStoreStream) processMessage(message []byte) {
	var msg tsStoreWSMessage
	if err := json.Unmarshal(message, &msg); err != nil {
		log.Printf("[TSStoreStream %s] Failed to parse message: %v", ts.datasourceID, err)
		return
	}

	switch msg.Type {
	case "data":
		record := ts.wsMessageToRecord(&msg)
		ts.broadcast([]models.Record{record})

	case "caught_up":
		// Optional: could send a special record to indicate caught up
		log.Printf("[TSStoreStream %s] Caught up to real-time", ts.datasourceID)

	case "error":
		log.Printf("[TSStoreStream %s] Error from TSStore: %s", ts.datasourceID, msg.Message)
	}
}

// wsMessageToRecord converts a TSStore WebSocket data message to a Record
func (ts *TSStoreStream) wsMessageToRecord(msg *tsStoreWSMessage) models.Record {
	record := models.Record{
		"timestamp": msg.Timestamp / 1e9, // nanoseconds -> seconds
	}

	// Parse the data based on store type
	switch ts.config.DataType {
	case models.TSStoreDataTypeText:
		var text string
		if err := json.Unmarshal(msg.Data, &text); err != nil {
			text = string(msg.Data)
		}
		record["data"] = text

	default: // JSON or Schema
		var data map[string]interface{}
		if err := json.Unmarshal(msg.Data, &data); err != nil {
			record["data"] = string(msg.Data)
		} else {
			// Merge data fields into record
			for k, v := range data {
				record[k] = v
			}
		}
	}

	return record
}

// reconnect attempts to reconnect with exponential backoff
func (ts *TSStoreStream) reconnect(ctx context.Context, delay *time.Duration) {
	ts.mu.Lock()
	if ts.reconnecting {
		ts.mu.Unlock()
		return
	}
	ts.reconnecting = true
	ts.mu.Unlock()

	defer func() {
		ts.mu.Lock()
		ts.reconnecting = false
		ts.mu.Unlock()
	}()

	log.Printf("[TSStoreStream %s] Reconnecting in %v...", ts.datasourceID, *delay)

	select {
	case <-ctx.Done():
		return
	case <-time.After(*delay):
	}

	if err := ts.connect(); err != nil {
		log.Printf("[TSStoreStream %s] Reconnect failed: %v", ts.datasourceID, err)
		// Exponential backoff
		*delay = *delay * 2
		if *delay > 30*time.Second {
			*delay = 30 * time.Second
		}
	} else {
		*delay = time.Second
	}
}

// broadcast sends records to all subscribers and adds to buffer
func (ts *TSStoreStream) broadcast(records []models.Record) {
	ts.mu.RLock()
	subscribers := make([]chan models.Record, 0, len(ts.subscribers))
	for ch := range ts.subscribers {
		subscribers = append(subscribers, ch)
	}
	ts.mu.RUnlock()

	// Get the aggregator registry for feeding bucket aggregators
	registry := GetRegistry()

	for _, record := range records {
		// Add to buffer
		ts.buffer.Push(record)

		// Feed to bucket aggregators for this datasource
		registry.FeedRecord(ts.datasourceID, record)

		// Send to all subscribers (non-blocking)
		for _, ch := range subscribers {
			select {
			case ch <- record:
			default:
				// Channel full, skip (subscriber is slow)
			}
		}
	}
}

// Subscribe adds a new subscriber and returns a channel for receiving records
func (ts *TSStoreStream) Subscribe() chan models.Record {
	ch := make(chan models.Record, 100) // Buffered channel

	ts.mu.Lock()
	ts.subscribers[ch] = struct{}{}
	ts.mu.Unlock()

	log.Printf("[TSStoreStream %s] Subscriber added (total: %d)", ts.datasourceID, len(ts.subscribers))
	return ch
}

// Unsubscribe removes a subscriber
func (ts *TSStoreStream) Unsubscribe(ch chan models.Record) {
	ts.mu.Lock()
	delete(ts.subscribers, ch)
	count := len(ts.subscribers)
	ts.mu.Unlock()

	close(ch)
	log.Printf("[TSStoreStream %s] Subscriber removed (total: %d)", ts.datasourceID, count)
}

// GetBuffer returns the current buffer contents
func (ts *TSStoreStream) GetBuffer() []models.Record {
	return ts.buffer.GetAll()
}

// BufferCount returns the number of records in the buffer
func (ts *TSStoreStream) BufferCount() int {
	return ts.buffer.Count()
}

// SubscriberCount returns the number of active subscribers
func (ts *TSStoreStream) SubscriberCount() int {
	ts.mu.RLock()
	defer ts.mu.RUnlock()
	return len(ts.subscribers)
}

// IsConnected returns whether the stream is connected
func (ts *TSStoreStream) IsConnected() bool {
	ts.mu.RLock()
	defer ts.mu.RUnlock()
	return ts.connected
}

// LastError returns the last error, if any
func (ts *TSStoreStream) LastError() error {
	ts.mu.RLock()
	defer ts.mu.RUnlock()
	return ts.lastError
}

// Stop stops the stream and closes the connection
func (ts *TSStoreStream) Stop() {
	if ts.cancelFunc != nil {
		ts.cancelFunc()
	}
}

// cleanup closes the WebSocket connection
func (ts *TSStoreStream) cleanup() {
	ts.mu.Lock()
	defer ts.mu.Unlock()

	if ts.wsConn != nil {
		ts.wsConn.Close()
		ts.wsConn = nil
	}
	ts.connected = false

	log.Printf("[TSStoreStream %s] Cleaned up", ts.datasourceID)
}
