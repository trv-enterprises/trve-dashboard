package models

import (
	"time"
)

// Component represents a dashboard chart/widget component
// @Description Component model for dashboard charts and widgets
type Component struct {
	ID            string                 `json:"id" bson:"_id"`
	Name          string                 `json:"name" bson:"name" binding:"required"`
	System        string                 `json:"system" bson:"system" binding:"required"`
	Source        string                 `json:"source" bson:"source" binding:"required"`
	Description   string                 `json:"description" bson:"description"`
	ComponentCode string                 `json:"component_code" bson:"component_code" binding:"required"`
	Metadata      ComponentMetadata      `json:"metadata" bson:"metadata"`
	Created       time.Time              `json:"created" bson:"created"`
	Updated       time.Time              `json:"updated" bson:"updated"`
}

// ComponentMetadata contains additional component information
// @Description Metadata for component categorization and configuration
type ComponentMetadata struct {
	Category        string                 `json:"category,omitempty" bson:"category,omitempty"`
	Tags            []string               `json:"tags,omitempty" bson:"tags,omitempty"`
	Visualization   *VisualizationConfig   `json:"visualization,omitempty" bson:"visualization,omitempty"`
	RequiredAPIs    []string               `json:"requiredApis,omitempty" bson:"requiredApis,omitempty"`
	DatasourceType  string                 `json:"datasourceType,omitempty" bson:"datasourceType,omitempty"`
	RefreshInterval int                    `json:"refreshInterval,omitempty" bson:"refreshInterval,omitempty"`
	Custom          map[string]interface{} `json:"custom,omitempty" bson:"custom,omitempty"`
}

// VisualizationConfig defines chart/visualization settings
// @Description Configuration for visualization components
type VisualizationConfig struct {
	Type    string `json:"type" bson:"type"`       // bar, line, pie, gauge, etc.
	Library string `json:"library" bson:"library"` // echarts, d3, custom
}

// CreateComponentRequest represents a request to create a component
// @Description Request body for creating a new component
type CreateComponentRequest struct {
	Name          string            `json:"name" binding:"required"`
	System        string            `json:"system" binding:"required"`
	Source        string            `json:"source" binding:"required"`
	Description   string            `json:"description"`
	ComponentCode string            `json:"component_code" binding:"required"`
	Metadata      ComponentMetadata `json:"metadata"`
}

// UpdateComponentRequest represents a request to update a component
// @Description Request body for updating an existing component
type UpdateComponentRequest struct {
	Description   *string            `json:"description,omitempty"`
	ComponentCode *string            `json:"component_code,omitempty"`
	Metadata      *ComponentMetadata `json:"metadata,omitempty"`
}

// ComponentListResponse represents a paginated list of components
// @Description Response containing a list of components with pagination
type ComponentListResponse struct {
	Components []Component `json:"components"`
	Total      int64       `json:"total"`
	Page       int         `json:"page"`
	PageSize   int         `json:"page_size"`
}

// ComponentSystemsResponse lists all systems and their sources
// @Description Response containing component organization hierarchy
type ComponentSystemsResponse struct {
	Systems map[string]ComponentSystem `json:"systems"`
}

// ComponentSystem represents a system category and its sources
// @Description System category containing multiple sources
type ComponentSystem struct {
	Name    string                       `json:"name"`
	Sources map[string]ComponentSource   `json:"sources"`
}

// ComponentSource represents a source within a system
// @Description Source category containing component count
type ComponentSource struct {
	Name           string `json:"name"`
	ComponentCount int    `json:"component_count"`
}

// ComponentQueryParams defines query parameters for listing components
// @Description Query parameters for filtering and pagination
type ComponentQueryParams struct {
	System   string `form:"system"`
	Source   string `form:"source"`
	Category string `form:"category"`
	Tag      string `form:"tag"`
	Page     int    `form:"page" binding:"min=1"`
	PageSize int    `form:"page_size" binding:"min=1,max=100"`
}
