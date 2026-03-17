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

// DeviceTypeService handles device type business logic
type DeviceTypeService struct {
	repo *repository.DeviceTypeRepository
}

// NewDeviceTypeService creates a new device type service
func NewDeviceTypeService(repo *repository.DeviceTypeRepository) *DeviceTypeService {
	return &DeviceTypeService{
		repo: repo,
	}
}

// CreateDeviceType creates a new device type with validation
func (s *DeviceTypeService) CreateDeviceType(ctx context.Context, req *models.CreateDeviceTypeRequest) (*models.DeviceType, error) {
	// Check ID uniqueness
	existing, err := s.repo.FindByID(ctx, req.ID)
	if err != nil {
		return nil, fmt.Errorf("error checking ID uniqueness: %w", err)
	}
	if existing != nil {
		return nil, fmt.Errorf("device type with ID '%s' already exists", req.ID)
	}

	// Validate category
	if !models.IsValidDeviceCategory(req.Category) {
		return nil, fmt.Errorf("invalid category '%s', must be one of: %v", req.Category, models.ValidDeviceCategories())
	}

	dt := &models.DeviceType{
		ID:           req.ID,
		Name:         req.Name,
		Description:  req.Description,
		Category:     req.Category,
		Subtype:      req.Subtype,
		Protocol:     req.Protocol,
		SchemaIDs:    req.SchemaIDs,
		Capabilities: req.Capabilities,
		TopicPattern: req.TopicPattern,
		IsBuiltIn:    false,
		Metadata:     req.Metadata,
	}

	if dt.SchemaIDs == nil {
		dt.SchemaIDs = []string{}
	}
	if dt.Capabilities == nil {
		dt.Capabilities = []models.DeviceCapability{}
	}

	if err := s.repo.Create(ctx, dt); err != nil {
		return nil, fmt.Errorf("error creating device type: %w", err)
	}

	return dt, nil
}

// GetDeviceType retrieves a device type by ID
func (s *DeviceTypeService) GetDeviceType(ctx context.Context, id string) (*models.DeviceType, error) {
	dt, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("error retrieving device type: %w", err)
	}
	if dt == nil {
		return nil, fmt.Errorf("device type not found")
	}
	return dt, nil
}

// UpdateDeviceType updates an existing device type with validation
func (s *DeviceTypeService) UpdateDeviceType(ctx context.Context, id string, req *models.UpdateDeviceTypeRequest) (*models.DeviceType, error) {
	existing, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("error retrieving device type: %w", err)
	}
	if existing == nil {
		return nil, fmt.Errorf("device type not found")
	}

	if existing.IsBuiltIn {
		return nil, fmt.Errorf("cannot modify built-in device type '%s'", id)
	}

	if req.Category != nil && !models.IsValidDeviceCategory(*req.Category) {
		return nil, fmt.Errorf("invalid category '%s', must be one of: %v", *req.Category, models.ValidDeviceCategories())
	}

	if err := s.repo.Update(ctx, id, req); err != nil {
		return nil, fmt.Errorf("error updating device type: %w", err)
	}

	return s.GetDeviceType(ctx, id)
}

// DeleteDeviceType deletes a device type by ID
func (s *DeviceTypeService) DeleteDeviceType(ctx context.Context, id string) error {
	existing, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return fmt.Errorf("error retrieving device type: %w", err)
	}
	if existing == nil {
		return fmt.Errorf("device type not found")
	}

	if existing.IsBuiltIn {
		return fmt.Errorf("cannot delete built-in device type '%s'", id)
	}

	if err := s.repo.Delete(ctx, id); err != nil {
		return fmt.Errorf("error deleting device type: %w", err)
	}

	return nil
}

// ListDeviceTypes retrieves device types with filtering and pagination
func (s *DeviceTypeService) ListDeviceTypes(ctx context.Context, params *models.DeviceTypeQueryParams) (*models.DeviceTypeListResponse, error) {
	deviceTypes, total, err := s.repo.List(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("error listing device types: %w", err)
	}
	if deviceTypes == nil {
		deviceTypes = []models.DeviceType{}
	}

	page := params.Page
	if page < 1 {
		page = 1
	}
	pageSize := params.PageSize
	if pageSize < 1 {
		pageSize = 50
	}

	return &models.DeviceTypeListResponse{
		DeviceTypes: deviceTypes,
		Total:       total,
		Page:        page,
		PageSize:    pageSize,
	}, nil
}

// SeedBuiltInDeviceTypes seeds the built-in device types into the database
func (s *DeviceTypeService) SeedBuiltInDeviceTypes(ctx context.Context) error {
	builtInTypes := getBuiltInDeviceTypes()

	for _, dt := range builtInTypes {
		if err := s.repo.UpsertBuiltIn(ctx, &dt); err != nil {
			return fmt.Errorf("error seeding built-in device type '%s': %w", dt.ID, err)
		}
	}

	return nil
}

