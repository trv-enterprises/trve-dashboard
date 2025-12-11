package streaming

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/tviviano/dashboard/internal/models"
	"github.com/tviviano/dashboard/internal/repository"
)

// Manager orchestrates multiple streaming connections
type Manager struct {
	streams      map[string]*Stream
	mu           sync.RWMutex
	repo         *repository.DatasourceRepository
	config       ManagerConfig
	ctx          context.Context
	cancelFunc   context.CancelFunc
}

// ManagerConfig holds configuration for the stream manager
type ManagerConfig struct {
	BufferSize          int           // Records to buffer per stream (default 100)
	CleanupGracePeriod  time.Duration // Time to keep stream alive with no subscribers (default 60s)
	CleanupInterval     time.Duration // How often to check for cleanup (default 30s)
}

// DefaultManagerConfig returns default manager configuration
func DefaultManagerConfig() ManagerConfig {
	return ManagerConfig{
		BufferSize:          100,
		CleanupGracePeriod:  60 * time.Second,
		CleanupInterval:     30 * time.Second,
	}
}

// NewManager creates a new stream manager
func NewManager(repo *repository.DatasourceRepository, config ManagerConfig) *Manager {
	ctx, cancel := context.WithCancel(context.Background())

	m := &Manager{
		streams:    make(map[string]*Stream),
		repo:       repo,
		config:     config,
		ctx:        ctx,
		cancelFunc: cancel,
	}

	// Start cleanup goroutine
	go m.cleanupLoop()

	return m
}

// SubscribeAndGetChannel creates or gets a stream for the datasource and returns a bidirectional channel
// This is useful when the caller needs to pass the channel to Unsubscribe later
func (m *Manager) SubscribeAndGetChannel(ctx context.Context, datasourceID string) chan models.Record {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Check if stream already exists
	stream, exists := m.streams[datasourceID]
	if exists {
		return stream.Subscribe()
	}

	// Get datasource config from repository
	ds, err := m.repo.FindByID(ctx, datasourceID)
	if err != nil {
		log.Printf("[StreamManager] Failed to get datasource: %v", err)
		return nil
	}
	if ds == nil {
		log.Printf("[StreamManager] Datasource not found: %s", datasourceID)
		return nil
	}

	// Verify it's a socket datasource
	if ds.Type != models.DatasourceTypeSocket {
		log.Printf("[StreamManager] Datasource %s is not a socket type (got: %s)", datasourceID, ds.Type)
		return nil
	}

	if ds.Config.Socket == nil {
		log.Printf("[StreamManager] Datasource %s has no socket configuration", datasourceID)
		return nil
	}

	// Create new stream
	streamConfig := StreamConfig{
		BufferSize: m.config.BufferSize,
	}
	stream = NewStream(datasourceID, ds.Config.Socket, streamConfig)

	// Start the stream
	if err := stream.Start(m.ctx); err != nil {
		log.Printf("[StreamManager] Failed to start stream: %v", err)
		return nil
	}

	// Store the stream
	m.streams[datasourceID] = stream

	log.Printf("[StreamManager] Created stream for datasource %s", datasourceID)

	return stream.Subscribe()
}

// Subscribe creates or gets a stream for the datasource and returns a subscriber channel
func (m *Manager) Subscribe(ctx context.Context, datasourceID string) (<-chan models.Record, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Check if stream already exists
	stream, exists := m.streams[datasourceID]
	if exists {
		return stream.Subscribe(), nil
	}

	// Get datasource config from repository
	ds, err := m.repo.FindByID(ctx, datasourceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get datasource: %w", err)
	}
	if ds == nil {
		return nil, fmt.Errorf("datasource not found: %s", datasourceID)
	}

	// Verify it's a socket datasource
	if ds.Type != models.DatasourceTypeSocket {
		return nil, fmt.Errorf("datasource %s is not a socket type (got: %s)", datasourceID, ds.Type)
	}

	if ds.Config.Socket == nil {
		return nil, fmt.Errorf("datasource %s has no socket configuration", datasourceID)
	}

	// Create new stream
	streamConfig := StreamConfig{
		BufferSize: m.config.BufferSize,
	}
	stream = NewStream(datasourceID, ds.Config.Socket, streamConfig)

	// Start the stream
	if err := stream.Start(m.ctx); err != nil {
		return nil, fmt.Errorf("failed to start stream: %w", err)
	}

	// Store the stream
	m.streams[datasourceID] = stream

	log.Printf("[StreamManager] Created stream for datasource %s", datasourceID)

	return stream.Subscribe(), nil
}

