// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

package ai

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/tviviano/dashboard/internal/hub"
	"github.com/tviviano/dashboard/internal/models"
)

// ToolExecutor handles executing AI tools and updating charts
type ToolExecutor struct {
	chartRepo      ChartRepository
	datasourceRepo DatasourceRepository
	datasourceSvc  DatasourceService
	chartHub       *hub.ChartHub
}

// ChartRepository interface for chart operations
type ChartRepository interface {
	FindByIDAndVersion(ctx context.Context, id string, version int) (*models.Chart, error)
	Update(ctx context.Context, id string, version int, chart *models.Chart) error
}

// DatasourceRepository interface for data source operations
type DatasourceRepository interface {
	FindAll(ctx context.Context, limit, offset int64) ([]*models.Datasource, error)
	FindByID(ctx context.Context, id string) (*models.Datasource, error)
}

// DatasourceService interface for data source queries
type DatasourceService interface {
	QueryDatasource(ctx context.Context, id string, req *models.QueryRequest) (*models.QueryResponse, error)
	GetSchema(ctx context.Context, id string) (*models.SchemaResponse, error)
}

// NewToolExecutor creates a new tool executor
func NewToolExecutor(chartRepo ChartRepository, dsRepo DatasourceRepository, dsSvc DatasourceService, chartHub *hub.ChartHub) *ToolExecutor {
	return &ToolExecutor{
		chartRepo:      chartRepo,
		datasourceRepo: dsRepo,
		datasourceSvc:  dsSvc,
		chartHub:       chartHub,
	}
}

// broadcastChartUpdate broadcasts a chart update to all subscribers via the hub
func (e *ToolExecutor) broadcastChartUpdate(chart *models.Chart) {
	if e.chartHub != nil && chart != nil {
		fmt.Printf("[ToolExecutor] Broadcasting chart update for %s to ChartHub\n", chart.ID)
		e.chartHub.BroadcastChartUpdate(chart.ID, chart)
	}
}

// ToolResult contains the result of executing a tool
type ToolResult struct {
	Success      bool        `json:"success"`
	Message      string      `json:"message,omitempty"`
	Data         interface{} `json:"data,omitempty"`
	Error        string      `json:"error,omitempty"`
	ChartUpdated bool        `json:"chart_updated,omitempty"`
}

// ExecuteTool executes a tool and returns the result
func (e *ToolExecutor) ExecuteTool(ctx context.Context, chartID string, chartVersion int, toolName string, input json.RawMessage) (*ToolResult, error) {
	fmt.Printf("[ToolExecutor] Executing tool: %s for chart %s v%d\n", toolName, chartID, chartVersion)
	fmt.Printf("[ToolExecutor] Input: %s\n", string(input))

	switch toolName {
	case ToolUpdateChartConfig:
		return e.executeUpdateChartConfig(ctx, chartID, chartVersion, input)
	case ToolUpdateDataMapping:
		return e.executeUpdateDataMapping(ctx, chartID, chartVersion, input)
	case ToolUpdateQueryConfig:
		return e.executeUpdateQueryConfig(ctx, chartID, chartVersion, input)
	case ToolUpdateFilters:
		return e.executeUpdateFilters(ctx, chartID, chartVersion, input)
	case ToolUpdateAggregation:
		return e.executeUpdateAggregation(ctx, chartID, chartVersion, input)
	case ToolUpdateSlidingWindow:
		return e.executeUpdateSlidingWindow(ctx, chartID, chartVersion, input)
	case ToolUpdateTimeBucket:
		return e.executeUpdateTimeBucket(ctx, chartID, chartVersion, input)
	case ToolSetCustomCode:
		return e.executeSetCustomCode(ctx, chartID, chartVersion, input)
	case ToolUpdateChartOptions:
		return e.executeUpdateChartOptions(ctx, chartID, chartVersion, input)
	case ToolQueryDatasource:
		return e.executeQueryDatasource(ctx, input)
	case ToolListDatasources:
		return e.executeListDatasources(ctx)
	case ToolGetDatasourceSchema:
		return e.executeGetDatasourceSchema(ctx, input)
	case ToolPreviewData:
		return e.executePreviewData(ctx, chartID, chartVersion, input)
	case ToolGetChartState:
		return e.executeGetChartState(ctx, chartID, chartVersion)
	case ToolSuggestMissing:
		return e.executeSuggestMissing(input)
	default:
		return &ToolResult{
			Success: false,
			Error:   fmt.Sprintf("unknown tool: %s", toolName),
		}, nil
	}
}

