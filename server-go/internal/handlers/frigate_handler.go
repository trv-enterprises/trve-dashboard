// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/tviviano/dashboard/internal/service"
)

// FrigateHandler handles proxied requests to Frigate NVR instances.
// Requests are routed through the Go backend so the browser doesn't need
// direct access to the Frigate host (CORS, network segmentation).
type FrigateHandler struct {
	datasourceService *service.DatasourceService
	httpClient        *http.Client
}

// NewFrigateHandler creates a new FrigateHandler
func NewFrigateHandler(datasourceService *service.DatasourceService) *FrigateHandler {
	return &FrigateHandler{
		datasourceService: datasourceService,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// getFrigateBaseURL looks up the connection by ID and extracts the Frigate base URL
func (h *FrigateHandler) getFrigateBaseURL(c *gin.Context) (string, error) {
	connectionID := c.Param("connection_id")
	if connectionID == "" {
		return "", fmt.Errorf("connection_id is required")
	}

	ds, err := h.datasourceService.GetDatasource(c.Request.Context(), connectionID)
	if err != nil {
		return "", fmt.Errorf("connection not found: %w", err)
	}

	// Dedicated Frigate connection type
	if ds.Type == "frigate" {
		if ds.Config.Frigate == nil {
			return "", fmt.Errorf("connection has no Frigate configuration")
		}
		return ds.Config.Frigate.BaseURL(), nil
	}

	// Legacy: API connection type (backwards compatibility)
	if ds.Type == "api" {
		if ds.Config.API == nil || ds.Config.API.URL == "" {
			return "", fmt.Errorf("connection has no API URL configured")
		}
		return strings.TrimRight(ds.Config.API.URL, "/"), nil
	}

	return "", fmt.Errorf("connection type %s is not a Frigate connection", ds.Type)
}

// getFrigateGo2RTCURL returns the go2rtc base URL for live streaming
func (h *FrigateHandler) getFrigateGo2RTCURL(c *gin.Context) (string, error) {
	connectionID := c.Param("connection_id")
	if connectionID == "" {
		return "", fmt.Errorf("connection_id is required")
	}

	ds, err := h.datasourceService.GetDatasource(c.Request.Context(), connectionID)
	if err != nil {
		return "", fmt.Errorf("connection not found: %w", err)
	}

	if ds.Type == "frigate" && ds.Config.Frigate != nil {
		return ds.Config.Frigate.Go2RTCURL(), nil
	}

	// Legacy API connections don't have go2rtc info — fall back to base URL with default port
	return "", fmt.Errorf("go2rtc URL not available for connection type %s", ds.Type)
}

// proxyBinary streams a binary response (JPEG, MP4) from Frigate to the client
func (h *FrigateHandler) proxyBinary(c *gin.Context, frigateURL string, contentType string) {
	req, err := http.NewRequestWithContext(c.Request.Context(), "GET", frigateURL, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to create request: %v", err)})
		return
	}

	// Forward Range headers for video scrubbing
	if rangeHeader := c.GetHeader("Range"); rangeHeader != "" {
		req.Header.Set("Range", rangeHeader)
	}

	resp, err := h.httpClient.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("failed to reach Frigate: %v", err)})
		return
	}
	defer resp.Body.Close()

	// Forward status code and content headers
	c.Status(resp.StatusCode)
	c.Header("Content-Type", contentType)
	if cl := resp.Header.Get("Content-Length"); cl != "" {
		c.Header("Content-Length", cl)
	}
	if cr := resp.Header.Get("Content-Range"); cr != "" {
		c.Header("Content-Range", cr)
	}
	if ar := resp.Header.Get("Accept-Ranges"); ar != "" {
		c.Header("Accept-Ranges", ar)
	}

	// Stream body directly — no buffering
	io.Copy(c.Writer, resp.Body)
}

