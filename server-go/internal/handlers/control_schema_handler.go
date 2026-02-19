// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/tviviano/dashboard/internal/models"
	"github.com/tviviano/dashboard/internal/service"
)

// ControlSchemaHandler handles control schema HTTP requests
type ControlSchemaHandler struct {
	service *service.ControlSchemaService
}

// NewControlSchemaHandler creates a new control schema handler
func NewControlSchemaHandler(service *service.ControlSchemaService) *ControlSchemaHandler {
	return &ControlSchemaHandler{
		service: service,
	}
}

// CreateSchema creates a new control schema
// @Summary Create a new control schema
// @Description Create a new control schema defining how controls communicate with connections
// @Tags control-schemas
// @Accept json
// @Produce json
// @Param schema body models.CreateControlSchemaRequest true "Schema data"
// @Success 201 {object} models.ControlSchema
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /control-schemas [post]
func (h *ControlSchemaHandler) CreateSchema(c *gin.Context) {
	var req models.CreateControlSchemaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	schema, err := h.service.CreateSchema(c.Request.Context(), &req)
	if err != nil {
		status := http.StatusInternalServerError
		if strings.Contains(err.Error(), "already exists") ||
			strings.Contains(err.Error(), "invalid control type") ||
			strings.Contains(err.Error(), "not in supported_types") {
			status = http.StatusBadRequest
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, schema)
}

// GetSchema retrieves a control schema by ID
// @Summary Get a control schema
// @Description Get a control schema by its ID
// @Tags control-schemas
// @Produce json
// @Param id path string true "Schema ID"
// @Success 200 {object} models.ControlSchema
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /control-schemas/{id} [get]
func (h *ControlSchemaHandler) GetSchema(c *gin.Context) {
	id := c.Param("id")

	schema, err := h.service.GetSchema(c.Request.Context(), id)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, gin.H{"error": "Control schema not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, schema)
}

// UpdateSchema updates an existing control schema
// @Summary Update a control schema
// @Description Update an existing control schema. Built-in schemas cannot be modified.
// @Tags control-schemas
// @Accept json
// @Produce json
// @Param id path string true "Schema ID"
// @Param schema body models.UpdateControlSchemaRequest true "Schema updates"
// @Success 200 {object} models.ControlSchema
// @Failure 400 {object} map[string]interface{}
// @Failure 403 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /control-schemas/{id} [put]
func (h *ControlSchemaHandler) UpdateSchema(c *gin.Context) {
	id := c.Param("id")

	var req models.UpdateControlSchemaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	schema, err := h.service.UpdateSchema(c.Request.Context(), id, &req)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, gin.H{"error": "Control schema not found"})
			return
		}
		if strings.Contains(err.Error(), "cannot modify built-in") {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		if strings.Contains(err.Error(), "invalid control type") ||
			strings.Contains(err.Error(), "not in supported_types") {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, schema)
}

// DeleteSchema deletes a control schema
// @Summary Delete a control schema
// @Description Delete a control schema. Built-in schemas cannot be deleted.
// @Tags control-schemas
// @Produce json
// @Param id path string true "Schema ID"
// @Success 204 "No Content"
// @Failure 403 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /control-schemas/{id} [delete]
func (h *ControlSchemaHandler) DeleteSchema(c *gin.Context) {
	id := c.Param("id")

	err := h.service.DeleteSchema(c.Request.Context(), id)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, gin.H{"error": "Control schema not found"})
			return
		}
		if strings.Contains(err.Error(), "cannot delete built-in") {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

// ListSchemas lists control schemas with filtering
// @Summary List control schemas
// @Description List control schemas with optional filtering by protocol type or control type
// @Tags control-schemas
// @Produce json
// @Param protocol_type query string false "Filter by protocol type"
// @Param control_type query string false "Filter by supported control type"
// @Param built_in_only query bool false "Show only built-in schemas"
// @Param page query int false "Page number (default 1)"
// @Param page_size query int false "Page size (default 50, max 100)"
// @Success 200 {object} models.ControlSchemaListResponse
// @Failure 500 {object} map[string]interface{}
// @Router /control-schemas [get]
func (h *ControlSchemaHandler) ListSchemas(c *gin.Context) {
	var params models.ControlSchemaQueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	response, err := h.service.ListSchemas(c.Request.Context(), &params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
}

// GetSchemasForProtocol gets schemas compatible with a protocol type
// @Summary Get schemas for protocol
// @Description Get all control schemas compatible with a specific protocol type
// @Tags control-schemas
// @Produce json
// @Param protocol_type path string true "Protocol type (e.g., websocket-json)"
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /control-schemas/by-protocol/{protocol_type} [get]
func (h *ControlSchemaHandler) GetSchemasForProtocol(c *gin.Context) {
	protocolType := c.Param("protocol_type")

	schemas, err := h.service.GetSchemasForProtocol(c.Request.Context(), protocolType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"schemas": schemas})
}

// GetSchemasForControlType gets schemas that support a control type
// @Summary Get schemas for control type
// @Description Get all control schemas that support a specific control type
// @Tags control-schemas
// @Produce json
// @Param control_type path string true "Control type (toggle, scalar, button, text)"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /control-schemas/by-control-type/{control_type} [get]
func (h *ControlSchemaHandler) GetSchemasForControlType(c *gin.Context) {
	controlType := c.Param("control_type")

	schemas, err := h.service.GetSchemasForControlType(c.Request.Context(), controlType)
	if err != nil {
		if strings.Contains(err.Error(), "invalid control type") {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":       err.Error(),
				"valid_types": models.ValidControlUITypes(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"schemas": schemas})
}

// GetValidControlTypes returns the list of valid control UI types
// @Summary Get valid control types
// @Description Get the list of valid control UI types (toggle, scalar, button, text)
// @Tags control-schemas
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /control-schemas/types [get]
func (h *ControlSchemaHandler) GetValidControlTypes(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"types": models.ValidControlUITypes(),
		"descriptions": map[string]string{
			models.ControlUITypeToggle: "On/off switch, sends boolean value",
			models.ControlUITypeScalar: "Slider/numeric input, sends number value",
			models.ControlUITypeButton: "Action trigger, sends null (fires event only)",
			models.ControlUITypeText:   "Text/command input, sends string value",
		},
	})
}
