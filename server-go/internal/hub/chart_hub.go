// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

package hub

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/tviviano/dashboard/internal/models"
	"github.com/tviviano/dashboard/internal/registry"
)

// ChartSubscriber represents a WebSocket connection subscribed to chart updates
type ChartSubscriber struct {
	ID               string          // Unique subscriber ID (e.g., session ID or connection ID)
	Conn             *websocket.Conn // WebSocket connection
	ChartIDs         map[string]bool // Set of chart IDs this subscriber is interested in
	ClientRegistryID uint64          // ID from client registry for status tracking
	mu               sync.Mutex      // Protects Conn writes
}

// Send sends a message to the subscriber (thread-safe)
func (s *ChartSubscriber) Send(data []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.Conn.WriteMessage(websocket.TextMessage, data)
}

// ChartHub manages chart update subscriptions and broadcasts
// Uses channel-based communication for thread safety
type ChartHub struct {
	// Subscribers indexed by their ID
	subscribers map[string]*ChartSubscriber

	// Chart subscriptions: chartID -> set of subscriber IDs
	chartSubscriptions map[string]map[string]bool

	// Channels for thread-safe operations
	subscribe   chan *subscribeRequest
	unsubscribe chan *unsubscribeRequest
	broadcast   chan *broadcastRequest
	stop        chan struct{}

	mu sync.RWMutex
}

type subscribeRequest struct {
	subscriber *ChartSubscriber
	chartID    string
}

type unsubscribeRequest struct {
	subscriberID string
	chartID      string // empty means unsubscribe from all
}

type broadcastRequest struct {
	chartID string
	chart   *models.Chart
}

// Global hub instance
var globalChartHub *ChartHub
var hubOnce sync.Once

// GetChartHub returns the global ChartHub instance
func GetChartHub() *ChartHub {
	hubOnce.Do(func() {
		globalChartHub = NewChartHub()
		go globalChartHub.Run()
	})
	return globalChartHub
}

// NewChartHub creates a new ChartHub
func NewChartHub() *ChartHub {
	return &ChartHub{
		subscribers:        make(map[string]*ChartSubscriber),
		chartSubscriptions: make(map[string]map[string]bool),
		subscribe:          make(chan *subscribeRequest, 100),
		unsubscribe:        make(chan *unsubscribeRequest, 100),
		broadcast:          make(chan *broadcastRequest, 100),
		stop:               make(chan struct{}),
	}
}

// Run starts the hub's main loop (run as goroutine)
func (h *ChartHub) Run() {
	fmt.Println("[ChartHub] Starting chart subscription hub")
	for {
		select {
		case req := <-h.subscribe:
			h.handleSubscribe(req)

		case req := <-h.unsubscribe:
			h.handleUnsubscribe(req)

		case req := <-h.broadcast:
			h.handleBroadcast(req)

		case <-h.stop:
			fmt.Println("[ChartHub] Stopping chart subscription hub")
			return
		}
	}
}

// Stop stops the hub
func (h *ChartHub) Stop() {
	close(h.stop)
}

// Subscribe adds a subscriber for a specific chart
func (h *ChartHub) Subscribe(subscriber *ChartSubscriber, chartID string) {
	h.subscribe <- &subscribeRequest{
		subscriber: subscriber,
		chartID:    chartID,
	}
}

// Unsubscribe removes a subscriber from a specific chart (or all if chartID is empty)
func (h *ChartHub) Unsubscribe(subscriberID string, chartID string) {
	h.unsubscribe <- &unsubscribeRequest{
		subscriberID: subscriberID,
		chartID:      chartID,
	}
}

// UnsubscribeAll removes a subscriber from all charts
func (h *ChartHub) UnsubscribeAll(subscriberID string) {
	h.Unsubscribe(subscriberID, "")
}

// BroadcastChartUpdate sends a chart update to all subscribers of that chart
func (h *ChartHub) BroadcastChartUpdate(chartID string, chart *models.Chart) {
	h.broadcast <- &broadcastRequest{
		chartID: chartID,
		chart:   chart,
	}
}

