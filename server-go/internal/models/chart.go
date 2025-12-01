package models

import (
	"time"
)

// Chart represents a standalone chart configuration
// @Description Chart with data source binding, query config, and visualization settings
type Chart struct {
	ID            string                 `json:"id" bson:"_id"`
	Name          string                 `json:"name" bson:"name" binding:"required"`
	Description   string                 `json:"description" bson:"description"`
	ChartType     string                 `json:"chart_type" bson:"chart_type"`           // bar, line, pie, gauge, etc.
	DatasourceID  string                 `json:"datasource_id" bson:"datasource_id"`     // Reference to data source
	QueryConfig   *ChartQueryConfig      `json:"query_config" bson:"query_config"`       // How to query data
	DataMapping   *ChartDataMapping      `json:"data_mapping" bson:"data_mapping"`       // How to map data to chart
	ComponentCode string                 `json:"component_code" bson:"component_code"`   // React component code
	UseCustomCode bool                   `json:"use_custom_code" bson:"use_custom_code"` // Whether custom code mode is enabled
	Options       map[string]interface{} `json:"options" bson:"options"`                 // ECharts options overrides
	Thumbnail     string                 `json:"thumbnail,omitempty" bson:"thumbnail"`   // Base64 preview image for card display
	Tags          []string               `json:"tags,omitempty" bson:"tags,omitempty"`   // Searchable tags
	Created       time.Time              `json:"created" bson:"created"`
	Updated       time.Time              `json:"updated" bson:"updated"`
}

// CreateChartRequest represents a request to create a chart
// @Description Request body for creating a new chart
type CreateChartRequest struct {
	Name          string                 `json:"name" binding:"required"`
	Description   string                 `json:"description"`
	ChartType     string                 `json:"chart_type"`
	DatasourceID  string                 `json:"datasource_id"`
	QueryConfig   *ChartQueryConfig      `json:"query_config"`
	DataMapping   *ChartDataMapping      `json:"data_mapping"`
	ComponentCode string                 `json:"component_code"`
	UseCustomCode bool                   `json:"use_custom_code"`
	Options       map[string]interface{} `json:"options"`
	Thumbnail     string                 `json:"thumbnail"`
	Tags          []string               `json:"tags"`
}

// UpdateChartRequest represents a request to update a chart
// @Description Request body for updating an existing chart
type UpdateChartRequest struct {
	Name          *string                 `json:"name,omitempty"`
	Description   *string                 `json:"description,omitempty"`
	ChartType     *string                 `json:"chart_type,omitempty"`
	DatasourceID  *string                 `json:"datasource_id,omitempty"`
	QueryConfig   *ChartQueryConfig       `json:"query_config,omitempty"`
	DataMapping   *ChartDataMapping       `json:"data_mapping,omitempty"`
	ComponentCode *string                 `json:"component_code,omitempty"`
	UseCustomCode *bool                   `json:"use_custom_code,omitempty"`
	Options       *map[string]interface{} `json:"options,omitempty"`
	Thumbnail     *string                 `json:"thumbnail,omitempty"`
	Tags          *[]string               `json:"tags,omitempty"`
}

// ChartListResponse represents a paginated list of charts
// @Description Response containing a list of charts with pagination
type ChartListResponse struct {
	Charts   []Chart `json:"charts"`
	Total    int64   `json:"total"`
	Page     int     `json:"page"`
	PageSize int     `json:"page_size"`
}

// ChartQueryParams defines query parameters for listing charts
// @Description Query parameters for filtering and pagination
type ChartQueryParams struct {
	Name         string `form:"name"`
	ChartType    string `form:"chart_type"`
	DatasourceID string `form:"datasource_id"`
	Tag          string `form:"tag"`
	Page         int    `form:"page"`
	PageSize     int    `form:"page_size"`
}

// ChartSummary is a lightweight chart representation for card listings
// @Description Minimal chart info for selection cards and lists
type ChartSummary struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Description  string   `json:"description"`
	ChartType    string   `json:"chart_type"`
	DatasourceID string   `json:"datasource_id"`
	Thumbnail    string   `json:"thumbnail,omitempty"`
	Tags         []string `json:"tags,omitempty"`
}
