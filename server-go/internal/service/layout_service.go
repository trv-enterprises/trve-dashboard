package service

import (
	"context"
	"fmt"

	"github.com/tviviano/dashboard/internal/models"
	"github.com/tviviano/dashboard/internal/repository"
)

// LayoutService handles layout business logic
type LayoutService struct {
	repo *repository.LayoutRepository
}

// NewLayoutService creates a new layout service
func NewLayoutService(repo *repository.LayoutRepository) *LayoutService {
	return &LayoutService{
		repo: repo,
	}
}

// CreateLayout creates a new layout
func (s *LayoutService) CreateLayout(ctx context.Context, req *models.CreateLayoutRequest) (*models.Layout, error) {
	// Check if layout with same name already exists
	existing, err := s.repo.FindByName(ctx, req.Name)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, fmt.Errorf("layout with name '%s' already exists", req.Name)
	}

	// Set default grid config if not provided
	grid := req.Grid
	if grid.Columns == 0 {
		grid = models.DefaultGridConfig()
	}

	// Validate grid configuration
	if err := s.validateGridConfig(&grid); err != nil {
		return nil, err
	}

	// Validate panels
	if err := s.validatePanels(req.Panels, &grid); err != nil {
		return nil, err
	}

	layout := &models.Layout{
		Name:        req.Name,
		Description: req.Description,
		Grid:        grid,
		Panels:      req.Panels,
	}

	if err := s.repo.Create(ctx, layout); err != nil {
		return nil, err
	}

	return layout, nil
}

// GetLayout retrieves a layout by ID
func (s *LayoutService) GetLayout(ctx context.Context, id string) (*models.Layout, error) {
	return s.repo.FindByID(ctx, id)
}

// ListLayouts retrieves all layouts with pagination
func (s *LayoutService) ListLayouts(ctx context.Context, limit, offset int64) ([]*models.Layout, int64, error) {
	// Set default limit if not provided
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100 // Max 100 items per page
	}

	layouts, err := s.repo.FindAll(ctx, limit, offset)
	if err != nil {
		return nil, 0, err
	}

	total, err := s.repo.Count(ctx)
	if err != nil {
		return nil, 0, err
	}

	return layouts, total, nil
}

// UpdateLayout updates an existing layout
func (s *LayoutService) UpdateLayout(ctx context.Context, id string, req *models.UpdateLayoutRequest) (*models.Layout, error) {
	// Get existing layout
	existing, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}

	// Check if name is being changed and conflicts with another layout
	if req.Name != "" && req.Name != existing.Name {
		nameConflict, err := s.repo.FindByName(ctx, req.Name)
		if err != nil {
			return nil, err
		}
		if nameConflict != nil && nameConflict.ID != existing.ID {
			return nil, fmt.Errorf("layout with name '%s' already exists", req.Name)
		}
		existing.Name = req.Name
	}

	// Update fields if provided
	if req.Description != "" {
		existing.Description = req.Description
	}

	if req.Grid.Columns > 0 {
		if err := s.validateGridConfig(&req.Grid); err != nil {
			return nil, err
		}
		existing.Grid = req.Grid
	}

	if req.Panels != nil {
		if err := s.validatePanels(req.Panels, &existing.Grid); err != nil {
			return nil, err
		}
		existing.Panels = req.Panels
	}

	if err := s.repo.Update(ctx, id, existing); err != nil {
		return nil, err
	}

	return existing, nil
}

// DeleteLayout deletes a layout by ID
func (s *LayoutService) DeleteLayout(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}

// validateGridConfig validates grid configuration
func (s *LayoutService) validateGridConfig(grid *models.GridConfig) error {
	if grid.Columns <= 0 {
		return fmt.Errorf("grid columns must be positive")
	}
	if grid.RowHeight <= 0 {
		return fmt.Errorf("grid row height must be positive")
	}
	if grid.MaxRows < 0 {
		return fmt.Errorf("grid max rows cannot be negative")
	}
	if grid.GridUnit <= 0 {
		return fmt.Errorf("grid unit must be positive")
	}
	return nil
}

// validatePanels validates panel configurations
func (s *LayoutService) validatePanels(panels []models.Panel, grid *models.GridConfig) error {
	// Track panel IDs to ensure uniqueness
	panelIDs := make(map[string]bool)

	for i, panel := range panels {
		// Check for duplicate panel IDs
		if panelIDs[panel.ID] {
			return fmt.Errorf("duplicate panel ID: %s", panel.ID)
		}
		panelIDs[panel.ID] = true

		// Validate panel position and size
		if panel.X < 0 {
			return fmt.Errorf("panel %d: x position cannot be negative", i)
		}
		if panel.Y < 0 {
			return fmt.Errorf("panel %d: y position cannot be negative", i)
		}
		if panel.Width <= 0 {
			return fmt.Errorf("panel %d: width must be positive", i)
		}
		if panel.Height <= 0 {
			return fmt.Errorf("panel %d: height must be positive", i)
		}

		// Check if panel fits within grid columns
		if panel.X+panel.Width > grid.Columns {
			return fmt.Errorf("panel %d: exceeds grid columns (x:%d + w:%d > %d)", i, panel.X, panel.Width, grid.Columns)
		}

		// Validate min/max constraints
		if panel.MinW > 0 && panel.Width < panel.MinW {
			return fmt.Errorf("panel %d: width is less than minimum", i)
		}
		if panel.MaxW > 0 && panel.Width > panel.MaxW {
			return fmt.Errorf("panel %d: width exceeds maximum", i)
		}
		if panel.MinH > 0 && panel.Height < panel.MinH {
			return fmt.Errorf("panel %d: height is less than minimum", i)
		}
		if panel.MaxH > 0 && panel.Height > panel.MaxH {
			return fmt.Errorf("panel %d: height exceeds maximum", i)
		}
	}

	return nil
}
