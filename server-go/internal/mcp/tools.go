// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

package mcp

import (
	"context"
	"fmt"

	"github.com/trv-enterprises/trve-dashboard/internal/models"
	"github.com/trv-enterprises/trve-dashboard/internal/service"
)

// ToolRegistry manages MCP tool definitions and handlers
type ToolRegistry struct {
	tools    map[string]Tool
	handlers map[string]ToolHandler

	datasourceService *service.DatasourceService
	dashboardService  *service.DashboardService
	chartService      *service.ChartService
}

// NewToolRegistry creates a new tool registry with the given services
func NewToolRegistry(datasourceSvc *service.DatasourceService, dashboardSvc *service.DashboardService, chartSvc *service.ChartService) *ToolRegistry {
	r := &ToolRegistry{
		tools:             make(map[string]Tool),
		handlers:          make(map[string]ToolHandler),
		datasourceService: datasourceSvc,
		dashboardService:  dashboardSvc,
		chartService:      chartSvc,
	}

	r.registerDatasourceTools()
	r.registerDashboardTools()
	r.registerChartTools()

	return r
}

// GetTools returns all registered tools
func (r *ToolRegistry) GetTools() []Tool {
	tools := make([]Tool, 0, len(r.tools))
	for _, tool := range r.tools {
		tools = append(tools, tool)
	}
	return tools
}

// CallTool executes a tool by name with the given arguments
func (r *ToolRegistry) CallTool(name string, args map[string]interface{}) (interface{}, error) {
	handler, ok := r.handlers[name]
	if !ok {
		return nil, fmt.Errorf("unknown tool: %s", name)
	}
	return handler(args)
}

// registerTool registers a tool definition and handler
func (r *ToolRegistry) registerTool(tool Tool, handler ToolHandler) {
	r.tools[tool.Name] = tool
	r.handlers[tool.Name] = handler
}

