// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

package service

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/tviviano/dashboard/internal/datasource"
	"github.com/tviviano/dashboard/internal/models"
	"github.com/tviviano/dashboard/internal/repository"
)

// DatasourceService handles datasource business logic
type DatasourceService struct {
	repo *repository.DatasourceRepository
}

// NewDatasourceService creates a new datasource service
func NewDatasourceService(repo *repository.DatasourceRepository) *DatasourceService {
	return &DatasourceService{
		repo: repo,
	}
}

// CreateDatasource creates a new datasource with validation
func (s *DatasourceService) CreateDatasource(ctx context.Context, req *models.CreateDatasourceRequest) (*models.Datasource, error) {
	// Check name uniqueness
	existing, err := s.repo.FindByName(ctx, req.Name)
	if err != nil {
		return nil, fmt.Errorf("error checking name uniqueness: %w", err)
	}
	if existing != nil {
		return nil, fmt.Errorf("datasource with name '%s' already exists", req.Name)
	}

	// Validate config based on type
	if err := s.validateConfig(req.Type, req.Config); err != nil {
		return nil, fmt.Errorf("invalid configuration: %w", err)
	}

	// Default MaskSecrets to true if not specified
	maskSecrets := true
	if req.MaskSecrets != nil {
		maskSecrets = *req.MaskSecrets
	}

	datasource := &models.Datasource{
		Name:        req.Name,
		Description: req.Description,
		Type:        req.Type,
		Config:      req.Config,
		Tags:        req.Tags,
		MaskSecrets: maskSecrets,
		Health: models.HealthInfo{
			Status: models.HealthStatusUnknown,
		},
	}

	if err := s.repo.Create(ctx, datasource); err != nil {
		return nil, fmt.Errorf("error creating datasource: %w", err)
	}

	return datasource, nil
}

// GetDatasource retrieves a datasource by ID
func (s *DatasourceService) GetDatasource(ctx context.Context, id string) (*models.Datasource, error) {
	datasource, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("error retrieving datasource: %w", err)
	}
	if datasource == nil {
		return nil, fmt.Errorf("datasource not found")
	}
	return datasource, nil
}

// ListDatasources retrieves all datasources with pagination
func (s *DatasourceService) ListDatasources(ctx context.Context, limit, offset int64) ([]*models.Datasource, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	datasources, err := s.repo.FindAll(ctx, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("error listing datasources: %w", err)
	}

	total, err := s.repo.Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("error counting datasources: %w", err)
	}

	return datasources, total, nil
}

// ListDatasourcesByType retrieves datasources by type with pagination
func (s *DatasourceService) ListDatasourcesByType(ctx context.Context, dsType models.DatasourceType, limit, offset int64) ([]*models.Datasource, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	datasources, err := s.repo.FindByType(ctx, dsType, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("error listing datasources by type: %w", err)
	}

	total, err := s.repo.CountByType(ctx, dsType)
	if err != nil {
		return nil, 0, fmt.Errorf("error counting datasources by type: %w", err)
	}

	return datasources, total, nil
}

// UpdateDatasource updates an existing datasource
func (s *DatasourceService) UpdateDatasource(ctx context.Context, id string, req *models.UpdateDatasourceRequest) (*models.Datasource, error) {
	// Get existing datasource
	datasource, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("error retrieving datasource: %w", err)
	}
	if datasource == nil {
		return nil, fmt.Errorf("datasource not found")
	}

	// Update fields if provided
	if req.Name != "" && req.Name != datasource.Name {
		// Check name uniqueness
		existing, err := s.repo.FindByName(ctx, req.Name)
		if err != nil {
			return nil, fmt.Errorf("error checking name uniqueness: %w", err)
		}
		if existing != nil && existing.ID != datasource.ID {
			return nil, fmt.Errorf("datasource with name '%s' already exists", req.Name)
		}
		datasource.Name = req.Name
	}

	if req.Description != "" {
		datasource.Description = req.Description
	}

	// MaskSecrets cannot be changed after creation (security constraint)
	// If provided and different from current value, reject the update
	if req.MaskSecrets != nil && *req.MaskSecrets != datasource.MaskSecrets {
		return nil, fmt.Errorf("mask_secrets cannot be changed after datasource creation")
	}

	// Update config if provided and validate
	if req.Config.API != nil || req.Config.Socket != nil || req.Config.CSV != nil || req.Config.SQL != nil || req.Config.TSStore != nil {
		// Preserve existing secrets if masked value is sent
		preserveSecrets(&req.Config, &datasource.Config)

		if err := s.validateConfig(datasource.Type, req.Config); err != nil {
			return nil, fmt.Errorf("invalid configuration: %w", err)
		}
		datasource.Config = req.Config
	}

	if req.Tags != nil {
		datasource.Tags = req.Tags
	}

	if err := s.repo.Update(ctx, id, datasource); err != nil {
		return nil, fmt.Errorf("error updating datasource: %w", err)
	}

	return datasource, nil
}

