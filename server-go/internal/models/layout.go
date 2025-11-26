package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Layout represents a dashboard layout with grid-based panel positioning
type Layout struct {
	ID          primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	Name        string             `json:"name" bson:"name" binding:"required"`
	Description string             `json:"description" bson:"description"`
	Grid        GridConfig         `json:"grid" bson:"grid"`
	Panels      []Panel            `json:"panels" bson:"panels"`
	CreatedAt   time.Time          `json:"created_at" bson:"created_at"`
	UpdatedAt   time.Time          `json:"updated_at" bson:"updated_at"`
}

// GridConfig defines the grid system configuration
type GridConfig struct {
	Columns    int `json:"columns" bson:"columns"`       // Number of columns (e.g., 12)
	RowHeight  int `json:"row_height" bson:"row_height"` // Height of each row in pixels
	MaxRows    int `json:"max_rows" bson:"max_rows"`     // Maximum number of rows
	GridUnit   int `json:"grid_unit" bson:"grid_unit"`   // Base spacing unit (32px = $spacing-08)
	CompactType string `json:"compact_type" bson:"compact_type"` // "vertical", "horizontal", or null
}

// Panel represents a single panel in the layout
type Panel struct {
	ID       string       `json:"id" bson:"id" binding:"required"`             // Unique panel identifier
	X        int          `json:"x" bson:"x" binding:"required"`               // Column position (0-indexed)
	Y        int          `json:"y" bson:"y" binding:"required"`               // Row position (0-indexed)
	Width    int          `json:"w" bson:"w" binding:"required,min=1"`         // Width in columns
	Height   int          `json:"h" bson:"h" binding:"required,min=1"`         // Height in rows
	MinW     int          `json:"min_w,omitempty" bson:"min_w,omitempty"`      // Minimum width
	MinH     int          `json:"min_h,omitempty" bson:"min_h,omitempty"`      // Minimum height
	MaxW     int          `json:"max_w,omitempty" bson:"max_w,omitempty"`      // Maximum width
	MaxH     int          `json:"max_h,omitempty" bson:"max_h,omitempty"`      // Maximum height
	Static   bool         `json:"static,omitempty" bson:"static,omitempty"`    // Cannot be moved/resized
	Content  PanelContent `json:"content,omitempty" bson:"content,omitempty"`  // Panel content reference
}

// PanelContent references what should be displayed in the panel
type PanelContent struct {
	Type       string `json:"type" bson:"type"`                           // "chart", "text", "image", "custom"
	ChartID    string `json:"chart_id,omitempty" bson:"chart_id,omitempty"`       // Reference to chart component
	ComponentID string `json:"component_id,omitempty" bson:"component_id,omitempty"` // Reference to custom component
	Config     map[string]interface{} `json:"config,omitempty" bson:"config,omitempty"` // Panel-specific configuration
}

// CreateLayoutRequest is the request body for creating a layout
type CreateLayoutRequest struct {
	Name        string     `json:"name" binding:"required"`
	Description string     `json:"description"`
	Grid        GridConfig `json:"grid"`
	Panels      []Panel    `json:"panels"`
}

// UpdateLayoutRequest is the request body for updating a layout
type UpdateLayoutRequest struct {
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Grid        GridConfig `json:"grid"`
	Panels      []Panel    `json:"panels"`
}

// DefaultGridConfig returns a default grid configuration
func DefaultGridConfig() GridConfig {
	return GridConfig{
		Columns:    12,
		RowHeight:  32, // $spacing-08
		MaxRows:    50,
		GridUnit:   32,
		CompactType: "vertical",
	}
}