// registerDatasourceTools registers all data source-related tools
func (r *ToolRegistry) registerDatasourceTools() {
	// list_datasources
	r.registerTool(
		Tool{
			Name:        "list_datasources",
			Description: "List all configured data sources",
			InputSchema: InputSchema{
				Type:       "object",
				Properties: map[string]PropertySchema{},
				Required:   []string{},
			},
		},
		func(args map[string]interface{}) (interface{}, error) {
			ctx := context.Background()
			datasources, total, err := r.datasourceService.ListDatasources(ctx, 100, 0)
			if err != nil {
				return nil, err
			}
			return map[string]interface{}{
				"datasources": datasources,
				"count":       total,
			}, nil
		},
	)

	// get_datasource
	r.registerTool(
		Tool{
			Name:        "get_datasource",
			Description: "Get a specific data source by ID",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]PropertySchema{
					"id": {
						Type:        "string",
						Description: "Data source ID",
					},
				},
				Required: []string{"id"},
			},
		},
		func(args map[string]interface{}) (interface{}, error) {
			ctx := context.Background()
			id, ok := args["id"].(string)
			if !ok {
				return nil, fmt.Errorf("id must be a string")
			}
			return r.datasourceService.GetDatasource(ctx, id)
		},
	)

	// create_datasource
	r.registerTool(
		Tool{
			Name:        "create_datasource",
			Description: "Create a new data source configuration",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]PropertySchema{
					"name": {
						Type:        "string",
						Description: "Data source name",
					},
					"type": {
						Type:        "string",
						Description: "Data source type",
						Enum:        []string{"api", "sql", "csv", "socket"},
					},
					"description": {
						Type:        "string",
						Description: "Optional description",
					},
					"config": {
						Type:        "object",
						Description: "Data source configuration (api, sql, csv, or socket config)",
					},
				},
				Required: []string{"name", "type", "config"},
			},
		},
		func(args map[string]interface{}) (interface{}, error) {
			ctx := context.Background()

			req := &models.CreateDatasourceRequest{
				Name:        getString(args, "name"),
				Description: getString(args, "description"),
				Type:        models.DatasourceType(getString(args, "type")),
			}

			// Parse config based on type
			if configMap, ok := args["config"].(map[string]interface{}); ok {
				req.Config = parseDatasourceConfig(req.Type, configMap)
			}

			return r.datasourceService.CreateDatasource(ctx, req)
		},
	)

	// update_datasource
	r.registerTool(
		Tool{
			Name:        "update_datasource",
			Description: "Update an existing data source",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]PropertySchema{
					"id": {
						Type:        "string",
						Description: "Data source ID",
					},
					"name": {
						Type:        "string",
						Description: "New name (optional)",
					},
					"description": {
						Type:        "string",
						Description: "New description (optional)",
					},
					"config": {
						Type:        "object",
						Description: "Updated configuration (optional)",
					},
				},
				Required: []string{"id"},
			},
		},
		func(args map[string]interface{}) (interface{}, error) {
			ctx := context.Background()
			id := getString(args, "id")

			req := &models.UpdateDatasourceRequest{
				Name:        getString(args, "name"),
				Description: getString(args, "description"),
			}

			return r.datasourceService.UpdateDatasource(ctx, id, req)
		},
	)

	// delete_datasource
	r.registerTool(
		Tool{
			Name:        "delete_datasource",
			Description: "Delete a data source",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]PropertySchema{
					"id": {
						Type:        "string",
						Description: "Data source ID",
					},
				},
				Required: []string{"id"},
			},
		},
		func(args map[string]interface{}) (interface{}, error) {
			ctx := context.Background()
			id := getString(args, "id")
			err := r.datasourceService.DeleteDatasource(ctx, id)
			if err != nil {
				return nil, err
			}
			return map[string]interface{}{
				"success": true,
				"message": fmt.Sprintf("Data source %s deleted", id),
			}, nil
		},
	)

	// query_datasource
	r.registerTool(
		Tool{
			Name:        "query_datasource",
			Description: "Query data from a data source",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]PropertySchema{
					"datasource_id": {
						Type:        "string",
						Description: "ID of the data source to query",
					},
					"query": {
						Type:        "object",
						Description: "Query parameters (raw query, type, params)",
					},
				},
				Required: []string{"datasource_id", "query"},
			},
		},
		func(args map[string]interface{}) (interface{}, error) {
			ctx := context.Background()
			dsID := getString(args, "datasource_id")

			queryMap, _ := args["query"].(map[string]interface{})
			query := models.Query{
				Raw:    getString(queryMap, "raw"),
				Type:   models.QueryType(getString(queryMap, "type")),
				Params: getMap(queryMap, "params"),
			}

			req := &models.QueryRequest{Query: query}
			return r.datasourceService.QueryDatasource(ctx, dsID, req)
		},
	)

	// test_datasource
	r.registerTool(
		Tool{
			Name:        "test_datasource",
			Description: "Test a data source connection",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]PropertySchema{
					"id": {
						Type:        "string",
						Description: "Data source ID to test",
					},
				},
				Required: []string{"id"},
			},
		},
		func(args map[string]interface{}) (interface{}, error) {
			ctx := context.Background()
			id := getString(args, "id")
			return r.datasourceService.CheckHealth(ctx, id)
		},
	)
}

