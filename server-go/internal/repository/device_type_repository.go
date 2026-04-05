// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

package repository

import (
	"context"
	"time"

	"github.com/trv-enterprises/trve-dashboard/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// DeviceTypeRepository handles device type database operations
type DeviceTypeRepository struct {
	collection *mongo.Collection
}

// NewDeviceTypeRepository creates a new device type repository
func NewDeviceTypeRepository(db *mongo.Database) *DeviceTypeRepository {
	return &DeviceTypeRepository{
		collection: db.Collection("device_types"),
	}
}

// CreateIndexes creates necessary indexes for the device_types collection
func (r *DeviceTypeRepository) CreateIndexes(ctx context.Context) error {
	indexes := []mongo.IndexModel{
		{Keys: bson.D{{Key: "category", Value: 1}}},
		{Keys: bson.D{{Key: "protocol", Value: 1}}},
		{Keys: bson.D{{Key: "is_built_in", Value: 1}}},
		{Keys: bson.D{{Key: "name", Value: 1}}},
		{Keys: bson.D{{Key: "supported_types", Value: 1}}},
		{Keys: bson.D{{Key: "updated", Value: -1}}},
	}

	_, err := r.collection.Indexes().CreateMany(ctx, indexes)
	return err
}

// Create inserts a new device type
func (r *DeviceTypeRepository) Create(ctx context.Context, dt *models.DeviceType) error {
	now := time.Now()
	dt.Created = now
	dt.Updated = now

	_, err := r.collection.InsertOne(ctx, dt)
	return err
}

// FindByID retrieves a device type by ID
func (r *DeviceTypeRepository) FindByID(ctx context.Context, id string) (*models.DeviceType, error) {
	var dt models.DeviceType
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&dt)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &dt, nil
}

// Update updates an existing device type
func (r *DeviceTypeRepository) Update(ctx context.Context, id string, update *models.UpdateDeviceTypeRequest) error {
	updateFields := bson.M{
		"updated": time.Now(),
	}

	if update.Name != nil {
		updateFields["name"] = *update.Name
	}
	if update.Description != nil {
		updateFields["description"] = *update.Description
	}
	if update.Category != nil {
		updateFields["category"] = *update.Category
	}
	if update.Subtype != nil {
		updateFields["subtype"] = *update.Subtype
	}
	if update.Protocol != nil {
		updateFields["protocol"] = *update.Protocol
	}
	if update.Capabilities != nil {
		updateFields["capabilities"] = *update.Capabilities
	}
	if update.SupportedTypes != nil {
		updateFields["supported_types"] = *update.SupportedTypes
	}
	if update.Commands != nil {
		updateFields["commands"] = *update.Commands
	}
	if update.StateQuery != nil {
		updateFields["state_query"] = update.StateQuery
	}
	if update.Response != nil {
		updateFields["response"] = update.Response
	}
	if update.Metadata != nil {
		updateFields["metadata"] = *update.Metadata
	}

	result, err := r.collection.UpdateOne(
		ctx,
		bson.M{"_id": id},
		bson.M{"$set": updateFields},
	)
	if err != nil {
		return err
	}
	if result.MatchedCount == 0 {
		return mongo.ErrNoDocuments
	}
	return nil
}

// Delete removes a device type by ID
func (r *DeviceTypeRepository) Delete(ctx context.Context, id string) error {
	result, err := r.collection.DeleteOne(ctx, bson.M{"_id": id})
	if err != nil {
		return err
	}
	if result.DeletedCount == 0 {
		return mongo.ErrNoDocuments
	}
	return nil
}

// List retrieves device types with filtering and pagination
func (r *DeviceTypeRepository) List(ctx context.Context, params *models.DeviceTypeQueryParams) ([]models.DeviceType, int64, error) {
	filter := bson.M{}

	if params.Category != "" {
		filter["category"] = params.Category
	}
	if params.Protocol != "" {
		filter["protocol"] = params.Protocol
	}
	if params.SupportedType != "" {
		filter["supported_types"] = params.SupportedType
	}
	if params.BuiltInOnly {
		filter["is_built_in"] = true
	}

	total, err := r.collection.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	page := params.Page
	if page < 1 {
		page = 1
	}
	pageSize := params.PageSize
	if pageSize < 1 {
		pageSize = 50
	}
	if pageSize > 100 {
		pageSize = 100
	}

	skip := (page - 1) * pageSize
	opts := options.Find().
		SetSort(bson.D{{Key: "is_built_in", Value: -1}, {Key: "name", Value: 1}}).
		SetSkip(int64(skip)).
		SetLimit(int64(pageSize))

	cursor, err := r.collection.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var deviceTypes []models.DeviceType
	if err := cursor.All(ctx, &deviceTypes); err != nil {
		return nil, 0, err
	}

	return deviceTypes, total, nil
}

// UpsertBuiltIn inserts or updates a built-in device type (used for seeding)
func (r *DeviceTypeRepository) UpsertBuiltIn(ctx context.Context, dt *models.DeviceType) error {
	dt.IsBuiltIn = true
	now := time.Now()
	dt.Updated = now

	opts := options.Update().SetUpsert(true)
	update := bson.M{
		"$set": bson.M{
			"name":            dt.Name,
			"description":     dt.Description,
			"category":        dt.Category,
			"subtype":         dt.Subtype,
			"protocol":        dt.Protocol,
			"capabilities":    dt.Capabilities,
			"supported_types": dt.SupportedTypes,
			"commands":        dt.Commands,
			"state_query":     dt.StateQuery,
			"response":        dt.Response,
			"is_built_in":     dt.IsBuiltIn,
			"metadata":        dt.Metadata,
			"updated":         now,
		},
		"$setOnInsert": bson.M{
			"created": now,
		},
		"$unset": bson.M{
			"schema_ids":    "", // Remove legacy field
			"topic_pattern": "", // Moved to device instances
		},
	}

	_, err := r.collection.UpdateOne(ctx, bson.M{"_id": dt.ID}, update, opts)
	return err
}
