package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/tviviano/dashboard/internal/models"
	"github.com/tviviano/dashboard/internal/service"
)

// DatasourceHandler handles datasource HTTP requests
type DatasourceHandler struct {
	service *service.DatasourceService
}

// NewDatasourceHandler creates a new datasource handler
func NewDatasourceHandler(service *service.DatasourceService) *DatasourceHandler {
	return &DatasourceHandler{
		service: service,
	}
}

// CreateDatasource handles datasource creation
// @Summary Create a new datasource
// @Description Create a new data source (API, WebSocket, or File)
// @Tags datasources
// @Accept json
// @Produce json
// @Param datasource body models.CreateDatasourceRequest true "Datasource to create"
// @Success 201 {object} models.Datasource
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /datasources [post]
func (h *DatasourceHandler) CreateDatasource(c *gin.Context) {
	var req models.CreateDatasourceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	datasource, err := h.service.CreateDatasource(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, datasource)
}

// ListDatasources handles datasource listing
// @Summary List all datasources
// @Description Retrieve all datasources with pagination and optional type filter
// @Tags datasources
// @Produce json
// @Param limit query int false "Number of items per page" default(20)
// @Param offset query int false "Number of items to skip" default(0)
// @Param type query string false "Filter by datasource type (api, websocket, file)"
// @Success 200 {object} map[string]interface{}
// @Router /datasources [get]
func (h *DatasourceHandler) ListDatasources(c *gin.Context) {
	limit, _ := strconv.ParseInt(c.DefaultQuery("limit", "20"), 10, 64)
	offset, _ := strconv.ParseInt(c.DefaultQuery("offset", "0"), 10, 64)
	typeFilter := c.Query("type")

	var datasources []*models.Datasource
	var total int64
	var err error

	if typeFilter != "" {
		dsType := models.DatasourceType(typeFilter)
		datasources, total, err = h.service.ListDatasourcesByType(c.Request.Context(), dsType, limit, offset)
	} else {
		datasources, total, err = h.service.ListDatasources(c.Request.Context(), limit, offset)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"datasources": datasources,
		"total":       total,
		"limit":       limit,
		"offset":      offset,
	})
}

// GetDatasource handles retrieving a single datasource
// @Summary Get a datasource by ID
// @Description Retrieve a single datasource by its ID
// @Tags datasources
// @Produce json
// @Param id path string true "Datasource ID"
// @Success 200 {object} models.Datasource
// @Failure 400 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Router /datasources/{id} [get]
func (h *DatasourceHandler) GetDatasource(c *gin.Context) {
	id := c.Param("id")

	datasource, err := h.service.GetDatasource(c.Request.Context(), id)
	if err != nil {
		if err.Error() == "datasource not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Datasource not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, datasource)
}

// UpdateDatasource handles datasource updates
// @Summary Update a datasource
// @Description Update an existing datasource by ID
// @Tags datasources
// @Accept json
// @Produce json
// @Param id path string true "Datasource ID"
// @Param datasource body models.UpdateDatasourceRequest true "Datasource updates"
// @Success 200 {object} models.Datasource
// @Failure 400 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /datasources/{id} [put]
func (h *DatasourceHandler) UpdateDatasource(c *gin.Context) {
	id := c.Param("id")

	var req models.UpdateDatasourceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	datasource, err := h.service.UpdateDatasource(c.Request.Context(), id, &req)
	if err != nil {
		if err.Error() == "datasource not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Datasource not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, datasource)
}

// DeleteDatasource handles datasource deletion
// @Summary Delete a datasource
// @Description Delete a datasource by ID
// @Tags datasources
// @Param id path string true "Datasource ID"
// @Success 204
// @Failure 400 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Router /datasources/{id} [delete]
func (h *DatasourceHandler) DeleteDatasource(c *gin.Context) {
	id := c.Param("id")

	err := h.service.DeleteDatasource(c.Request.Context(), id)
	if err != nil {
		if err.Error() == "datasource not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Datasource not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

// TestDatasource handles datasource connection testing
// @Summary Test a datasource connection
// @Description Test a datasource connection without saving it
// @Tags datasources
// @Accept json
// @Produce json
// @Param datasource body models.TestDatasourceRequest true "Datasource configuration to test"
// @Success 200 {object} models.TestDatasourceResponse
// @Failure 400 {object} map[string]interface{}
// @Router /datasources/test [post]
func (h *DatasourceHandler) TestDatasource(c *gin.Context) {
	var req models.TestDatasourceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	response, err := h.service.TestDatasource(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
}

// CheckDatasourceHealth handles health check for a specific datasource
// @Summary Check datasource health
// @Description Check the health of a specific datasource and update its status
// @Tags datasources
// @Produce json
// @Param id path string true "Datasource ID"
// @Success 200 {object} models.HealthInfo
// @Failure 400 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Router /datasources/{id}/health [post]
func (h *DatasourceHandler) CheckDatasourceHealth(c *gin.Context) {
	id := c.Param("id")

	health, err := h.service.CheckHealth(c.Request.Context(), id)
	if err != nil {
		if err.Error() == "datasource not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Datasource not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, health)
}

// QueryDatasource handles query execution for a datasource
// @Summary Execute a query against a datasource
// @Description Execute a query and return normalized results
// @Tags datasources
// @Accept json
// @Produce json
// @Param id path string true "Datasource ID"
// @Param query body models.QueryRequest true "Query to execute"
// @Success 200 {object} models.QueryResponse
// @Failure 400 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Router /datasources/{id}/query [post]
func (h *DatasourceHandler) QueryDatasource(c *gin.Context) {
	id := c.Param("id")

	var req models.QueryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	response, err := h.service.QueryDatasource(c.Request.Context(), id, &req)
	if err != nil {
		if err.Error() == "datasource not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Datasource not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
}

// GetDatasourceSchema handles schema discovery for SQL datasources
// @Summary Get database schema for a SQL datasource
// @Description Retrieve tables and columns for SQL datasources. Only SQL-type datasources support this endpoint.
// @Tags datasources
// @Produce json
// @Param id path string true "Datasource ID"
// @Success 200 {object} models.SchemaResponse
// @Failure 400 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Router /datasources/{id}/schema [get]
func (h *DatasourceHandler) GetDatasourceSchema(c *gin.Context) {
	id := c.Param("id")

	response, err := h.service.GetSchema(c.Request.Context(), id)
	if err != nil {
		if err.Error() == "datasource not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Datasource not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
}
