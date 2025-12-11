package models

import "time"

// ConfigScope represents the scope of a configuration
type ConfigScope string

const (
	ConfigScopeSystem ConfigScope = "system"
	ConfigScopeUser   ConfigScope = "user"
)

// AppConfig represents a configuration document stored in MongoDB
// Used for persistent settings that need to survive server restarts
type AppConfig struct {
	ID        string                 `json:"id" bson:"_id"`
	Scope     ConfigScope            `json:"scope" bson:"scope"`         // "system" or "user"
	UserID    string                 `json:"user_id,omitempty" bson:"user_id,omitempty"` // Only for user-scoped configs
	Settings  map[string]interface{} `json:"settings" bson:"settings"`   // Key-value settings
	Created   time.Time              `json:"created" bson:"created"`
	Updated   time.Time              `json:"updated" bson:"updated"`
}

// SystemConfigResponse is the API response for system configuration
type SystemConfigResponse struct {
	Settings              map[string]interface{}        `json:"settings"`
	LayoutDimensions      map[string]LayoutDimensionDTO `json:"layout_dimensions"`
	DefaultDimension      string                        `json:"default_dimension"`
	ConfigRefreshInterval int                           `json:"config_refresh_interval"` // seconds - how often frontend should refresh dashboard/chart config
}

// UserConfigResponse is the API response for user configuration
type UserConfigResponse struct {
	UserID   string                 `json:"user_id"`
	Settings map[string]interface{} `json:"settings"`
}

// LayoutDimensionDTO represents a layout dimension preset for API responses
type LayoutDimensionDTO struct {
	Name      string `json:"name"`
	MaxWidth  int    `json:"max_width"`
	MaxHeight int    `json:"max_height"`
}

// UpdateConfigRequest is the request body for updating configuration
type UpdateConfigRequest struct {
	Settings map[string]interface{} `json:"settings" binding:"required"`
}

// Common system config keys
const (
	ConfigKeyCurrentDimension = "current_layout_dimension"
)