// executeUpdateChartConfig updates basic chart configuration (not name - that's user-controlled)
func (e *ToolExecutor) executeUpdateChartConfig(ctx context.Context, chartID string, chartVersion int, input json.RawMessage) (*ToolResult, error) {
	var params struct {
		Description *string `json:"description,omitempty"`
		ChartType   *string `json:"chart_type,omitempty"`
	}
	if err := json.Unmarshal(input, &params); err != nil {
		return &ToolResult{Success: false, Error: "invalid input: " + err.Error()}, nil
	}

	chart, err := e.chartRepo.FindByIDAndVersion(ctx, chartID, chartVersion)
	if err != nil {
		return &ToolResult{Success: false, Error: "failed to get chart: " + err.Error()}, nil
	}
	if chart == nil {
		return &ToolResult{Success: false, Error: fmt.Sprintf("chart not found: %s v%d", chartID, chartVersion)}, nil
	}

	updates := []string{}
	if params.Description != nil {
		chart.Description = *params.Description
		updates = append(updates, "description")
	}
	if params.ChartType != nil {
		chart.ChartType = *params.ChartType
		updates = append(updates, "chart_type")
	}

	if len(updates) == 0 {
		return &ToolResult{Success: true, Message: "No changes specified"}, nil
	}

	if err := e.chartRepo.Update(ctx, chartID, chartVersion, chart); err != nil {
		return &ToolResult{Success: false, Error: "failed to update chart: " + err.Error()}, nil
	}

	// Broadcast chart update to all subscribers
	e.broadcastChartUpdate(chart)

	return &ToolResult{
		Success:      true,
		Message:      fmt.Sprintf("Updated chart config: %v", updates),
		ChartUpdated: true,
	}, nil
}