// preserveSecrets copies secret values from existing config if the new config contains the masked value.
// This allows the frontend to send "********" for unchanged secrets without losing the actual value.
func preserveSecrets(newConfig, existingConfig *models.DatasourceConfig) {
	// Preserve SQL secrets
	if newConfig.SQL != nil && existingConfig.SQL != nil {
		if newConfig.SQL.Password == models.SecretMaskedValue {
			newConfig.SQL.Password = existingConfig.SQL.Password
		}
	}

	// Preserve API secrets
	if newConfig.API != nil && existingConfig.API != nil {
		// Preserve auth credentials
		if len(newConfig.API.AuthCredentials) > 0 && len(existingConfig.API.AuthCredentials) > 0 {
			for k, v := range newConfig.API.AuthCredentials {
				if v == models.SecretMaskedValue {
					if existingVal, ok := existingConfig.API.AuthCredentials[k]; ok {
						newConfig.API.AuthCredentials[k] = existingVal
					}
				}
			}
		}
		// Preserve sensitive headers
		if len(newConfig.API.Headers) > 0 && len(existingConfig.API.Headers) > 0 {
			for k, v := range newConfig.API.Headers {
				if v == models.SecretMaskedValue {
					if existingVal, ok := existingConfig.API.Headers[k]; ok {
						newConfig.API.Headers[k] = existingVal
					}
				}
			}
		}
	}

	// Preserve TSStore secrets
	if newConfig.TSStore != nil && existingConfig.TSStore != nil {
		if newConfig.TSStore.APIKey == models.SecretMaskedValue {
			newConfig.TSStore.APIKey = existingConfig.TSStore.APIKey
		}
	}

	// Preserve Socket header secrets
	if newConfig.Socket != nil && existingConfig.Socket != nil {
		if len(newConfig.Socket.Headers) > 0 && len(existingConfig.Socket.Headers) > 0 {
			for k, v := range newConfig.Socket.Headers {
				if v == models.SecretMaskedValue {
					if existingVal, ok := existingConfig.Socket.Headers[k]; ok {
						newConfig.Socket.Headers[k] = existingVal
					}
				}
			}
		}
	}
}

// DeleteDatasource deletes a datasource by ID
func (s *DatasourceService) DeleteDatasource(ctx context.Context, id string) error {
	// Check if datasource exists
	datasource, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return fmt.Errorf("error retrieving datasource: %w", err)
	}
	if datasource == nil {
		return fmt.Errorf("datasource not found")
	}

	if err := s.repo.Delete(ctx, id); err != nil {
		return fmt.Errorf("error deleting datasource: %w", err)
	}

	return nil
}

