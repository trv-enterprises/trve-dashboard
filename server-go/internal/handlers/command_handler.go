// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/tviviano/dashboard/internal/models"
	"github.com/tviviano/dashboard/internal/registry"
	"github.com/tviviano/dashboard/internal/service"
)

// CommandHandler handles command execution for bidirectional datasources and controls
type CommandHandler struct {
	datasourceService *service.DatasourceService
	chartService      *service.ChartService
}

// NewCommandHandler creates a new command handler
func NewCommandHandler(datasourceService *service.DatasourceService, chartService *service.ChartService) *CommandHandler {
	return &CommandHandler{
		datasourceService: datasourceService,
		chartService:      chartService,
	}
}

// ExecuteCommandRequest represents a command to execute
type ExecuteCommandRequest struct {
	Action  string                 `json:"action" binding:"required"`
	Target  string                 `json:"target,omitempty"`
	Payload map[string]interface{} `json:"payload,omitempty"`
}

// ExecuteCommandResponse represents the command execution result
type ExecuteCommandResponse struct {
	Success   bool                   `json:"success"`
	Message   string                 `json:"message,omitempty"`
	Data      map[string]interface{} `json:"data,omitempty"`
	Timestamp string                 `json:"timestamp"`
}

// ExecuteCommand godoc
// @Summary Execute a command on a bidirectional datasource
// @Description Send a command to a datasource that supports write operations (e.g., stream.websocket-bidir)
// @Tags datasources
// @Accept json
// @Produce json
// @Param id path string true "Datasource ID"
// @Param command body ExecuteCommandRequest true "Command to execute"
// @Success 200 {object} ExecuteCommandResponse
// @Failure 400 {object} map[string]interface{} "Bad request - connection does not support write"
// @Failure 404 {object} map[string]interface{} "Datasource not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/datasources/{id}/command [post]
func (h *CommandHandler) ExecuteCommand(c *gin.Context) {
	id := c.Param("id")

	var req ExecuteCommandRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get the datasource
	datasource, err := h.datasourceService.GetDatasource(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "datasource not found"})
		return
	}

	// Create adapter from datasource
	adapter, err := h.datasourceService.CreateAdapter(c.Request.Context(), datasource)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer adapter.Close()

	// Check if adapter supports write
	if !adapter.Capabilities().CanWrite {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "connection does not support write operations",
			"type_id": adapter.TypeID(),
			"hint":    "Use a bidirectional connection type (e.g., stream.websocket-bidir)",
		})
		return
	}

	// Connect first
	if err := adapter.Connect(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to connect: " + err.Error()})
		return
	}

	// Execute the command
	cmd := registry.Command{
		Action:  req.Action,
		Target:  req.Target,
		Payload: req.Payload,
	}

	result, err := adapter.Write(c.Request.Context(), cmd)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, ExecuteCommandResponse{
		Success:   result.Success,
		Message:   result.Message,
		Data:      result.Data,
		Timestamp: result.Timestamp.Format("2006-01-02T15:04:05Z07:00"),
	})
}

// ExecuteControlRequest represents a control execution request
type ExecuteControlRequest struct {
	Value interface{} `json:"value"` // The value from the control (bool, number, string, or null for buttons)
}

// ExecuteControlCommand godoc
// @Summary Execute a control component command
// @Description Executes the command configured on a control component, interpolating the value into the payload template
// @Tags controls
// @Accept json
// @Produce json
// @Param id path string true "Control (Chart) ID"
// @Param request body ExecuteControlRequest true "Control value"
// @Success 200 {object} ExecuteCommandResponse
// @Failure 400 {object} map[string]interface{} "Bad request - not a control or missing connection"
// @Failure 404 {object} map[string]interface{} "Control not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/controls/{id}/execute [post]
func (h *CommandHandler) ExecuteControlCommand(c *gin.Context) {
	controlID := c.Param("id")

	var req ExecuteControlRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get the control (stored as a chart with component_type="control")
	chart, err := h.chartService.GetChart(c.Request.Context(), controlID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "control not found"})
		return
	}

	// Validate it's a control type
	if chart.ComponentType != models.ComponentTypeControl {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":          "component is not a control",
			"component_type": chart.ComponentType,
		})
		return
	}

	// Validate control has configuration
	if chart.ControlConfig == nil || chart.ControlConfig.CommandConfig == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "control has no command configuration"})
		return
	}

	// Validate connection is set
	if chart.DatasourceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "control has no connection configured"})
		return
	}

	// Get the connection
	datasource, err := h.datasourceService.GetDatasource(c.Request.Context(), chart.DatasourceID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "connection not found"})
		return
	}

	// Create adapter
	adapter, err := h.datasourceService.CreateAdapter(c.Request.Context(), datasource)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer adapter.Close()

	// Check if adapter supports write
	if !adapter.Capabilities().CanWrite {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "connection does not support write operations",
			"type_id": adapter.TypeID(),
			"hint":    "Use a bidirectional connection type (e.g., stream.websocket-bidir)",
		})
		return
	}

	// Connect
	if err := adapter.Connect(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to connect: " + err.Error()})
		return
	}

	// Build payload by interpolating {{value}} in the template
	cmdConfig := chart.ControlConfig.CommandConfig
	payload := interpolatePayload(cmdConfig.PayloadTemplate, req.Value)

	// Execute the command
	cmd := registry.Command{
		Action:  cmdConfig.Action,
		Target:  cmdConfig.Target,
		Payload: payload,
	}

	result, err := adapter.Write(c.Request.Context(), cmd)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, ExecuteCommandResponse{
		Success:   result.Success,
		Message:   result.Message,
		Data:      result.Data,
		Timestamp: result.Timestamp.Format("2006-01-02T15:04:05Z07:00"),
	})
}

// interpolatePayload replaces {{value}} placeholders in the payload template with the actual value
func interpolatePayload(template map[string]interface{}, value interface{}) map[string]interface{} {
	if template == nil {
		// If no template, just return the value as-is
		return map[string]interface{}{"value": value}
	}

	result := make(map[string]interface{})
	for key, val := range template {
		result[key] = interpolateValue(val, value)
	}
	return result
}

// interpolateValue recursively replaces {{value}} in nested structures
func interpolateValue(templateVal interface{}, value interface{}) interface{} {
	switch v := templateVal.(type) {
	case string:
		// Check if the entire string is "{{value}}"
		if v == "{{value}}" {
			return value
		}
		// Check if string contains {{value}} as a substring
		if strings.Contains(v, "{{value}}") {
			// Convert value to string for interpolation
			valueStr := valueToString(value)
			return strings.ReplaceAll(v, "{{value}}", valueStr)
		}
		return v
	case map[string]interface{}:
		// Recursively process nested maps
		result := make(map[string]interface{})
		for k, nestedVal := range v {
			result[k] = interpolateValue(nestedVal, value)
		}
		return result
	case []interface{}:
		// Recursively process arrays
		result := make([]interface{}, len(v))
		for i, item := range v {
			result[i] = interpolateValue(item, value)
		}
		return result
	default:
		return v
	}
}

// valueToString converts a value to its string representation
func valueToString(value interface{}) string {
	if value == nil {
		return "null"
	}
	switch v := value.(type) {
	case string:
		return v
	case bool:
		if v {
			return "true"
		}
		return "false"
	case float64:
		return fmt.Sprintf("%g", v)
	case int:
		return fmt.Sprintf("%d", v)
	default:
		// For complex types, use JSON encoding
		bytes, _ := json.Marshal(v)
		return string(bytes)
	}
}
