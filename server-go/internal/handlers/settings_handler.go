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

// SettingsHandler handles HTTP requests for settings
type SettingsHandler struct {
	service *service.SettingsService
}

// NewSettingsHandler creates a new SettingsHandler
func NewSettingsHandler(service *service.SettingsService) *SettingsHandler {
	return &SettingsHandler{
		service: service,
	}
}

// GetAllSettings godoc
// @Summary Get all user-configurable settings
// @Description Get all settings that can be modified by administrators
// @Tags settings
// @Accept json
// @Produce json
// @Success 200 {object} models.SettingsListResponse
// @Failure 500 {object} map[string]string
// @Router /api/settings [get]
func (h *SettingsHandler) GetAllSettings(c *gin.Context) {
	settings, err := h.service.GetAllSettings(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, models.SettingsListResponse{Settings: settings})
}

// GetSetting godoc
// @Summary Get a single setting
// @Description Get a single setting by key
// @Tags settings
// @Accept json
// @Produce json
// @Param key path string true "Setting key"
// @Success 200 {object} models.ConfigItem
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/settings/{key} [get]
func (h *SettingsHandler) GetSetting(c *gin.Context) {
	key := c.Param("key")

	setting, err := h.service.GetSetting(c.Request.Context(), key)
	if err != nil {
		if err.Error() == "setting not found: "+key {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, setting)
}

// UpdateSetting godoc
// @Summary Update a setting
// @Description Update the value of a user-configurable setting
// @Tags settings
// @Accept json
// @Produce json
// @Param key path string true "Setting key"
// @Param body body models.UpdateSettingRequest true "New value for the setting"
// @Success 200 {object} models.ConfigItem
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/settings/{key} [put]
func (h *SettingsHandler) UpdateSetting(c *gin.Context) {
	key := c.Param("key")

	var req models.UpdateSettingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body: " + err.Error()})
		return
	}

	setting, err := h.service.UpdateSetting(c.Request.Context(), key, req.Value)
	if err != nil {
		errMsg := err.Error()
		if errMsg == "setting not found: "+key {
			c.JSON(http.StatusNotFound, gin.H{"error": errMsg})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": errMsg})
		return
	}
	c.JSON(http.StatusOK, setting)
}

// RegisterRoutes registers the settings routes
func (h *SettingsHandler) RegisterRoutes(router *gin.RouterGroup) {
	settings := router.Group("/settings")
	{
		settings.GET("", h.GetAllSettings)
		settings.GET("/:key", h.GetSetting)
		settings.PUT("/:key", h.UpdateSetting)
	}
}
