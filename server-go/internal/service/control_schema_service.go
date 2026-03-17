// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

package service

import (
	"context"
	"fmt"

	"github.com/tviviano/dashboard/internal/models"
	"github.com/tviviano/dashboard/internal/repository"
)

// ControlSchemaService handles control schema business logic
type ControlSchemaService struct {
	repo *repository.ControlSchemaRepository
}

// NewControlSchemaService creates a new control schema service
func NewControlSchemaService(repo *repository.ControlSchemaRepository) *ControlSchemaService {
	return &ControlSchemaService{
		repo: repo,
	}
}

// CreateSchema creates a new control schema with validation
func (s *ControlSchemaService) CreateSchema(ctx context.Context, req *models.CreateControlSchemaRequest) (*models.ControlSchema, error) {
	// Check ID uniqueness
	existing, err := s.repo.FindByID(ctx, req.ID)
	if err != nil {
		return nil, fmt.Errorf("error checking ID uniqueness: %w", err)
	}
	if existing != nil {
		return nil, fmt.Errorf("control schema with ID '%s' already exists", req.ID)
	}

	// Validate supported types
	for _, t := range req.SupportedTypes {
		if !models.IsValidControlUIType(t) {
			return nil, fmt.Errorf("invalid control type '%s', must be one of: %v", t, models.ValidControlUITypes())
		}
	}

	// Validate commands match supported types
	for controlType := range req.Commands {
		found := false
		for _, t := range req.SupportedTypes {
			if t == controlType {
				found = true
				break
			}
		}
		if !found {
			return nil, fmt.Errorf("command defined for type '%s' but not in supported_types", controlType)
		}
	}

	// Set default version if not provided
	version := req.Version
	if version == "" {
		version = "1.0"
	}

	schema := &models.ControlSchema{
		ID:             req.ID,
		Name:           req.Name,
		Description:    req.Description,
		Version:        version,
		ProtocolType:   req.ProtocolType,
		SupportedTypes: req.SupportedTypes,
		Commands:       req.Commands,
		StateQuery:     req.StateQuery,
		Response:       req.Response,
		IsBuiltIn:      false, // User-created schemas are never built-in
		Metadata:       req.Metadata,
	}

	if err := s.repo.Create(ctx, schema); err != nil {
		return nil, fmt.Errorf("error creating control schema: %w", err)
	}

	return schema, nil
}

// GetSchema retrieves a control schema by ID
func (s *ControlSchemaService) GetSchema(ctx context.Context, id string) (*models.ControlSchema, error) {
	schema, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("error retrieving control schema: %w", err)
	}
	if schema == nil {
		return nil, fmt.Errorf("control schema not found")
	}
	return schema, nil
}

// UpdateSchema updates an existing control schema with validation
func (s *ControlSchemaService) UpdateSchema(ctx context.Context, id string, req *models.UpdateControlSchemaRequest) (*models.ControlSchema, error) {
	// Get existing schema
	existing, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("error retrieving control schema: %w", err)
	}
	if existing == nil {
		return nil, fmt.Errorf("control schema not found")
	}

	// Prevent modification of built-in schemas
	if existing.IsBuiltIn {
		return nil, fmt.Errorf("cannot modify built-in schema '%s'", id)
	}

	// Validate supported types if being updated
	if req.SupportedTypes != nil {
		for _, t := range *req.SupportedTypes {
			if !models.IsValidControlUIType(t) {
				return nil, fmt.Errorf("invalid control type '%s', must be one of: %v", t, models.ValidControlUITypes())
			}
		}
	}

	// Validate commands match supported types if commands being updated
	if req.Commands != nil {
		supportedTypes := existing.SupportedTypes
		if req.SupportedTypes != nil {
			supportedTypes = *req.SupportedTypes
		}
		for controlType := range *req.Commands {
			found := false
			for _, t := range supportedTypes {
				if t == controlType {
					found = true
					break
				}
			}
			if !found {
				return nil, fmt.Errorf("command defined for type '%s' but not in supported_types", controlType)
			}
		}
	}

	if err := s.repo.Update(ctx, id, req); err != nil {
		return nil, fmt.Errorf("error updating control schema: %w", err)
	}

	// Retrieve and return updated schema
	return s.GetSchema(ctx, id)
}

