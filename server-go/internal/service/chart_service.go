package service

import (
	"context"
	"fmt"

	"github.com/tviviano/dashboard/internal/models"
	"github.com/tviviano/dashboard/internal/repository"
)

// ChartService handles chart business logic
type ChartService struct {
	repo *repository.ChartRepository
}

// NewChartService creates a new chart service
func NewChartService(repo *repository.ChartRepository) *ChartService {
	return &ChartService{
		repo: repo,
	}
}

// CreateChart creates a new chart with validation
func (s *ChartService) CreateChart(ctx context.Context, req *models.CreateChartRequest) (*models.Chart, error) {
	// Check name uniqueness
	existing, err := s.repo.FindByName(ctx, req.Name)
	if err != nil {
		return nil, fmt.Errorf("error checking name uniqueness: %w", err)
	}
	if existing != nil {
		return nil, fmt.Errorf("chart with name '%s' already exists", req.Name)
	}

	chart := &models.Chart{
		Name:          req.Name,
		Description:   req.Description,
		ChartType:     req.ChartType,
		DatasourceID:  req.DatasourceID,
		QueryConfig:   req.QueryConfig,
		DataMapping:   req.DataMapping,
		ComponentCode: req.ComponentCode,
		UseCustomCode: req.UseCustomCode,
		Options:       req.Options,
		Thumbnail:     req.Thumbnail,
		Tags:          req.Tags,
	}

	if err := s.repo.Create(ctx, chart); err != nil {
		return nil, fmt.Errorf("error creating chart: %w", err)
	}

	return chart, nil
}

// GetChart retrieves a chart by ID
func (s *ChartService) GetChart(ctx context.Context, id string) (*models.Chart, error) {
	chart, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("error retrieving chart: %w", err)
	}
	if chart == nil {
		return nil, fmt.Errorf("chart not found")
	}
	return chart, nil
}

// ListCharts retrieves charts with pagination and filtering
func (s *ChartService) ListCharts(ctx context.Context, params models.ChartQueryParams) (*models.ChartListResponse, error) {
	if params.Page < 1 {
		params.Page = 1
	}
	if params.PageSize < 1 {
		params.PageSize = 20
	}

	charts, total, err := s.repo.FindAll(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("error listing charts: %w", err)
	}

	return &models.ChartListResponse{
		Charts:   charts,
		Total:    total,
		Page:     params.Page,
		PageSize: params.PageSize,
	}, nil
}

// GetChartSummaries returns lightweight chart summaries for card display
func (s *ChartService) GetChartSummaries(ctx context.Context, limit int64) ([]models.ChartSummary, error) {
	return s.repo.FindSummaries(ctx, limit)
}

// UpdateChart updates an existing chart
func (s *ChartService) UpdateChart(ctx context.Context, id string, req *models.UpdateChartRequest) (*models.Chart, error) {
	// Get existing chart
	chart, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("error retrieving chart: %w", err)
	}
	if chart == nil {
		return nil, fmt.Errorf("chart not found")
	}

	// Check name uniqueness if changing
	if req.Name != nil && *req.Name != chart.Name {
		existing, err := s.repo.FindByName(ctx, *req.Name)
		if err != nil {
			return nil, fmt.Errorf("error checking name uniqueness: %w", err)
		}
		if existing != nil && existing.ID != chart.ID {
			return nil, fmt.Errorf("chart with name '%s' already exists", *req.Name)
		}
		chart.Name = *req.Name
	}

	// Update fields if provided
	if req.Description != nil {
		chart.Description = *req.Description
	}
	if req.ChartType != nil {
		chart.ChartType = *req.ChartType
	}
	if req.DatasourceID != nil {
		chart.DatasourceID = *req.DatasourceID
	}
	if req.QueryConfig != nil {
		chart.QueryConfig = req.QueryConfig
	}
	if req.DataMapping != nil {
		chart.DataMapping = req.DataMapping
	}
	if req.ComponentCode != nil {
		chart.ComponentCode = *req.ComponentCode
	}
	if req.UseCustomCode != nil {
		chart.UseCustomCode = *req.UseCustomCode
	}
	if req.Options != nil {
		chart.Options = *req.Options
	}
	if req.Thumbnail != nil {
		chart.Thumbnail = *req.Thumbnail
	}
	if req.Tags != nil {
		chart.Tags = *req.Tags
	}

	if err := s.repo.Update(ctx, id, chart); err != nil {
		return nil, fmt.Errorf("error updating chart: %w", err)
	}

	return chart, nil
}

// DeleteChart deletes a chart by ID
func (s *ChartService) DeleteChart(ctx context.Context, id string) error {
	// Check if chart exists
	chart, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return fmt.Errorf("error retrieving chart: %w", err)
	}
	if chart == nil {
		return fmt.Errorf("chart not found")
	}

	// TODO: Check if chart is used by any dashboards before deleting
	// For now, allow deletion - dashboards will need to handle missing charts

	if err := s.repo.Delete(ctx, id); err != nil {
		return fmt.Errorf("error deleting chart: %w", err)
	}

	return nil
}

// GetChartsByDatasource retrieves all charts using a specific data source
func (s *ChartService) GetChartsByDatasource(ctx context.Context, datasourceID string) ([]models.Chart, error) {
	return s.repo.FindByDatasourceID(ctx, datasourceID)
}