// GetCameras returns the list of camera names from Frigate config
// @Summary Get Frigate camera list
// @Description Returns camera names from a Frigate NVR connection
// @Tags Frigate
// @Produce json
// @Param connection_id path string true "Connection ID"
// @Success 200 {object} map[string]interface{}
// @Router /api/frigate/{connection_id}/cameras [get]
func (h *FrigateHandler) GetCameras(c *gin.Context) {
	baseURL, err := h.getFrigateBaseURL(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resp, err := h.httpClient.Get(baseURL + "/api/config")
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("failed to reach Frigate: %v", err)})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.JSON(resp.StatusCode, gin.H{"error": fmt.Sprintf("Frigate returned %d", resp.StatusCode)})
		return
	}

	// Parse Frigate config to extract camera names
	var config map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&config); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to parse Frigate config: %v", err)})
		return
	}

	cameras := []string{}
	if camsMap, ok := config["cameras"].(map[string]interface{}); ok {
		for name := range camsMap {
			cameras = append(cameras, name)
		}
	}

	c.JSON(http.StatusOK, gin.H{"cameras": cameras})
}

// GetSnapshot proxies the latest camera snapshot JPEG from Frigate
// @Summary Get camera snapshot
// @Description Returns the latest JPEG snapshot for a camera
// @Tags Frigate
// @Produce image/jpeg
// @Param connection_id path string true "Connection ID"
// @Param camera path string true "Camera name"
// @Success 200 {file} binary
// @Router /api/frigate/{connection_id}/snapshot/{camera} [get]
func (h *FrigateHandler) GetSnapshot(c *gin.Context) {
	baseURL, err := h.getFrigateBaseURL(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	camera := c.Param("camera")
	if camera == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "camera name is required"})
		return
	}

	frigateURL := fmt.Sprintf("%s/api/%s/latest.jpg", baseURL, camera)
	h.proxyBinary(c, frigateURL, "image/jpeg")
}

// GetEvents returns recent events for a camera
// @Summary Get camera events
// @Description Returns recent detection events for a camera
// @Tags Frigate
// @Produce json
// @Param connection_id path string true "Connection ID"
// @Param camera path string true "Camera name"
// @Param limit query int false "Max events to return" default(10)
// @Success 200 {array} map[string]interface{}
// @Router /api/frigate/{connection_id}/events/{camera} [get]
func (h *FrigateHandler) GetEvents(c *gin.Context) {
	baseURL, err := h.getFrigateBaseURL(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	camera := c.Param("camera")
	if camera == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "camera name is required"})
		return
	}

	limit := c.DefaultQuery("limit", "10")
	frigateURL := fmt.Sprintf("%s/api/events?camera=%s&limit=%s", baseURL, camera, limit)

	resp, err := h.httpClient.Get(frigateURL)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("failed to reach Frigate: %v", err)})
		return
	}
	defer resp.Body.Close()

	// Stream JSON response directly
	c.Status(resp.StatusCode)
	c.Header("Content-Type", "application/json")
	io.Copy(c.Writer, resp.Body)
}

// GetEventClip proxies an event clip MP4 from Frigate
// @Summary Get event clip
// @Description Returns the MP4 clip for a detection event (supports Range headers)
// @Tags Frigate
// @Produce video/mp4
// @Param connection_id path string true "Connection ID"
// @Param event_id path string true "Event ID"
// @Success 200 {file} binary
// @Router /api/frigate/{connection_id}/event/{event_id}/clip [get]
func (h *FrigateHandler) GetEventClip(c *gin.Context) {
	baseURL, err := h.getFrigateBaseURL(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	eventID := c.Param("event_id")
	if eventID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "event_id is required"})
		return
	}

	frigateURL := fmt.Sprintf("%s/api/events/%s/clip.mp4", baseURL, eventID)
	h.proxyBinary(c, frigateURL, "video/mp4")
}

// GetEventSnapshot proxies an event snapshot JPEG from Frigate
// @Summary Get event snapshot
// @Description Returns the JPEG snapshot for a detection event
// @Tags Frigate
// @Produce image/jpeg
// @Param connection_id path string true "Connection ID"
// @Param event_id path string true "Event ID"
// @Success 200 {file} binary
// @Router /api/frigate/{connection_id}/event/{event_id}/snapshot [get]
func (h *FrigateHandler) GetEventSnapshot(c *gin.Context) {
	baseURL, err := h.getFrigateBaseURL(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	eventID := c.Param("event_id")
	if eventID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "event_id is required"})
		return
	}

	frigateURL := fmt.Sprintf("%s/api/events/%s/snapshot.jpg", baseURL, eventID)
	h.proxyBinary(c, frigateURL, "image/jpeg")
}

