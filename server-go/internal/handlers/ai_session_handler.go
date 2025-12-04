package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tviviano/dashboard/internal/models"
	"github.com/tviviano/dashboard/internal/service"
)

// AISessionHandler handles AI session-related HTTP requests
type AISessionHandler struct {
	service *service.AISessionService
}

// NewAISessionHandler creates a new AI session handler
func NewAISessionHandler(service *service.AISessionService) *AISessionHandler {
	return &AISessionHandler{
		service: service,
	}
}

// CreateSession creates a new AI session
// @Summary Create a new AI session
// @Description Create a new AI session for chart creation or editing. Creates a chart draft.
// @Tags ai
// @Accept json
// @Produce json
// @Param request body models.CreateAISessionRequest true "Session creation request"
// @Success 201 {object} models.AISessionResponse
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /ai/sessions [post]
func (h *AISessionHandler) CreateSession(c *gin.Context) {
	var req models.CreateAISessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	response, err := h.service.CreateSession(c.Request.Context(), &req)
	if err != nil {
		status := http.StatusInternalServerError
		if strings.Contains(err.Error(), "not found") {
			status = http.StatusNotFound
		} else if strings.Contains(err.Error(), "already has an active AI session") {
			status = http.StatusConflict
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, response)
}

// GetSession retrieves a session by ID
// @Summary Get AI session
// @Description Get an AI session by ID with current chart state
// @Tags ai
// @Produce json
// @Param id path string true "Session ID"
// @Success 200 {object} models.AISessionResponse
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /ai/sessions/{id} [get]
func (h *AISessionHandler) GetSession(c *gin.Context) {
	id := c.Param("id")

	response, err := h.service.GetSession(c.Request.Context(), id)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, gin.H{"error": "Session not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
}

// SendMessage sends a user message to the session
// @Summary Send message to AI session
// @Description Send a user message to an AI session
// @Tags ai
// @Accept json
// @Produce json
// @Param id path string true "Session ID"
// @Param request body models.SendMessageRequest true "Message content"
// @Success 200 {object} models.AIMessage
// @Failure 400 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /ai/sessions/{id}/messages [post]
func (h *AISessionHandler) SendMessage(c *gin.Context) {
	id := c.Param("id")

	var req models.SendMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	message, err := h.service.AddMessage(c.Request.Context(), id, req.Content)
	if err != nil {
		status := http.StatusInternalServerError
		if strings.Contains(err.Error(), "not found") {
			status = http.StatusNotFound
		} else if strings.Contains(err.Error(), "not active") {
			status = http.StatusBadRequest
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, message)
}

// StreamEvents provides SSE stream for session updates
// @Summary Subscribe to AI session events
// @Description Subscribe to real-time updates for an AI session via Server-Sent Events
// @Tags ai
// @Produce text/event-stream
// @Param id path string true "Session ID"
// @Success 200 {string} string "SSE stream"
// @Failure 404 {object} map[string]interface{}
// @Router /ai/sessions/{id}/events [get]
func (h *AISessionHandler) StreamEvents(c *gin.Context) {
	id := c.Param("id")

	// Verify session exists
	response, err := h.service.GetSession(c.Request.Context(), id)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, gin.H{"error": "Session not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Check if session is still active
	if response.Session.Status != models.AISessionStatusActive {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Session is not active"})
		return
	}

	// Set headers for SSE
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Access-Control-Allow-Origin", "*")
	c.Header("X-Accel-Buffering", "no")

	// Register client
	client := h.service.RegisterClient(id)
	defer h.service.UnregisterClient(client)

	// Send initial connection event
	h.sendSSEEvent(c.Writer, "connected", map[string]interface{}{
		"session_id": id,
		"timestamp":  time.Now(),
	})
	c.Writer.Flush()

	// Keep-alive ticker
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	// Stream events
	for {
		select {
		case event := <-client.Events:
			h.sendSSEEvent(c.Writer, event.Type, event)
			c.Writer.Flush()

		case <-ticker.C:
			// Send keep-alive ping
			h.sendSSEEvent(c.Writer, "ping", map[string]interface{}{
				"timestamp": time.Now(),
			})
			c.Writer.Flush()

		case <-client.Done:
			// Session closed
			return

		case <-c.Request.Context().Done():
			// Client disconnected
			return
		}
	}
}

// sendSSEEvent sends a single SSE event
func (h *AISessionHandler) sendSSEEvent(w io.Writer, eventType string, data interface{}) {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return
	}
	fmt.Fprintf(w, "event: %s\n", eventType)
	fmt.Fprintf(w, "data: %s\n\n", jsonData)
}

// SaveSession publishes the draft as final
// @Summary Save AI session (publish draft)
// @Description Save the AI session by publishing the draft as a new final version
// @Tags ai
// @Produce json
// @Param id path string true "Session ID"
// @Success 200 {object} models.Chart
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /ai/sessions/{id}/save [post]
func (h *AISessionHandler) SaveSession(c *gin.Context) {
	id := c.Param("id")

	chart, err := h.service.SaveSession(c.Request.Context(), id)
	if err != nil {
		status := http.StatusInternalServerError
		if strings.Contains(err.Error(), "not found") {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, chart)
}

// CancelSession discards the draft and ends the session
// @Summary Cancel AI session
// @Description Cancel the AI session and discard the draft
// @Tags ai
// @Param id path string true "Session ID"
// @Success 204
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /ai/sessions/{id} [delete]
func (h *AISessionHandler) CancelSession(c *gin.Context) {
	id := c.Param("id")

	err := h.service.CancelSession(c.Request.Context(), id)
	if err != nil {
		status := http.StatusInternalServerError
		if strings.Contains(err.Error(), "not found") {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}
