// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

package streaming

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/url"
	"sync"
	"time"

	"github.com/eclipse/paho.golang/autopaho"
	"github.com/eclipse/paho.golang/paho"
	"github.com/tviviano/dashboard/internal/models"
)

// MQTTStream represents a persistent MQTT subscription that broadcasts to multiple subscribers
type MQTTStream struct {
	datasourceID string
	config       *models.MQTTConfig
	cm           *autopaho.ConnectionManager
	subscribers  map[chan models.Record]struct{}
	buffer       *RingBuffer
	mu           sync.RWMutex
	cancelFunc   context.CancelFunc
	connected    bool
	lastError    error
}

// NewMQTTStream creates a new MQTT stream
func NewMQTTStream(datasourceID string, config *models.MQTTConfig, streamConfig StreamConfig) *MQTTStream {
	bufferSize := streamConfig.BufferSize
	if config.BufferSize > 0 {
		bufferSize = config.BufferSize
	}

	return &MQTTStream{
		datasourceID: datasourceID,
		config:       config,
		subscribers:  make(map[chan models.Record]struct{}),
		buffer:       NewRingBuffer(bufferSize),
	}
}

// Start begins the MQTT streaming connection, subscribing to all topics (#)
// Individual topic filtering happens client-side
func (s *MQTTStream) Start(ctx context.Context) error {
	streamCtx, cancel := context.WithCancel(ctx)
	s.cancelFunc = cancel

	brokerURL, err := url.Parse(s.config.BrokerURL)
	if err != nil {
		cancel()
		return fmt.Errorf("invalid broker URL: %w", err)
	}

	keepAlive := uint16(s.config.KeepAlive)
	if keepAlive == 0 {
		keepAlive = 60
	}

	// Use a unique client ID for the stream to avoid conflicts with adapter connections
	clientID := s.config.ClientID
	if clientID == "" {
		clientID = fmt.Sprintf("dashboard-stream-%d", time.Now().UnixNano()%1000000)
	} else {
		clientID = clientID + "-stream"
	}

	cfg := autopaho.ClientConfig{
		ServerUrls:                    []*url.URL{brokerURL},
		KeepAlive:                     keepAlive,
		CleanStartOnInitialConnection: s.config.CleanStart,
		SessionExpiryInterval:         0,
		OnConnectionUp: func(cm *autopaho.ConnectionManager, connAck *paho.Connack) {
			log.Printf("[MQTTStream %s] Connected to broker, subscribing to #", s.datasourceID)

			s.mu.Lock()
			s.connected = true
			s.lastError = nil
			s.mu.Unlock()

			qos := byte(s.config.QoS)
			if qos > 2 {
				qos = 0
			}

			// Subscribe to all topics — filtering is done by the frontend per-component
			_, err := cm.Subscribe(streamCtx, &paho.Subscribe{
				Subscriptions: []paho.SubscribeOptions{
					{Topic: "#", QoS: qos},
				},
			})
			if err != nil {
				log.Printf("[MQTTStream %s] Subscribe error: %v", s.datasourceID, err)
			}
		},
		OnConnectError: func(err error) {
			log.Printf("[MQTTStream %s] Connection error: %v", s.datasourceID, err)
			s.mu.Lock()
			s.connected = false
			s.lastError = err
			s.mu.Unlock()
		},
		ClientConfig: paho.ClientConfig{
			ClientID: clientID,
			Router: paho.NewSingleHandlerRouter(func(m *paho.Publish) {
				s.handleMessage(m)
			}),
		},
	}

	// Set authentication if provided
	if s.config.Username != "" {
		cfg.ConnectUsername = s.config.Username
		cfg.ConnectPassword = []byte(s.config.Password)
	}

	cm, err := autopaho.NewConnection(streamCtx, cfg)
	if err != nil {
		cancel()
		return fmt.Errorf("failed to create MQTT stream connection: %w", err)
	}

	// Wait for initial connection
	waitCtx, waitCancel := context.WithTimeout(ctx, 10*time.Second)
	defer waitCancel()

	if err := cm.AwaitConnection(waitCtx); err != nil {
		cancel()
		return fmt.Errorf("failed to connect to MQTT broker: %w", err)
	}

	s.mu.Lock()
	s.cm = cm
	s.mu.Unlock()

	log.Printf("[MQTTStream %s] Started (broker: %s, clientID: %s)", s.datasourceID, s.config.BrokerURL, clientID)
	return nil
}

// handleMessage processes incoming MQTT messages and broadcasts to subscribers
func (s *MQTTStream) handleMessage(m *paho.Publish) {
	record := models.Record{
		"topic":     m.Topic,
		"timestamp": time.Now().Unix(),
	}

	// Try to parse payload as JSON
	var payload map[string]interface{}
	if err := json.Unmarshal(m.Payload, &payload); err != nil {
		// Not JSON, store as raw string
		record["payload"] = string(m.Payload)
	} else {
		// Merge JSON fields into record
		for k, v := range payload {
			record[k] = v
		}
	}

	// Add to buffer
	s.buffer.Push(record)

	// Feed to bucket aggregators
	registry := GetRegistry()
	registry.FeedRecord(s.datasourceID, record)

	// Broadcast to all subscribers (non-blocking)
	s.mu.RLock()
	subscribers := make([]chan models.Record, 0, len(s.subscribers))
	for ch := range s.subscribers {
		subscribers = append(subscribers, ch)
	}
	s.mu.RUnlock()

	for _, ch := range subscribers {
		select {
		case ch <- record:
		default:
			// Channel full, skip
		}
	}
}

// Subscribe adds a new subscriber and returns a channel for receiving records
func (s *MQTTStream) Subscribe() chan models.Record {
	ch := make(chan models.Record, 100)

	s.mu.Lock()
	s.subscribers[ch] = struct{}{}
	s.mu.Unlock()

	log.Printf("[MQTTStream %s] Subscriber added (total: %d)", s.datasourceID, len(s.subscribers))
	return ch
}

// Unsubscribe removes a subscriber
func (s *MQTTStream) Unsubscribe(ch chan models.Record) {
	s.mu.Lock()
	delete(s.subscribers, ch)
	count := len(s.subscribers)
	s.mu.Unlock()

	close(ch)
	log.Printf("[MQTTStream %s] Subscriber removed (total: %d)", s.datasourceID, count)
}

// GetBuffer returns the current buffer contents
func (s *MQTTStream) GetBuffer() []models.Record {
	return s.buffer.GetAll()
}

// BufferCount returns the number of records in the buffer
func (s *MQTTStream) BufferCount() int {
	return s.buffer.Count()
}

// SubscriberCount returns the number of active subscribers
func (s *MQTTStream) SubscriberCount() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.subscribers)
}

// IsConnected returns whether the stream is connected
func (s *MQTTStream) IsConnected() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.connected
}

// LastError returns the last error, if any
func (s *MQTTStream) LastError() error {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.lastError
}

// Stop stops the stream and disconnects
func (s *MQTTStream) Stop() {
	if s.cancelFunc != nil {
		s.cancelFunc()
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if s.cm != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = s.cm.Disconnect(ctx)
		s.cm = nil
	}

	s.connected = false
	log.Printf("[MQTTStream %s] Stopped", s.datasourceID)
}