// TestDatasource tests a datasource connection without saving
func (s *DatasourceService) TestDatasource(ctx context.Context, req *models.TestDatasourceRequest) (*models.TestDatasourceResponse, error) {
	if err := s.validateConfig(req.Type, req.Config); err != nil {
		return &models.TestDatasourceResponse{
			Success: false,
			Status:  models.HealthStatusUnhealthy,
			Message: fmt.Sprintf("Invalid configuration: %v", err),
		}, nil
	}

	startTime := time.Now()
	var response *models.TestDatasourceResponse

	switch req.Type {
	case models.DatasourceTypeSQL:
		response = s.testSQLConnection(req.Config.SQL)
	case models.DatasourceTypeAPI:
		response = s.testAPIConnection(ctx, req.Config.API)
	case models.DatasourceTypeCSV:
		response = s.testFileConnection(req.Config.CSV)
	case models.DatasourceTypeSocket:
		response = &models.TestDatasourceResponse{
			Success: true,
			Status:  models.HealthStatusHealthy,
			Message: "WebSocket validation successful (connection test requires runtime connection)",
		}
	case models.DatasourceTypeTSStore:
		response = s.testTSStoreConnection(ctx, req.Config.TSStore)
	default:
		return &models.TestDatasourceResponse{
			Success: false,
			Status:  models.HealthStatusUnhealthy,
			Message: fmt.Sprintf("Unsupported datasource type: %s", req.Type),
		}, nil
	}

	response.ResponseTime = time.Since(startTime).Milliseconds()
	return response, nil
}

// CheckHealth checks the health of a datasource and updates its status
func (s *DatasourceService) CheckHealth(ctx context.Context, id string) (*models.HealthInfo, error) {
	datasource, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("error retrieving datasource: %w", err)
	}
	if datasource == nil {
		return nil, fmt.Errorf("datasource not found")
	}

	startTime := time.Now()
	health := models.HealthInfo{
		LastCheck: time.Now(),
	}

	var testResponse *models.TestDatasourceResponse

	switch datasource.Type {
	case models.DatasourceTypeSQL:
		testResponse = s.testSQLConnection(datasource.Config.SQL)
	case models.DatasourceTypeAPI:
		testResponse = s.testAPIConnection(ctx, datasource.Config.API)
	case models.DatasourceTypeCSV:
		testResponse = s.testFileConnection(datasource.Config.CSV)
	case models.DatasourceTypeSocket:
		testResponse = &models.TestDatasourceResponse{
			Success: true,
			Status:  models.HealthStatusHealthy,
			Message: "WebSocket configuration valid",
		}
	case models.DatasourceTypeTSStore:
		testResponse = s.testTSStoreConnection(ctx, datasource.Config.TSStore)
	}

	health.Status = testResponse.Status
	health.ResponseTime = time.Since(startTime).Milliseconds()

	if testResponse.Success {
		health.LastSuccess = time.Now()
		health.ErrorMessage = ""
	} else {
		health.ErrorMessage = testResponse.Message
	}

	// Update health in database
	if err := s.repo.UpdateHealth(ctx, id, health); err != nil {
		return nil, fmt.Errorf("error updating health status: %w", err)
	}

	return &health, nil
}

// validateConfig validates datasource configuration based on type
func (s *DatasourceService) validateConfig(dsType models.DatasourceType, config models.DatasourceConfig) error {
	switch dsType {
	case models.DatasourceTypeAPI:
		if config.API == nil {
			return fmt.Errorf("API configuration is required for API datasource")
		}
		return s.validateAPIConfig(config.API)

	case models.DatasourceTypeSQL:
		if config.SQL == nil {
			return fmt.Errorf("SQL configuration is required for SQL datasource")
		}
		return s.validateSQLConfig(config.SQL)

	case models.DatasourceTypeSocket:
		if config.Socket == nil {
			return fmt.Errorf("Socket configuration is required for Socket datasource")
		}
		return s.validateSocketConfig(config.Socket)

	case models.DatasourceTypeCSV:
		if config.CSV == nil {
			return fmt.Errorf("CSV configuration is required for CSV datasource")
		}
		return s.validateCSVConfig(config.CSV)

	case models.DatasourceTypeTSStore:
		if config.TSStore == nil {
			return fmt.Errorf("TSStore configuration is required for TSStore datasource")
		}
		return s.validateTSStoreConfig(config.TSStore)

	default:
		return fmt.Errorf("unsupported datasource type: %s", dsType)
	}
}

