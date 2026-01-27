// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

package ai

import (
	"github.com/anthropics/anthropic-sdk-go"
)

// GetAnthropicTools returns the list of tools available to the AI agent in Anthropic SDK format
func GetAnthropicTools() []anthropic.ToolUnionParam {
	toolParams := []anthropic.ToolParam{
		{
			Name:        "update_chart_config",
			Description: anthropic.String("Update basic chart configuration like description and chart type. Note: Chart name is set by the user when saving, do NOT try to set the name."),
			InputSchema: anthropic.ToolInputSchemaParam{
				Properties: map[string]interface{}{
					"description": map[string]interface{}{"type": "string", "description": "Chart description"},
					"chart_type": map[string]interface{}{
						"type":        "string",
						"description": "Type of chart",
						"enum":        []string{"bar", "line", "area", "pie", "scatter", "gauge", "heatmap", "radar", "funnel", "dataview", "custom"},
					},
				},
			},
		},
		{
			Name:        "update_data_mapping",
			Description: anthropic.String("Configure how data maps to chart axes and series"),
			InputSchema: anthropic.ToolInputSchemaParam{
				Properties: map[string]interface{}{
					"datasource_id":  map[string]interface{}{"type": "string", "description": "ID of the data source to use"},
					"x_axis":         map[string]interface{}{"type": "string", "description": "Column for X axis"},
					"x_axis_label":   map[string]interface{}{"type": "string", "description": "Label for X axis"},
					"x_axis_format":  map[string]interface{}{"type": "string", "description": "Format for X axis values"},
					"y_axis":         map[string]interface{}{"type": "array", "items": map[string]interface{}{"type": "string"}, "description": "Columns for Y axis"},
					"y_axis_label":   map[string]interface{}{"type": "string", "description": "Label for Y axis"},
					"group_by":       map[string]interface{}{"type": "string", "description": "Column to group data by"},
				},
			},
		},
		{
			Name:        "update_query_config",
			Description: anthropic.String("Update the query configuration for data retrieval"),
			InputSchema: anthropic.ToolInputSchemaParam{
				Properties: map[string]interface{}{
					"query":            map[string]interface{}{"type": "string", "description": "The query string (SQL, API path, etc.)"},
					"query_type":       map[string]interface{}{"type": "string", "description": "Type of query", "enum": []string{"sql", "api", "csv_filter", "stream_filter"}},
					"refresh_interval": map[string]interface{}{"type": "integer", "description": "Auto-refresh interval in milliseconds (0 for no refresh)"},
				},
			},
		},
		{
			Name:        "update_filters",
			Description: anthropic.String("Add or update data filters"),
			InputSchema: anthropic.ToolInputSchemaParam{
				Properties: map[string]interface{}{
					"filters": map[string]interface{}{
						"type": "array",
						"items": map[string]interface{}{
							"type": "object",
							"properties": map[string]interface{}{
								"field": map[string]interface{}{"type": "string"},
								"op":    map[string]interface{}{"type": "string", "enum": []string{"eq", "neq", "gt", "gte", "lt", "lte", "contains", "in"}},
								"value": map[string]interface{}{},
							},
						},
						"description": "Array of filter objects",
					},
				},
			},
		},
		{
			Name:        "update_aggregation",
			Description: anthropic.String("Configure data aggregation"),
			InputSchema: anthropic.ToolInputSchemaParam{
				Properties: map[string]interface{}{
					"type":    map[string]interface{}{"type": "string", "description": "Aggregation type", "enum": []string{"first", "last", "min", "max", "avg", "sum", "count", "limit"}},
					"field":   map[string]interface{}{"type": "string", "description": "Field to aggregate"},
					"sort_by": map[string]interface{}{"type": "string", "description": "Field to sort by (for first/last)"},
					"count":   map[string]interface{}{"type": "integer", "description": "Row count (for limit)"},
				},
			},
		},
		{
			Name:        "update_sliding_window",
			Description: anthropic.String("Configure a time-based sliding window to show only recent data. Essential for streaming/real-time charts to prevent unbounded data growth."),
			InputSchema: anthropic.ToolInputSchemaParam{
				Properties: map[string]interface{}{
					"duration":      map[string]interface{}{"type": "integer", "description": "Window duration in seconds (e.g., 300 for last 5 minutes, 3600 for last hour)"},
					"timestamp_col": map[string]interface{}{"type": "string", "description": "Name of the timestamp column in the data"},
				},
				Required: []string{"duration", "timestamp_col"},
			},
		},
		{
			Name:        "update_time_bucket",
			Description: anthropic.String("Configure time-bucketed aggregation for streaming data. Aggregates raw streaming data into time buckets (e.g., 1-minute averages). Only works with socket/streaming data sources."),
			InputSchema: anthropic.ToolInputSchemaParam{
				Properties: map[string]interface{}{
					"interval":      map[string]interface{}{"type": "integer", "description": "Bucket interval in seconds (e.g., 60 for 1-minute buckets, 3600 for hourly)"},
					"function":      map[string]interface{}{"type": "string", "description": "Aggregation function", "enum": []string{"avg", "min", "max", "sum", "count"}},
					"value_cols":    map[string]interface{}{"type": "array", "items": map[string]interface{}{"type": "string"}, "description": "Columns to aggregate (numeric values)"},
					"timestamp_col": map[string]interface{}{"type": "string", "description": "Column containing timestamps for bucket alignment"},
				},
				Required: []string{"interval", "function", "value_cols", "timestamp_col"},
			},
		},
		{
			Name:        "set_custom_code",
			Description: anthropic.String("Enable custom code mode and set React component code. Use this for complex charts not supported by standard config."),
			InputSchema: anthropic.ToolInputSchemaParam{
				Properties: map[string]interface{}{
					"component_code": map[string]interface{}{"type": "string", "description": "Full React component code"},
				},
				Required: []string{"component_code"},
			},
		},
		{
			Name:        "update_chart_options",
			Description: anthropic.String("Update ECharts-specific options for the chart"),
			InputSchema: anthropic.ToolInputSchemaParam{
				Properties: map[string]interface{}{
					"title":            map[string]interface{}{"type": "string", "description": "Chart title displayed on the chart"},
					"show_legend":      map[string]interface{}{"type": "boolean", "description": "Whether to show the legend"},
					"legend_position":  map[string]interface{}{"type": "string", "description": "Legend position", "enum": []string{"top", "bottom", "left", "right"}},
					"show_tooltip":     map[string]interface{}{"type": "boolean", "description": "Whether to show tooltips on hover"},
					"color_palette":    map[string]interface{}{"type": "array", "items": map[string]interface{}{"type": "string"}, "description": "Array of color hex codes for series"},
					"stack_series":     map[string]interface{}{"type": "boolean", "description": "Whether to stack series (bar/area charts)"},
					"smooth_lines":     map[string]interface{}{"type": "boolean", "description": "Whether to smooth line charts"},
					"show_data_labels": map[string]interface{}{"type": "boolean", "description": "Whether to show data labels on chart"},
				},
			},
		},
		{
			Name:        "query_datasource",
			Description: anthropic.String("Execute a test query against a data source to see sample data"),
			InputSchema: anthropic.ToolInputSchemaParam{
				Properties: map[string]interface{}{
					"datasource_id": map[string]interface{}{"type": "string", "description": "ID of the data source"},
					"query":         map[string]interface{}{"type": "string", "description": "Query to execute (SQL, filter, etc.)"},
					"limit":         map[string]interface{}{"type": "integer", "description": "Maximum rows to return", "default": 10},
				},
				Required: []string{"datasource_id"},
			},
		},
		{
			Name:        "list_datasources",
			Description: anthropic.String("List all available data sources with their types and descriptions"),
			InputSchema: anthropic.ToolInputSchemaParam{
				Properties: map[string]interface{}{},
			},
		},
		{
			Name:        "get_datasource_schema",
			Description: anthropic.String("Get the schema (tables and columns) for a SQL database data source. Use this to discover what tables and columns are available before writing queries."),
			InputSchema: anthropic.ToolInputSchemaParam{
				Properties: map[string]interface{}{
					"datasource_id": map[string]interface{}{"type": "string", "description": "ID of the SQL data source"},
				},
				Required: []string{"datasource_id"},
			},
		},
		{
			Name:        "preview_data",
			Description: anthropic.String("Get sample data for the current chart configuration"),
			InputSchema: anthropic.ToolInputSchemaParam{
				Properties: map[string]interface{}{
					"limit": map[string]interface{}{"type": "integer", "description": "Maximum rows to return", "default": 10},
				},
			},
		},
		{
			Name:        "get_chart_state",
			Description: anthropic.String("Get the current state of the chart being edited"),
			InputSchema: anthropic.ToolInputSchemaParam{
				Properties: map[string]interface{}{},
			},
		},
		{
			Name:        "suggest_missing_tools",
			Description: anthropic.String("When user requests an ECharts feature not supported by current tools, explain what would be needed"),
			InputSchema: anthropic.ToolInputSchemaParam{
				Properties: map[string]interface{}{
					"feature":    map[string]interface{}{"type": "string", "description": "The ECharts feature being requested"},
					"suggestion": map[string]interface{}{"type": "string", "description": "Explanation of what tools/config would need to be added"},
				},
				Required: []string{"feature", "suggestion"},
			},
		},
	}

	// Convert to ToolUnionParam
	tools := make([]anthropic.ToolUnionParam, len(toolParams))
	for i := range toolParams {
		tools[i] = anthropic.ToolUnionParam{OfTool: &toolParams[i]}
	}

	return tools
}

