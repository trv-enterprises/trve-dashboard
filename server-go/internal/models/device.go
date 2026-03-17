// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Device is a specific IoT device instance bound to a connection
// @Description A specific device instance with connection and topic bindings
type Device struct {
	ID           primitive.ObjectID     `json:"id" bson:"_id,omitempty"`
	Name         string                 `json:"name" bson:"name" binding:"required"`
	DeviceTypeID string                 `json:"device_type_id" bson:"device_type_id"`
	ConnectionID string                 `json:"connection_id" bson:"connection_id"`
	Target       string                 `json:"target" bson:"target"`
	StateTopic   string                 `json:"state_topic,omitempty" bson:"state_topic"`
	Room         string                 `json:"room,omitempty" bson:"room"`
	Tags         []string               `json:"tags,omitempty" bson:"tags"`
	Enabled      bool                   `json:"enabled" bson:"enabled"`
	Metadata     map[string]interface{} `json:"metadata,omitempty" bson:"metadata,omitempty"`
	Created      time.Time              `json:"created" bson:"created"`
	Updated      time.Time              `json:"updated" bson:"updated"`
}

// CreateDeviceRequest represents a request to create a device
// @Description Request body for creating a new device
type CreateDeviceRequest struct {
	Name         string                 `json:"name" binding:"required"`
	DeviceTypeID string                 `json:"device_type_id" binding:"required"`
	ConnectionID string                 `json:"connection_id" binding:"required"`
	Target       string                 `json:"target" binding:"required"`
	StateTopic   string                 `json:"state_topic"`
	Room         string                 `json:"room"`
	Tags         []string               `json:"tags"`
	Enabled      *bool                  `json:"enabled"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

// UpdateDeviceRequest represents a request to update a device
// @Description Request body for updating an existing device
type UpdateDeviceRequest struct {
	Name         *string                 `json:"name,omitempty"`
	DeviceTypeID *string                 `json:"device_type_id,omitempty"`
	ConnectionID *string                 `json:"connection_id,omitempty"`
	Target       *string                 `json:"target,omitempty"`
	StateTopic   *string                 `json:"state_topic,omitempty"`
	Room         *string                 `json:"room,omitempty"`
	Tags         *[]string               `json:"tags,omitempty"`
	Enabled      *bool                   `json:"enabled,omitempty"`
	Metadata     *map[string]interface{} `json:"metadata,omitempty"`
}

// DeviceListResponse represents a paginated list of devices
// @Description Response containing a list of devices
type DeviceListResponse struct {
	Devices  []Device `json:"devices"`
	Total    int64    `json:"total"`
	Page     int      `json:"page"`
	PageSize int      `json:"page_size"`
}

// DeviceQueryParams defines query parameters for listing devices
// @Description Query parameters for filtering devices
type DeviceQueryParams struct {
	DeviceTypeID string `form:"device_type_id"`
	ConnectionID string `form:"connection_id"`
	Room         string `form:"room"`
	Enabled      *bool  `form:"enabled"`
	Page         int    `form:"page"`
	PageSize     int    `form:"page_size"`
}
