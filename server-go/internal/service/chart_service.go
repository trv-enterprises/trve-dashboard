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
// Creates as version 1 with status "final"
func (s *ChartService) CreateChart(ctx context.Context, req *models.CreateChartRequest) (*models.Chart, error) {
	// Check name uniqueness
	existing, err := s.repo.FindByName(ctx, req.Name)
	if err != nil {
		return nil, fmt.Errorf("error checking name uniqueness: %w", err)
	}
	if existing != nil {
		return nil, fmt.Errorf("chart with name '%s' already exists", req.Name)
	}

	// Default title to name if not provided
	title := req.Title
	if title == "" {
		title = req.Name
	}

	chart := &models.Chart{
		Version:       1,
		Status:        models.ChartStatusFinal,
		Name:          req.Name,
		Title:         title,
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

// GetChart retrieves the latest version of a chart by ID
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

// GetChartVersion retrieves a specific version of a chart
func (s *ChartService) GetChartVersion(ctx context.Context, id string, version int) (*models.Chart, error) {
	chart, err := s.repo.FindByIDAndVersion(ctx, id, version)
	if err != nil {
		return nil, fmt.Errorf("error retrieving chart version: %w", err)
	}
	if chart == nil {
		return nil, fmt.Errorf("chart version not found")
	}
	return chart, nil
}

// GetChartDraft retrieves the draft version of a chart (if exists)
func (s *ChartService) GetChartDraft(ctx context.Context, id string) (*models.Chart, error) {
	chart, err := s.repo.FindDraft(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("error retrieving chart draft: %w", err)
	}
	if chart == nil {
		return nil, fmt.Errorf("no draft found for chart")
	}
	return chart, nil
}

// GetVersionInfo returns version metadata for delete dialogs
func (s *ChartService) GetVersionInfo(ctx context.Context, id string) (*models.ChartVersionInfo, error) {
	info, err := s.repo.GetVersionInfo(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("error retrieving version info: %w", err)
	}
	if info == nil {
		return nil, fmt.Errorf("chart not found")
	}
	return info, nil
}

// ListChartVersions retrieves all versions of a chart
func (s *ChartService) ListChartVersions(ctx context.Context, id string) ([]models.Chart, error) {
	// First check if chart exists
	latest, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("error checking chart: %w", err)
	}
	if latest == nil {
		return nil, fmt.Errorf("chart not found")
	}

	// Get all versions - we need to add this method to repository
	// For now, we can use aggregation or iterate
	var versions []models.Chart
	for v := 1; v <= latest.Version; v++ {
		chart, err := s.repo.FindByIDAndVersion(ctx, id, v)
		if err != nil {
			return nil, fmt.Errorf("error retrieving version %d: %w", v, err)
		}
		if chart != nil {
			versions = append(versions, *chart)
		}
	}

	// Check for draft (version higher than latest final)
	draft, _ := s.repo.FindDraft(ctx, id)
	if draft != nil {
		versions = append(versions, *draft)
	}

	return versions, nil
}

// ListCharts retrieves latest version of each chart with pagination and filtering
func (s *ChartService) ListCharts(ctx context.Context, params models.ChartQueryParams) (*models.ChartListResponse, error) {
	if params.Page < 1 {
		params.Page = 1
	}
	if params.PageSize < 1 {
		params.PageSize = 20
	}

	charts, total, err := s.repo.FindAllLatest(ctx, params)
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

// UpdateChart updates the latest version of a chart in-place
// This is used for manual edits (non-AI)
func (s *ChartService) UpdateChart(ctx context.Context, id string, req *models.UpdateChartRequest) (*models.Chart, error) {
	// Get existing chart (latest version)
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
	if req.Title != nil {
		chart.Title = *req.Title
	}
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

	// Update in place (same version)
	if err := s.repo.Update(ctx, id, chart.Version, chart); err != nil {
		return nil, fmt.Errorf("error updating chart: %w", err)
	}

	return chart, nil
}

// DeleteChart deletes all versions of a chart by ID
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

	if err := s.repo.DeleteAllVersions(ctx, id); err != nil {
		return fmt.Errorf("error deleting chart: %w", err)
	}

	return nil
}

// DeleteChartVersion deletes a specific version of a chart
func (s *ChartService) DeleteChartVersion(ctx context.Context, id string, version int) error {
	// Check if version exists
	chart, err := s.repo.FindByIDAndVersion(ctx, id, version)
	if err != nil {
		return fmt.Errorf("error retrieving chart version: %w", err)
	}
	if chart == nil {
		return fmt.Errorf("chart version not found")
	}

	if err := s.repo.DeleteVersion(ctx, id, version); err != nil {
		return fmt.Errorf("error deleting chart version: %w", err)
	}

	return nil
}

// DeleteChartDraft deletes only the draft version of a chart
func (s *ChartService) DeleteChartDraft(ctx context.Context, id string) error {
	// Check if draft exists
	draft, err := s.repo.FindDraft(ctx, id)
	if err != nil {
		return fmt.Errorf("error retrieving draft: %w", err)
	}
	if draft == nil {
		return fmt.Errorf("no draft found for chart")
	}

	if err := s.repo.DeleteVersion(ctx, id, draft.Version); err != nil {
		return fmt.Errorf("error deleting draft: %w", err)
	}

	return nil
}

// GetChartsByDatasource retrieves latest version of all charts using a specific data source
func (s *ChartService) GetChartsByDatasource(ctx context.Context, datasourceID string) ([]models.Chart, error) {
	return s.repo.FindByDatasourceID(ctx, datasourceID)
}
