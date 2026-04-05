// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

package service

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/trv-enterprises/trve-dashboard/config"
	"github.com/trv-enterprises/trve-dashboard/internal/models"
	"github.com/trv-enterprises/trve-dashboard/internal/repository"
)

// SettingsService handles business logic for settings management
type SettingsService struct {
	repo         *repository.SettingsItemRepository
	fileSettings []config.SettingDefinition
}

// NewSettingsService creates a new SettingsService
func NewSettingsService(repo *repository.SettingsItemRepository, userConfig *config.UserConfigurableSettings) *SettingsService {
	settings := []config.SettingDefinition{}
	if userConfig != nil {
		settings = userConfig.Settings
	}
	return &SettingsService{
		repo:         repo,
		fileSettings: settings,
	}
}

// SyncSettingsFromConfig syncs settings from user-configurable.yaml to MongoDB
// On first run: creates settings in DB from file
// On subsequent runs: only creates NEW settings (doesn't overwrite existing DB values)
func (s *SettingsService) SyncSettingsFromConfig(ctx context.Context) error {
	log.Println("Starting user-configurable settings sync...")

	// Get all existing settings from DB
	existingSettings, err := s.repo.GetAllSettings(ctx)
	if err != nil {
		return fmt.Errorf("failed to get existing settings: %w", err)
	}

	// Create a map for quick lookup
	existingMap := make(map[string]*models.ConfigItem)
	for i := range existingSettings {
		existingMap[existingSettings[i].Key] = &existingSettings[i]
	}

	// Process each setting from the config file
	newCount := 0
	for _, fileSetting := range s.fileSettings {
		_, found := existingMap[fileSetting.Key]

		if !found {
			// New setting - create it
			item := &models.ConfigItem{
				ID:          fileSetting.Key,
				Key:         fileSetting.Key,
				Value:       fileSetting.Value,
				Category:    fileSetting.Category,
				Description: fileSetting.Description,
				Created:     time.Now(),
				Updated:     time.Now(),
			}
			if err := s.repo.UpsertSetting(ctx, item); err != nil {
				log.Printf("Warning: failed to create setting %s: %v", fileSetting.Key, err)
				continue
			}
			log.Printf("Created new setting: %s", fileSetting.Key)
			newCount++
		}
		// Existing settings are NOT overwritten - DB values take precedence
	}

	log.Printf("Settings sync complete. Created %d new settings (existing settings preserved).", newCount)
	return nil
}

// GetAllSettings retrieves all user-configurable settings
func (s *SettingsService) GetAllSettings(ctx context.Context) ([]models.ConfigItem, error) {
	settings, err := s.repo.GetAllSettings(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get settings: %w", err)
	}

	// Ensure non-nil slice
	if settings == nil {
		settings = []models.ConfigItem{}
	}

	return settings, nil
}

// GetSetting retrieves a single setting by key
func (s *SettingsService) GetSetting(ctx context.Context, key string) (*models.ConfigItem, error) {
	item, err := s.repo.GetSettingByKey(ctx, key)
	if err != nil {
		return nil, fmt.Errorf("failed to get setting: %w", err)
	}
	if item == nil {
		return nil, fmt.Errorf("setting not found: %s", key)
	}
	return item, nil
}

// UpdateSetting updates a setting's value
func (s *SettingsService) UpdateSetting(ctx context.Context, key string, value interface{}) (*models.ConfigItem, error) {
	// First, check if setting exists
	item, err := s.repo.GetSettingByKey(ctx, key)
	if err != nil {
		return nil, fmt.Errorf("failed to get setting: %w", err)
	}
	if item == nil {
		return nil, fmt.Errorf("setting not found: %s", key)
	}

	// Update the value
	if err := s.repo.UpdateSettingValue(ctx, key, value); err != nil {
		return nil, fmt.Errorf("failed to update setting: %w", err)
	}

	// Return updated setting
	return s.GetSetting(ctx, key)
}

// CreateIndexes creates necessary indexes for the settings collection
func (s *SettingsService) CreateIndexes(ctx context.Context) error {
	return s.repo.CreateIndexes(ctx)
}