// DeleteSchema deletes a control schema by ID
func (s *ControlSchemaService) DeleteSchema(ctx context.Context, id string) error {
	// Get existing schema to check if it's built-in
	existing, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return fmt.Errorf("error retrieving control schema: %w", err)
	}
	if existing == nil {
		return fmt.Errorf("control schema not found")
	}

	// Prevent deletion of built-in schemas
	if existing.IsBuiltIn {
		return fmt.Errorf("cannot delete built-in schema '%s'", id)
	}

	if err := s.repo.Delete(ctx, id); err != nil {
		return fmt.Errorf("error deleting control schema: %w", err)
	}

	return nil
}

// ListSchemas retrieves control schemas with filtering and pagination
func (s *ControlSchemaService) ListSchemas(ctx context.Context, params *models.ControlSchemaQueryParams) (*models.ControlSchemaListResponse, error) {
	schemas, total, err := s.repo.List(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("error listing control schemas: %w", err)
	}

	page := params.Page
	if page < 1 {
		page = 1
	}
	pageSize := params.PageSize
	if pageSize < 1 {
		pageSize = 50
	}

	return &models.ControlSchemaListResponse{
		Schemas:  schemas,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

// GetSchemasForProtocol retrieves all schemas compatible with a protocol type
func (s *ControlSchemaService) GetSchemasForProtocol(ctx context.Context, protocolType string) ([]models.ControlSchema, error) {
	schemas, err := s.repo.FindByProtocolType(ctx, protocolType)
	if err != nil {
		return nil, fmt.Errorf("error retrieving schemas for protocol: %w", err)
	}
	return schemas, nil
}

// GetSchemasForControlType retrieves all schemas that support a control type
func (s *ControlSchemaService) GetSchemasForControlType(ctx context.Context, controlType string) ([]models.ControlSchema, error) {
	if !models.IsValidControlUIType(controlType) {
		return nil, fmt.Errorf("invalid control type '%s'", controlType)
	}
	schemas, err := s.repo.FindByControlType(ctx, controlType)
	if err != nil {
		return nil, fmt.Errorf("error retrieving schemas for control type: %w", err)
	}
	return schemas, nil
}

// SeedBuiltInSchemas seeds the built-in control schemas into the database
func (s *ControlSchemaService) SeedBuiltInSchemas(ctx context.Context) error {
	builtInSchemas := getBuiltInSchemas()

	for _, schema := range builtInSchemas {
		if err := s.repo.UpsertBuiltIn(ctx, &schema); err != nil {
			return fmt.Errorf("error seeding built-in schema '%s': %w", schema.ID, err)
		}
	}

	return nil
}

// getBuiltInSchemas returns the list of built-in control schemas
func getBuiltInSchemas() []models.ControlSchema {
	return []models.ControlSchema{
		{
			ID:           "json-rpc-switch",
			Name:         "JSON-RPC Switch Control",
			Description:  "Standard JSON-RPC style on/off control with state query",
			Version:      "1.0",
			ProtocolType: "websocket-json",
			SupportedTypes: []string{
				models.ControlUITypeToggle,
				models.ControlUITypeButton,
			},
			Commands: map[string]models.CommandDef{
				models.ControlUITypeToggle: {
					Template: map[string]interface{}{
						"action": "set",
						"device": "{{target}}",
						"state":  "{{value}}",
					},
					ValueMap: map[string]interface{}{
						"true":  "on",
						"false": "off",
					},
				},
				models.ControlUITypeButton: {
					Template: map[string]interface{}{
						"action": "trigger",
						"device": "{{target}}",
					},
				},
			},
			StateQuery: &models.StateQueryDef{
				Template: map[string]interface{}{
					"action": "get",
					"device": "{{target}}",
				},
				IntervalMs: 5000,
			},
			Response: &models.ResponseDef{
				SuccessPath: "$.success",
				StatePath:   "$.state",
				ErrorPath:   "$.error",
				ValueMap: map[string]interface{}{
					"on":  true,
					"off": false,
				},
			},
			IsBuiltIn: true,
		},
		{
			ID:           "json-rpc-scalar",
			Name:         "JSON-RPC Scalar Control",
			Description:  "JSON-RPC style numeric/range control",
			Version:      "1.0",
			ProtocolType: "websocket-json",
			SupportedTypes: []string{
				models.ControlUITypeScalar,
				models.ControlUITypeText,
			},
			Commands: map[string]models.CommandDef{
				models.ControlUITypeScalar: {
					Template: map[string]interface{}{
						"action": "set",
						"device": "{{target}}",
						"value":  "{{value}}",
					},
				},
				models.ControlUITypeText: {
					Template: map[string]interface{}{
						"action":  "send",
						"device":  "{{target}}",
						"command": "{{value}}",
					},
				},
			},
			StateQuery: &models.StateQueryDef{
				Template: map[string]interface{}{
					"action": "get",
					"device": "{{target}}",
				},
				IntervalMs: 5000,
			},
			Response: &models.ResponseDef{
				SuccessPath: "$.success",
				StatePath:   "$.value",
				ErrorPath:   "$.error",
			},
			IsBuiltIn: true,
		},
		{
			ID:           "zigbee2mqtt-switch",
			Name:         "Zigbee2MQTT Switch",
			Description:  "On/off control for Zigbee2MQTT devices. Publishes {\"state\": \"ON/OFF\"} to <device>/set topic.",
			Version:      "1.0",
			ProtocolType: "mqtt",
			SupportedTypes: []string{
				models.ControlUITypeToggle,
				models.ControlUITypePlug,
				models.ControlUITypeButton,
			},
			Commands: map[string]models.CommandDef{
				models.ControlUITypeToggle: {
					Template: map[string]interface{}{"state": "{{value}}"},
					ValueMap: map[string]interface{}{"true": "ON", "false": "OFF"},
				},
				models.ControlUITypePlug: {
					Template: map[string]interface{}{"state": "{{value}}"},
					ValueMap: map[string]interface{}{"true": "ON", "false": "OFF"},
				},
				models.ControlUITypeButton: {
					Template: map[string]interface{}{"state": "TOGGLE"},
				},
			},
			Response: &models.ResponseDef{
				StatePath: "$.state",
				ValueMap:  map[string]interface{}{"ON": true, "OFF": false},
			},
			IsBuiltIn: true,
		},
		{
			ID:           "zigbee2mqtt-brightness",
			Name:         "Zigbee2MQTT Brightness",
			Description:  "Brightness control for Zigbee2MQTT dimmable devices. Publishes {\"brightness\": N} to <device>/set topic.",
			Version:      "1.0",
			ProtocolType: "mqtt",
			SupportedTypes: []string{
				models.ControlUITypeScalar,
				models.ControlUITypeDimmer,
			},
			Commands: map[string]models.CommandDef{
				models.ControlUITypeScalar: {
					Template: map[string]interface{}{"brightness": "{{value}}"},
				},
				models.ControlUITypeDimmer: {
					Template: map[string]interface{}{"brightness": "{{value}}"},
				},
			},
			Response: &models.ResponseDef{
				StatePath: "$.brightness",
			},
			IsBuiltIn: true,
		},
		{
			ID:           "caseta-switch",
			Name:         "Caseta Switch",
			Description:  "On/off control for Lutron Caseta devices. Publishes {\"action\": \"turn_on/turn_off\"} to caseta/<device>/set topic.",
			Version:      "1.0",
			ProtocolType: "mqtt",
			SupportedTypes: []string{
				models.ControlUITypeToggle,
				models.ControlUITypePlug,
				models.ControlUITypeButton,
			},
			Commands: map[string]models.CommandDef{
				models.ControlUITypeToggle: {
					Template: map[string]interface{}{"action": "{{value}}"},
					ValueMap: map[string]interface{}{"true": "turn_on", "false": "turn_off"},
				},
				models.ControlUITypePlug: {
					Template: map[string]interface{}{"action": "{{value}}"},
					ValueMap: map[string]interface{}{"true": "turn_on", "false": "turn_off"},
				},
				models.ControlUITypeButton: {
					Template: map[string]interface{}{"action": "turn_on"},
				},
			},
			Response: &models.ResponseDef{
				StatePath: "$.state",
				ValueMap:  map[string]interface{}{"on": true, "off": false},
			},
			IsBuiltIn: true,
		},
		{
			ID:           "caseta-dimmer",
			Name:         "Caseta Dimmer",
			Description:  "Level control for Lutron Caseta dimmable devices. Publishes {\"action\": \"set_level\", \"level\": N} to caseta/<device>/set topic.",
			Version:      "1.0",
			ProtocolType: "mqtt",
			SupportedTypes: []string{
				models.ControlUITypeScalar,
				models.ControlUITypeDimmer,
			},
			Commands: map[string]models.CommandDef{
				models.ControlUITypeScalar: {
					Template: map[string]interface{}{"action": "set_level", "level": "{{value}}"},
				},
				models.ControlUITypeDimmer: {
					Template: map[string]interface{}{"action": "set_level", "level": "{{value}}"},
				},
			},
			Response: &models.ResponseDef{
				StatePath: "$.level",
			},
			IsBuiltIn: true,
		},
	}
}
