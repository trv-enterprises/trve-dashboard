// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

package service

import (
	"context"
	"fmt"

	"github.com/tviviano/dashboard/internal/models"
	"github.com/tviviano/dashboard/internal/repository"
	"go.mongodb.org/mongo-driver/mongo"
)

// DashboardService handles business logic for dashboards
type DashboardService struct {
	repo *repository.DashboardRepository
	db   *mongo.Database
}

// NewDashboardService creates a new dashboard service
func NewDashboardService(repo *repository.DashboardRepository, db *mongo.Database) *DashboardService {
	return &DashboardService{
		repo: repo,
		db:   db,
	}
}

// CreateDashboard creates a new dashboard
func (s *DashboardService) CreateDashboard(ctx context.Context, req *models.CreateDashboardRequest) (*models.Dashboard, error) {
	// Check for duplicate dashboard name
	existing, err := s.repo.FindByName(ctx, req.Name)
	if err != nil {
		return nil, fmt.Errorf("error checking for existing dashboard: %w", err)
	}
	if existing != nil {
		return nil, fmt.Errorf("dashboard with name '%s' already exists", req.Name)
	}

	dashboard, err := s.repo.Create(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to create dashboard: %w", err)
	}

	return dashboard, nil
}

// GetDashboard retrieves a dashboard by ID
func (s *DashboardService) GetDashboard(ctx context.Context, id string) (*models.Dashboard, error) {
	dashboard, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get dashboard: %w", err)
	}
	if dashboard == nil {
		return nil, fmt.Errorf("dashboard not found")
	}
	return dashboard, nil
}

// ListDashboards retrieves dashboards with filtering and pagination
func (s *DashboardService) ListDashboards(ctx context.Context, params models.DashboardQueryParams) (*models.DashboardListResponse, error) {
	dashboards, total, err := s.repo.List(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to list dashboards: %w", err)
	}

	// Default page values
	page := params.Page
	if page < 1 {
		page = 1
	}
	pageSize := params.PageSize
	if pageSize < 1 {
		pageSize = 20
	}

	return &models.DashboardListResponse{
		Dashboards: dashboards,
		Total:      total,
		Page:       page,
		PageSize:   pageSize,
	}, nil
}

// ListDashboardsWithDatasources retrieves dashboard summaries with data source names
func (s *DashboardService) ListDashboardsWithDatasources(ctx context.Context, params models.DashboardQueryParams) (*models.DashboardSummaryListResponse, error) {
	summaries, total, err := s.repo.ListWithDatasources(ctx, params, s.db)
	if err != nil {
		return nil, fmt.Errorf("failed to list dashboards with datasources: %w", err)
	}

	// Default page values
	page := params.Page
	if page < 1 {
		page = 1
	}
	pageSize := params.PageSize
	if pageSize < 1 {
		pageSize = 20
	}

	return &models.DashboardSummaryListResponse{
		Dashboards: summaries,
		Total:      total,
		Page:       page,
		PageSize:   pageSize,
	}, nil
}

// UpdateDashboard updates a dashboard
func (s *DashboardService) UpdateDashboard(ctx context.Context, id string, req *models.UpdateDashboardRequest) (*models.Dashboard, error) {
	// Check if dashboard exists
	existing, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("error finding dashboard: %w", err)
	}
	if existing == nil {
		return nil, fmt.Errorf("dashboard not found")
	}

	// If name is being updated, check for duplicates
	if req.Name != nil && *req.Name != existing.Name {
		duplicate, err := s.repo.FindByName(ctx, *req.Name)
		if err != nil {
			return nil, fmt.Errorf("error checking for duplicate name: %w", err)
		}
		if duplicate != nil {
			return nil, fmt.Errorf("dashboard with name '%s' already exists", *req.Name)
		}
	}

	dashboard, err := s.repo.Update(ctx, id, req)
	if err != nil {
		return nil, fmt.Errorf("failed to update dashboard: %w", err)
	}

	return dashboard, nil
}

// DeleteDashboard deletes a dashboard
func (s *DashboardService) DeleteDashboard(ctx context.Context, id string) error {
	// Check if dashboard exists
	existing, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return fmt.Errorf("error finding dashboard: %w", err)
	}
	if existing == nil {
		return fmt.Errorf("dashboard not found")
	}

	err = s.repo.Delete(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to delete dashboard: %w", err)
	}

	return nil
}
