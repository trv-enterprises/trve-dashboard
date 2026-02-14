// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

package models

import (
	"time"
)

// Chart status constants
const (
	ChartStatusDraft = "draft" // AI work in progress, not visible in dashboards
	ChartStatusFinal = "final" // Saved/committed version
)

// Component type constants
const (
	ComponentTypeChart   = "chart"   // Default - data visualization chart
	ComponentTypeControl = "control" // Interactive control component
)

// Control type constants
const (
	ControlTypeButton    = "button"     // Simple action button
	ControlTypeToggle    = "toggle"     // On/off toggle switch
	ControlTypeSlider    = "slider"     // Numeric slider
	ControlTypeTextInput = "text_input" // Text input field
)

// ControlConfig defines configuration for control components
// @Description Configuration for interactive control components (buttons, toggles, etc.)
type ControlConfig struct {
	ControlType   string                 `json:"control_type" bson:"control_type"`     // button, toggle, slider, text_input
	CommandConfig *CommandConfig         `json:"command_config" bson:"command_config"` // How to send commands
	UIConfig      map[string]interface{} `json:"ui_config" bson:"ui_config"`           // Type-specific UI configuration
}

// CommandConfig defines how a control sends commands to a connection
// @Description Configuration for sending commands via a connection
type CommandConfig struct {
	Action          string                 `json:"action" bson:"action"`                       // Command action name
	Target          string                 `json:"target,omitempty" bson:"target,omitempty"`   // Optional target identifier
	PayloadTemplate map[string]interface{} `json:"payload_template,omitempty" bson:"payload_template,omitempty"` // Template with {{value}} placeholder
}

// Chart represents a standalone chart or control configuration
// @Description Chart/Control with data source binding, query config, and visualization settings
// Primary key is composite (id, version) - id stays same across versions
type Chart struct {
	ID            string                 `json:"id" bson:"id"`                           // UUID - same across versions
	Version       int                    `json:"version" bson:"version"`                 // Version number (1, 2, 3...)
	Status        string                 `json:"status" bson:"status"`                   // "draft" | "final"
	ComponentType string                 `json:"component_type" bson:"component_type"`   // "chart" (default) | "control"
	Name          string                 `json:"name" bson:"name" binding:"required"`    // Unique identifier
	Title         string                 `json:"title" bson:"title"`                     // Display title (defaults to Name if empty)
	Description   string                 `json:"description" bson:"description"`
	ChartType     string                 `json:"chart_type" bson:"chart_type"`           // bar, line, pie, gauge, etc. (charts only)
	DatasourceID  string                 `json:"connection_id" bson:"datasource_id"`     // Reference to connection
	QueryConfig   *ChartQueryConfig      `json:"query_config" bson:"query_config"`       // How to query data (charts only)
	DataMapping   *ChartDataMapping      `json:"data_mapping" bson:"data_mapping"`       // How to map data to chart (charts only)
	ControlConfig *ControlConfig         `json:"control_config,omitempty" bson:"control_config,omitempty"` // Control configuration (controls only)
	ComponentCode string                 `json:"component_code" bson:"component_code"`   // React component code
	UseCustomCode bool                   `json:"use_custom_code" bson:"use_custom_code"` // Whether custom code mode is enabled
	Options       map[string]interface{} `json:"options" bson:"options"`                 // ECharts options overrides (charts only)
	Thumbnail     string                 `json:"thumbnail,omitempty" bson:"thumbnail"`   // Base64 preview image for card display
	Tags          []string               `json:"tags,omitempty" bson:"tags,omitempty"`   // Searchable tags
	AISessionID   string                 `json:"ai_session_id,omitempty" bson:"ai_session_id,omitempty"` // Active AI session (drafts only)
	Created       time.Time              `json:"created" bson:"created"`
	Updated       time.Time              `json:"updated" bson:"updated"`
}

// CreateChartRequest represents a request to create a chart or control
// @Description Request body for creating a new chart or control
type CreateChartRequest struct {
	ComponentType string                 `json:"component_type"` // "chart" (default) | "control"
	Name          string                 `json:"name" binding:"required"`
	Title         string                 `json:"title"`
	Description   string                 `json:"description"`
	ChartType     string                 `json:"chart_type"`
	DatasourceID  string                 `json:"connection_id"`
	QueryConfig   *ChartQueryConfig      `json:"query_config"`
	DataMapping   *ChartDataMapping      `json:"data_mapping"`
	ControlConfig *ControlConfig         `json:"control_config"`
	ComponentCode string                 `json:"component_code"`
	UseCustomCode bool                   `json:"use_custom_code"`
	Options       map[string]interface{} `json:"options"`
	Thumbnail     string                 `json:"thumbnail"`
	Tags          []string               `json:"tags"`
}

// UpdateChartRequest represents a request to update a chart or control
// @Description Request body for updating an existing chart or control
type UpdateChartRequest struct {
	ComponentType *string                 `json:"component_type,omitempty"`
	Name          *string                 `json:"name,omitempty"`
	Title         *string                 `json:"title,omitempty"`
	Description   *string                 `json:"description,omitempty"`
	ChartType     *string                 `json:"chart_type,omitempty"`
	DatasourceID  *string                 `json:"connection_id,omitempty"`
	QueryConfig   *ChartQueryConfig       `json:"query_config,omitempty"`
	DataMapping   *ChartDataMapping       `json:"data_mapping,omitempty"`
	ControlConfig *ControlConfig          `json:"control_config,omitempty"`
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
	DatasourceID string `form:"connection_id"` // Accept connection_id query param
	Tag          string `form:"tag"`
	Page         int    `form:"page"`
	PageSize     int    `form:"page_size"`
}

// ChartSummary is a lightweight chart representation for card listings
// @Description Minimal chart info for selection cards and lists
type ChartSummary struct {
	ID            string   `json:"id"`
	Version       int      `json:"version"`
	Status        string   `json:"status"`
	ComponentType string   `json:"component_type"`
	Name          string   `json:"name"`
	Description   string   `json:"description"`
	ChartType     string   `json:"chart_type"`
	DatasourceID  string   `json:"connection_id"`
	Thumbnail     string   `json:"thumbnail,omitempty"`
	Tags          []string `json:"tags,omitempty"`
}

// ChartVersionInfo provides version metadata for delete dialogs
// @Description Version info for a chart
type ChartVersionInfo struct {
	ID           string `json:"id"`
	Version      int    `json:"version"`
	Status       string `json:"status"`
	VersionCount int    `json:"version_count"` // Total versions for this chart id
	HasDraft     bool   `json:"has_draft"`     // Whether a draft version exists
}