// handleSubscribe processes a subscribe request
func (h *ChartHub) handleSubscribe(req *subscribeRequest) {
	h.mu.Lock()
	defer h.mu.Unlock()

	// Add/update subscriber
	existing, ok := h.subscribers[req.subscriber.ID]
	if ok {
		// Subscriber exists, add chart to their list
		existing.ChartIDs[req.chartID] = true
	} else {
		// New subscriber - register with client registry
		clientRegistry := registry.GetClientRegistry()
		req.subscriber.ClientRegistryID = clientRegistry.Register(registry.ConnectionTypeChartSubscription, map[string]interface{}{
			"subscriber_id": req.subscriber.ID,
			"chart_id":      req.chartID,
		})

		req.subscriber.ChartIDs = make(map[string]bool)
		req.subscriber.ChartIDs[req.chartID] = true
		h.subscribers[req.subscriber.ID] = req.subscriber
	}

	// Add to chart subscriptions
	if h.chartSubscriptions[req.chartID] == nil {
		h.chartSubscriptions[req.chartID] = make(map[string]bool)
	}
	h.chartSubscriptions[req.chartID][req.subscriber.ID] = true

	fmt.Printf("[ChartHub] Subscriber %s subscribed to chart %s (total subscribers for chart: %d)\n",
		req.subscriber.ID, req.chartID, len(h.chartSubscriptions[req.chartID]))
}

// handleUnsubscribe processes an unsubscribe request
func (h *ChartHub) handleUnsubscribe(req *unsubscribeRequest) {
	h.mu.Lock()
	defer h.mu.Unlock()

	subscriber, ok := h.subscribers[req.subscriberID]
	if !ok {
		return
	}

	if req.chartID == "" {
		// Unsubscribe from all charts
		for chartID := range subscriber.ChartIDs {
			if subs := h.chartSubscriptions[chartID]; subs != nil {
				delete(subs, req.subscriberID)
				if len(subs) == 0 {
					delete(h.chartSubscriptions, chartID)
				}
			}
		}
		// Unregister from client registry
		if subscriber.ClientRegistryID > 0 {
			clientRegistry := registry.GetClientRegistry()
			clientRegistry.Unregister(subscriber.ClientRegistryID)
		}
		delete(h.subscribers, req.subscriberID)
		fmt.Printf("[ChartHub] Subscriber %s unsubscribed from all charts\n", req.subscriberID)
	} else {
		// Unsubscribe from specific chart
		delete(subscriber.ChartIDs, req.chartID)
		if subs := h.chartSubscriptions[req.chartID]; subs != nil {
			delete(subs, req.subscriberID)
			if len(subs) == 0 {
				delete(h.chartSubscriptions, req.chartID)
			}
		}
		// If subscriber has no more subscriptions, remove them
		if len(subscriber.ChartIDs) == 0 {
			// Unregister from client registry
			if subscriber.ClientRegistryID > 0 {
				clientRegistry := registry.GetClientRegistry()
				clientRegistry.Unregister(subscriber.ClientRegistryID)
			}
			delete(h.subscribers, req.subscriberID)
		}
		fmt.Printf("[ChartHub] Subscriber %s unsubscribed from chart %s\n", req.subscriberID, req.chartID)
	}
}

// handleBroadcast processes a broadcast request
func (h *ChartHub) handleBroadcast(req *broadcastRequest) {
	h.mu.RLock()
	subscriberIDs := make([]string, 0)
	if subs := h.chartSubscriptions[req.chartID]; subs != nil {
		for subID := range subs {
			subscriberIDs = append(subscriberIDs, subID)
		}
	}
	h.mu.RUnlock()

	if len(subscriberIDs) == 0 {
		fmt.Printf("[ChartHub] No subscribers for chart %s\n", req.chartID)
		return
	}

	// Build the event message
	event := &models.AIEvent{
		Type: models.AIEventTypeChartUpdate,
		Data: models.AIChartUpdateEvent{
			Chart: req.chart,
		},
		Timestamp: time.Now(),
	}

	data, err := json.Marshal(event)
	if err != nil {
		fmt.Printf("[ChartHub] Error marshaling chart update: %v\n", err)
		return
	}

	fmt.Printf("[ChartHub] Broadcasting chart %s update to %d subscribers\n", req.chartID, len(subscriberIDs))

	// Send to all subscribers
	h.mu.RLock()
	for _, subID := range subscriberIDs {
		if subscriber, ok := h.subscribers[subID]; ok {
			if err := subscriber.Send(data); err != nil {
				fmt.Printf("[ChartHub] Error sending to subscriber %s: %v\n", subID, err)
				// Queue unsubscribe for failed connection
				go h.UnsubscribeAll(subID)
			}
		}
	}
	h.mu.RUnlock()
}

// GetSubscriberCount returns the number of subscribers for a chart
func (h *ChartHub) GetSubscriberCount(chartID string) int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	if subs := h.chartSubscriptions[chartID]; subs != nil {
		return len(subs)
	}
	return 0
}

// GetTotalSubscribers returns the total number of unique subscribers
func (h *ChartHub) GetTotalSubscribers() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.subscribers)
}