// executeUpdateDataMapping updates data mapping configuration
func (e *ToolExecutor) executeUpdateDataMapping(ctx context.Context, chartID string, chartVersion int, input json.RawMessage) (*ToolResult, error) {
	var params struct {
		DatasourceID *string   `json:"datasource_id,omitempty"`
		XAxis        *string   `json:"x_axis,omitempty"`
		XAxisLabel   *string   `json:"x_axis_label,omitempty"`
		XAxisFormat  *string   `json:"x_axis_format,omitempty"`
		YAxis        *[]string `json:"y_axis,omitempty"`
		YAxisLabel   *string   `json:"y_axis_label,omitempty"`
		GroupBy      *string   `json:"group_by,omitempty"`
	}
	if err := json.Unmarshal(input, &params); err != nil {
		return &ToolResult{Success: false, Error: "invalid input: " + err.Error()}, nil
	}

	chart, err := e.chartRepo.FindByIDAndVersion(ctx, chartID, chartVersion)
	if err != nil {
		return &ToolResult{Success: false, Error: "failed to get chart: " + err.Error()}, nil
	}
	if chart == nil {
		return &ToolResult{Success: false, Error: fmt.Sprintf("chart not found: %s v%d", chartID, chartVersion)}, nil
	}

	if params.DatasourceID != nil {
		chart.DatasourceID = *params.DatasourceID
	}

	// Initialize DataMapping if nil
	if chart.DataMapping == nil {
		chart.DataMapping = &models.ChartDataMapping{}
	}

	if params.XAxis != nil {
		chart.DataMapping.XAxis = *params.XAxis
	}
	if params.XAxisLabel != nil {
		chart.DataMapping.XAxisLabel = *params.XAxisLabel
	}
	if params.XAxisFormat != nil {
		chart.DataMapping.XAxisFormat = *params.XAxisFormat
	}
	if params.YAxis != nil {
		chart.DataMapping.YAxis = *params.YAxis
	}
	if params.YAxisLabel != nil {
		chart.DataMapping.YAxisLabel = *params.YAxisLabel
	}
	if params.GroupBy != nil {
		chart.DataMapping.GroupBy = *params.GroupBy
	}

	if err := e.chartRepo.Update(ctx, chartID, chartVersion, chart); err != nil {
		fmt.Printf("[ToolExecutor] update_data_mapping - Update failed: %v\n", err)
		return &ToolResult{Success: false, Error: "failed to update chart: " + err.Error()}, nil
	}

	fmt.Printf("[ToolExecutor] update_data_mapping - Chart updated successfully\n")
	fmt.Printf("[ToolExecutor] update_data_mapping - DatasourceID: %s\n", chart.DatasourceID)
	if chart.DataMapping != nil {
		fmt.Printf("[ToolExecutor] update_data_mapping - XAxis: %s, YAxis: %v\n",
			chart.DataMapping.XAxis, chart.DataMapping.YAxis)
	}

	// Broadcast chart update to all subscribers
	e.broadcastChartUpdate(chart)

	return &ToolResult{
		Success:      true,
		Message:      "Updated data mapping configuration",
		ChartUpdated: true,
	}, nil
}

// executeUpdateQueryConfig updates query configuration
func (e *ToolExecutor) executeUpdateQueryConfig(ctx context.Context, chartID string, chartVersion int, input json.RawMessage) (*ToolResult, error) {
	var params struct {
		Query           *string `json:"query,omitempty"`
		QueryType       *string `json:"query_type,omitempty"`
		RefreshInterval *int    `json:"refresh_interval,omitempty"`
	}
	if err := json.Unmarshal(input, &params); err != nil {
		return &ToolResult{Success: false, Error: "invalid input: " + err.Error()}, nil
	}

	chart, err := e.chartRepo.FindByIDAndVersion(ctx, chartID, chartVersion)
	if err != nil {
		return &ToolResult{Success: false, Error: "failed to get chart: " + err.Error()}, nil
	}
	if chart == nil {
		return &ToolResult{Success: false, Error: fmt.Sprintf("chart not found: %s v%d", chartID, chartVersion)}, nil
	}

	// Initialize QueryConfig if nil
	if chart.QueryConfig == nil {
		chart.QueryConfig = &models.ChartQueryConfig{}
	}

	if params.Query != nil {
		chart.QueryConfig.Raw = *params.Query
	}
	if params.QueryType != nil {
		chart.QueryConfig.Type = *params.QueryType
	}
	// RefreshInterval is stored in Options for now
	if params.RefreshInterval != nil {
		if chart.Options == nil {
			chart.Options = make(map[string]interface{})
		}
		chart.Options["refreshInterval"] = *params.RefreshInterval
	}

	if err := e.chartRepo.Update(ctx, chartID, chartVersion, chart); err != nil {
		return &ToolResult{Success: false, Error: "failed to update chart: " + err.Error()}, nil
	}

	// Broadcast chart update to all subscribers
	e.broadcastChartUpdate(chart)

	return &ToolResult{
		Success:      true,
		Message:      "Updated query configuration",
		ChartUpdated: true,
	}, nil
}

