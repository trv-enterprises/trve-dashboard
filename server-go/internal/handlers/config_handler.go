package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tviviano/dashboard/internal/models"
	"github.com/tviviano/dashboard/internal/service"
)

// ConfigHandler handles HTTP requests for app configuration
type ConfigHandler struct {
	service *service.ConfigService
}

// NewConfigHandler creates a new ConfigHandler
func NewConfigHandler(service *service.ConfigService) *ConfigHandler {
	return &ConfigHandler{service: service}
}

// GetSystemConfig godoc
// @Summary Get system configuration
// @Description Retrieves system-wide configuration including layout dimensions
// @Tags config
// @Produce json
// @Success 200 {object} models.SystemConfigResponse
// @Failure 500 {object} map[string]string
// @Router /config/system [get]
func (h *ConfigHandler) GetSystemConfig(c *gin.Context) {
	config, err := h.service.GetSystemConfig(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, config)
}

// UpdateSystemConfig godoc
// @Summary Update system configuration
// @Description Updates system-wide configuration settings
// @Tags config
// @Accept json
// @Produce json
// @Param request body models.UpdateConfigRequest true "Configuration settings to update"
// @Success 200 {object} models.SystemConfigResponse
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /config/system [put]
func (h *ConfigHandler) UpdateSystemConfig(c *gin.Context) {
	var req models.UpdateConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	config, err := h.service.UpdateSystemConfig(c.Request.Context(), req.Settings)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, config)
}

// SetCurrentDimensionRequest is the request body for setting current dimension
type SetCurrentDimensionRequest struct {
	Dimension string `json:"dimension" binding:"required"`
}

// SetCurrentDimension godoc
// @Summary Set current layout dimension
// @Description Sets the current layout dimension preset
// @Tags config
// @Accept json
// @Produce json
// @Param request body SetCurrentDimensionRequest true "Dimension to set"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /config/system/dimension [put]
func (h *ConfigHandler) SetCurrentDimension(c *gin.Context) {
	var req SetCurrentDimensionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := h.service.SetCurrentDimension(c.Request.Context(), req.Dimension)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"dimension": req.Dimension, "message": "Dimension updated successfully"})
}

// GetLayoutDimensions godoc
// @Summary Get available layout dimensions
// @Description Returns all available layout dimension presets
// @Tags config
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /config/dimensions [get]
func (h *ConfigHandler) GetLayoutDimensions(c *gin.Context) {
	dimensions := h.service.GetLayoutDimensions()
	order := h.service.GetLayoutDimensionOrder()

	// Build ordered response
	result := make([]map[string]interface{}, 0, len(order))
	for _, name := range order {
		if dim, exists := dimensions[name]; exists {
			result = append(result, map[string]interface{}{
				"name":       name,
				"max_width":  dim.MaxWidth,
				"max_height": dim.MaxHeight,
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"dimensions": result,
		"default":    order[0],
	})
}

// GetUserConfig godoc
// @Summary Get user configuration
// @Description Retrieves configuration for a specific user
// @Tags config
// @Produce json
// @Param user_id path string true "User ID"
// @Success 200 {object} models.UserConfigResponse
// @Failure 500 {object} map[string]string
// @Router /config/user/{user_id} [get]
func (h *ConfigHandler) GetUserConfig(c *gin.Context) {
	userID := c.Param("user_id")

	config, err := h.service.GetUserConfig(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, config)
}

// UpdateUserConfig godoc
// @Summary Update user configuration
// @Description Updates configuration for a specific user
// @Tags config
// @Accept json
// @Produce json
// @Param user_id path string true "User ID"
// @Param request body models.UpdateConfigRequest true "Configuration settings to update"
// @Success 200 {object} models.UserConfigResponse
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /config/user/{user_id} [put]
func (h *ConfigHandler) UpdateUserConfig(c *gin.Context) {
	userID := c.Param("user_id")

	var req models.UpdateConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	config, err := h.service.UpdateUserConfig(c.Request.Context(), userID, req.Settings)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, config)
}
