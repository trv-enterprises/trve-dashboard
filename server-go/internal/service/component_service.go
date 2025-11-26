package service

import (
	"context"
	"fmt"

	"github.com/tviviano/dashboard/internal/models"
	"github.com/tviviano/dashboard/internal/repository"
)

// ComponentService handles business logic for components
type ComponentService struct {
	repo *repository.ComponentRepository
}

// NewComponentService creates a new component service
func NewComponentService(repo *repository.ComponentRepository) *ComponentService {
	return &ComponentService{
		repo: repo,
	}
}

// CreateComponent creates a new component
func (s *ComponentService) CreateComponent(ctx context.Context, req *models.CreateComponentRequest) (*models.Component, error) {
	// Validate component code is not empty
	if req.ComponentCode == "" {
		return nil, fmt.Errorf("component code is required")
	}

	// Check for duplicate component with same system/source/name
	existing, err := s.repo.FindBySystemSourceName(ctx, req.System, req.Source, req.Name)
	if err != nil {
		return nil, fmt.Errorf("error checking for existing component: %w", err)
	}
	if existing != nil {
		return nil, fmt.Errorf("component with name '%s' already exists in %s/%s", req.Name, req.System, req.Source)
	}

	// Initialize metadata if nil
	if req.Metadata.Tags == nil {
		req.Metadata.Tags = []string{}
	}
	if req.Metadata.RequiredAPIs == nil {
		req.Metadata.RequiredAPIs = []string{}
	}

	component, err := s.repo.Create(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to create component: %w", err)
	}

	return component, nil
}

// GetComponent retrieves a component by ID
func (s *ComponentService) GetComponent(ctx context.Context, id string) (*models.Component, error) {
	component, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get component: %w", err)
	}
	if component == nil {
		return nil, fmt.Errorf("component not found")
	}
	return component, nil
}

// ListComponents retrieves components with filtering and pagination
func (s *ComponentService) ListComponents(ctx context.Context, params models.ComponentQueryParams) (*models.ComponentListResponse, error) {
	components, total, err := s.repo.List(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to list components: %w", err)
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

	return &models.ComponentListResponse{
		Components: components,
		Total:      total,
		Page:       page,
		PageSize:   pageSize,
	}, nil
}

// UpdateComponent updates a component
func (s *ComponentService) UpdateComponent(ctx context.Context, id string, req *models.UpdateComponentRequest) (*models.Component, error) {
	// Check if component exists
	existing, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("error finding component: %w", err)
	}
	if existing == nil {
		return nil, fmt.Errorf("component not found")
	}

	// Validate component code if provided
	if req.ComponentCode != nil && *req.ComponentCode == "" {
		return nil, fmt.Errorf("component code cannot be empty")
	}

	component, err := s.repo.Update(ctx, id, req)
	if err != nil {
		return nil, fmt.Errorf("failed to update component: %w", err)
	}

	return component, nil
}

// DeleteComponent deletes a component
func (s *ComponentService) DeleteComponent(ctx context.Context, id string) error {
	// Check if component exists
	existing, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return fmt.Errorf("error finding component: %w", err)
	}
	if existing == nil {
		return fmt.Errorf("component not found")
	}

	err = s.repo.Delete(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to delete component: %w", err)
	}

	return nil
}

// GetSystems retrieves all systems and sources
func (s *ComponentService) GetSystems(ctx context.Context) (*models.ComponentSystemsResponse, error) {
	systems, err := s.repo.GetSystems(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get systems: %w", err)
	}
	return systems, nil
}