// executeUpdateFilters updates data filters
func (e *ToolExecutor) executeUpdateFilters(ctx context.Context, chartID string, chartVersion int, input json.RawMessage) (*ToolResult, error) {
	var params struct {
		Filters []models.DataFilter `json:"filters"`
	}
	if err := json.Unmarshal(input, &params); err != nil {
		return &ToolResult{Success: false, Error: "invalid input: " + err.Error()}, nil
	}

	chart, err := e.chartRepo.FindByIDAndVersion(ctx, chartID, chartVersion)
	if err != nil {
		return &ToolResult{Success: false, Error: "failed to get chart: " + err.Error()}, nil
	}
	if chart == nil {
		return &ToolResult{Success: false, Error: fmt.Sprintf("chart not found: %s v%d", chartID, chartVersion)}, nil
	}

	// Initialize DataMapping if nil
	if chart.DataMapping == nil {
		chart.DataMapping = &models.ChartDataMapping{}
	}

	chart.DataMapping.Filters = params.Filters

	if err := e.chartRepo.Update(ctx, chartID, chartVersion, chart); err != nil {
		return &ToolResult{Success: false, Error: "failed to update chart: " + err.Error()}, nil
	}

	// Broadcast chart update to all subscribers
	e.broadcastChartUpdate(chart)

	return &ToolResult{
		Success:      true,
		Message:      fmt.Sprintf("Updated filters: %d filter(s) applied", len(params.Filters)),
		ChartUpdated: true,
	}, nil
}

// executeUpdateAggregation updates aggregation configuration
func (e *ToolExecutor) executeUpdateAggregation(ctx context.Context, chartID string, chartVersion int, input json.RawMessage) (*ToolResult, error) {
	var params struct {
		Type   *string `json:"type,omitempty"`
		Field  *string `json:"field,omitempty"`
		SortBy *string `json:"sort_by,omitempty"`
		Count  *int    `json:"count,omitempty"`
	}
	if err := json.Unmarshal(input, &params); err != nil {
		return &ToolResult{Success: false, Error: "invalid input: " + err.Error()}, nil
	}

	chart, err := e.chartRepo.FindByIDAndVersion(ctx, chartID, chartVersion)
	if err != nil {
		return &ToolResult{Success: false, Error: "failed to get chart: " + err.Error()}, nil
	}
	if chart == nil {
		return &ToolResult{Success: false, Error: fmt.Sprintf("chart not found: %s v%d", chartID, chartVersion)}, nil
	}

	// Initialize DataMapping if nil
	if chart.DataMapping == nil {
		chart.DataMapping = &models.ChartDataMapping{}
	}
	if chart.DataMapping.Aggregation == nil {
		chart.DataMapping.Aggregation = &models.DataAggregation{}
	}

	if params.Type != nil {
		chart.DataMapping.Aggregation.Type = *params.Type
	}
	if params.Field != nil {
		chart.DataMapping.Aggregation.Field = *params.Field
	}
	if params.SortBy != nil {
		chart.DataMapping.Aggregation.SortBy = *params.SortBy
	}
	if params.Count != nil {
		chart.DataMapping.Aggregation.Count = *params.Count
	}

	if err := e.chartRepo.Update(ctx, chartID, chartVersion, chart); err != nil {
		return &ToolResult{Success: false, Error: "failed to update chart: " + err.Error()}, nil
	}

	// Broadcast chart update to all subscribers
	e.broadcastChartUpdate(chart)

	return &ToolResult{
		Success:      true,
		Message:      "Updated aggregation configuration",
		ChartUpdated: true,
	}, nil
}

