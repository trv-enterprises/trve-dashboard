// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

package service

import (
	"context"
	"fmt"

	"github.com/tviviano/dashboard/internal/models"
	"github.com/tviviano/dashboard/internal/repository"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// DeviceService handles device business logic
type DeviceService struct {
	repo           *repository.DeviceRepository
	deviceTypeRepo *repository.DeviceTypeRepository
	datasourceRepo *repository.DatasourceRepository
}

// NewDeviceService creates a new device service
func NewDeviceService(
	repo *repository.DeviceRepository,
	deviceTypeRepo *repository.DeviceTypeRepository,
	datasourceRepo *repository.DatasourceRepository,
) *DeviceService {
	return &DeviceService{
		repo:           repo,
		deviceTypeRepo: deviceTypeRepo,
		datasourceRepo: datasourceRepo,
	}
}

// CreateDevice creates a new device with cross-entity validation
func (s *DeviceService) CreateDevice(ctx context.Context, req *models.CreateDeviceRequest) (*models.Device, error) {
	// Validate device type exists
	dt, err := s.deviceTypeRepo.FindByID(ctx, req.DeviceTypeID)
	if err != nil {
		return nil, fmt.Errorf("error validating device type: %w", err)
	}
	if dt == nil {
		return nil, fmt.Errorf("device type '%s' not found", req.DeviceTypeID)
	}

	// Validate connection exists
	ds, err := s.datasourceRepo.FindByID(ctx, req.ConnectionID)
	if err != nil {
		return nil, fmt.Errorf("error validating connection: %w", err)
	}
	if ds == nil {
		return nil, fmt.Errorf("connection '%s' not found", req.ConnectionID)
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	device := &models.Device{
		Name:         req.Name,
		DeviceTypeID: req.DeviceTypeID,
		ConnectionID: req.ConnectionID,
		Target:       req.Target,
		StateTopic:   req.StateTopic,
		Room:         req.Room,
		Tags:         req.Tags,
		Enabled:      enabled,
		Metadata:     req.Metadata,
	}

	if device.Tags == nil {
		device.Tags = []string{}
	}

	if err := s.repo.Create(ctx, device); err != nil {
		return nil, fmt.Errorf("error creating device: %w", err)
	}

	return device, nil
}

// GetDevice retrieves a device by ID
func (s *DeviceService) GetDevice(ctx context.Context, id string) (*models.Device, error) {
	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, fmt.Errorf("invalid device ID format")
	}

	device, err := s.repo.FindByID(ctx, objID)
	if err != nil {
		return nil, fmt.Errorf("error retrieving device: %w", err)
	}
	if device == nil {
		return nil, fmt.Errorf("device not found")
	}
	return device, nil
}

// UpdateDevice updates an existing device with validation
func (s *DeviceService) UpdateDevice(ctx context.Context, id string, req *models.UpdateDeviceRequest) (*models.Device, error) {
	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, fmt.Errorf("invalid device ID format")
	}

	existing, err := s.repo.FindByID(ctx, objID)
	if err != nil {
		return nil, fmt.Errorf("error retrieving device: %w", err)
	}
	if existing == nil {
		return nil, fmt.Errorf("device not found")
	}

	// Validate device type if being changed
	if req.DeviceTypeID != nil {
		dt, err := s.deviceTypeRepo.FindByID(ctx, *req.DeviceTypeID)
		if err != nil {
			return nil, fmt.Errorf("error validating device type: %w", err)
		}
		if dt == nil {
			return nil, fmt.Errorf("device type '%s' not found", *req.DeviceTypeID)
		}
	}

	// Validate connection if being changed
	if req.ConnectionID != nil {
		ds, err := s.datasourceRepo.FindByID(ctx, *req.ConnectionID)
		if err != nil {
			return nil, fmt.Errorf("error validating connection: %w", err)
		}
		if ds == nil {
			return nil, fmt.Errorf("connection '%s' not found", *req.ConnectionID)
		}
	}

	if err := s.repo.Update(ctx, objID, req); err != nil {
		return nil, fmt.Errorf("error updating device: %w", err)
	}

	return s.GetDevice(ctx, id)
}

// DeleteDevice deletes a device by ID
func (s *DeviceService) DeleteDevice(ctx context.Context, id string) error {
	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return fmt.Errorf("invalid device ID format")
	}

	existing, err := s.repo.FindByID(ctx, objID)
	if err != nil {
		return fmt.Errorf("error retrieving device: %w", err)
	}
	if existing == nil {
		return fmt.Errorf("device not found")
	}

	if err := s.repo.Delete(ctx, objID); err != nil {
		return fmt.Errorf("error deleting device: %w", err)
	}

	return nil
}

// ListDevices retrieves devices with filtering and pagination
func (s *DeviceService) ListDevices(ctx context.Context, params *models.DeviceQueryParams) (*models.DeviceListResponse, error) {
	devices, total, err := s.repo.List(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("error listing devices: %w", err)
	}
	if devices == nil {
		devices = []models.Device{}
	}

	page := params.Page
	if page < 1 {
		page = 1
	}
	pageSize := params.PageSize
	if pageSize < 1 {
		pageSize = 50
	}

	return &models.DeviceListResponse{
		Devices:  devices,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

// ImportDevices bulk-creates devices from a discovery import
func (s *DeviceService) ImportDevices(ctx context.Context, req *models.ImportDevicesRequest) ([]models.Device, error) {
	// Validate connection exists
	ds, err := s.datasourceRepo.FindByID(ctx, req.ConnectionID)
	if err != nil {
		return nil, fmt.Errorf("error validating connection: %w", err)
	}
	if ds == nil {
		return nil, fmt.Errorf("connection '%s' not found", req.ConnectionID)
	}

	var imported []models.Device
	for _, entry := range req.Devices {
		// Validate device type
		dt, err := s.deviceTypeRepo.FindByID(ctx, entry.DeviceTypeID)
		if err != nil {
			return nil, fmt.Errorf("error validating device type '%s': %w", entry.DeviceTypeID, err)
		}
		if dt == nil {
			return nil, fmt.Errorf("device type '%s' not found", entry.DeviceTypeID)
		}

		// Build target and state topic from topic pattern
		stateTopic := ""
		target := ""
		if dt.TopicPattern != "" {
			// Replace {device_name} with friendly_name
			stateTopic = replaceDeviceName(dt.TopicPattern, entry.FriendlyName)
			target = stateTopic + "/set"
		}

		device := &models.Device{
			Name:         entry.Name,
			DeviceTypeID: entry.DeviceTypeID,
			ConnectionID: req.ConnectionID,
			Target:       target,
			StateTopic:   stateTopic,
			Room:         entry.Room,
			Tags:         []string{},
			Enabled:      true,
			Metadata: map[string]interface{}{
				"friendly_name": entry.FriendlyName,
				"imported":      true,
			},
		}

		if err := s.repo.Create(ctx, device); err != nil {
			return nil, fmt.Errorf("error creating device '%s': %w", entry.Name, err)
		}

		imported = append(imported, *device)
	}

	return imported, nil
}

// replaceDeviceName replaces {device_name} in a topic pattern with the actual name
func replaceDeviceName(pattern string, name string) string {
	result := ""
	i := 0
	for i < len(pattern) {
		if i+len("{device_name}") <= len(pattern) && pattern[i:i+len("{device_name}")] == "{device_name}" {
			result += name
			i += len("{device_name}")
		} else {
			result += string(pattern[i])
			i++
		}
	}
	return result
}
