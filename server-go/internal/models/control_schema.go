// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

package models

import (
	"time"
)

// ControlSchema defines a reusable protocol for control communication
// @Description Schema that defines how controls communicate with connections
type ControlSchema struct {
	ID             string                 `json:"id" bson:"_id"`                                   // Unique identifier (e.g., "json-rpc-switch")
	Name           string                 `json:"name" bson:"name" binding:"required"`             // Human-readable name
	Description    string                 `json:"description" bson:"description"`                  // Schema description
	Version        string                 `json:"version" bson:"version"`                          // Schema version (e.g., "1.0")
	ProtocolType   string                 `json:"protocol_type" bson:"protocol_type"`              // Connection type this works with (e.g., "websocket-json", "mqtt", "tcp-json")
	SupportedTypes []string               `json:"supported_types" bson:"supported_types"`          // Control UI types this schema supports (toggle, scalar, button, text)
	Commands       map[string]CommandDef  `json:"commands" bson:"commands"`                        // Command definitions keyed by control type
	StateQuery     *StateQueryDef         `json:"state_query,omitempty" bson:"state_query"`        // How to query current state (optional)
	Response       *ResponseDef           `json:"response,omitempty" bson:"response"`              // How to parse responses (optional)
	IsBuiltIn      bool                   `json:"is_built_in" bson:"is_built_in"`                  // True for system default schemas (cannot modify/delete)
	Metadata       map[string]interface{} `json:"metadata,omitempty" bson:"metadata,omitempty"`    // Additional custom metadata
	Created        time.Time              `json:"created" bson:"created"`
	Updated        time.Time              `json:"updated" bson:"updated"`
}

// CommandDef defines how to format a command message for a specific control type
// @Description Template for formatting control commands
type CommandDef struct {
	Template map[string]interface{} `json:"template" bson:"template"`               // Message template with {{value}}, {{target}} placeholders
	ValueMap map[string]interface{} `json:"value_map,omitempty" bson:"value_map"`   // Optional value mapping (e.g., true -> "ON", false -> "OFF")
}

// StateQueryDef defines how to request current state from a connection
// @Description Configuration for querying control state
type StateQueryDef struct {
	Template   map[string]interface{} `json:"template" bson:"template"`       // Query message template
	IntervalMs int                    `json:"interval_ms" bson:"interval_ms"` // Auto-poll interval in milliseconds (0 = manual only)
}

// ResponseDef defines how to parse responses from a connection
// @Description Configuration for parsing connection responses
type ResponseDef struct {
	SuccessPath string                 `json:"success_path" bson:"success_path"` // JSONPath to success flag (e.g., "$.success")
	StatePath   string                 `json:"state_path" bson:"state_path"`     // JSONPath to current state value (e.g., "$.state")
	ErrorPath   string                 `json:"error_path" bson:"error_path"`     // JSONPath to error message (e.g., "$.error")
	ValueMap    map[string]interface{} `json:"value_map,omitempty" bson:"value_map"` // Reverse mapping (e.g., "ON" -> true, "OFF" -> false)
}

// CreateControlSchemaRequest represents a request to create a control schema
// @Description Request body for creating a new control schema
type CreateControlSchemaRequest struct {
	ID             string                 `json:"id" binding:"required"`              // Unique identifier
	Name           string                 `json:"name" binding:"required"`            // Human-readable name
	Description    string                 `json:"description"`                        // Schema description
	Version        string                 `json:"version"`                            // Schema version
	ProtocolType   string                 `json:"protocol_type" binding:"required"`   // Connection protocol type
	SupportedTypes []string               `json:"supported_types" binding:"required"` // Supported control types
	Commands       map[string]CommandDef  `json:"commands" binding:"required"`        // Command definitions
	StateQuery     *StateQueryDef         `json:"state_query,omitempty"`              // State query config
	Response       *ResponseDef           `json:"response,omitempty"`                 // Response parsing config
	Metadata       map[string]interface{} `json:"metadata,omitempty"`                 // Custom metadata
}

// UpdateControlSchemaRequest represents a request to update a control schema
// @Description Request body for updating an existing control schema
type UpdateControlSchemaRequest struct {
	Name           *string                 `json:"name,omitempty"`
	Description    *string                 `json:"description,omitempty"`
	Version        *string                 `json:"version,omitempty"`
	ProtocolType   *string                 `json:"protocol_type,omitempty"`
	SupportedTypes *[]string               `json:"supported_types,omitempty"`
	Commands       *map[string]CommandDef  `json:"commands,omitempty"`
	StateQuery     *StateQueryDef          `json:"state_query,omitempty"`
	Response       *ResponseDef            `json:"response,omitempty"`
	Metadata       *map[string]interface{} `json:"metadata,omitempty"`
}

// ControlSchemaListResponse represents a paginated list of control schemas
// @Description Response containing a list of control schemas
type ControlSchemaListResponse struct {
	Schemas  []ControlSchema `json:"schemas"`
	Total    int64           `json:"total"`
	Page     int             `json:"page"`
	PageSize int             `json:"page_size"`
}

// ControlSchemaQueryParams defines query parameters for listing schemas
// @Description Query parameters for filtering control schemas
type ControlSchemaQueryParams struct {
	ProtocolType string `form:"protocol_type"` // Filter by protocol type
	ControlType  string `form:"control_type"`  // Filter by supported control type
	BuiltInOnly  bool   `form:"built_in_only"` // Show only built-in schemas
	Page         int    `form:"page"`
	PageSize     int    `form:"page_size"`
}

// Control UI type constants (fixed set - how controls appear in UI)
const (
	ControlUITypeToggle = "toggle" // On/off switch, sends boolean
	ControlUITypeScalar = "scalar" // Slider/numeric input, sends number
	ControlUITypeButton = "button" // Action trigger, sends null
	ControlUITypeText   = "text"   // Text/command input, sends string
)

// ValidControlUITypes returns the list of valid control UI types
func ValidControlUITypes() []string {
	return []string{
		ControlUITypeToggle,
		ControlUITypeScalar,
		ControlUITypeButton,
		ControlUITypeText,
	}
}

// IsValidControlUIType checks if a control type is valid
func IsValidControlUIType(controlType string) bool {
	for _, t := range ValidControlUITypes() {
		if t == controlType {
			return true
		}
	}
	return false
}