// executeUpdateSlidingWindow updates sliding window configuration for time-based data filtering
func (e *ToolExecutor) executeUpdateSlidingWindow(ctx context.Context, chartID string, chartVersion int, input json.RawMessage) (*ToolResult, error) {
	var params struct {
		Duration     *int    `json:"duration,omitempty"`
		TimestampCol *string `json:"timestamp_col,omitempty"`
	}
	if err := json.Unmarshal(input, &params); err != nil {
		return &ToolResult{Success: false, Error: "invalid input: " + err.Error()}, nil
	}

	chart, err := e.chartRepo.FindByIDAndVersion(ctx, chartID, chartVersion)
	if err != nil {
		return &ToolResult{Success: false, Error: "failed to get chart: " + err.Error()}, nil
	}
	if chart == nil {
		return &ToolResult{Success: false, Error: fmt.Sprintf("chart not found: %s v%d", chartID, chartVersion)}, nil
	}

	// Initialize DataMapping if nil
	if chart.DataMapping == nil {
		chart.DataMapping = &models.ChartDataMapping{}
	}
	if chart.DataMapping.SlidingWindow == nil {
		chart.DataMapping.SlidingWindow = &models.SlidingWindow{}
	}

	if params.Duration != nil {
		chart.DataMapping.SlidingWindow.Duration = *params.Duration
	}
	if params.TimestampCol != nil {
		chart.DataMapping.SlidingWindow.TimestampCol = *params.TimestampCol
	}

	if err := e.chartRepo.Update(ctx, chartID, chartVersion, chart); err != nil {
		return &ToolResult{Success: false, Error: "failed to update chart: " + err.Error()}, nil
	}

	// Broadcast chart update to all subscribers
	e.broadcastChartUpdate(chart)

	return &ToolResult{
		Success:      true,
		Message:      fmt.Sprintf("Updated sliding window: %d seconds on column '%s'", chart.DataMapping.SlidingWindow.Duration, chart.DataMapping.SlidingWindow.TimestampCol),
		ChartUpdated: true,
	}, nil
}

// executeUpdateTimeBucket updates time-bucketed aggregation configuration for streaming data
func (e *ToolExecutor) executeUpdateTimeBucket(ctx context.Context, chartID string, chartVersion int, input json.RawMessage) (*ToolResult, error) {
	var params struct {
		Interval     *int      `json:"interval,omitempty"`
		Function     *string   `json:"function,omitempty"`
		ValueCols    *[]string `json:"value_cols,omitempty"`
		TimestampCol *string   `json:"timestamp_col,omitempty"`
	}
	if err := json.Unmarshal(input, &params); err != nil {
		return &ToolResult{Success: false, Error: "invalid input: " + err.Error()}, nil
	}

	chart, err := e.chartRepo.FindByIDAndVersion(ctx, chartID, chartVersion)
	if err != nil {
		return &ToolResult{Success: false, Error: "failed to get chart: " + err.Error()}, nil
	}
	if chart == nil {
		return &ToolResult{Success: false, Error: fmt.Sprintf("chart not found: %s v%d", chartID, chartVersion)}, nil
	}

	// Initialize DataMapping if nil
	if chart.DataMapping == nil {
		chart.DataMapping = &models.ChartDataMapping{}
	}
	if chart.DataMapping.TimeBucket == nil {
		chart.DataMapping.TimeBucket = &models.TimeBucket{}
	}

	if params.Interval != nil {
		chart.DataMapping.TimeBucket.Interval = *params.Interval
	}
	if params.Function != nil {
		// Validate function
		validFunctions := map[string]bool{"avg": true, "min": true, "max": true, "sum": true, "count": true}
		if !validFunctions[*params.Function] {
			return &ToolResult{Success: false, Error: "invalid function, must be: avg, min, max, sum, or count"}, nil
		}
		chart.DataMapping.TimeBucket.Function = *params.Function
	}
	if params.ValueCols != nil {
		chart.DataMapping.TimeBucket.ValueCols = *params.ValueCols
	}
	if params.TimestampCol != nil {
		chart.DataMapping.TimeBucket.TimestampCol = *params.TimestampCol
	}

	if err := e.chartRepo.Update(ctx, chartID, chartVersion, chart); err != nil {
		return &ToolResult{Success: false, Error: "failed to update chart: " + err.Error()}, nil
	}

	// Broadcast chart update to all subscribers
	e.broadcastChartUpdate(chart)

	return &ToolResult{
		Success:      true,
		Message:      fmt.Sprintf("Updated time bucket: %d second intervals using '%s' function on columns %v", chart.DataMapping.TimeBucket.Interval, chart.DataMapping.TimeBucket.Function, chart.DataMapping.TimeBucket.ValueCols),
		ChartUpdated: true,
	}, nil
}

