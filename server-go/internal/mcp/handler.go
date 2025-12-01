package mcp

import (
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// Handler handles MCP SSE connections and messages
type Handler struct {
	registry *ToolRegistry
	clients  sync.Map // map[string]*sseClient
}

type sseClient struct {
	id       string
	response gin.ResponseWriter
	done     chan struct{}
}

// NewHandler creates a new MCP handler
func NewHandler(registry *ToolRegistry) *Handler {
	return &Handler{
		registry: registry,
	}
}

// SSEConnect handles the SSE connection endpoint
// @Summary MCP SSE Connection
// @Description Establish an SSE connection for MCP protocol
// @Tags MCP
// @Produce text/event-stream
// @Success 200 {string} string "SSE stream"
// @Router /mcp/sse [get]
func (h *Handler) SSEConnect(c *gin.Context) {
	// Set SSE headers
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Access-Control-Allow-Origin", "*")
	c.Header("X-Accel-Buffering", "no") // Disable nginx buffering

	// Generate client ID
	clientID := fmt.Sprintf("client_%d_%s", time.Now().UnixNano(), randomString(9))

	// Create client
	client := &sseClient{
		id:       clientID,
		response: c.Writer,
		done:     make(chan struct{}),
	}

	// Store client
	h.clients.Store(clientID, client)
	defer func() {
		h.clients.Delete(clientID)
		close(client.done)
		log.Printf("[MCP] SSE client disconnected: %s", clientID)
	}()

	log.Printf("[MCP] SSE client connected: %s", clientID)

	// Send initial connection message
	h.sendSSEMessage(c.Writer, SSEMessage{
		JSONRPC: "2.0",
		Method:  "connection.established",
		Params: map[string]interface{}{
			"clientId": clientID,
			"serverInfo": map[string]interface{}{
				"name":    "GiVi-Solution MCP Server",
				"version": "1.0.0",
				"capabilities": map[string]interface{}{
					"tools":       true,
					"datasources": true,
					"dashboards":  true,
				},
			},
		},
	})

	// Flush to ensure message is sent
	c.Writer.Flush()

	// Keep connection alive until client disconnects
	<-c.Request.Context().Done()
}

// HandleMessage handles JSON-RPC messages from clients
// @Summary Handle MCP Message
// @Description Process a JSON-RPC message for MCP protocol
// @Tags MCP
// @Accept json
// @Produce json
// @Param message body JSONRPCRequest true "JSON-RPC request"
// @Success 200 {object} JSONRPCResponse
// @Failure 400 {object} JSONRPCResponse
// @Failure 500 {object} JSONRPCResponse
// @Router /mcp/message [post]
func (h *Handler) HandleMessage(c *gin.Context) {
	var req JSONRPCRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, JSONRPCResponse{
			JSONRPC: "2.0",
			ID:      nil,
			Error: &JSONRPCError{
				Code:    ParseError,
				Message: fmt.Sprintf("Failed to parse request: %v", err),
			},
		})
		return
	}

	log.Printf("[MCP] Received request: method=%s, id=%v", req.Method, req.ID)

	if req.JSONRPC != "2.0" {
		c.JSON(http.StatusBadRequest, JSONRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error: &JSONRPCError{
				Code:    InvalidRequest,
				Message: "Invalid JSON-RPC version",
			},
		})
		return
	}

	var result interface{}
	var err error

	switch req.Method {
	case "initialize":
		result = h.handleInitialize(req.Params)
	case "tools/list":
		result = h.handleToolsList()
	case "tools/call":
		result, err = h.handleToolsCall(req.Params)
	default:
		c.JSON(http.StatusBadRequest, JSONRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error: &JSONRPCError{
				Code:    MethodNotFound,
				Message: fmt.Sprintf("Method not found: %s", req.Method),
			},
		})
		return
	}

	if err != nil {
		log.Printf("[MCP] Error handling %s: %v", req.Method, err)
		c.JSON(http.StatusInternalServerError, JSONRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error: &JSONRPCError{
				Code:    InternalError,
				Message: err.Error(),
			},
		})
		return
	}

	log.Printf("[MCP] Sending success response for %s", req.Method)
	c.JSON(http.StatusOK, JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      req.ID,
		Result:  result,
	})
}

// handleInitialize handles the initialize method
func (h *Handler) handleInitialize(params map[string]interface{}) InitializeResult {
	return InitializeResult{
		ProtocolVersion: "2024-11-05",
		ServerInfo: ServerInfo{
			Name:    "GiVi-Solution MCP Server",
			Version: "1.0.0",
		},
		Capabilities: Capabilities{
			Tools: map[string]interface{}{},
		},
	}
}

// handleToolsList handles the tools/list method
func (h *Handler) handleToolsList() ToolsListResult {
	return ToolsListResult{
		Tools: h.registry.GetTools(),
	}
}

// handleToolsCall handles the tools/call method
func (h *Handler) handleToolsCall(params map[string]interface{}) (interface{}, error) {
	name, ok := params["name"].(string)
	if !ok {
		return nil, fmt.Errorf("tool name is required")
	}

	args, _ := params["arguments"].(map[string]interface{})
	if args == nil {
		args = make(map[string]interface{})
	}

	log.Printf("[MCP] Calling tool: %s with args: %v", name, args)
	result, err := h.registry.CallTool(name, args)
	if err != nil {
		return nil, err
	}

	// Format result as content array per MCP spec
	return map[string]interface{}{
		"content": []map[string]interface{}{
			{
				"type": "text",
				"text": toJSON(result),
			},
		},
	}, nil
}

// sendSSEMessage sends an SSE message to the client
func (h *Handler) sendSSEMessage(w gin.ResponseWriter, msg SSEMessage) {
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("[MCP] Error marshaling SSE message: %v", err)
		return
	}

	fmt.Fprintf(w, "data: %s\n\n", data)
}

// Broadcast sends a message to all connected clients
func (h *Handler) Broadcast(msg SSEMessage) {
	h.clients.Range(func(key, value interface{}) bool {
		client := value.(*sseClient)
		h.sendSSEMessage(client.response, msg)
		client.response.Flush()
		return true
	})
}

// Helper functions

func randomString(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}

func toJSON(v interface{}) string {
	data, err := json.Marshal(v)
	if err != nil {
		return fmt.Sprintf("%v", v)
	}
	return string(data)
}

// SetupRoutes configures MCP routes on the given router group
func (h *Handler) SetupRoutes(router *gin.RouterGroup) {
	mcp := router.Group("/mcp")
	{
		mcp.GET("/sse", h.SSEConnect)
		mcp.POST("/message", h.HandleMessage)
	}
}
