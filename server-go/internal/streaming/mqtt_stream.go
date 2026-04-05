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
	"strings"
	"sync"
	"time"

	"github.com/eclipse/paho.golang/autopaho"
	"github.com/eclipse/paho.golang/paho"
	"github.com/trv-enterprises/trve-dashboard/internal/models"
)

// MQTTTopicMatch checks if a topic matches an MQTT topic filter pattern.
// Supports MQTT wildcards: + (single level) and # (multi level).
// Examples:
//
//	MQTTTopicMatch("sensors/temp/room1", "sensors/temp/room1") => true
//	MQTTTopicMatch("sensors/temp/room1", "sensors/+/room1") => true
//	MQTTTopicMatch("sensors/temp/room1", "sensors/#") => true
//	MQTTTopicMatch("sensors/temp/room1", "#") => true
func MQTTTopicMatch(topic, filter string) bool {
	if filter == "#" {
		return true
	}
	if filter == topic {
		return true
	}

	topicParts := splitTopic(topic)
	filterParts := splitTopic(filter)

	for i, fp := range filterParts {
		if fp == "#" {
			// # matches everything from here on
			return true
		}
		if i >= len(topicParts) {
			// Filter has more levels than topic
			return false
		}
		if fp == "+" {
			// + matches any single level
			continue
		}
		if fp != topicParts[i] {
			return false
		}
	}

	// Filter exhausted — must have matched all topic levels exactly
	return len(topicParts) == len(filterParts)
}

func splitTopic(t string) []string {
	parts := []string{}
	start := 0
	for i := 0; i <= len(t); i++ {
		if i == len(t) || t[i] == '/' {
			parts = append(parts, t[start:i])
			start = i + 1
		}
	}
	return parts
}

// MQTTTopicMatchAny checks if a topic matches any of the given filter patterns.
func MQTTTopicMatchAny(topic string, filters []string) bool {
	for _, f := range filters {
		if MQTTTopicMatch(topic, f) {
			return true
		}
	}
	return false
}

// mqttSubscriber tracks a subscriber and its topic filters
type mqttSubscriber struct {
	ch      chan models.Record
	topics  []string // MQTT topic filters this subscriber wants
}

// MQTTStream represents a persistent MQTT connection that manages topic subscriptions
// dynamically based on what subscribers need. Only subscribes to topics at the broker
// level when at least one subscriber wants them.
type MQTTStream struct {
	datasourceID string
	config       *models.MQTTConfig
	cm           *autopaho.ConnectionManager
	subscribers  []*mqttSubscriber
	topicRefs    map[string]int // ref count: topic filter -> number of subscribers using it
	buffer       *RingBuffer
	mu           sync.RWMutex
	cancelFunc   context.CancelFunc
	streamCtx    context.Context
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
		subscribers:  make([]*mqttSubscriber, 0),
		topicRefs:    make(map[string]int),
		buffer:       NewRingBuffer(bufferSize),
	}
}