// registerDashboardTools registers all dashboard-related tools
func (r *ToolRegistry) registerDashboardTools() {
	// list_dashboards
	r.registerTool(
		Tool{
			Name:        "list_dashboards",
			Description: "List all dashboards",
			InputSchema: InputSchema{
				Type:       "object",
				Properties: map[string]PropertySchema{},
				Required:   []string{},
			},
		},
		func(args map[string]interface{}) (interface{}, error) {
			ctx := context.Background()
			params := models.DashboardQueryParams{
				Page:     1,
				PageSize: 100,
			}
			result, err := r.dashboardService.ListDashboards(ctx, params)
			if err != nil {
				return nil, err
			}
			return map[string]interface{}{
				"dashboards": result.Dashboards,
				"count":      result.Total,
			}, nil
		},
	)

	// get_dashboard
	r.registerTool(
		Tool{
			Name:        "get_dashboard",
			Description: "Get a specific dashboard by ID",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]PropertySchema{
					"id": {
						Type:        "string",
						Description: "Dashboard ID",
					},
				},
				Required: []string{"id"},
			},
		},
		func(args map[string]interface{}) (interface{}, error) {
			ctx := context.Background()
			id := getString(args, "id")
			return r.dashboardService.GetDashboard(ctx, id)
		},
	)

	// create_dashboard
	r.registerTool(
		Tool{
			Name:        "create_dashboard",
			Description: "Create a new dashboard with panels that reference charts",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]PropertySchema{
					"name": {
						Type:        "string",
						Description: "Dashboard name",
					},
					"description": {
						Type:        "string",
						Description: "Dashboard description",
					},
					"panels": {
						Type:        "array",
						Description: "Array of panel configurations (id, x, y, w, h, chart_id)",
					},
					"settings": {
						Type:        "object",
						Description: "Dashboard settings (theme, refresh_interval, etc.)",
					},
				},
				Required: []string{"name"},
			},
		},
		func(args map[string]interface{}) (interface{}, error) {
			ctx := context.Background()

			req := &models.CreateDashboardRequest{
				Name:        getString(args, "name"),
				Description: getString(args, "description"),
			}

			// Parse panels
			if panelsRaw, ok := args["panels"].([]interface{}); ok {
				req.Panels = parsePanels(panelsRaw)
			}

			// Parse settings
			if settingsRaw, ok := args["settings"].(map[string]interface{}); ok {
				req.Settings = parseSettings(settingsRaw)
			}

			return r.dashboardService.CreateDashboard(ctx, req)
		},
	)

	// update_dashboard
	r.registerTool(
		Tool{
			Name:        "update_dashboard",
			Description: "Update an existing dashboard",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]PropertySchema{
					"id": {
						Type:        "string",
						Description: "Dashboard ID",
					},
					"name": {
						Type:        "string",
						Description: "New name (optional)",
					},
					"description": {
						Type:        "string",
						Description: "New description (optional)",
					},
					"panels": {
						Type:        "array",
						Description: "Updated panels with chart_id references (optional)",
					},
					"settings": {
						Type:        "object",
						Description: "Updated settings (optional)",
					},
				},
				Required: []string{"id"},
			},
		},
		func(args map[string]interface{}) (interface{}, error) {
			ctx := context.Background()
			id := getString(args, "id")

			req := &models.UpdateDashboardRequest{}

			if name := getString(args, "name"); name != "" {
				req.Name = &name
			}
			if desc := getString(args, "description"); desc != "" {
				req.Description = &desc
			}
			if panelsRaw, ok := args["panels"].([]interface{}); ok {
				panels := parsePanels(panelsRaw)
				req.Panels = &panels
			}
			if settingsRaw, ok := args["settings"].(map[string]interface{}); ok {
				settings := parseSettings(settingsRaw)
				req.Settings = &settings
			}

			return r.dashboardService.UpdateDashboard(ctx, id, req)
		},
	)

	// delete_dashboard
	r.registerTool(
		Tool{
			Name:        "delete_dashboard",
			Description: "Delete a dashboard",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]PropertySchema{
					"id": {
						Type:        "string",
						Description: "Dashboard ID",
					},
				},
				Required: []string{"id"},
			},
		},
		func(args map[string]interface{}) (interface{}, error) {
			ctx := context.Background()
			id := getString(args, "id")
			err := r.dashboardService.DeleteDashboard(ctx, id)
			if err != nil {
				return nil, err
			}
			return map[string]interface{}{
				"success": true,
				"message": fmt.Sprintf("Dashboard %s deleted", id),
			}, nil
		},
	)
}

