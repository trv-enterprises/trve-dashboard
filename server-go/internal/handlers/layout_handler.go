package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/tviviano/dashboard/internal/models"
	"github.com/tviviano/dashboard/internal/service"
)

// LayoutHandler handles layout HTTP requests
type LayoutHandler struct {
	service *service.LayoutService
}

// NewLayoutHandler creates a new layout handler
func NewLayoutHandler(service *service.LayoutService) *LayoutHandler {
	return &LayoutHandler{
		service: service,
	}
}

// CreateLayout godoc
// @Summary Create a new layout
// @Description Create a new dashboard layout with grid configuration and panels
// @Tags layouts
// @Accept json
// @Produce json
// @Param layout body models.CreateLayoutRequest true "Layout to create"
// @Success 201 {object} models.Layout
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /layouts [post]
func (h *LayoutHandler) CreateLayout(c *gin.Context) {
	var req models.CreateLayoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	layout, err := h.service.CreateLayout(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, layout)
}

// GetLayout godoc
// @Summary Get a layout by ID
// @Description Retrieve a single layout by its ID
// @Tags layouts
// @Produce json
// @Param id path string true "Layout ID"
// @Success 200 {object} models.Layout
// @Failure 400 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Router /layouts/{id} [get]
func (h *LayoutHandler) GetLayout(c *gin.Context) {
	id := c.Param("id")

	layout, err := h.service.GetLayout(c.Request.Context(), id)
	if err != nil {
		if err.Error() == "layout not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "layout not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, layout)
}

// ListLayouts godoc
// @Summary List all layouts
// @Description Retrieve all layouts with pagination
// @Tags layouts
// @Produce json
// @Param limit query int false "Number of items per page" default(20)
// @Param offset query int false "Number of items to skip" default(0)
// @Success 200 {object} map[string]interface{}
// @Router /layouts [get]
func (h *LayoutHandler) ListLayouts(c *gin.Context) {
	limit, _ := strconv.ParseInt(c.DefaultQuery("limit", "20"), 10, 64)
	offset, _ := strconv.ParseInt(c.DefaultQuery("offset", "0"), 10, 64)

	layouts, total, err := h.service.ListLayouts(c.Request.Context(), limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"layouts": layouts,
		"total":   total,
		"limit":   limit,
		"offset":  offset,
	})
}

// UpdateLayout godoc
// @Summary Update a layout
// @Description Update an existing layout by ID
// @Tags layouts
// @Accept json
// @Produce json
// @Param id path string true "Layout ID"
// @Param layout body models.UpdateLayoutRequest true "Layout updates"
// @Success 200 {object} models.Layout
// @Failure 400 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /layouts/{id} [put]
func (h *LayoutHandler) UpdateLayout(c *gin.Context) {
	id := c.Param("id")

	var req models.UpdateLayoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	layout, err := h.service.UpdateLayout(c.Request.Context(), id, &req)
	if err != nil {
		if err.Error() == "layout not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "layout not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, layout)
}

// DeleteLayout godoc
// @Summary Delete a layout
// @Description Delete a layout by ID
// @Tags layouts
// @Param id path string true "Layout ID"
// @Success 204
// @Failure 400 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Router /layouts/{id} [delete]
func (h *LayoutHandler) DeleteLayout(c *gin.Context) {
	id := c.Param("id")

	err := h.service.DeleteLayout(c.Request.Context(), id)
	if err != nil {
		if err.Error() == "layout not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "layout not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}