// validateAPIConfig validates API configuration
func (s *DatasourceService) validateAPIConfig(config *models.APIConfig) error {
	if config.URL == "" {
		return fmt.Errorf("URL is required")
	}

	if config.Method != "" {
		validMethods := map[string]bool{
			"GET": true, "POST": true, "PUT": true, "DELETE": true, "PATCH": true,
		}
		if !validMethods[config.Method] {
			return fmt.Errorf("invalid HTTP method: %s", config.Method)
		}
	}

	if config.Timeout < 0 {
		return fmt.Errorf("timeout cannot be negative")
	}

	if config.RetryCount < 0 {
		return fmt.Errorf("retry count cannot be negative")
	}

	if config.RetryDelay < 0 {
		return fmt.Errorf("retry delay cannot be negative")
	}

	return nil
}

// validateSQLConfig validates SQL configuration
func (s *DatasourceService) validateSQLConfig(config *models.SQLConfig) error {
	if config.Driver == "" {
		return fmt.Errorf("database driver is required")
	}

	validDrivers := map[string]bool{
		"postgres": true, "mysql": true, "sqlite": true, "mssql": true, "oracle": true,
	}
	if !validDrivers[config.Driver] {
		return fmt.Errorf("unsupported database driver: %s", config.Driver)
	}

	// SQLite only needs database (file path)
	if config.Driver == "sqlite" {
		if config.Database == "" {
			return fmt.Errorf("database path is required for SQLite")
		}
		return nil
	}

	// Other drivers need host, database, and username
	if config.Host == "" {
		return fmt.Errorf("host is required")
	}
	if config.Database == "" {
		return fmt.Errorf("database name is required")
	}
	if config.Username == "" {
		return fmt.Errorf("username is required")
	}
	if config.Port == 0 {
		return fmt.Errorf("port is required")
	}

	return nil
}

// validateSocketConfig validates Socket configuration
func (s *DatasourceService) validateSocketConfig(config *models.SocketConfig) error {
	if config.URL == "" {
		return fmt.Errorf("URL is required")
	}

	if !strings.HasPrefix(config.URL, "ws://") && !strings.HasPrefix(config.URL, "wss://") {
		return fmt.Errorf("URL must start with ws:// or wss://")
	}

	if config.ReconnectDelay < 0 {
		return fmt.Errorf("reconnect delay cannot be negative")
	}

	if config.PingInterval < 0 {
		return fmt.Errorf("ping interval cannot be negative")
	}

	return nil
}

// validateCSVConfig validates CSV file configuration
func (s *DatasourceService) validateCSVConfig(config *models.CSVConfig) error {
	if config.Path == "" {
		return fmt.Errorf("file path is required")
	}

	return nil
}

// validateTSStoreConfig validates TSStore configuration
func (s *DatasourceService) validateTSStoreConfig(config *models.TSStoreConfig) error {
	if config.Host == "" {
		return fmt.Errorf("host is required")
	}
	if config.Port == 0 {
		return fmt.Errorf("port is required")
	}
	if config.StoreName == "" {
		return fmt.Errorf("store name is required")
	}

	return nil
}