// registerChartTools registers all chart-related tools
func (r *ToolRegistry) registerChartTools() {
	// list_charts
	r.registerTool(
		Tool{
			Name:        "list_charts",
			Description: "List all charts with optional filtering",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]PropertySchema{
					"chart_type": {
						Type:        "string",
						Description: "Filter by chart type (bar, line, pie, etc.)",
					},
					"datasource_id": {
						Type:        "string",
						Description: "Filter by data source ID",
					},
					"tag": {
						Type:        "string",
						Description: "Filter by tag",
					},
				},
				Required: []string{},
			},
		},
		func(args map[string]interface{}) (interface{}, error) {
			ctx := context.Background()
			params := models.ChartQueryParams{
				Page:         1,
				PageSize:     100,
				ChartType:    getString(args, "chart_type"),
				DatasourceID: getString(args, "datasource_id"),
				Tag:          getString(args, "tag"),
			}
			result, err := r.chartService.ListCharts(ctx, params)
			if err != nil {
				return nil, err
			}
			return map[string]interface{}{
				"charts": result.Charts,
				"count":  result.Total,
			}, nil
		},
	)

	// get_chart
	r.registerTool(
		Tool{
			Name:        "get_chart",
			Description: "Get a specific chart by ID",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]PropertySchema{
					"id": {
						Type:        "string",
						Description: "Chart ID",
					},
				},
				Required: []string{"id"},
			},
		},
		func(args map[string]interface{}) (interface{}, error) {
			ctx := context.Background()
			id := getString(args, "id")
			return r.chartService.GetChart(ctx, id)
		},
	)

	// create_chart
	r.registerTool(
		Tool{
			Name:        "create_chart",
			Description: "Create a new chart with visualization configuration",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]PropertySchema{
					"name": {
						Type:        "string",
						Description: "Chart name",
					},
					"description": {
						Type:        "string",
						Description: "Chart description",
					},
					"chart_type": {
						Type:        "string",
						Description: "Chart type (bar, line, pie, scatter, etc.)",
					},
					"datasource_id": {
						Type:        "string",
						Description: "Data source ID to bind to",
					},
					"query_config": {
						Type:        "object",
						Description: "Query configuration (raw, type, params)",
					},
					"data_mapping": {
						Type:        "object",
						Description: "Data mapping (x_axis, y_axis, group_by, etc.)",
					},
					"component_code": {
						Type:        "string",
						Description: "Custom React component code",
					},
					"use_custom_code": {
						Type:        "boolean",
						Description: "Whether to use custom code mode",
					},
					"options": {
						Type:        "object",
						Description: "ECharts options overrides",
					},
					"tags": {
						Type:        "array",
						Description: "Tags for categorization",
					},
				},
				Required: []string{"name", "chart_type"},
			},
		},
		func(args map[string]interface{}) (interface{}, error) {
			ctx := context.Background()

			req := &models.CreateChartRequest{
				Name:          getString(args, "name"),
				Description:   getString(args, "description"),
				ChartType:     getString(args, "chart_type"),
				DatasourceID:  getString(args, "datasource_id"),
				ComponentCode: getString(args, "component_code"),
				UseCustomCode: getBool(args, "use_custom_code"),
			}

			// Parse query_config
			if qc, ok := args["query_config"].(map[string]interface{}); ok {
				req.QueryConfig = parseQueryConfig(qc)
			}

			// Parse data_mapping
			if dm, ok := args["data_mapping"].(map[string]interface{}); ok {
				req.DataMapping = parseDataMapping(dm)
			}

			// Parse options
			if opts, ok := args["options"].(map[string]interface{}); ok {
				req.Options = opts
			}

			// Parse tags
			if tagsRaw, ok := args["tags"].([]interface{}); ok {
				req.Tags = parseStringArray(tagsRaw)
			}

			return r.chartService.CreateChart(ctx, req)
		},
	)

	// update_chart
	r.registerTool(
		Tool{
			Name:        "update_chart",
			Description: "Update an existing chart",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]PropertySchema{
					"id": {
						Type:        "string",
						Description: "Chart ID",
					},
					"name": {
						Type:        "string",
						Description: "New name (optional)",
					},
					"description": {
						Type:        "string",
						Description: "New description (optional)",
					},
					"chart_type": {
						Type:        "string",
						Description: "New chart type (optional)",
					},
					"datasource_id": {
						Type:        "string",
						Description: "New data source ID (optional)",
					},
					"query_config": {
						Type:        "object",
						Description: "Updated query configuration (optional)",
					},
					"data_mapping": {
						Type:        "object",
						Description: "Updated data mapping (optional)",
					},
					"component_code": {
						Type:        "string",
						Description: "Updated custom component code (optional)",
					},
					"use_custom_code": {
						Type:        "boolean",
						Description: "Updated custom code mode (optional)",
					},
					"options": {
						Type:        "object",
						Description: "Updated ECharts options (optional)",
					},
					"tags": {
						Type:        "array",
						Description: "Updated tags (optional)",
					},
				},
				Required: []string{"id"},
			},
		},
		func(args map[string]interface{}) (interface{}, error) {
			ctx := context.Background()
			id := getString(args, "id")

			req := &models.UpdateChartRequest{}

			if name := getString(args, "name"); name != "" {
				req.Name = &name
			}
			if desc := getString(args, "description"); desc != "" {
				req.Description = &desc
			}
			if chartType := getString(args, "chart_type"); chartType != "" {
				req.ChartType = &chartType
			}
			if dsID := getString(args, "datasource_id"); dsID != "" {
				req.DatasourceID = &dsID
			}
			if code := getString(args, "component_code"); code != "" {
				req.ComponentCode = &code
			}
			if _, ok := args["use_custom_code"]; ok {
				useCustom := getBool(args, "use_custom_code")
				req.UseCustomCode = &useCustom
			}
			if qc, ok := args["query_config"].(map[string]interface{}); ok {
				queryConfig := parseQueryConfig(qc)
				req.QueryConfig = queryConfig
			}
			if dm, ok := args["data_mapping"].(map[string]interface{}); ok {
				dataMapping := parseDataMapping(dm)
				req.DataMapping = dataMapping
			}
			if opts, ok := args["options"].(map[string]interface{}); ok {
				req.Options = &opts
			}
			if tagsRaw, ok := args["tags"].([]interface{}); ok {
				tags := parseStringArray(tagsRaw)
				req.Tags = &tags
			}

			return r.chartService.UpdateChart(ctx, id, req)
		},
	)

	// delete_chart
	r.registerTool(
		Tool{
			Name:        "delete_chart",
			Description: "Delete a chart",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]PropertySchema{
					"id": {
						Type:        "string",
						Description: "Chart ID",
					},
				},
				Required: []string{"id"},
			},
		},
		func(args map[string]interface{}) (interface{}, error) {
			ctx := context.Background()
			id := getString(args, "id")
			err := r.chartService.DeleteChart(ctx, id)
			if err != nil {
				return nil, err
			}
			return map[string]interface{}{
				"success": true,
				"message": fmt.Sprintf("Chart %s deleted", id),
			}, nil
		},
	)

	// get_chart_summaries
	r.registerTool(
		Tool{
			Name:        "get_chart_summaries",
			Description: "Get lightweight chart summaries for selection UI",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]PropertySchema{
					"limit": {
						Type:        "number",
						Description: "Maximum number of summaries to return",
					},
				},
				Required: []string{},
			},
		},
		func(args map[string]interface{}) (interface{}, error) {
			ctx := context.Background()
			limit := int64(50)
			if l := getInt(args, "limit"); l > 0 {
				limit = int64(l)
			}
			return r.chartService.GetChartSummaries(ctx, limit)
		},
	)

	// get_dashboards_using_chart
	r.registerTool(
		Tool{
			Name:        "get_dashboards_using_chart",
			Description: "Get all dashboards that use a specific chart (useful for notifications)",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]PropertySchema{
					"chart_id": {
						Type:        "string",
						Description: "Chart ID to search for",
					},
				},
				Required: []string{"chart_id"},
			},
		},
		func(args map[string]interface{}) (interface{}, error) {
			ctx := context.Background()
			chartID := getString(args, "chart_id")
			params := models.DashboardQueryParams{
				ChartID:  chartID,
				Page:     1,
				PageSize: 100,
			}
			result, err := r.dashboardService.ListDashboards(ctx, params)
			if err != nil {
				return nil, err
			}
			return map[string]interface{}{
				"dashboards": result.Dashboards,
				"count":      result.Total,
			}, nil
		},
	)
}

