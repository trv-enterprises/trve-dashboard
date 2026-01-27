// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

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
