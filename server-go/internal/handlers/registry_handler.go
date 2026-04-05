// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/trv-enterprises/trve-dashboard/internal/registry"
)

// RegistryHandler handles registry-related endpoints
type RegistryHandler struct{}

// NewRegistryHandler creates a new registry handler
func NewRegistryHandler() *RegistryHandler {
	return &RegistryHandler{}
}

// ListConnectionTypesResponse represents the response for listing connection types
type ListConnectionTypesResponse struct {
	Types      []registry.TypeInfo `json:"types"`
	Categories []string            `json:"categories"`
	Count      int                 `json:"count"`
}

// ListConnectionTypes godoc
// @Summary List all available connection types
// @Description Get all registered adapter types with their capabilities and configuration schema
// @Tags registry
// @Produce json
// @Param category query string false "Filter by category (e.g., 'db', 'stream', 'api')"
// @Success 200 {object} ListConnectionTypesResponse
// @Router /api/registry/connections [get]
func (h *RegistryHandler) ListConnectionTypes(c *gin.Context) {
	category := c.Query("category")

	var types []registry.TypeInfo
	if category != "" {
		types = registry.ListByCategory(category)
	} else {
		types = registry.List()
	}

	c.JSON(http.StatusOK, ListConnectionTypesResponse{
		Types:      types,
		Categories: registry.Categories(),
		Count:      len(types),
	})
}

// GetConnectionType godoc
// @Summary Get a specific connection type
// @Description Get details about a specific adapter type including configuration schema
// @Tags registry
// @Produce json
// @Param typeId path string true "Type ID (e.g., 'db.postgres', 'stream.websocket-bidir')"
// @Success 200 {object} registry.TypeInfo
// @Failure 404 {object} map[string]interface{} "Type not found"
// @Router /api/registry/connections/{typeId} [get]
func (h *RegistryHandler) GetConnectionType(c *gin.Context) {
	typeID := c.Param("typeId")

	info, ok := registry.GetTypeInfo(typeID)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error":      "type not found",
			"type_id":    typeID,
			"available":  registry.Categories(),
		})
		return
	}

	c.JSON(http.StatusOK, info)
}

// ListCategoriesResponse represents the response for listing categories
type ListCategoriesResponse struct {
	Categories []CategoryInfo `json:"categories"`
}

// CategoryInfo represents information about a category
type CategoryInfo struct {
	Name        string `json:"name"`
	DisplayName string `json:"display_name"`
	TypeCount   int    `json:"type_count"`
}

// ListCategories godoc
// @Summary List all connection type categories
// @Description Get all available categories with their type counts
// @Tags registry
// @Produce json
// @Success 200 {object} ListCategoriesResponse
// @Router /api/registry/categories [get]
func (h *RegistryHandler) ListCategories(c *gin.Context) {
	categories := registry.Categories()

	categoryInfos := make([]CategoryInfo, len(categories))
	displayNames := map[string]string{
		"db":     "Databases",
		"file":   "Files",
		"stream": "Streams",
		"api":    "APIs",
		"store":  "Data Stores",
	}

	for i, cat := range categories {
		displayName := displayNames[cat]
		if displayName == "" {
			displayName = cat
		}
		categoryInfos[i] = CategoryInfo{
			Name:        cat,
			DisplayName: displayName,
			TypeCount:   len(registry.ListByCategory(cat)),
		}
	}

	c.JSON(http.StatusOK, ListCategoriesResponse{
		Categories: categoryInfos,
	})
}