// Start connects to the MQTT broker but does NOT subscribe to any topics yet.
// Topics are subscribed dynamically when subscribers are added via SubscribeWithTopics.
func (s *MQTTStream) Start(ctx context.Context) error {
	streamCtx, cancel := context.WithCancel(ctx)
	s.cancelFunc = cancel
	s.streamCtx = streamCtx

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
			log.Printf("[MQTTStream %s] Connected to broker", s.datasourceID)

			s.mu.Lock()
			s.connected = true
			s.lastError = nil
			// Re-subscribe to all active topics after reconnect
			topics := make([]string, 0, len(s.topicRefs))
			for t := range s.topicRefs {
				topics = append(topics, t)
			}
			s.mu.Unlock()

			if len(topics) > 0 {
				s.subscribeBrokerTopics(topics)
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

// subscribeBrokerTopics sends SUBSCRIBE for the given topics to the broker
func (s *MQTTStream) subscribeBrokerTopics(topics []string) {
	s.mu.RLock()
	cm := s.cm
	s.mu.RUnlock()

	if cm == nil {
		return
	}

	qos := byte(s.config.QoS)
	if qos > 2 {
		qos = 0
	}

	subs := make([]paho.SubscribeOptions, len(topics))
	for i, t := range topics {
		subs[i] = paho.SubscribeOptions{Topic: t, QoS: qos}
	}

	ctx, cancel := context.WithTimeout(s.streamCtx, 10*time.Second)
	defer cancel()

	_, err := cm.Subscribe(ctx, &paho.Subscribe{Subscriptions: subs})
	if err != nil {
		log.Printf("[MQTTStream %s] Subscribe error for %v: %v", s.datasourceID, topics, err)
	} else {
		log.Printf("[MQTTStream %s] Subscribed to broker topics: %v", s.datasourceID, topics)
	}
}

// unsubscribeBrokerTopics sends UNSUBSCRIBE for the given topics to the broker
func (s *MQTTStream) unsubscribeBrokerTopics(topics []string) {
	s.mu.RLock()
	cm := s.cm
	s.mu.RUnlock()

	if cm == nil {
		return
	}

	ctx, cancel := context.WithTimeout(s.streamCtx, 10*time.Second)
	defer cancel()

	_, err := cm.Unsubscribe(ctx, &paho.Unsubscribe{Topics: topics})
	if err != nil {
		log.Printf("[MQTTStream %s] Unsubscribe error for %v: %v", s.datasourceID, topics, err)
	} else {
		log.Printf("[MQTTStream %s] Unsubscribed from broker topics: %v", s.datasourceID, topics)
	}
}

// handleMessage processes incoming MQTT messages and routes to matching subscribers only
func (s *MQTTStream) handleMessage(m *paho.Publish) {
	serverTS := time.Now().Unix()
	record := models.Record{
		"topic":     m.Topic,
		"timestamp": serverTS,
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

		// Validate payload timestamp if present — reject non-epoch values
		if payloadTS, exists := payload["timestamp"]; exists {
			switch v := payloadTS.(type) {
			case float64:
				if int64(v) > 1000000000 {
					record["timestamp"] = int64(v)
				} else {
					record["timestamp"] = serverTS
					record["payload_timestamp"] = payloadTS
				}
			default:
				record["timestamp"] = serverTS
				record["payload_timestamp"] = payloadTS
			}
		}
	}

	// Add to buffer
	s.buffer.Push(record)

	// Feed to bucket aggregators
	aggRegistry := GetRegistry()
	aggRegistry.FeedRecord(s.datasourceID, record)

	// Route to matching subscribers only (non-blocking)
	s.mu.RLock()
	for _, sub := range s.subscribers {
		if MQTTTopicMatchAny(m.Topic, sub.topics) {
			select {
			case sub.ch <- record:
			default:
				// Channel full, skip
			}
		}
	}
	s.mu.RUnlock()
}

// Subscribe satisfies the Streamer interface. For MQTT, this subscribes to all topics (#).
// Prefer SubscribeWithTopics for topic-filtered subscriptions.
func (s *MQTTStream) Subscribe() chan models.Record {
	return s.SubscribeWithTopics([]string{"#"})
}

// SubscribeWithTopics adds a new subscriber with specific topic filters.
// Dynamically subscribes to new topics at the broker if needed.
func (s *MQTTStream) SubscribeWithTopics(topics []string) chan models.Record {
	ch := make(chan models.Record, 100)

	sub := &mqttSubscriber{
		ch:     ch,
		topics: topics,
	}

	// Track which topics are new and need broker subscription
	var newTopics []string

	s.mu.Lock()
	s.subscribers = append(s.subscribers, sub)

	for _, t := range topics {
		s.topicRefs[t]++
		if s.topicRefs[t] == 1 {
			newTopics = append(newTopics, t)
		}
	}
	totalSubs := len(s.subscribers)
	s.mu.Unlock()

	// Subscribe to new topics at broker level (outside lock)
	if len(newTopics) > 0 && s.connected {
		s.subscribeBrokerTopics(newTopics)
	}

	log.Printf("[MQTTStream %s] Subscriber added for topics %v (total subscribers: %d)", s.datasourceID, topics, totalSubs)
	return ch
}

// Unsubscribe removes a subscriber and cleans up unused broker subscriptions
func (s *MQTTStream) Unsubscribe(ch chan models.Record) {
	var removedTopics []string

	s.mu.Lock()
	for i, sub := range s.subscribers {
		if sub.ch == ch {
			// Decrement ref counts for this subscriber's topics
			for _, t := range sub.topics {
				s.topicRefs[t]--
				if s.topicRefs[t] <= 0 {
					delete(s.topicRefs, t)
					removedTopics = append(removedTopics, t)
				}
			}
			// Remove subscriber from slice
			s.subscribers = append(s.subscribers[:i], s.subscribers[i+1:]...)
			break
		}
	}
	totalSubs := len(s.subscribers)
	s.mu.Unlock()

	close(ch)

	// Unsubscribe removed topics from broker (outside lock)
	if len(removedTopics) > 0 && s.connected {
		s.unsubscribeBrokerTopics(removedTopics)
	}

	log.Printf("[MQTTStream %s] Subscriber removed (total: %d)", s.datasourceID, totalSubs)
}

// GetBuffer returns the current buffer contents
func (s *MQTTStream) GetBuffer() []models.Record {
	return s.buffer.GetAll()
}

// GetBufferFiltered returns buffer contents filtered by topic patterns
func (s *MQTTStream) GetBufferFiltered(topics []string) []models.Record {
	all := s.buffer.GetAll()
	if len(topics) == 0 {
		return all
	}

	filtered := make([]models.Record, 0, len(all))
	for _, record := range all {
		if topic, ok := record["topic"].(string); ok {
			if MQTTTopicMatchAny(topic, topics) {
				filtered = append(filtered, record)
			}
		}
	}
	return filtered
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

// ActiveTopics returns the list of currently subscribed broker topics
func (s *MQTTStream) ActiveTopics() []string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	topics := make([]string, 0, len(s.topicRefs))
	for t := range s.topicRefs {
		topics = append(topics, t)
	}
	return topics
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

// ParseTopicFilters parses a comma-separated topic filter string into individual filters
func ParseTopicFilters(topicsParam string) []string {
	if topicsParam == "" {
		return nil
	}
	var filters []string
	for _, t := range strings.Split(topicsParam, ",") {
		t = strings.TrimSpace(t)
		if t != "" {
			filters = append(filters, t)
		}
	}
	return filters
}
