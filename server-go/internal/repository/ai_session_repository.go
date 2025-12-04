package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/tviviano/dashboard/internal/models"
)

const (
	// Redis key prefixes
	aiSessionPrefix     = "ai_session:"
	aiSessionByChartKey = "ai_session_by_chart:" // Maps chart_id to session_id

	// Default TTL for sessions (24 hours)
	defaultSessionTTL = 24 * time.Hour
)

// AISessionRepository handles AI session storage in Redis
type AISessionRepository struct {
	client *redis.Client
}

// NewAISessionRepository creates a new AI session repository
func NewAISessionRepository(client *redis.Client) *AISessionRepository {
	return &AISessionRepository{
		client: client,
	}
}

// sessionKey returns the Redis key for a session
func sessionKey(id string) string {
	return aiSessionPrefix + id
}

// chartSessionKey returns the Redis key for chart -> session mapping
func chartSessionKey(chartID string) string {
	return aiSessionByChartKey + chartID
}

// Create creates a new AI session
func (r *AISessionRepository) Create(ctx context.Context, session *models.AISession) error {
	if session.ID == "" {
		session.ID = uuid.New().String()
	}
	now := time.Now()
	session.Created = now
	session.Updated = now
	if session.Status == "" {
		session.Status = models.AISessionStatusActive
	}
	if session.Messages == nil {
		session.Messages = []models.AIMessage{}
	}

	data, err := json.Marshal(session)
	if err != nil {
		return fmt.Errorf("failed to marshal session: %w", err)
	}

	// Store session
	if err := r.client.Set(ctx, sessionKey(session.ID), data, defaultSessionTTL).Err(); err != nil {
		return fmt.Errorf("failed to store session: %w", err)
	}

	// Store chart -> session mapping (for quick lookup)
	if session.ChartID != "" {
		if err := r.client.Set(ctx, chartSessionKey(session.ChartID), session.ID, defaultSessionTTL).Err(); err != nil {
			return fmt.Errorf("failed to store chart-session mapping: %w", err)
		}
	}

	return nil
}

// FindByID retrieves a session by ID
func (r *AISessionRepository) FindByID(ctx context.Context, id string) (*models.AISession, error) {
	data, err := r.client.Get(ctx, sessionKey(id)).Bytes()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get session: %w", err)
	}

	var session models.AISession
	if err := json.Unmarshal(data, &session); err != nil {
		return nil, fmt.Errorf("failed to unmarshal session: %w", err)
	}

	return &session, nil
}

// FindByChartID retrieves the active session for a chart
func (r *AISessionRepository) FindByChartID(ctx context.Context, chartID string) (*models.AISession, error) {
	sessionID, err := r.client.Get(ctx, chartSessionKey(chartID)).Result()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get session ID for chart: %w", err)
	}

	return r.FindByID(ctx, sessionID)
}

// Update updates an existing session
func (r *AISessionRepository) Update(ctx context.Context, session *models.AISession) error {
	session.Updated = time.Now()

	data, err := json.Marshal(session)
	if err != nil {
		return fmt.Errorf("failed to marshal session: %w", err)
	}

	// Get remaining TTL
	ttl, err := r.client.TTL(ctx, sessionKey(session.ID)).Result()
	if err != nil || ttl <= 0 {
		ttl = defaultSessionTTL
	}

	if err := r.client.Set(ctx, sessionKey(session.ID), data, ttl).Err(); err != nil {
		return fmt.Errorf("failed to update session: %w", err)
	}

	return nil
}

// Delete removes a session
func (r *AISessionRepository) Delete(ctx context.Context, id string) error {
	// Get session first to clean up chart mapping
	session, err := r.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if session == nil {
		return nil
	}

	// Delete chart -> session mapping
	if session.ChartID != "" {
		r.client.Del(ctx, chartSessionKey(session.ChartID))
	}

	// Delete session
	if err := r.client.Del(ctx, sessionKey(id)).Err(); err != nil {
		return fmt.Errorf("failed to delete session: %w", err)
	}

	return nil
}

// AddMessage adds a message to a session
func (r *AISessionRepository) AddMessage(ctx context.Context, sessionID string, message *models.AIMessage) error {
	session, err := r.FindByID(ctx, sessionID)
	if err != nil {
		return err
	}
	if session == nil {
		return fmt.Errorf("session not found")
	}

	if message.ID == "" {
		message.ID = uuid.New().String()
	}
	if message.Timestamp.IsZero() {
		message.Timestamp = time.Now()
	}

	session.Messages = append(session.Messages, *message)
	return r.Update(ctx, session)
}

// UpdateStatus updates the session status
func (r *AISessionRepository) UpdateStatus(ctx context.Context, sessionID string, status string) error {
	session, err := r.FindByID(ctx, sessionID)
	if err != nil {
		return err
	}
	if session == nil {
		return fmt.Errorf("session not found")
	}

	session.Status = status
	return r.Update(ctx, session)
}

// RefreshTTL extends the session TTL
func (r *AISessionRepository) RefreshTTL(ctx context.Context, sessionID string) error {
	if err := r.client.Expire(ctx, sessionKey(sessionID), defaultSessionTTL).Err(); err != nil {
		return fmt.Errorf("failed to refresh TTL: %w", err)
	}
	return nil
}

// ListActive returns all active sessions (for admin/monitoring)
func (r *AISessionRepository) ListActive(ctx context.Context) ([]models.AISession, error) {
	// Scan for all session keys
	var sessions []models.AISession
	var cursor uint64

	for {
		keys, nextCursor, err := r.client.Scan(ctx, cursor, aiSessionPrefix+"*", 100).Result()
		if err != nil {
			return nil, fmt.Errorf("failed to scan sessions: %w", err)
		}

		for _, key := range keys {
			data, err := r.client.Get(ctx, key).Bytes()
			if err != nil {
				continue
			}

			var session models.AISession
			if err := json.Unmarshal(data, &session); err != nil {
				continue
			}

			if session.Status == models.AISessionStatusActive {
				sessions = append(sessions, session)
			}
		}

		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}

	return sessions, nil
}
