// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

package service

import (
	"context"
	"fmt"

	"github.com/tviviano/dashboard/config"
	"github.com/tviviano/dashboard/internal/models"
	"github.com/tviviano/dashboard/internal/repository"
)

// ConfigService handles business logic for app configuration
type ConfigService struct {
	repo                  *repository.ConfigRepository
	layoutDimensions      map[string]config.LayoutDimension
	dimensionOrder        []string // Maintains order from config file
	configRefreshInterval int      // seconds - how often frontend should refresh config
}

// NewConfigService creates a new ConfigService
func NewConfigService(repo *repository.ConfigRepository, cfg *config.Config) *ConfigService {
	// Extract dimension keys in order (first one is default)
	// Note: Go maps don't preserve order, so we need to handle this
	// The config.yaml order is: 1920x1080, 2056x1329, 2992x1934, 3456x2160
	dimensionOrder := []string{"1920x1080", "2056x1329", "2992x1934", "3456x2160"}

	// Default to 120 seconds if not configured
	configRefreshInterval := cfg.Dashboard.ConfigRefreshInterval
	if configRefreshInterval <= 0 {
		configRefreshInterval = 120
	}

	return &ConfigService{
		repo:                  repo,
		layoutDimensions:      cfg.LayoutDimensions,
		dimensionOrder:        dimensionOrder,
		configRefreshInterval: configRefreshInterval,
	}
}

// GetSystemConfig retrieves system configuration with layout dimensions
func (s *ConfigService) GetSystemConfig(ctx context.Context) (*models.SystemConfigResponse, error) {
	appConfig, err := s.repo.GetSystemConfig(ctx)
	if err != nil {
		return nil, err
	}

	// Build layout dimensions map for response
	dimensions := make(map[string]models.LayoutDimensionDTO)
	for name, dim := range s.layoutDimensions {
		dimensions[name] = models.LayoutDimensionDTO{
			Name:      name,
			MaxWidth:  dim.MaxWidth,
			MaxHeight: dim.MaxHeight,
		}
	}

	// Determine default dimension (first in order)
	defaultDimension := ""
	if len(s.dimensionOrder) > 0 {
		defaultDimension = s.dimensionOrder[0]
	}

	// If no current dimension is set, use the default
	if appConfig.Settings == nil {
		appConfig.Settings = make(map[string]interface{})
	}
	if _, exists := appConfig.Settings[models.ConfigKeyCurrentDimension]; !exists {
		appConfig.Settings[models.ConfigKeyCurrentDimension] = defaultDimension
	}

	return &models.SystemConfigResponse{
		Settings:              appConfig.Settings,
		LayoutDimensions:      dimensions,
		DefaultDimension:      defaultDimension,
		ConfigRefreshInterval: s.configRefreshInterval,
	}, nil
}

// UpdateSystemConfig updates system configuration
func (s *ConfigService) UpdateSystemConfig(ctx context.Context, settings map[string]interface{}) (*models.SystemConfigResponse, error) {
	// Validate dimension setting if provided
	if dimValue, exists := settings[models.ConfigKeyCurrentDimension]; exists {
		dimName, ok := dimValue.(string)
		if !ok {
			return nil, fmt.Errorf("invalid dimension value type")
		}
		if _, valid := s.layoutDimensions[dimName]; !valid {
			return nil, fmt.Errorf("invalid dimension: %s", dimName)
		}
	}

	_, err := s.repo.UpsertSystemConfig(ctx, settings)
	if err != nil {
		return nil, err
	}

	return s.GetSystemConfig(ctx)
}

// GetCurrentDimension gets the current layout dimension
func (s *ConfigService) GetCurrentDimension(ctx context.Context) (string, *config.LayoutDimension, error) {
	appConfig, err := s.repo.GetSystemConfig(ctx)
	if err != nil {
		return "", nil, err
	}

	// Get current dimension name
	dimName := ""
	if appConfig.Settings != nil {
		if val, exists := appConfig.Settings[models.ConfigKeyCurrentDimension]; exists {
			dimName, _ = val.(string)
		}
	}

	// Default to first dimension if not set
	if dimName == "" && len(s.dimensionOrder) > 0 {
		dimName = s.dimensionOrder[0]
	}

	dim, exists := s.layoutDimensions[dimName]
	if !exists {
		return "", nil, fmt.Errorf("dimension not found: %s", dimName)
	}

	return dimName, &dim, nil
}

// ValidatePanelBounds checks if panels fit within the given dimension
func (s *ConfigService) ValidatePanelBounds(panels []models.DashboardPanel, dimensionName string) error {
	dim, exists := s.layoutDimensions[dimensionName]
	if !exists {
		return fmt.Errorf("invalid dimension: %s", dimensionName)
	}

	for _, panel := range panels {
		// Check if panel exceeds dimension bounds
		panelRight := panel.X + panel.W
		panelBottom := panel.Y + panel.H

		if panelRight > dim.MaxWidth {
			return fmt.Errorf("panel '%s' exceeds max width: panel ends at %d, max is %d",
				panel.ID, panelRight, dim.MaxWidth)
		}
		if panelBottom > dim.MaxHeight {
			return fmt.Errorf("panel '%s' exceeds max height: panel ends at %d, max is %d",
				panel.ID, panelBottom, dim.MaxHeight)
		}
	}

	return nil
}

// GetUserConfig retrieves user-specific configuration
func (s *ConfigService) GetUserConfig(ctx context.Context, userID string) (*models.UserConfigResponse, error) {
	appConfig, err := s.repo.GetUserConfig(ctx, userID)
	if err != nil {
		return nil, err
	}

	return &models.UserConfigResponse{
		UserID:   userID,
		Settings: appConfig.Settings,
	}, nil
}

// UpdateUserConfig updates user-specific configuration
func (s *ConfigService) UpdateUserConfig(ctx context.Context, userID string, settings map[string]interface{}) (*models.UserConfigResponse, error) {
	_, err := s.repo.UpsertUserConfig(ctx, userID, settings)
	if err != nil {
		return nil, err
	}

	return s.GetUserConfig(ctx, userID)
}
