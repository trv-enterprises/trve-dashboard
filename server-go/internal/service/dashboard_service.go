package service

import (
	"context"
	"fmt"

	"github.com/tviviano/dashboard/internal/models"
	"github.com/tviviano/dashboard/internal/repository"
)

// DashboardService handles business logic for dashboards
type DashboardService struct {
	repo          *repository.DashboardRepository
	layoutRepo    *repository.LayoutRepository
	componentRepo *repository.ComponentRepository
}

// NewDashboardService creates a new dashboard service
func NewDashboardService(
	repo *repository.DashboardRepository,
	layoutRepo *repository.LayoutRepository,
	componentRepo *repository.ComponentRepository,
) *DashboardService {
	return &DashboardService{
		repo:          repo,
		layoutRepo:    layoutRepo,
		componentRepo: componentRepo,
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

	// Validate layout exists
	layout, err := s.layoutRepo.FindByID(ctx, req.LayoutID)
	if err != nil {
		return nil, fmt.Errorf("error finding layout: %w", err)
	}
	if layout == nil {
		return nil, fmt.Errorf("layout '%s' not found", req.LayoutID)
	}

	// Validate all component IDs exist
	for _, dc := range req.Components {
		component, err := s.componentRepo.FindByID(ctx, dc.ComponentID)
		if err != nil {
			return nil, fmt.Errorf("error finding component %s: %w", dc.ComponentID, err)
		}
		if component == nil {
			return nil, fmt.Errorf("component '%s' not found", dc.ComponentID)
		}
	}

	// Validate all panel IDs exist in the layout
	panelIDs := make(map[string]bool)
	for _, panel := range layout.Panels {
		panelIDs[panel.ID] = true
	}

	for _, dc := range req.Components {
		if !panelIDs[dc.PanelID] {
			return nil, fmt.Errorf("panel '%s' not found in layout '%s'", dc.PanelID, req.LayoutID)
		}
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

// GetDashboardWithDetails retrieves a dashboard with expanded layout and component details
func (s *DashboardService) GetDashboardWithDetails(ctx context.Context, id string) (*models.DashboardWithDetails, error) {
	dashboard, err := s.GetDashboard(ctx, id)
	if err != nil {
		return nil, err
	}

	result := &models.DashboardWithDetails{
		Dashboard: *dashboard,
	}

	// Fetch layout details
	layout, err := s.layoutRepo.FindByID(ctx, dashboard.LayoutID)
	if err == nil && layout != nil {
		result.Layout = layout
	}

	// Fetch component details
	componentDetails := make([]models.Component, 0, len(dashboard.Components))
	for _, dc := range dashboard.Components {
		component, err := s.componentRepo.FindByID(ctx, dc.ComponentID)
		if err == nil && component != nil {
			componentDetails = append(componentDetails, *component)
		}
	}
	result.ComponentDetails = componentDetails

	return result, nil
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

	// If layout is being updated, validate it exists
	if req.LayoutID != nil {
		layout, err := s.layoutRepo.FindByID(ctx, *req.LayoutID)
		if err != nil {
			return nil, fmt.Errorf("error finding layout: %w", err)
		}
		if layout == nil {
			return nil, fmt.Errorf("layout '%s' not found", *req.LayoutID)
		}
	}

	// If components are being updated, validate them
	if req.Components != nil {
		for _, dc := range *req.Components {
			component, err := s.componentRepo.FindByID(ctx, dc.ComponentID)
			if err != nil {
				return nil, fmt.Errorf("error finding component %s: %w", dc.ComponentID, err)
			}
			if component == nil {
				return nil, fmt.Errorf("component '%s' not found", dc.ComponentID)
			}
		}

		// Validate panel IDs exist in the layout
		layoutID := existing.LayoutID
		if req.LayoutID != nil {
			layoutID = *req.LayoutID
		}

		layout, err := s.layoutRepo.FindByID(ctx, layoutID)
		if err != nil {
			return nil, fmt.Errorf("error finding layout: %w", err)
		}
		if layout == nil {
			return nil, fmt.Errorf("layout '%s' not found", layoutID)
		}

		panelIDs := make(map[string]bool)
		for _, panel := range layout.Panels {
			panelIDs[panel.ID] = true
		}

		for _, dc := range *req.Components {
			if !panelIDs[dc.PanelID] {
				return nil, fmt.Errorf("panel '%s' not found in layout '%s'", dc.PanelID, layoutID)
			}
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
