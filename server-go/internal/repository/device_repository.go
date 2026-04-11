// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

package repository

import (
	"context"
	"time"

	"github.com/trv-enterprises/trve-dashboard/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// DeviceRepository handles device database operations
type DeviceRepository struct {
	collection *mongo.Collection
}

// NewDeviceRepository creates a new device repository
func NewDeviceRepository(db *mongo.Database) *DeviceRepository {
	return &DeviceRepository{
		collection: db.Collection("devices"),
	}
}

// CreateIndexes creates necessary indexes for the devices collection
func (r *DeviceRepository) CreateIndexes(ctx context.Context) error {
	indexes := []mongo.IndexModel{
		{Keys: bson.D{{Key: "device_type_id", Value: 1}}},
		{Keys: bson.D{{Key: "connection_id", Value: 1}}},
		{Keys: bson.D{{Key: "room", Value: 1}}},
		{Keys: bson.D{{Key: "enabled", Value: 1}}},
		{Keys: bson.D{{Key: "name", Value: 1}}},
		{Keys: bson.D{{Key: "updated", Value: -1}}},
		// Device lookup by connection + target (MQTT topic / WS address).
		// Previously `target` was unindexed, forcing a scan on every command
		// dispatch.
		{Keys: bson.D{{Key: "connection_id", Value: 1}, {Key: "target", Value: 1}}},
		// List page compound: filter by enabled/room, sort by name.
		{Keys: bson.D{
			{Key: "enabled", Value: 1},
			{Key: "room", Value: 1},
			{Key: "name", Value: 1},
		}},
	}

	_, err := r.collection.Indexes().CreateMany(ctx, indexes)
	return err
}

// Create inserts a new device
func (r *DeviceRepository) Create(ctx context.Context, device *models.Device) error {
	now := time.Now()
	device.Created = now
	device.Updated = now

	if device.ID.IsZero() {
		device.ID = primitive.NewObjectID()
	}

	_, err := r.collection.InsertOne(ctx, device)
	return err
}

// FindByID retrieves a device by ID
func (r *DeviceRepository) FindByID(ctx context.Context, id primitive.ObjectID) (*models.Device, error) {
	var device models.Device
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&device)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &device, nil
}

// Update updates an existing device
func (r *DeviceRepository) Update(ctx context.Context, id primitive.ObjectID, update *models.UpdateDeviceRequest) error {
	updateFields := bson.M{
		"updated": time.Now(),
	}

	if update.Name != nil {
		updateFields["name"] = *update.Name
	}
	if update.DeviceTypeID != nil {
		updateFields["device_type_id"] = *update.DeviceTypeID
	}
	if update.ConnectionID != nil {
		updateFields["connection_id"] = *update.ConnectionID
	}
	if update.Target != nil {
		updateFields["target"] = *update.Target
	}
	if update.StateTopic != nil {
		updateFields["state_topic"] = *update.StateTopic
	}
	if update.Room != nil {
		updateFields["room"] = *update.Room
	}
	if update.Tags != nil {
		updateFields["tags"] = *update.Tags
	}
	if update.Enabled != nil {
		updateFields["enabled"] = *update.Enabled
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

// Delete removes a device by ID
func (r *DeviceRepository) Delete(ctx context.Context, id primitive.ObjectID) error {
	result, err := r.collection.DeleteOne(ctx, bson.M{"_id": id})
	if err != nil {
		return err
	}
	if result.DeletedCount == 0 {
		return mongo.ErrNoDocuments
	}
	return nil
}

// List retrieves devices with filtering and pagination
func (r *DeviceRepository) List(ctx context.Context, params *models.DeviceQueryParams) ([]models.Device, int64, error) {
	filter := bson.M{}

	if params.DeviceTypeID != "" {
		filter["device_type_id"] = params.DeviceTypeID
	}
	if params.ConnectionID != "" {
		filter["connection_id"] = params.ConnectionID
	}
	if params.Room != "" {
		filter["room"] = params.Room
	}
	if params.Enabled != nil {
		filter["enabled"] = *params.Enabled
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
		SetSort(bson.D{{Key: "name", Value: 1}}).
		SetSkip(int64(skip)).
		SetLimit(int64(pageSize))

	cursor, err := r.collection.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var devices []models.Device
	if err := cursor.All(ctx, &devices); err != nil {
		return nil, 0, err
	}

	return devices, total, nil
}

// FindByConnectionAndTarget finds a device by connection ID and target
func (r *DeviceRepository) FindByConnectionAndTarget(ctx context.Context, connectionID string, target string) (*models.Device, error) {
	var device models.Device
	err := r.collection.FindOne(ctx, bson.M{
		"connection_id": connectionID,
		"target":        target,
	}).Decode(&device)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &device, nil
}

// FindByConnectionID finds all devices for a connection
func (r *DeviceRepository) FindByConnectionID(ctx context.Context, connectionID string) ([]models.Device, error) {
	cursor, err := r.collection.Find(ctx, bson.M{"connection_id": connectionID})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var devices []models.Device
	if err := cursor.All(ctx, &devices); err != nil {
		return nil, err
	}
	return devices, nil
}
