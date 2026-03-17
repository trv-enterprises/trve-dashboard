// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

package repository

import (
	"context"
	"time"

	"github.com/tviviano/dashboard/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// ControlSchemaRepository handles control schema database operations
type ControlSchemaRepository struct {
	collection *mongo.Collection
}

// NewControlSchemaRepository creates a new control schema repository
func NewControlSchemaRepository(db *mongo.Database) *ControlSchemaRepository {
	return &ControlSchemaRepository{
		collection: db.Collection("control_schemas"),
	}
}

// CreateIndexes creates necessary indexes for the control_schemas collection
func (r *ControlSchemaRepository) CreateIndexes(ctx context.Context) error {
	indexes := []mongo.IndexModel{
		// Primary key on _id (automatic)
		// Protocol type index for filtering
		{
			Keys: bson.D{{Key: "protocol_type", Value: 1}},
		},
		// Supported types index for filtering by control type
		{
			Keys: bson.D{{Key: "supported_types", Value: 1}},
		},
		// Built-in flag for filtering
		{
			Keys: bson.D{{Key: "is_built_in", Value: 1}},
		},
		// Name index for search
		{
			Keys: bson.D{{Key: "name", Value: 1}},
		},
		// Updated timestamp for sorting
		{
			Keys: bson.D{{Key: "updated", Value: -1}},
		},
	}

	_, err := r.collection.Indexes().CreateMany(ctx, indexes)
	return err
}

// Create inserts a new control schema
func (r *ControlSchemaRepository) Create(ctx context.Context, schema *models.ControlSchema) error {
	now := time.Now()
	schema.Created = now
	schema.Updated = now

	_, err := r.collection.InsertOne(ctx, schema)
	return err
}

// FindByID retrieves a control schema by ID
func (r *ControlSchemaRepository) FindByID(ctx context.Context, id string) (*models.ControlSchema, error) {
	var schema models.ControlSchema
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&schema)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &schema, nil
}

// Update updates an existing control schema
func (r *ControlSchemaRepository) Update(ctx context.Context, id string, update *models.UpdateControlSchemaRequest) error {
	updateFields := bson.M{
		"updated": time.Now(),
	}

	if update.Name != nil {
		updateFields["name"] = *update.Name
	}
	if update.Description != nil {
		updateFields["description"] = *update.Description
	}
	if update.Version != nil {
		updateFields["version"] = *update.Version
	}
	if update.ProtocolType != nil {
		updateFields["protocol_type"] = *update.ProtocolType
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

// Delete removes a control schema by ID
func (r *ControlSchemaRepository) Delete(ctx context.Context, id string) error {
	result, err := r.collection.DeleteOne(ctx, bson.M{"_id": id})
	if err != nil {
		return err
	}
	if result.DeletedCount == 0 {
		return mongo.ErrNoDocuments
	}
	return nil
}

// List retrieves control schemas with filtering and pagination
func (r *ControlSchemaRepository) List(ctx context.Context, params *models.ControlSchemaQueryParams) ([]models.ControlSchema, int64, error) {
	filter := bson.M{}

	if params.ProtocolType != "" {
		filter["protocol_type"] = params.ProtocolType
	}
	if params.ControlType != "" {
		// Filter schemas that support this control type
		filter["supported_types"] = params.ControlType
	}
	if params.BuiltInOnly {
		filter["is_built_in"] = true
	}

	// Count total matching documents
	total, err := r.collection.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	// Set pagination defaults
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
		SetSort(bson.D{{Key: "is_built_in", Value: -1}, {Key: "name", Value: 1}}). // Built-in first, then alphabetically
		SetSkip(int64(skip)).
		SetLimit(int64(pageSize))

	cursor, err := r.collection.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var schemas []models.ControlSchema
	if err := cursor.All(ctx, &schemas); err != nil {
		return nil, 0, err
	}

	return schemas, total, nil
}

// FindByProtocolType retrieves all schemas that support a specific protocol type
func (r *ControlSchemaRepository) FindByProtocolType(ctx context.Context, protocolType string) ([]models.ControlSchema, error) {
	cursor, err := r.collection.Find(ctx, bson.M{"protocol_type": protocolType})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var schemas []models.ControlSchema
	if err := cursor.All(ctx, &schemas); err != nil {
		return nil, err
	}

	return schemas, nil
}

// FindByControlType retrieves all schemas that support a specific control type
func (r *ControlSchemaRepository) FindByControlType(ctx context.Context, controlType string) ([]models.ControlSchema, error) {
	cursor, err := r.collection.Find(ctx, bson.M{"supported_types": controlType})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var schemas []models.ControlSchema
	if err := cursor.All(ctx, &schemas); err != nil {
		return nil, err
	}

	return schemas, nil
}

// UpsertBuiltIn inserts or updates a built-in schema (used for seeding)
func (r *ControlSchemaRepository) UpsertBuiltIn(ctx context.Context, schema *models.ControlSchema) error {
	schema.IsBuiltIn = true
	now := time.Now()
	schema.Updated = now

	opts := options.Update().SetUpsert(true)
	update := bson.M{
		"$set": bson.M{
			"name":            schema.Name,
			"description":     schema.Description,
			"version":         schema.Version,
			"protocol_type":   schema.ProtocolType,
			"supported_types": schema.SupportedTypes,
			"commands":        schema.Commands,
			"state_query":     schema.StateQuery,
			"response":        schema.Response,
			"is_built_in":     schema.IsBuiltIn,
			"metadata":        schema.Metadata,
			"updated":         now,
		},
		"$setOnInsert": bson.M{
			"created": now,
		},
	}

	_, err := r.collection.UpdateOne(ctx, bson.M{"_id": schema.ID}, update, opts)
	return err
}

// CountByProtocolType returns the count of schemas for a protocol type
func (r *ControlSchemaRepository) CountByProtocolType(ctx context.Context, protocolType string) (int64, error) {
	return r.collection.CountDocuments(ctx, bson.M{"protocol_type": protocolType})
}