// Helper functions for parsing arguments

func getString(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

func getInt(m map[string]interface{}, key string) int {
	if v, ok := m[key].(float64); ok {
		return int(v)
	}
	if v, ok := m[key].(int); ok {
		return v
	}
	return 0
}

func getBool(m map[string]interface{}, key string) bool {
	if v, ok := m[key].(bool); ok {
		return v
	}
	return false
}

func getMap(m map[string]interface{}, key string) map[string]interface{} {
	if v, ok := m[key].(map[string]interface{}); ok {
		return v
	}
	return nil
}

func parseDatasourceConfig(dsType models.DatasourceType, configMap map[string]interface{}) models.DatasourceConfig {
	config := models.DatasourceConfig{}

	switch dsType {
	case models.DatasourceTypeAPI:
		config.API = &models.APIConfig{
			URL:     getString(configMap, "url"),
			Method:  getString(configMap, "method"),
			Timeout: getInt(configMap, "timeout"),
		}
		if headers, ok := configMap["headers"].(map[string]interface{}); ok {
			config.API.Headers = make(map[string]string)
			for k, v := range headers {
				if str, ok := v.(string); ok {
					config.API.Headers[k] = str
				}
			}
		}
	case models.DatasourceTypeSQL:
		config.SQL = &models.SQLConfig{
			Driver:   getString(configMap, "driver"),
			Host:     getString(configMap, "host"),
			Port:     getInt(configMap, "port"),
			Database: getString(configMap, "database"),
			Username: getString(configMap, "username"),
			Password: getString(configMap, "password"),
			SSL:      getBool(configMap, "ssl"),
			Options:  getString(configMap, "options"),
		}
	case models.DatasourceTypeCSV:
		config.CSV = &models.CSVConfig{
			Path:      getString(configMap, "path"),
			Delimiter: getString(configMap, "delimiter"),
			HasHeader: getBool(configMap, "has_header"),
		}
	case models.DatasourceTypeSocket:
		config.Socket = &models.SocketConfig{
			URL:      getString(configMap, "url"),
			Protocol: getString(configMap, "protocol"),
		}
	}

	return config
}

func parsePanels(panelsRaw []interface{}) []models.DashboardPanel {
	panels := make([]models.DashboardPanel, 0, len(panelsRaw))
	for _, p := range panelsRaw {
		if pm, ok := p.(map[string]interface{}); ok {
			panels = append(panels, models.DashboardPanel{
				ID:      getString(pm, "id"),
				X:       getInt(pm, "x"),
				Y:       getInt(pm, "y"),
				W:       getInt(pm, "w"),
				H:       getInt(pm, "h"),
				ChartID: getString(pm, "chart_id"),
			})
		}
	}
	return panels
}

func parseSettings(settingsRaw map[string]interface{}) models.DashboardSettings {
	return models.DashboardSettings{
		Theme:           getString(settingsRaw, "theme"),
		RefreshInterval: getInt(settingsRaw, "refresh_interval"),
		TimeZone:        getString(settingsRaw, "timezone"),
		DefaultView:     getString(settingsRaw, "default_view"),
		IsPublic:        getBool(settingsRaw, "is_public"),
		AllowExport:     getBool(settingsRaw, "allow_export"),
	}
}

func parseQueryConfig(qc map[string]interface{}) *models.ChartQueryConfig {
	return &models.ChartQueryConfig{
		Raw:    getString(qc, "raw"),
		Type:   getString(qc, "type"),
		Params: getMap(qc, "params"),
	}
}

func parseDataMapping(dm map[string]interface{}) *models.ChartDataMapping {
	mapping := &models.ChartDataMapping{
		XAxis:     getString(dm, "x_axis"),
		GroupBy:   getString(dm, "group_by"),
		LabelCol:  getString(dm, "label_col"),
		SortBy:    getString(dm, "sort_by"),
		SortOrder: getString(dm, "sort_order"),
		Limit:     getInt(dm, "limit"),
	}

	// Parse y_axis array
	if yAxisRaw, ok := dm["y_axis"].([]interface{}); ok {
		mapping.YAxis = parseStringArray(yAxisRaw)
	}

	// Parse filters array
	if filtersRaw, ok := dm["filters"].([]interface{}); ok {
		filters := make([]models.DataFilter, 0, len(filtersRaw))
		for _, f := range filtersRaw {
			if fm, ok := f.(map[string]interface{}); ok {
				filters = append(filters, models.DataFilter{
					Field: getString(fm, "field"),
					Op:    getString(fm, "op"),
					Value: fm["value"],
				})
			}
		}
		mapping.Filters = filters
	}

	// Parse aggregation
	if aggRaw, ok := dm["aggregation"].(map[string]interface{}); ok {
		mapping.Aggregation = &models.DataAggregation{
			Type:   getString(aggRaw, "type"),
			SortBy: getString(aggRaw, "sort_by"),
			Field:  getString(aggRaw, "field"),
			Count:  getInt(aggRaw, "count"),
		}
	}

	return mapping
}

func parseStringArray(arr []interface{}) []string {
	result := make([]string, 0, len(arr))
	for _, item := range arr {
		if str, ok := item.(string); ok {
			result = append(result, str)
		}
	}
	return result
}
