package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/tviviano/dashboard/internal/ai"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for debug endpoint
	},
}

// DebugHandler handles WebSocket connections for AI debug streaming
type DebugHandler struct{}

// NewDebugHandler creates a new debug handler
func NewDebugHandler() *DebugHandler {
	return &DebugHandler{}
}

// HandleDebugWebSocket handles WebSocket connections for debug streaming
// @Summary Connect to AI debug WebSocket
// @Description Stream real-time debug events from the AI agent including LLM requests, responses, and tool calls
// @Tags debug
// @Produce json
// @Success 101 {string} string "Switching Protocols"
// @Router /api/ai/debug [get]
func (h *DebugHandler) HandleDebugWebSocket(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to upgrade to WebSocket"})
		return
	}

	// Get the debug hub and register this connection
	hub := ai.GetDebugHub()
	hub.Register(conn)

	// Send welcome message
	conn.WriteJSON(map[string]interface{}{
		"type":    "connected",
		"message": "Connected to AI debug stream",
		"clients": hub.ClientCount(),
	})

	// Keep the connection open and handle incoming messages (if any)
	go func() {
		defer hub.Unregister(conn)
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				break
			}
			// We don't process incoming messages, just keep connection alive
		}
	}()
}

// GetDebugStatus returns the current debug hub status
// @Summary Get debug status
// @Description Get the current status of the AI debug system
// @Tags debug
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /api/ai/debug/status [get]
func (h *DebugHandler) GetDebugStatus(c *gin.Context) {
	hub := ai.GetDebugHub()
	c.JSON(http.StatusOK, gin.H{
		"enabled":      true,
		"clients":      hub.ClientCount(),
		"websocket_url": "/api/ai/debug",
	})
}
