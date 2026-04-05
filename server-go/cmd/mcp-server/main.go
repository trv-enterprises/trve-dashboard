// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/trv-enterprises/trve-dashboard/config"
	"github.com/trv-enterprises/trve-dashboard/internal/database"
	"github.com/trv-enterprises/trve-dashboard/internal/datasource"
	"github.com/trv-enterprises/trve-dashboard/internal/models"
	"github.com/trv-enterprises/trve-dashboard/internal/repository"
	"github.com/trv-enterprises/trve-dashboard/internal/service"
)

// MCP Protocol Types
type JSONRPCRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      interface{}     `json:"id"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

type JSONRPCResponse struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      interface{} `json:"id"`
	Result  interface{} `json:"result,omitempty"`
	Error   *RPCError   `json:"error,omitempty"`
}

type RPCError struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// MCP-specific types
type InitializeResult struct {
	ProtocolVersion string       `json:"protocolVersion"`
	Capabilities    Capabilities `json:"capabilities"`
	ServerInfo      ServerInfo   `json:"serverInfo"`
}

type Capabilities struct {
	Tools *ToolsCapability `json:"tools,omitempty"`
}

type ToolsCapability struct {
	ListChanged bool `json:"listChanged,omitempty"`
}

type ServerInfo struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type Tool struct {
	Name        string      `json:"name"`
	Description string      `json:"description"`
	InputSchema InputSchema `json:"inputSchema"`
}

type InputSchema struct {
	Type       string              `json:"type"`
	Properties map[string]Property `json:"properties,omitempty"`
	Required   []string            `json:"required,omitempty"`
}

type Property struct {
	Type        string `json:"type"`
	Description string `json:"description"`
}

type ToolsListResult struct {
	Tools []Tool `json:"tools"`
}

type CallToolParams struct {
	Name      string                 `json:"name"`
	Arguments map[string]interface{} `json:"arguments,omitempty"`
}

type ToolResult struct {
	Content []ContentBlock `json:"content"`
	IsError bool           `json:"isError,omitempty"`
}

type ContentBlock struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

// Server holds the MCP server state
type Server struct {
	mongodb   *database.MongoDB
	dsService *service.DatasourceService
	dsFactory *datasource.DataSourceFactory
}

func NewServer() (*Server, error) {
	// Get MongoDB connection string from environment or use default
	mongoURI := os.Getenv("MONGODB_URI")
	if mongoURI == "" {
		mongoURI = "mongodb://localhost:27017"
	}
	dbName := os.Getenv("MONGODB_DATABASE")
	if dbName == "" {
		dbName = "dashboard"
	}

	// Create MongoDB config
	cfg := config.MongoDBConfig{
		URI:               mongoURI,
		Database:          dbName,
		ConnectionTimeout: 10 * time.Second,
		MaxPoolSize:       10,
		MinPoolSize:       1,
	}

	// Connect to MongoDB
	mongodb, err := database.NewMongoDB(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to MongoDB: %w", err)
	}

	// Create repository and service
	dsRepo := repository.NewDatasourceRepository(mongodb.Database)
	dsService := service.NewDatasourceService(dsRepo)
	dsFactory := datasource.NewDataSourceFactory()

	return &Server{
		mongodb:   mongodb,
		dsService: dsService,
		dsFactory: dsFactory,
	}, nil
}

func (s *Server) Close() error {
	if s.mongodb != nil {
		return s.mongodb.Disconnect()
	}
	return nil
}

func (s *Server) handleRequest(req *JSONRPCRequest) *JSONRPCResponse {
	switch req.Method {
	case "initialize":
		return s.handleInitialize(req)
	case "tools/list":
		return s.handleToolsList(req)
	case "tools/call":
		return s.handleToolsCall(req)
	case "notifications/initialized":
		// Client notification, no response needed
		return nil
	default:
		return &JSONRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error: &RPCError{
				Code:    -32601,
				Message: fmt.Sprintf("Method not found: %s", req.Method),
			},
		}
	}
}

func (s *Server) handleInitialize(req *JSONRPCRequest) *JSONRPCResponse {
	return &JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      req.ID,
		Result: InitializeResult{
			ProtocolVersion: "2024-11-05",
			Capabilities: Capabilities{
				Tools: &ToolsCapability{},
			},
			ServerInfo: ServerInfo{
				Name:    "dashboard-datasource-mcp",
				Version: "1.0.0",
			},
		},
	}
}

func (s *Server) handleToolsList(req *JSONRPCRequest) *JSONRPCResponse {
	tools := []Tool{
		{
			Name:        "list_datasources",
			Description: "List all available data sources with their types, names, and descriptions. Use this to discover what data sources are available for querying.",
			InputSchema: InputSchema{
				Type:       "object",
				Properties: map[string]Property{},
			},
		},
		{
			Name:        "get_datasource",
			Description: "Get detailed information about a specific data source by ID, including its configuration and health status.",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"id": {
						Type:        "string",
						Description: "The data source ID",
					},
				},
				Required: []string{"id"},
			},
		},
		{
			Name:        "get_schema",
			Description: "Get the database schema for a SQL data source. Returns tables, columns, and data types. Only works for SQL data sources.",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"id": {
						Type:        "string",
						Description: "The data source ID (must be a SQL data source)",
					},
				},
				Required: []string{"id"},
			},
		},
		{
			Name:        "query_datasource",
			Description: "Execute a query against a data source. For SQL sources, provide a SQL query. Returns tabular data with columns and rows.",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"id": {
						Type:        "string",
						Description: "The data source ID to query",
					},
					"query": {
						Type:        "string",
						Description: "The query to execute (SQL for SQL sources, filter expression for others)",
					},
				},
				Required: []string{"id", "query"},
			},
		},
	}

	return &JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      req.ID,
		Result: ToolsListResult{
			Tools: tools,
		},
	}
}

func (s *Server) handleToolsCall(req *JSONRPCRequest) *JSONRPCResponse {
	var params CallToolParams
	if err := json.Unmarshal(req.Params, &params); err != nil {
		return &JSONRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error: &RPCError{
				Code:    -32602,
				Message: fmt.Sprintf("Invalid params: %v", err),
			},
		}
	}

	var result ToolResult

	switch params.Name {
	case "list_datasources":
		result = s.toolListDatasources()
	case "get_datasource":
		id, _ := params.Arguments["id"].(string)
		result = s.toolGetDatasource(id)
	case "get_schema":
		id, _ := params.Arguments["id"].(string)
		result = s.toolGetSchema(id)
	case "query_datasource":
		id, _ := params.Arguments["id"].(string)
		query, _ := params.Arguments["query"].(string)
		result = s.toolQueryDatasource(id, query)
	default:
		result = ToolResult{
			Content: []ContentBlock{{Type: "text", Text: fmt.Sprintf("Unknown tool: %s", params.Name)}},
			IsError: true,
		}
	}

	return &JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      req.ID,
		Result:  result,
	}
}

func (s *Server) toolListDatasources() ToolResult {
	ctx := context.Background()
	datasources, _, err := s.dsService.ListDatasources(ctx, 100, 0)
	if err != nil {
		return ToolResult{
			Content: []ContentBlock{{Type: "text", Text: fmt.Sprintf("Error listing data sources: %v", err)}},
			IsError: true,
		}
	}

	// Format as readable list
	var result string
	result = fmt.Sprintf("Found %d data source(s):\n\n", len(datasources))
	for _, ds := range datasources {
		result += fmt.Sprintf("- **%s** (ID: %s)\n", ds.Name, ds.ID.Hex())
		result += fmt.Sprintf("  Type: %s\n", ds.Type)
		if ds.Description != "" {
			result += fmt.Sprintf("  Description: %s\n", ds.Description)
		}
		result += fmt.Sprintf("  Health: %s\n", ds.Health.Status)
		result += "\n"
	}

	return ToolResult{
		Content: []ContentBlock{{Type: "text", Text: result}},
	}
}

func (s *Server) toolGetDatasource(id string) ToolResult {
	if id == "" {
		return ToolResult{
			Content: []ContentBlock{{Type: "text", Text: "Error: id is required"}},
			IsError: true,
		}
	}

	ctx := context.Background()
	ds, err := s.dsService.GetDatasource(ctx, id)
	if err != nil {
		return ToolResult{
			Content: []ContentBlock{{Type: "text", Text: fmt.Sprintf("Error getting data source: %v", err)}},
			IsError: true,
		}
	}

	// Format as JSON for detailed view
	data, _ := json.MarshalIndent(ds, "", "  ")
	return ToolResult{
		Content: []ContentBlock{{Type: "text", Text: string(data)}},
	}
}

func (s *Server) toolGetSchema(id string) ToolResult {
	if id == "" {
		return ToolResult{
			Content: []ContentBlock{{Type: "text", Text: "Error: id is required"}},
			IsError: true,
		}
	}

	ctx := context.Background()
	schemaResp, err := s.dsService.GetSchema(ctx, id)
	if err != nil {
		return ToolResult{
			Content: []ContentBlock{{Type: "text", Text: fmt.Sprintf("Error getting schema: %v", err)}},
			IsError: true,
		}
	}

	if !schemaResp.Success {
		return ToolResult{
			Content: []ContentBlock{{Type: "text", Text: fmt.Sprintf("Schema discovery failed: %s", schemaResp.Error)}},
			IsError: true,
		}
	}

	// Format schema in readable format
	var result string
	result = fmt.Sprintf("Database: %s\n\n", schemaResp.Schema.Database)
	for _, table := range schemaResp.Schema.Tables {
		result += fmt.Sprintf("Table: %s\n", table.Name)
		for _, col := range table.Columns {
			nullable := ""
			if col.Nullable {
				nullable = " (nullable)"
			}
			pk := ""
			if col.PrimaryKey {
				pk = " [PK]"
			}
			result += fmt.Sprintf("  - %s: %s%s%s\n", col.Name, col.Type, nullable, pk)
		}
		result += "\n"
	}

	return ToolResult{
		Content: []ContentBlock{{Type: "text", Text: result}},
	}
}

func (s *Server) toolQueryDatasource(id, query string) ToolResult {
	if id == "" {
		return ToolResult{
			Content: []ContentBlock{{Type: "text", Text: "Error: id is required"}},
			IsError: true,
		}
	}
	if query == "" {
		return ToolResult{
			Content: []ContentBlock{{Type: "text", Text: "Error: query is required"}},
			IsError: true,
		}
	}

	ctx := context.Background()

	// Get datasource to determine query type
	ds, err := s.dsService.GetDatasource(ctx, id)
	if err != nil {
		return ToolResult{
			Content: []ContentBlock{{Type: "text", Text: fmt.Sprintf("Error getting data source: %v", err)}},
			IsError: true,
		}
	}

	// Determine query type based on datasource type
	var queryType models.QueryType
	switch ds.Type {
	case models.DatasourceTypeSQL:
		queryType = models.QueryTypeSQL
	case models.DatasourceTypeCSV:
		queryType = models.QueryTypeCSVFilter
	case models.DatasourceTypeAPI:
		queryType = models.QueryTypeAPI
	case models.DatasourceTypeSocket:
		queryType = models.QueryTypeStreamFilter
	default:
		queryType = models.QueryTypeSQL
	}

	// Execute query
	queryReq := &models.QueryRequest{
		Query: models.Query{
			Raw:  query,
			Type: queryType,
		},
	}

	resp, err := s.dsService.QueryDatasource(ctx, id, queryReq)
	if err != nil {
		return ToolResult{
			Content: []ContentBlock{{Type: "text", Text: fmt.Sprintf("Error executing query: %v", err)}},
			IsError: true,
		}
	}

	if !resp.Success {
		return ToolResult{
			Content: []ContentBlock{{Type: "text", Text: fmt.Sprintf("Query failed: %s", resp.Error)}},
			IsError: true,
		}
	}

	// Format result as a table
	var result string
	rs := resp.ResultSet

	if len(rs.Rows) == 0 {
		result = "Query returned no results."
	} else {
		// Header
		result = "| " + fmt.Sprintf("%s", joinStrings(rs.Columns, " | ")) + " |\n"
		result += "|" + repeatString("---|", len(rs.Columns)) + "\n"

		// Limit to 50 rows for readability
		maxRows := 50
		rowCount := len(rs.Rows)
		if rowCount > maxRows {
			rowCount = maxRows
		}

		// Rows
		for i := 0; i < rowCount; i++ {
			row := rs.Rows[i]
			cells := make([]string, len(row))
			for j, cell := range row {
				cells[j] = fmt.Sprintf("%v", cell)
			}
			result += "| " + joinStrings(cells, " | ") + " |\n"
		}

		if len(rs.Rows) > maxRows {
			result += fmt.Sprintf("\n... and %d more rows (showing first %d)", len(rs.Rows)-maxRows, maxRows)
		}

		result += fmt.Sprintf("\n\nTotal: %d rows, Duration: %dms", len(rs.Rows), resp.Duration)
	}

	return ToolResult{
		Content: []ContentBlock{{Type: "text", Text: result}},
	}
}

func joinStrings(strs []string, sep string) string {
	if len(strs) == 0 {
		return ""
	}
	result := strs[0]
	for i := 1; i < len(strs); i++ {
		result += sep + strs[i]
	}
	return result
}

func repeatString(s string, n int) string {
	result := ""
	for i := 0; i < n; i++ {
		result += s
	}
	return result
}

func main() {
	// Create server
	server, err := NewServer()
	if err != nil {
		log.Fatalf("Failed to create server: %v", err)
	}
	defer server.Close()

	// Read from stdin, write to stdout
	scanner := bufio.NewScanner(os.Stdin)
	// Increase buffer size for large messages
	const maxScanTokenSize = 10 * 1024 * 1024 // 10MB
	buf := make([]byte, maxScanTokenSize)
	scanner.Buffer(buf, maxScanTokenSize)

	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}

		var req JSONRPCRequest
		if err := json.Unmarshal([]byte(line), &req); err != nil {
			// Log to stderr (for debugging)
			fmt.Fprintf(os.Stderr, "Failed to parse request: %v\n", err)
			continue
		}

		resp := server.handleRequest(&req)
		if resp != nil {
			respBytes, err := json.Marshal(resp)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Failed to marshal response: %v\n", err)
				continue
			}
			fmt.Println(string(respBytes))
		}
	}

	if err := scanner.Err(); err != nil {
		fmt.Fprintf(os.Stderr, "Scanner error: %v\n", err)
	}
}