// executeSetCustomCode enables custom code mode and sets component code
func (e *ToolExecutor) executeSetCustomCode(ctx context.Context, chartID string, chartVersion int, input json.RawMessage) (*ToolResult, error) {
	var params struct {
		ComponentCode string `json:"component_code"`
	}
	if err := json.Unmarshal(input, &params); err != nil {
		return &ToolResult{Success: false, Error: "invalid input: " + err.Error()}, nil
	}

	if params.ComponentCode == "" {
		return &ToolResult{Success: false, Error: "component_code is required"}, nil
	}

	chart, err := e.chartRepo.FindByIDAndVersion(ctx, chartID, chartVersion)
	if err != nil {
		return &ToolResult{Success: false, Error: "failed to get chart: " + err.Error()}, nil
	}
	if chart == nil {
		return &ToolResult{Success: false, Error: fmt.Sprintf("chart not found: %s v%d", chartID, chartVersion)}, nil
	}

	chart.UseCustomCode = true
	chart.ComponentCode = params.ComponentCode

	if err := e.chartRepo.Update(ctx, chartID, chartVersion, chart); err != nil {
		return &ToolResult{Success: false, Error: "failed to update chart: " + err.Error()}, nil
	}

	// Broadcast chart update to all subscribers
	e.broadcastChartUpdate(chart)

	return &ToolResult{
		Success:      true,
		Message:      "Enabled custom code mode and updated component code",
		ChartUpdated: true,
	}, nil
}

// executeUpdateChartOptions updates ECharts-specific options
func (e *ToolExecutor) executeUpdateChartOptions(ctx context.Context, chartID string, chartVersion int, input json.RawMessage) (*ToolResult, error) {
	var params struct {
		Title          *string   `json:"title,omitempty"`
		ShowLegend     *bool     `json:"show_legend,omitempty"`
		LegendPosition *string   `json:"legend_position,omitempty"`
		ShowTooltip    *bool     `json:"show_tooltip,omitempty"`
		ColorPalette   *[]string `json:"color_palette,omitempty"`
		StackSeries    *bool     `json:"stack_series,omitempty"`
		SmoothLines    *bool     `json:"smooth_lines,omitempty"`
		ShowDataLabels *bool     `json:"show_data_labels,omitempty"`
	}
	if err := json.Unmarshal(input, &params); err != nil {
		return &ToolResult{Success: false, Error: "invalid input: " + err.Error()}, nil
	}

	chart, err := e.chartRepo.FindByIDAndVersion(ctx, chartID, chartVersion)
	if err != nil {
		return &ToolResult{Success: false, Error: "failed to get chart: " + err.Error()}, nil
	}
	if chart == nil {
		return &ToolResult{Success: false, Error: fmt.Sprintf("chart not found: %s v%d", chartID, chartVersion)}, nil
	}

	// Initialize Options if nil
	if chart.Options == nil {
		chart.Options = make(map[string]interface{})
	}

	if params.Title != nil {
		chart.Options["title"] = *params.Title
	}
	if params.ShowLegend != nil {
		chart.Options["showLegend"] = *params.ShowLegend
	}
	if params.LegendPosition != nil {
		chart.Options["legendPosition"] = *params.LegendPosition
	}
	if params.ShowTooltip != nil {
		chart.Options["showTooltip"] = *params.ShowTooltip
	}
	if params.ColorPalette != nil {
		chart.Options["colorPalette"] = *params.ColorPalette
	}
	if params.StackSeries != nil {
		chart.Options["stackSeries"] = *params.StackSeries
	}
	if params.SmoothLines != nil {
		chart.Options["smoothLines"] = *params.SmoothLines
	}
	if params.ShowDataLabels != nil {
		chart.Options["showDataLabels"] = *params.ShowDataLabels
	}

	if err := e.chartRepo.Update(ctx, chartID, chartVersion, chart); err != nil {
		return &ToolResult{Success: false, Error: "failed to update chart: " + err.Error()}, nil
	}

	// Broadcast chart update to all subscribers
	e.broadcastChartUpdate(chart)

	return &ToolResult{
		Success:      true,
		Message:      "Updated chart options",
		ChartUpdated: true,
	}, nil
}