// ToolName constants for easier reference
const (
	ToolUpdateChartConfig    = "update_chart_config"
	ToolUpdateDataMapping    = "update_data_mapping"
	ToolUpdateQueryConfig    = "update_query_config"
	ToolUpdateFilters        = "update_filters"
	ToolUpdateAggregation    = "update_aggregation"
	ToolUpdateSlidingWindow  = "update_sliding_window"
	ToolUpdateTimeBucket     = "update_time_bucket"
	ToolSetCustomCode        = "set_custom_code"
	ToolUpdateChartOptions   = "update_chart_options"
	ToolQueryDatasource      = "query_datasource"
	ToolListDatasources      = "list_datasources"
	ToolGetDatasourceSchema  = "get_datasource_schema"
	ToolPreviewData          = "preview_data"
	ToolGetChartState        = "get_chart_state"
	ToolSuggestMissing       = "suggest_missing_tools"
)

// IsChartUpdateTool returns true if the tool modifies the chart
func IsChartUpdateTool(toolName string) bool {
	switch toolName {
	case ToolUpdateChartConfig, ToolUpdateDataMapping, ToolUpdateQueryConfig,
		ToolUpdateFilters, ToolUpdateAggregation, ToolUpdateSlidingWindow, ToolUpdateTimeBucket, ToolSetCustomCode, ToolUpdateChartOptions:
		return true
	default:
		return false
	}
}
