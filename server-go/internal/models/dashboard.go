package models

import (
	"time"
)

// DashboardPanel represents a panel position in the dashboard grid
// @Description Panel position and size in the grid (copied from layout template)
type DashboardPanel struct {
	ID string `json:"id" bson:"id"`
	X  int    `json:"x" bson:"x"`
	Y  int    `json:"y" bson:"y"`
	W  int    `json:"w" bson:"w"`
	H  int    `json:"h" bson:"h"`
}

// ChartQueryConfig defines how to query data for a chart
// @Description Query configuration for fetching chart data
type ChartQueryConfig struct {
	Raw    string                 `json:"raw" bson:"raw"`       // SQL query, filter, or API path
	Type   string                 `json:"type" bson:"type"`     // sql, csv_filter, stream_filter, api
	Params map[string]interface{} `json:"params" bson:"params"` // Query parameters
}

// ChartDataMapping defines how to map query results to chart elements
// @Description Mapping configuration from data columns to chart axes/series
type ChartDataMapping struct {
	XAxis    string   `json:"x_axis" bson:"x_axis"`       // Column for X axis (categories)
	YAxis    []string `json:"y_axis" bson:"y_axis"`       // Columns for Y axis (values/series)
	GroupBy  string   `json:"group_by" bson:"group_by"`   // Column to group/split series by
	LabelCol string   `json:"label_col" bson:"label_col"` // Column for labels
}

// EmbeddedChart represents a chart embedded directly in a dashboard
// @Description Chart stored within a dashboard, keyed by panel_id
type EmbeddedChart struct {
	ID            string                 `json:"id" bson:"id"`
	Name          string                 `json:"name" bson:"name"`
	ChartType     string                 `json:"chart_type" bson:"chart_type"`         // bar, line, pie, etc.
	DatasourceID  string                 `json:"datasource_id" bson:"datasource_id"`   // Reference to datasource
	QueryConfig   *ChartQueryConfig      `json:"query_config" bson:"query_config"`     // How to query data
	DataMapping   *ChartDataMapping      `json:"data_mapping" bson:"data_mapping"`     // How to map data to chart
	ComponentCode string                 `json:"component_code" bson:"component_code"` // Custom React component code
	Options       map[string]interface{} `json:"options" bson:"options"`               // ECharts options overrides
}

// Dashboard represents a complete dashboard configuration
// @Description Self-contained dashboard with panels and embedded charts
type Dashboard struct {
	ID          string                   `json:"id" bson:"_id"`
	Name        string                   `json:"name" bson:"name" binding:"required"`
	Description string                   `json:"description" bson:"description"`
	Panels      []DashboardPanel         `json:"panels" bson:"panels"`
	Charts      map[string]EmbeddedChart `json:"charts" bson:"charts"`
	Settings    DashboardSettings        `json:"settings" bson:"settings"`
	Metadata    map[string]interface{}   `json:"metadata,omitempty" bson:"metadata,omitempty"`
	Created     time.Time                `json:"created" bson:"created"`
	Updated     time.Time                `json:"updated" bson:"updated"`
}

// DashboardSettings contains dashboard-level configuration
// @Description Dashboard settings and preferences
type DashboardSettings struct {
	Theme           string `json:"theme" bson:"theme"`
	RefreshInterval int    `json:"refresh_interval" bson:"refresh_interval"`
	TimeZone        string `json:"timezone,omitempty" bson:"timezone,omitempty"`
	DefaultView     string `json:"default_view,omitempty" bson:"default_view,omitempty"`
	IsPublic        bool   `json:"is_public" bson:"is_public"`
	AllowExport     bool   `json:"allow_export" bson:"allow_export"`
}

// CreateDashboardRequest represents a request to create a dashboard
// @Description Request body for creating a new dashboard
type CreateDashboardRequest struct {
	Name        string                   `json:"name" binding:"required"`
	Description string                   `json:"description"`
	Panels      []DashboardPanel         `json:"panels"`
	Charts      map[string]EmbeddedChart `json:"charts"`
	Settings    DashboardSettings        `json:"settings"`
	Metadata    map[string]interface{}   `json:"metadata,omitempty"`
}

// UpdateDashboardRequest represents a request to update a dashboard
// @Description Request body for updating an existing dashboard
type UpdateDashboardRequest struct {
	Name        *string                   `json:"name,omitempty"`
	Description *string                   `json:"description,omitempty"`
	Panels      *[]DashboardPanel         `json:"panels,omitempty"`
	Charts      *map[string]EmbeddedChart `json:"charts,omitempty"`
	Settings    *DashboardSettings        `json:"settings,omitempty"`
	Metadata    *map[string]interface{}   `json:"metadata,omitempty"`
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