// Unsubscribe removes a subscriber from a stream
// Note: The caller must pass a bidirectional channel that was returned by Subscribe()
func (m *Manager) Unsubscribe(datasourceID string, ch chan models.Record) {
	m.mu.RLock()
	stream, exists := m.streams[datasourceID]
	m.mu.RUnlock()

	if !exists {
		return
	}

	stream.Unsubscribe(ch)
}

// GetBuffer returns the buffered records for a datasource
func (m *Manager) GetBuffer(datasourceID string) []models.Record {
	m.mu.RLock()
	stream, exists := m.streams[datasourceID]
	m.mu.RUnlock()

	if !exists {
		return []models.Record{}
	}

	return stream.GetBuffer()
}

// GetStreamStatus returns status information for a stream
func (m *Manager) GetStreamStatus(datasourceID string) *StreamStatus {
	m.mu.RLock()
	stream, exists := m.streams[datasourceID]
	m.mu.RUnlock()

	if !exists {
		return nil
	}

	return &StreamStatus{
		DatasourceID:    datasourceID,
		Connected:       stream.IsConnected(),
		SubscriberCount: stream.SubscriberCount(),
		BufferCount:     stream.buffer.Count(),
		LastError:       stream.LastError(),
	}
}

// StreamStatus contains status information for a stream
type StreamStatus struct {
	DatasourceID    string
	Connected       bool
	SubscriberCount int
	BufferCount     int
	LastError       error
}

// ListStreams returns a list of active stream IDs
func (m *Manager) ListStreams() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	ids := make([]string, 0, len(m.streams))
	for id := range m.streams {
		ids = append(ids, id)
	}
	return ids
}

// cleanupLoop periodically checks for streams with no subscribers and removes them
func (m *Manager) cleanupLoop() {
	ticker := time.NewTicker(m.config.CleanupInterval)
	defer ticker.Stop()

	// Track when streams became idle (no subscribers)
	idleSince := make(map[string]time.Time)

	for {
		select {
		case <-m.ctx.Done():
			return
		case <-ticker.C:
			m.mu.Lock()
			now := time.Now()

			for id, stream := range m.streams {
				if stream.SubscriberCount() == 0 {
					// No subscribers - track or cleanup
					if since, exists := idleSince[id]; exists {
						if now.Sub(since) > m.config.CleanupGracePeriod {
							// Grace period exceeded, cleanup
							log.Printf("[StreamManager] Cleaning up idle stream %s", id)
							stream.Stop()
							delete(m.streams, id)
							delete(idleSince, id)
						}
					} else {
						// Start tracking idle time
						idleSince[id] = now
						log.Printf("[StreamManager] Stream %s has no subscribers, will cleanup in %v", id, m.config.CleanupGracePeriod)
					}
				} else {
					// Has subscribers, remove from idle tracking
					delete(idleSince, id)
				}
			}

			m.mu.Unlock()
		}
	}
}

// Stop stops the manager and all streams
func (m *Manager) Stop() {
	m.cancelFunc()

	m.mu.Lock()
	defer m.mu.Unlock()

	for id, stream := range m.streams {
		log.Printf("[StreamManager] Stopping stream %s", id)
		stream.Stop()
	}

	m.streams = make(map[string]*Stream)
	log.Println("[StreamManager] Stopped")
}

// IsSocketDatasource checks if a datasource is a socket type
func (m *Manager) IsSocketDatasource(ctx context.Context, datasourceID string) (bool, error) {
	ds, err := m.repo.FindByID(ctx, datasourceID)
	if err != nil {
		return false, err
	}
	if ds == nil {
		return false, fmt.Errorf("datasource not found")
	}
	return ds.Type == models.DatasourceTypeSocket, nil
}
