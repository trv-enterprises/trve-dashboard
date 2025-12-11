package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tviviano/dashboard/internal/streaming"
)

// StreamHandler handles SSE streaming for socket datasources
type StreamHandler struct {
	manager *streaming.Manager
}

// NewStreamHandler creates a new stream handler
func NewStreamHandler(manager *streaming.Manager) *StreamHandler {
	return &StreamHandler{
		manager: manager,
	}
}

// StreamDatasource streams data from a socket datasource via SSE
// @Summary Stream data from a socket datasource
// @Description Opens an SSE connection to stream real-time data from a socket datasource
// @Tags datasources
// @Produce text/event-stream
// @Param id path string true "Datasource ID"
// @Success 200 {string} string "SSE stream"
// @Failure 400 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /datasources/{id}/stream [get]
func (h *StreamHandler) StreamDatasource(c *gin.Context) {
	datasourceID := c.Param("id")
	if datasourceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "datasource ID is required"})
		return
	}

	// Check if this is a socket datasource
	isSocket, err := h.manager.IsSocketDatasource(c.Request.Context(), datasourceID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	if !isSocket {
		c.JSON(http.StatusBadRequest, gin.H{"error": "datasource is not a socket type"})
		return
	}

	// Subscribe to the stream (returns a bidirectional channel)
	recordCh := h.manager.SubscribeAndGetChannel(c.Request.Context(), datasourceID)
	if recordCh == nil {
		log.Printf("[StreamHandler] Subscribe error for %s", datasourceID)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to subscribe to stream"})
		return
	}

	// Set SSE headers
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no") // Disable nginx buffering

	log.Printf("[StreamHandler] SSE connection opened for datasource %s", datasourceID)

	// Send buffered records first (initial state)
	bufferedRecords := h.manager.GetBuffer(datasourceID)
	if len(bufferedRecords) > 0 {
		log.Printf("[StreamHandler] Sending %d buffered records", len(bufferedRecords))
		for _, record := range bufferedRecords {
			data, err := json.Marshal(record)
			if err != nil {
				continue
			}
			fmt.Fprintf(c.Writer, "event: record\ndata: %s\n\n", data)
		}
		c.Writer.Flush()
	}

	// Create ticker for heartbeat
	heartbeatTicker := time.NewTicker(30 * time.Second)
	defer heartbeatTicker.Stop()

	// Stream records to client
	clientGone := c.Request.Context().Done()
	for {
		select {
		case <-clientGone:
			log.Printf("[StreamHandler] Client disconnected from datasource %s", datasourceID)
			h.manager.Unsubscribe(datasourceID, recordCh)
			return

		case record, ok := <-recordCh:
			if !ok {
				// Channel closed
				log.Printf("[StreamHandler] Stream channel closed for datasource %s", datasourceID)
				return
			}

			data, err := json.Marshal(record)
			if err != nil {
				log.Printf("[StreamHandler] Error marshaling record: %v", err)
				continue
			}

			fmt.Fprintf(c.Writer, "event: record\ndata: %s\n\n", data)
			c.Writer.Flush()

		case <-heartbeatTicker.C:
			// Send heartbeat to keep connection alive
			fmt.Fprintf(c.Writer, "event: heartbeat\ndata: {\"timestamp\":%d}\n\n", time.Now().Unix())
			c.Writer.Flush()
		}
	}
}

// GetStreamStatus returns status information for a stream
// @Summary Get stream status
// @Description Get status information for an active stream
// @Tags datasources
// @Produce json
// @Param id path string true "Datasource ID"
// @Success 200 {object} streaming.StreamStatus
// @Failure 404 {object} map[string]interface{}
// @Router /datasources/{id}/stream/status [get]
func (h *StreamHandler) GetStreamStatus(c *gin.Context) {
	datasourceID := c.Param("id")
	if datasourceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "datasource ID is required"})
		return
	}

	status := h.manager.GetStreamStatus(datasourceID)
	if status == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "stream not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"datasource_id":    status.DatasourceID,
		"connected":        status.Connected,
		"subscriber_count": status.SubscriberCount,
		"buffer_count":     status.BufferCount,
		"last_error":       errorToString(status.LastError),
	})
}

// ListActiveStreams returns a list of all active streams
// @Summary List active streams
// @Description Get a list of all active streaming connections
// @Tags datasources
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /datasources/streams [get]
func (h *StreamHandler) ListActiveStreams(c *gin.Context) {
	streamIDs := h.manager.ListStreams()

	streams := make([]gin.H, 0, len(streamIDs))
	for _, id := range streamIDs {
		status := h.manager.GetStreamStatus(id)
		if status != nil {
			streams = append(streams, gin.H{
				"datasource_id":    status.DatasourceID,
				"connected":        status.Connected,
				"subscriber_count": status.SubscriberCount,
				"buffer_count":     status.BufferCount,
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"streams": streams,
		"count":   len(streams),
	})
}

func errorToString(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}