// executeQueryDatasource executes a query against a data source
func (e *ToolExecutor) executeQueryDatasource(ctx context.Context, input json.RawMessage) (*ToolResult, error) {
	var params struct {
		DatasourceID string  `json:"datasource_id"`
		Query        *string `json:"query,omitempty"`
		Limit        *int    `json:"limit,omitempty"`
	}
	if err := json.Unmarshal(input, &params); err != nil {
		return &ToolResult{Success: false, Error: "invalid input: " + err.Error()}, nil
	}

	if params.DatasourceID == "" {
		return &ToolResult{Success: false, Error: "datasource_id is required"}, nil
	}

	// Set default limit
	limit := 10
	if params.Limit != nil {
		limit = *params.Limit
	}

	query := ""
	if params.Query != nil {
		query = *params.Query
	}

	req := &models.QueryRequest{
		Query: models.Query{
			Raw: query,
			Params: map[string]interface{}{
				"limit": limit,
			},
		},
	}

	response, err := e.datasourceSvc.QueryDatasource(ctx, params.DatasourceID, req)
	if err != nil {
		return &ToolResult{Success: false, Error: "query failed: " + err.Error()}, nil
	}

	if response.ResultSet == nil {
		return &ToolResult{Success: true, Message: "Query returned no results", Data: nil}, nil
	}

	return &ToolResult{
		Success: true,
		Message: fmt.Sprintf("Query returned %d rows", len(response.ResultSet.Rows)),
		Data:    response.ResultSet,
	}, nil
}

// executeListDatasources lists all available data sources
func (e *ToolExecutor) executeListDatasources(ctx context.Context) (*ToolResult, error) {
	datasources, err := e.datasourceRepo.FindAll(ctx, 100, 0) // limit 100, offset 0
	if err != nil {
		return &ToolResult{Success: false, Error: "failed to list datasources: " + err.Error()}, nil
	}

	// Build summary list
	type dsSummary struct {
		ID          string   `json:"id"`
		Name        string   `json:"name"`
		Type        string   `json:"type"`
		Description string   `json:"description,omitempty"`
		Columns     []string `json:"columns,omitempty"`
	}

	summaries := make([]dsSummary, len(datasources))
	for i, ds := range datasources {
		summaries[i] = dsSummary{
			ID:          ds.ID.Hex(),
			Name:        ds.Name,
			Type:        string(ds.Type),
			Description: ds.Description,
		}
		// Note: Schema discovery would require querying the data source
		// For now, we just list the available data sources
	}

	return &ToolResult{
		Success: true,
		Message: fmt.Sprintf("Found %d data source(s)", len(datasources)),
		Data:    summaries,
	}, nil
}

// executeGetDatasourceSchema gets the schema (tables and columns) for a SQL data source
func (e *ToolExecutor) executeGetDatasourceSchema(ctx context.Context, input json.RawMessage) (*ToolResult, error) {
	var params struct {
		DatasourceID string `json:"datasource_id"`
	}
	if err := json.Unmarshal(input, &params); err != nil {
		return &ToolResult{Success: false, Error: "invalid input: " + err.Error()}, nil
	}

	if params.DatasourceID == "" {
		return &ToolResult{Success: false, Error: "datasource_id is required"}, nil
	}

	response, err := e.datasourceSvc.GetSchema(ctx, params.DatasourceID)
	if err != nil {
		return &ToolResult{Success: false, Error: "schema discovery failed: " + err.Error()}, nil
	}

	if !response.Success {
		return &ToolResult{Success: false, Error: response.Error}, nil
	}

	// Format schema info for AI consumption
	tableCount := len(response.Schema.Tables)
	return &ToolResult{
		Success: true,
		Message: fmt.Sprintf("Found %d table(s) in database", tableCount),
		Data:    response.Schema,
	}, nil
}

