package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/tviviano/dashboard/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// ComponentRepository handles component data operations
type ComponentRepository struct {
	collection *mongo.Collection
}

// NewComponentRepository creates a new component repository
func NewComponentRepository(db *mongo.Database) *ComponentRepository {
	return &ComponentRepository{
		collection: db.Collection("components"),
	}
}

// Create creates a new component
func (r *ComponentRepository) Create(ctx context.Context, req *models.CreateComponentRequest) (*models.Component, error) {
	component := &models.Component{
		ID:            uuid.New().String(),
		Name:          req.Name,
		System:        req.System,
		Source:        req.Source,
		Description:   req.Description,
		ComponentCode: req.ComponentCode,
		Metadata:      req.Metadata,
		Created:       time.Now(),
		Updated:       time.Now(),
	}

	_, err := r.collection.InsertOne(ctx, component)
	if err != nil {
		return nil, fmt.Errorf("failed to insert component: %w", err)
	}

	return component, nil
}

// FindByID retrieves a component by ID
func (r *ComponentRepository) FindByID(ctx context.Context, id string) (*models.Component, error) {
	var component models.Component
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&component)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to find component: %w", err)
	}
	return &component, nil
}

// FindBySystemSourceName retrieves a component by system, source, and name
func (r *ComponentRepository) FindBySystemSourceName(ctx context.Context, system, source, name string) (*models.Component, error) {
	var component models.Component
	filter := bson.M{
		"system": system,
		"source": source,
		"name":   name,
	}
	err := r.collection.FindOne(ctx, filter).Decode(&component)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to find component: %w", err)
	}
	return &component, nil
}

// List retrieves components with optional filtering and pagination
func (r *ComponentRepository) List(ctx context.Context, params models.ComponentQueryParams) ([]models.Component, int64, error) {
	// Build filter
	filter := bson.M{}
	if params.System != "" {
		filter["system"] = params.System
	}
	if params.Source != "" {
		filter["source"] = params.Source
	}
	if params.Category != "" {
		filter["metadata.category"] = params.Category
	}
	if params.Tag != "" {
		filter["metadata.tags"] = params.Tag
	}

	// Count total documents
	total, err := r.collection.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count components: %w", err)
	}

	// Calculate pagination
	page := params.Page
	if page < 1 {
		page = 1
	}
	pageSize := params.PageSize
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	skip := int64((page - 1) * pageSize)
	limit := int64(pageSize)

	// Find options with pagination and sorting
	opts := options.Find().
		SetSkip(skip).
		SetLimit(limit).
		SetSort(bson.D{
			{Key: "system", Value: 1},
			{Key: "source", Value: 1},
			{Key: "name", Value: 1},
		})

	cursor, err := r.collection.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to find components: %w", err)
	}
	defer cursor.Close(ctx)

	var components []models.Component
	if err := cursor.All(ctx, &components); err != nil {
		return nil, 0, fmt.Errorf("failed to decode components: %w", err)
	}

	return components, total, nil
}

// Update updates a component
func (r *ComponentRepository) Update(ctx context.Context, id string, req *models.UpdateComponentRequest) (*models.Component, error) {
	update := bson.M{
		"$set": bson.M{
			"updated": time.Now(),
		},
	}

	setFields := update["$set"].(bson.M)

	if req.Description != nil {
		setFields["description"] = *req.Description
	}
	if req.ComponentCode != nil {
		setFields["component_code"] = *req.ComponentCode
	}
	if req.Metadata != nil {
		setFields["metadata"] = *req.Metadata
	}

	opts := options.FindOneAndUpdate().SetReturnDocument(options.After)
	var component models.Component
	err := r.collection.FindOneAndUpdate(
		ctx,
		bson.M{"_id": id},
		update,
		opts,
	).Decode(&component)

	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to update component: %w", err)
	}

	return &component, nil
}

// Delete deletes a component by ID
func (r *ComponentRepository) Delete(ctx context.Context, id string) error {
	result, err := r.collection.DeleteOne(ctx, bson.M{"_id": id})
	if err != nil {
		return fmt.Errorf("failed to delete component: %w", err)
	}
	if result.DeletedCount == 0 {
		return fmt.Errorf("component not found")
	}
	return nil
}

// GetSystems retrieves all systems and their sources with component counts
func (r *ComponentRepository) GetSystems(ctx context.Context) (*models.ComponentSystemsResponse, error) {
	pipeline := []bson.M{
		{
			"$group": bson.M{
				"_id": bson.M{
					"system": "$system",
					"source": "$source",
				},
				"count": bson.M{"$sum": 1},
			},
		},
		{
			"$sort": bson.M{
				"_id.system": 1,
				"_id.source": 1,
			},
		},
	}

	cursor, err := r.collection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, fmt.Errorf("failed to aggregate systems: %w", err)
	}
	defer cursor.Close(ctx)

	type GroupResult struct {
		ID struct {
			System string `bson:"system"`
			Source string `bson:"source"`
		} `bson:"_id"`
		Count int `bson:"count"`
	}

	systems := make(map[string]models.ComponentSystem)

	for cursor.Next(ctx) {
		var result GroupResult
		if err := cursor.Decode(&result); err != nil {
			return nil, fmt.Errorf("failed to decode group result: %w", err)
		}

		systemName := result.ID.System
		sourceName := result.ID.Source

		system, exists := systems[systemName]
		if !exists {
			system = models.ComponentSystem{
				Name:    systemName,
				Sources: make(map[string]models.ComponentSource),
			}
		}

		system.Sources[sourceName] = models.ComponentSource{
			Name:           sourceName,
			ComponentCount: result.Count,
		}

		systems[systemName] = system
	}

	if err := cursor.Err(); err != nil {
		return nil, fmt.Errorf("cursor error: %w", err)
	}

	return &models.ComponentSystemsResponse{
		Systems: systems,
	}, nil
}