func ptr(v float64) *float64 {
	return &v
}

// getBuiltInDeviceTypes returns the list of built-in device types
func getBuiltInDeviceTypes() []models.DeviceType {
	return []models.DeviceType{
		{
			ID:          "zigbee-switch",
			Name:        "Zigbee Switch/Plug",
			Description: "On/off switch or smart plug controlled via Zigbee2MQTT",
			Category:    models.DeviceCategorySwitch,
			Subtype:     "plug",
			Protocol:    "mqtt",
			SchemaIDs:   []string{"zigbee2mqtt-switch"},
			Capabilities: []models.DeviceCapability{
				{
					Name:      "state",
					Type:      "binary",
					Access:    7, // read + write + report
					StatePath: "$.state",
				},
			},
			TopicPattern: "zigbee2mqtt/{device_name}",
			IsBuiltIn:    true,
		},
		{
			ID:          "zigbee-dimmer",
			Name:        "Zigbee Dimmer",
			Description: "Dimmable light controlled via Zigbee2MQTT",
			Category:    models.DeviceCategoryLight,
			Subtype:     "dimmer",
			Protocol:    "mqtt",
			SchemaIDs:   []string{"zigbee2mqtt-switch", "zigbee2mqtt-brightness"},
			Capabilities: []models.DeviceCapability{
				{
					Name:      "state",
					Type:      "binary",
					Access:    7,
					StatePath: "$.state",
				},
				{
					Name:      "brightness",
					Type:      "numeric",
					Access:    7,
					ValueMin:  ptr(0),
					ValueMax:  ptr(254),
					StatePath: "$.brightness",
				},
			},
			TopicPattern: "zigbee2mqtt/{device_name}",
			IsBuiltIn:    true,
		},
		{
			ID:          "caseta-switch",
			Name:        "Caseta Switch",
			Description: "On/off light switch controlled via Lutron Caseta bridge over MQTT",
			Category:    models.DeviceCategorySwitch,
			Subtype:     "switch",
			Protocol:    "mqtt",
			SchemaIDs:   []string{"caseta-switch"},
			Capabilities: []models.DeviceCapability{
				{
					Name:      "state",
					Type:      "binary",
					Access:    7, // read + write + report
					StatePath: "$.state",
				},
			},
			TopicPattern: "caseta/{device_name}",
			IsBuiltIn:    true,
		},
		{
			ID:          "caseta-dimmer",
			Name:        "Caseta Dimmer",
			Description: "Dimmable light controlled via Lutron Caseta bridge over MQTT",
			Category:    models.DeviceCategoryLight,
			Subtype:     "dimmer",
			Protocol:    "mqtt",
			SchemaIDs:   []string{"caseta-switch", "caseta-dimmer"},
			Capabilities: []models.DeviceCapability{
				{
					Name:      "state",
					Type:      "binary",
					Access:    7, // read + write + report
					StatePath: "$.state",
				},
				{
					Name:      "level",
					Type:      "numeric",
					Access:    7,
					ValueMin:  ptr(0),
					ValueMax:  ptr(100),
					Unit:      "%",
					StatePath: "$.level",
				},
			},
			TopicPattern: "caseta/{device_name}",
			IsBuiltIn:    true,
		},
		{
			ID:          "caseta-shade",
			Name:        "Caseta Shade",
			Description: "Window shade/blind controlled via Lutron Caseta bridge over MQTT",
			Category:    models.DeviceCategoryCover,
			Subtype:     "shade",
			Protocol:    "mqtt",
			SchemaIDs:   []string{"caseta-switch", "caseta-dimmer"},
			Capabilities: []models.DeviceCapability{
				{
					Name:      "state",
					Type:      "binary",
					Access:    7,
					StatePath: "$.state",
				},
				{
					Name:      "level",
					Type:      "numeric",
					Access:    7,
					ValueMin:  ptr(0),
					ValueMax:  ptr(100),
					Unit:      "%",
					StatePath: "$.level",
				},
			},
			TopicPattern: "caseta/{device_name}",
			IsBuiltIn:    true,
		},
		{
			ID:          "caseta-fan",
			Name:        "Caseta Fan",
			Description: "Fan speed control via Lutron Caseta bridge over MQTT",
			Category:    models.DeviceCategoryOther,
			Subtype:     "fan",
			Protocol:    "mqtt",
			SchemaIDs:   []string{"caseta-switch", "caseta-dimmer"},
			Capabilities: []models.DeviceCapability{
				{
					Name:      "state",
					Type:      "binary",
					Access:    7,
					StatePath: "$.state",
				},
				{
					Name:      "level",
					Type:      "numeric",
					Access:    7,
					ValueMin:  ptr(0),
					ValueMax:  ptr(100),
					Unit:      "%",
					StatePath: "$.level",
				},
			},
			TopicPattern: "caseta/{device_name}",
			IsBuiltIn:    true,
		},
	}
}
