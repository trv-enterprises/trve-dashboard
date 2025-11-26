package models

import (
	"time"
)

// Dashboard represents a complete dashboard configuration
// @Description Dashboard model combining layout and components
type Dashboard struct {
	ID          string                 `json:"id" bson:"_id"`
	Name        string                 `json:"name" bson:"name" binding:"required"`
	Description string                 `json:"description" bson:"description"`
	LayoutID    string                 `json:"layout_id" bson:"layout_id" binding:"required"`
	Components  []DashboardComponent   `json:"components" bson:"components"`
	Settings    DashboardSettings      `json:"settings" bson:"settings"`
	Metadata    map[string]interface{} `json:"metadata,omitempty" bson:"metadata,omitempty"`
	Created     time.Time              `json:"created" bson:"created"`
	Updated     time.Time              `json:"updated" bson:"updated"`
}

// DashboardComponent represents a component placed in a dashboard
// @Description Component placement within a dashboard
type DashboardComponent struct {
	ID          string                 `json:"id" bson:"id"`                       // Unique ID for this placement
	ComponentID string                 `json:"component_id" bson:"component_id"`   // Reference to Component
	PanelID     string                 `json:"panel_id" bson:"panel_id"`           // Reference to Layout Panel
	Config      map[string]interface{} `json:"config,omitempty" bson:"config,omitempty"` // Component-specific config
	Props       map[string]interface{} `json:"props,omitempty" bson:"props,omitempty"`   // Runtime props
}

// DashboardSettings contains dashboard-level configuration
// @Description Dashboard settings and preferences
type DashboardSettings struct {
	Theme           string `json:"theme" bson:"theme"`                       // "light", "dark", "auto"
	RefreshInterval int    `json:"refresh_interval" bson:"refresh_interval"` // Auto-refresh interval in ms
	TimeZone        string `json:"timezone,omitempty" bson:"timezone,omitempty"`
	DefaultView     string `json:"default_view,omitempty" bson:"default_view,omitempty"`
	IsPublic        bool   `json:"is_public" bson:"is_public"`
	AllowExport     bool   `json:"allow_export" bson:"allow_export"`
}

// CreateDashboardRequest represents a request to create a dashboard
// @Description Request body for creating a new dashboard
type CreateDashboardRequest struct {
	Name        string                 `json:"name" binding:"required"`
	Description string                 `json:"description"`
	LayoutID    string                 `json:"layout_id" binding:"required"`
	Components  []DashboardComponent   `json:"components"`
	Settings    DashboardSettings      `json:"settings"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// UpdateDashboardRequest represents a request to update a dashboard
// @Description Request body for updating an existing dashboard
type UpdateDashboardRequest struct {
	Name        *string                 `json:"name,omitempty"`
	Description *string                 `json:"description,omitempty"`
	LayoutID    *string                 `json:"layout_id,omitempty"`
	Components  *[]DashboardComponent   `json:"components,omitempty"`
	Settings    *DashboardSettings      `json:"settings,omitempty"`
	Metadata    *map[string]interface{} `json:"metadata,omitempty"`
}

// DashboardListResponse represents a paginated list of dashboards
// @Description Response containing a list of dashboards with pagination
type DashboardListResponse struct {
	Dashboards []Dashboard `json:"dashboards"`
	Total      int64       `json:"total"`
	Page       int         `json:"page"`
	PageSize   int         `json:"page_size"`
}

// DashboardQueryParams defines query parameters for listing dashboards
// @Description Query parameters for filtering and pagination
type DashboardQueryParams struct {
	Name     string `form:"name"`
	IsPublic *bool  `form:"is_public"`
	Page     int    `form:"page" binding:"min=1"`
	PageSize int    `form:"page_size" binding:"min=1,max=100"`
}

// DashboardWithDetails includes expanded layout and component details
// @Description Dashboard with full layout and component information
type DashboardWithDetails struct {
	Dashboard
	Layout           *Layout      `json:"layout,omitempty"`
	ComponentDetails []Component  `json:"component_details,omitempty"`
}
