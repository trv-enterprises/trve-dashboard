package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tviviano/dashboard/internal/models"
	"github.com/tviviano/dashboard/internal/service"
)

// ComponentHandler handles component-related HTTP requests
type ComponentHandler struct {
	service *service.ComponentService
}

// NewComponentHandler creates a new component handler
func NewComponentHandler(service *service.ComponentService) *ComponentHandler {
	return &ComponentHandler{
		service: service,
	}
}

// CreateComponent creates a new component
// @Summary Create a new component
// @Description Create a new dashboard component or chart
// @Tags components
// @Accept json
// @Produce json
// @Param component body models.CreateComponentRequest true "Component data"
// @Success 201 {object} models.Component
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /components [post]
func (h *ComponentHandler) CreateComponent(c *gin.Context) {
	var req models.CreateComponentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	component, err := h.service.CreateComponent(c.Request.Context(), &req)
	if err != nil {
		status := http.StatusInternalServerError
		if err.Error() == "component code is required" ||
			err.Error()[:len("component with name")] == "component with name" {
			status = http.StatusBadRequest
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, component)
}

// GetComponent retrieves a component by ID
// @Summary Get a component
// @Description Get a component by ID
// @Tags components
// @Produce json
// @Param id path string true "Component ID"
// @Success 200 {object} models.Component
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /components/{id} [get]
func (h *ComponentHandler) GetComponent(c *gin.Context) {
	id := c.Param("id")

	component, err := h.service.GetComponent(c.Request.Context(), id)
	if err != nil {
		if err.Error() == "component not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Component not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, component)
}

// ListComponents retrieves a list of components with pagination
// @Summary List components
// @Description Get a paginated list of components with optional filtering
// @Tags components
// @Produce json
// @Param system query string false "Filter by system"
// @Param source query string false "Filter by source"
// @Param category query string false "Filter by category"
// @Param tag query string false "Filter by tag"
// @Param page query int false "Page number" default(1)
// @Param page_size query int false "Page size" default(20)
// @Success 200 {object} models.ComponentListResponse
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /components [get]
func (h *ComponentHandler) ListComponents(c *gin.Context) {
	var params models.ComponentQueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	response, err := h.service.ListComponents(c.Request.Context(), params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
}

// UpdateComponent updates a component
// @Summary Update a component
// @Description Update an existing component
// @Tags components
// @Accept json
// @Produce json
// @Param id path string true "Component ID"
// @Param component body models.UpdateComponentRequest true "Component update data"
// @Success 200 {object} models.Component
// @Failure 400 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /components/{id} [put]
func (h *ComponentHandler) UpdateComponent(c *gin.Context) {
	id := c.Param("id")

	var req models.UpdateComponentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	component, err := h.service.UpdateComponent(c.Request.Context(), id, &req)
	if err != nil {
		status := http.StatusInternalServerError
		if err.Error() == "component not found" {
			status = http.StatusNotFound
		} else if err.Error() == "component code cannot be empty" {
			status = http.StatusBadRequest
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, component)
}

// DeleteComponent deletes a component
// @Summary Delete a component
// @Description Delete a component by ID
// @Tags components
// @Param id path string true "Component ID"
// @Success 204
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /components/{id} [delete]
func (h *ComponentHandler) DeleteComponent(c *gin.Context) {
	id := c.Param("id")

	err := h.service.DeleteComponent(c.Request.Context(), id)
	if err != nil {
		if err.Error() == "component not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Component not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

// GetSystems retrieves all systems and sources
// @Summary Get component systems
// @Description Get all component systems and sources with counts
// @Tags components
// @Produce json
// @Success 200 {object} models.ComponentSystemsResponse
// @Failure 500 {object} map[string]interface{}
// @Router /components/systems [get]
func (h *ComponentHandler) GetSystems(c *gin.Context) {
	systems, err := h.service.GetSystems(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, systems)
}
