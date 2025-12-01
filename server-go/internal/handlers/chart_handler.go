package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/tviviano/dashboard/internal/models"
	"github.com/tviviano/dashboard/internal/service"
)

// ChartHandler handles chart-related HTTP requests
type ChartHandler struct {
	service *service.ChartService
}

// NewChartHandler creates a new chart handler
func NewChartHandler(service *service.ChartService) *ChartHandler {
	return &ChartHandler{
		service: service,
	}
}

// CreateChart creates a new chart
// @Summary Create a new chart
// @Description Create a new chart with data source binding and visualization config
// @Tags charts
// @Accept json
// @Produce json
// @Param chart body models.CreateChartRequest true "Chart data"
// @Success 201 {object} models.Chart
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /charts [post]
func (h *ChartHandler) CreateChart(c *gin.Context) {
	var req models.CreateChartRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	chart, err := h.service.CreateChart(c.Request.Context(), &req)
	if err != nil {
		status := http.StatusInternalServerError
		if strings.Contains(err.Error(), "already exists") {
			status = http.StatusBadRequest
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, chart)
}

// GetChart retrieves a chart by ID
// @Summary Get a chart
// @Description Get a chart by ID
// @Tags charts
// @Produce json
// @Param id path string true "Chart ID"
// @Success 200 {object} models.Chart
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /charts/{id} [get]
func (h *ChartHandler) GetChart(c *gin.Context) {
	id := c.Param("id")

	chart, err := h.service.GetChart(c.Request.Context(), id)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, gin.H{"error": "Chart not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, chart)
}

// ListCharts retrieves a list of charts with pagination
// @Summary List charts
// @Description Get a paginated list of charts with optional filtering
// @Tags charts
// @Produce json
// @Param name query string false "Filter by name (partial match)"
// @Param chart_type query string false "Filter by chart type"
// @Param datasource_id query string false "Filter by data source ID"
// @Param tag query string false "Filter by tag"
// @Param page query int false "Page number" default(1)
// @Param page_size query int false "Page size" default(20)
// @Success 200 {object} models.ChartListResponse
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /charts [get]
func (h *ChartHandler) ListCharts(c *gin.Context) {
	var params models.ChartQueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	response, err := h.service.ListCharts(c.Request.Context(), params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
}

// GetChartSummaries retrieves lightweight chart summaries for card display
// @Summary Get chart summaries
// @Description Get lightweight chart summaries for card-based selection UI
// @Tags charts
// @Produce json
// @Param limit query int false "Maximum number of summaries" default(50)
// @Success 200 {array} models.ChartSummary
// @Failure 500 {object} map[string]interface{}
// @Router /charts/summaries [get]
func (h *ChartHandler) GetChartSummaries(c *gin.Context) {
	limit := int64(50)
	if l := c.Query("limit"); l != "" {
		// Parse limit if provided
		var parsed int64
		if _, err := c.GetQuery("limit"); err == false {
			parsed = 50
		}
		if parsed > 0 {
			limit = parsed
		}
	}

	summaries, err := h.service.GetChartSummaries(c.Request.Context(), limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"summaries": summaries})
}

// UpdateChart updates a chart
// @Summary Update a chart
// @Description Update an existing chart
// @Tags charts
// @Accept json
// @Produce json
// @Param id path string true "Chart ID"
// @Param chart body models.UpdateChartRequest true "Chart update data"
// @Success 200 {object} models.Chart
// @Failure 400 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /charts/{id} [put]
func (h *ChartHandler) UpdateChart(c *gin.Context) {
	id := c.Param("id")

	var req models.UpdateChartRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	chart, err := h.service.UpdateChart(c.Request.Context(), id, &req)
	if err != nil {
		status := http.StatusInternalServerError
		if strings.Contains(err.Error(), "not found") {
			status = http.StatusNotFound
		} else if strings.Contains(err.Error(), "already exists") {
			status = http.StatusBadRequest
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, chart)
}

// DeleteChart deletes a chart
// @Summary Delete a chart
// @Description Delete a chart by ID
// @Tags charts
// @Param id path string true "Chart ID"
// @Success 204
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /charts/{id} [delete]
func (h *ChartHandler) DeleteChart(c *gin.Context) {
	id := c.Param("id")

	err := h.service.DeleteChart(c.Request.Context(), id)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, gin.H{"error": "Chart not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}