// GetInfo returns the Frigate connection info (base URL for go2rtc WebSocket)
// @Summary Get Frigate connection info
// @Description Returns connection metadata needed for direct WebSocket access (go2rtc MSE)
// @Tags Frigate
// @Produce json
// @Param connection_id path string true "Connection ID"
// @Success 200 {object} map[string]interface{}
// @Router /api/frigate/{connection_id}/info [get]
func (h *FrigateHandler) GetInfo(c *gin.Context) {
	baseURL, err := h.getFrigateBaseURL(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	info := gin.H{
		"base_url": baseURL,
	}

	// Include go2rtc URL if available (Frigate connection type)
	if go2rtcURL, err := h.getFrigateGo2RTCURL(c); err == nil {
		info["go2rtc_url"] = go2rtcURL
	}

	c.JSON(http.StatusOK, info)
}

// WebSocket upgrader for live stream proxy
var frigateWSUpgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

// ProxyLiveStream proxies a JSMPEG WebSocket stream from Frigate to the browser
// @Summary Proxy Frigate JSMPEG live stream
// @Description Proxies the JSMPEG WebSocket stream for a camera through the backend
// @Tags Frigate
// @Param connection_id path string true "Connection ID"
// @Param camera path string true "Camera name"
// @Router /api/frigate/{connection_id}/live/{camera} [get]
func (h *FrigateHandler) ProxyLiveStream(c *gin.Context) {
	connectionID := c.Param("connection_id")
	camera := c.Param("camera")

	if connectionID == "" || camera == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "connection_id and camera are required"})
		return
	}

	// Look up the Frigate connection to get the JSMPEG WebSocket URL
	ds, err := h.datasourceService.GetDatasource(c.Request.Context(), connectionID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("connection not found: %v", err)})
		return
	}

	var frigateWSURL string
	if ds.Type == "frigate" && ds.Config.Frigate != nil {
		frigateWSURL = fmt.Sprintf("%s/live/jsmpeg/%s", ds.Config.Frigate.JSMPEGURL(), camera)
	} else if ds.Type == "api" && ds.Config.API != nil {
		// Legacy API connection — derive WebSocket URL from HTTP URL
		baseURL := strings.TrimRight(ds.Config.API.URL, "/")
		wsURL := strings.Replace(baseURL, "http://", "ws://", 1)
		wsURL = strings.Replace(wsURL, "https://", "wss://", 1)
		frigateWSURL = fmt.Sprintf("%s/live/jsmpeg/%s", wsURL, camera)
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "not a Frigate connection"})
		return
	}

	log.Printf("[FrigateProxy] Connecting to Frigate JSMPEG: %s", frigateWSURL)

	// Upgrade the browser connection to WebSocket
	browserConn, err := frigateWSUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("[FrigateProxy] Failed to upgrade browser WebSocket: %v", err)
		return
	}
	defer browserConn.Close()

	// Connect to Frigate's JSMPEG WebSocket
	frigateConn, _, err := websocket.DefaultDialer.Dial(frigateWSURL, nil)
	if err != nil {
		log.Printf("[FrigateProxy] Failed to connect to Frigate: %v", err)
		browserConn.WriteMessage(websocket.CloseMessage,
			websocket.FormatCloseMessage(websocket.CloseInternalServerErr, "Failed to connect to Frigate"))
		return
	}
	defer frigateConn.Close()

	log.Printf("[FrigateProxy] Connected, proxying %s", camera)

	var once sync.Once
	done := make(chan struct{})

	// Frigate -> Browser
	go func() {
		defer once.Do(func() { close(done) })
		for {
			msgType, data, err := frigateConn.ReadMessage()
			if err != nil {
				return
			}
			if err := browserConn.WriteMessage(msgType, data); err != nil {
				return
			}
		}
	}()

	// Browser -> Frigate (for pings/control)
	go func() {
		defer once.Do(func() { close(done) })
		for {
			msgType, data, err := browserConn.ReadMessage()
			if err != nil {
				return
			}
			if err := frigateConn.WriteMessage(msgType, data); err != nil {
				return
			}
		}
	}()

	<-done
	log.Printf("[FrigateProxy] Stream ended for %s", camera)
}