// testAPIConnection tests an API connection
func (s *DatasourceService) testAPIConnection(ctx context.Context, config *models.APIConfig) *models.TestDatasourceResponse {
	timeout := 30 * time.Second
	if config.Timeout > 0 {
		timeout = time.Duration(config.Timeout) * time.Second
	}

	client := &http.Client{
		Timeout: timeout,
	}

	method := "GET"
	if config.Method != "" {
		method = config.Method
	}

	req, err := http.NewRequestWithContext(ctx, method, config.URL, nil)
	if err != nil {
		return &models.TestDatasourceResponse{
			Success: false,
			Status:  models.HealthStatusUnhealthy,
			Message: fmt.Sprintf("Error creating request: %v", err),
		}
	}

	// Add headers
	for key, value := range config.Headers {
		req.Header.Set(key, value)
	}

	// Add auth headers
	if config.AuthType == "bearer" && config.AuthCredentials["token"] != "" {
		req.Header.Set("Authorization", "Bearer "+config.AuthCredentials["token"])
	} else if config.AuthType == "basic" {
		username := config.AuthCredentials["username"]
		password := config.AuthCredentials["password"]
		if username != "" || password != "" {
			req.SetBasicAuth(username, password)
		}
	} else if config.AuthType == "api-key" {
		if key := config.AuthCredentials["key"]; key != "" {
			headerName := config.AuthCredentials["header"]
			if headerName == "" {
				headerName = "X-API-Key"
			}
			req.Header.Set(headerName, key)
		}
	}

	// Add query params
	if len(config.QueryParams) > 0 {
		q := req.URL.Query()
		for key, value := range config.QueryParams {
			q.Add(key, value)
		}
		req.URL.RawQuery = q.Encode()
	}

	resp, err := client.Do(req)
	if err != nil {
		return &models.TestDatasourceResponse{
			Success: false,
			Status:  models.HealthStatusUnhealthy,
			Message: fmt.Sprintf("Connection failed: %v", err),
		}
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return &models.TestDatasourceResponse{
			Success: true,
			Status:  models.HealthStatusHealthy,
			Message: fmt.Sprintf("Connection successful (HTTP %d)", resp.StatusCode),
		}
	}

	return &models.TestDatasourceResponse{
		Success: false,
		Status:  models.HealthStatusDegraded,
		Message: fmt.Sprintf("HTTP %d: %s", resp.StatusCode, resp.Status),
	}
}

// testFileConnection tests a CSV file datasource
func (s *DatasourceService) testFileConnection(config *models.CSVConfig) *models.TestDatasourceResponse {
	// Check if file exists
	info, err := os.Stat(config.Path)
	if err != nil {
		if os.IsNotExist(err) {
			return &models.TestDatasourceResponse{
				Success: false,
				Status:  models.HealthStatusUnhealthy,
				Message: "File does not exist",
			}
		}
		return &models.TestDatasourceResponse{
			Success: false,
			Status:  models.HealthStatusUnhealthy,
			Message: fmt.Sprintf("Error accessing file: %v", err),
		}
	}

	// Check if it's a regular file
	if info.IsDir() {
		return &models.TestDatasourceResponse{
			Success: false,
			Status:  models.HealthStatusUnhealthy,
			Message: "Path is a directory, not a file",
		}
	}

	// Check file extension is CSV
	ext := strings.TrimPrefix(filepath.Ext(config.Path), ".")
	if ext != "csv" {
		return &models.TestDatasourceResponse{
			Success: false,
			Status:  models.HealthStatusDegraded,
			Message: fmt.Sprintf("File extension .%s is not a CSV file", ext),
		}
	}

	// Try to open and read first few bytes
	file, err := os.Open(config.Path)
	if err != nil {
		return &models.TestDatasourceResponse{
			Success: false,
			Status:  models.HealthStatusUnhealthy,
			Message: fmt.Sprintf("Cannot open file: %v", err),
		}
	}
	defer file.Close()

	// Try reading first 1KB to verify readability
	buffer := make([]byte, 1024)
	_, err = file.Read(buffer)
	if err != nil && err != io.EOF {
		return &models.TestDatasourceResponse{
			Success: false,
			Status:  models.HealthStatusUnhealthy,
			Message: fmt.Sprintf("Cannot read file: %v", err),
		}
	}

	return &models.TestDatasourceResponse{
		Success: true,
		Status:  models.HealthStatusHealthy,
		Message: fmt.Sprintf("File accessible (size: %d bytes)", info.Size()),
	}
}

// testSQLConnection tests a SQL database connection
func (s *DatasourceService) testSQLConnection(config *models.SQLConfig) *models.TestDatasourceResponse {
	// Use the datasource package to create and test the connection
	sqlDS, err := datasource.NewSQLDataSource(config)
	if err != nil {
		return &models.TestDatasourceResponse{
			Success: false,
			Status:  models.HealthStatusUnhealthy,
			Message: fmt.Sprintf("Connection failed: %v", err),
		}
	}
	defer sqlDS.Close()

	// Connection successful, now fetch schema
	response := &models.TestDatasourceResponse{
		Success: true,
		Status:  models.HealthStatusHealthy,
		Message: fmt.Sprintf("Connection successful (driver: %s)", config.Driver),
	}

	// Try to get schema info and include it in the response
	ctx := context.Background()
	schema, err := sqlDS.GetSchema(ctx)
	if err == nil && schema != nil {
		response.Data = schema
	}

	return response
}