// executePreviewData gets sample data for the current chart configuration
func (e *ToolExecutor) executePreviewData(ctx context.Context, chartID string, chartVersion int, input json.RawMessage) (*ToolResult, error) {
	var params struct {
		Limit *int `json:"limit,omitempty"`
	}
	if err := json.Unmarshal(input, &params); err != nil {
		return &ToolResult{Success: false, Error: "invalid input: " + err.Error()}, nil
	}

	chart, err := e.chartRepo.FindByIDAndVersion(ctx, chartID, chartVersion)
	if err != nil {
		return &ToolResult{Success: false, Error: "failed to get chart: " + err.Error()}, nil
	}
	if chart == nil {
		return &ToolResult{Success: false, Error: fmt.Sprintf("chart not found: %s v%d", chartID, chartVersion)}, nil
	}

	if chart.DatasourceID == "" {
		return &ToolResult{Success: false, Error: "chart has no data source configured"}, nil
	}

	limit := 10
	if params.Limit != nil {
		limit = *params.Limit
	}

	query := ""
	if chart.QueryConfig != nil && chart.QueryConfig.Raw != "" {
		query = chart.QueryConfig.Raw
	}

	req := &models.QueryRequest{
		Query: models.Query{
			Raw: query,
			Params: map[string]interface{}{
				"limit": limit,
			},
		},
	}

	response, err := e.datasourceSvc.QueryDatasource(ctx, chart.DatasourceID, req)
	if err != nil {
		return &ToolResult{Success: false, Error: "query failed: " + err.Error()}, nil
	}

	// Check if ResultSet is nil (datasource may not have returned data)
	if response == nil || response.ResultSet == nil {
		return &ToolResult{
			Success: true,
			Message: "Preview returned 0 rows (no data available)",
			Data:    nil,
		}, nil
	}

	return &ToolResult{
		Success: true,
		Message: fmt.Sprintf("Preview returned %d rows", len(response.ResultSet.Rows)),
		Data:    response.ResultSet,
	}, nil
}

// executeGetChartState returns the current chart state
func (e *ToolExecutor) executeGetChartState(ctx context.Context, chartID string, chartVersion int) (*ToolResult, error) {
	chart, err := e.chartRepo.FindByIDAndVersion(ctx, chartID, chartVersion)
	if err != nil {
		return &ToolResult{Success: false, Error: "failed to get chart: " + err.Error()}, nil
	}
	if chart == nil {
		return &ToolResult{Success: false, Error: fmt.Sprintf("chart not found: %s v%d", chartID, chartVersion)}, nil
	}

	return &ToolResult{
		Success: true,
		Data:    chart,
	}, nil
}

// executeSuggestMissing handles the suggest_missing_tools tool
func (e *ToolExecutor) executeSuggestMissing(input json.RawMessage) (*ToolResult, error) {
	var params struct {
		Feature    string `json:"feature"`
		Suggestion string `json:"suggestion"`
	}
	if err := json.Unmarshal(input, &params); err != nil {
		return &ToolResult{Success: false, Error: "invalid input: " + err.Error()}, nil
	}

	return &ToolResult{
		Success: true,
		Message: fmt.Sprintf("Feature '%s' is not directly supported. %s", params.Feature, params.Suggestion),
		Data: map[string]string{
			"feature":    params.Feature,
			"suggestion": params.Suggestion,
		},
	}, nil
}
