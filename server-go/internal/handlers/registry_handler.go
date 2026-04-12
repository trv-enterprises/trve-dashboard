// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

package handlers

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/trv-enterprises/trve-dashboard/internal/models"
	"github.com/trv-enterprises/trve-dashboard/internal/registry"
	"github.com/trv-enterprises/trve-dashboard/internal/service"
)

// RegistryHandler handles registry-related endpoints. It owns the unified
// type catalog (connection types, chart/control/display subtypes, and
// device types), which is what the AI builder and MCP server consume as
// their single source of truth.
type RegistryHandler struct {
	deviceTypes *service.DeviceTypeService
}

// NewRegistryHandler creates a new registry handler. deviceTypes may be nil
// (the catalog endpoint will omit device types if so).
func NewRegistryHandler(deviceTypes *service.DeviceTypeService) *RegistryHandler {
	return &RegistryHandler{deviceTypes: deviceTypes}
}

// deviceTypeListerAdapter adapts DeviceTypeService to registry.DeviceTypeLister
// so the registry package stays free of service/models imports.
type deviceTypeListerAdapter struct {
	svc *service.DeviceTypeService
}

func (a *deviceTypeListerAdapter) ListDeviceTypesForCatalog(ctx context.Context) ([]registry.DeviceTypeSummary, error) {
	if a.svc == nil {
		return nil, nil
	}
	resp, err := a.svc.ListDeviceTypes(ctx, &models.DeviceTypeQueryParams{Page: 1, PageSize: 500})
	if err != nil {
		return nil, err
	}
	summaries := make([]registry.DeviceTypeSummary, 0, len(resp.DeviceTypes))
	for _, dt := range resp.DeviceTypes {
		summaries = append(summaries, registry.DeviceTypeSummary{
			ID:             dt.ID,
			Name:           dt.Name,
			Description:    dt.Description,
			Category:       dt.Category,
			Protocol:       dt.Protocol,
			SupportedTypes: dt.SupportedTypes,
			IsBuiltIn:      dt.IsBuiltIn,
		})
	}
	return summaries, nil
}

// deviceTypeLister returns a lister backed by the handler's service, or nil
// if no service was supplied.
func (h *RegistryHandler) deviceTypeLister() registry.DeviceTypeLister {
	if h.deviceTypes == nil {
		return nil
	}
	return &deviceTypeListerAdapter{svc: h.deviceTypes}
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

// ListComponentTypesResponse wraps component type listings.
type ListComponentTypesResponse struct {
	Types []registry.ComponentTypeInfo `json:"types"`
	Count int                          `json:"count"`
}

// ListComponentTypes godoc
// @Summary List component subtypes (chart/control/display)
// @Description Returns registered component types. Pass ?category=chart, ?category=control, or ?category=display to filter; omit for all. Hidden types are included so legacy editors still work.
// @Tags registry
// @Produce json
// @Param category query string false "Filter: chart, control, display"
// @Success 200 {object} ListComponentTypesResponse
// @Router /api/registry/components [get]
func (h *RegistryHandler) ListComponentTypes(c *gin.Context) {
	category := c.Query("category")
	types := registry.ListComponentTypes(category)
	c.JSON(http.StatusOK, ListComponentTypesResponse{
		Types: types,
		Count: len(types),
	})
}

// GetComponentType godoc
// @Summary Get a single component type by ID
// @Description Returns metadata for a single component subtype like "chart.bar" or "control.toggle".
// @Tags registry
// @Produce json
// @Param typeId path string true "Component type ID"
// @Success 200 {object} registry.ComponentTypeInfo
// @Failure 404 {object} map[string]interface{}
// @Router /api/registry/components/{typeId} [get]
func (h *RegistryHandler) GetComponentType(c *gin.Context) {
	typeID := c.Param("typeId")
	info, ok := registry.GetComponentType(typeID)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "component type not found",
			"type_id": typeID,
		})
		return
	}
	c.JSON(http.StatusOK, info)
}

// GetCatalog godoc
// @Summary Unified type catalog (single source of truth)
// @Description Returns connection types, chart/control/display subtypes, and device types in one payload. This is what the AI builder and MCP server consume so they never duplicate enum lists.
// @Tags registry
// @Produce json
// @Success 200 {object} registry.Catalog
// @Router /api/registry/catalog [get]
func (h *RegistryHandler) GetCatalog(c *gin.Context) {
	cat, err := registry.BuildCatalog(c.Request.Context(), h.deviceTypeLister())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, cat)
}

// GetCatalogMarkdown godoc
// @Summary Catalog rendered as markdown
// @Description Same data as /catalog but formatted as a markdown document. Useful for embedding directly in an LLM system prompt or pasting into chat.
// @Tags registry
// @Produce text/plain
// @Success 200 {string} string "Markdown document"
// @Router /api/registry/catalog.md [get]
func (h *RegistryHandler) GetCatalogMarkdown(c *gin.Context) {
	cat, err := registry.BuildCatalog(c.Request.Context(), h.deviceTypeLister())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Data(http.StatusOK, "text/plain; charset=utf-8", []byte(cat.RenderMarkdown()))
}