// testTSStoreConnection tests a TSStore connection
func (s *DatasourceService) testTSStoreConnection(ctx context.Context, config *models.TSStoreConfig) *models.TestDatasourceResponse {
	tsDS, err := datasource.NewTSStoreDataSource(config)
	if err != nil {
		return &models.TestDatasourceResponse{
			Success: false,
			Status:  models.HealthStatusUnhealthy,
			Message: fmt.Sprintf("Failed to create TSStore datasource: %v", err),
		}
	}
	defer tsDS.Close()

	// Test the connection
	if err := tsDS.TestConnection(ctx); err != nil {
		return &models.TestDatasourceResponse{
			Success: false,
			Status:  models.HealthStatusUnhealthy,
			Message: fmt.Sprintf("Connection failed: %v", err),
		}
	}

	return &models.TestDatasourceResponse{
		Success: true,
		Status:  models.HealthStatusHealthy,
		Message: fmt.Sprintf("Connection successful (store: %s)", config.StoreName),
	}
}

// QueryDatasource executes a query against a datasource
func (s *DatasourceService) QueryDatasource(ctx context.Context, id string, req *models.QueryRequest) (*models.QueryResponse, error) {
	// Get datasource configuration
	ds, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("error retrieving datasource: %w", err)
	}
	if ds == nil {
		return nil, fmt.Errorf("datasource not found")
	}

	// Create datasource adapter
	factory := datasource.NewDataSourceFactory()
	dataSource, err := factory.CreateFromConfig(ds)
	if err != nil {
		return &models.QueryResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to create datasource: %v", err),
		}, nil
	}
	defer dataSource.Close()

	// Execute query
	startTime := time.Now()
	resultSet, err := dataSource.Query(ctx, req.Query)
	duration := time.Since(startTime).Milliseconds()

	if err != nil {
		return &models.QueryResponse{
			Success:  false,
			Error:    err.Error(),
			Duration: duration,
		}, nil
	}

	return &models.QueryResponse{
		Success:   true,
		ResultSet: resultSet,
		Duration:  duration,
	}, nil
}

// GetSchema retrieves schema information for a datasource that supports it
// Only SQL datasources implement SchemaProvider; others return an error
func (s *DatasourceService) GetSchema(ctx context.Context, id string) (*models.SchemaResponse, error) {
	// Get datasource configuration
	ds, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("error retrieving datasource: %w", err)
	}
	if ds == nil {
		return nil, fmt.Errorf("datasource not found")
	}

	// Only SQL datasources support schema discovery
	if ds.Type != models.DatasourceTypeSQL {
		return &models.SchemaResponse{
			Success: false,
			Error:   fmt.Sprintf("Schema discovery not supported for datasource type: %s", ds.Type),
		}, nil
	}

	// Create datasource adapter
	factory := datasource.NewDataSourceFactory()
	dataSource, err := factory.CreateFromConfig(ds)
	if err != nil {
		return &models.SchemaResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to create datasource: %v", err),
		}, nil
	}
	defer dataSource.Close()

	// Check if datasource implements SchemaProvider
	schemaProvider, ok := dataSource.(models.SchemaProvider)
	if !ok {
		return &models.SchemaResponse{
			Success: false,
			Error:   "Datasource does not support schema discovery",
		}, nil
	}

	// Get schema
	startTime := time.Now()
	schema, err := schemaProvider.GetSchema(ctx)
	duration := time.Since(startTime).Milliseconds()

	if err != nil {
		return &models.SchemaResponse{
			Success:  false,
			Error:    err.Error(),
			Duration: duration,
		}, nil
	}

	return &models.SchemaResponse{
		Success:  true,
		Schema:   schema,
		Duration: duration,
	}, nil
}
