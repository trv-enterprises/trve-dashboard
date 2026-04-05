// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/trv-enterprises/trve-dashboard/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// DatasourceRepository handles datasource data access
type DatasourceRepository struct {
	collection *mongo.Collection
}

// NewDatasourceRepository creates a new datasource repository
func NewDatasourceRepository(db *mongo.Database) *DatasourceRepository {
	return &DatasourceRepository{
		collection: db.Collection("datasources"),
	}
}

// Create creates a new datasource
func (r *DatasourceRepository) Create(ctx context.Context, datasource *models.Datasource) error {
	datasource.ID = primitive.NewObjectID()
	datasource.CreatedAt = time.Now()
	datasource.UpdatedAt = time.Now()

	// Initialize health status as unknown
	if datasource.Health.Status == "" {
		datasource.Health.Status = models.HealthStatusUnknown
	}

	_, err := r.collection.InsertOne(ctx, datasource)
	return err
}

// FindByID retrieves a datasource by ID
func (r *DatasourceRepository) FindByID(ctx context.Context, id string) (*models.Datasource, error) {
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, fmt.Errorf("invalid id format: %w", err)
	}

	var datasource models.Datasource
	err = r.collection.FindOne(ctx, bson.M{"_id": objectID}).Decode(&datasource)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, err
	}

	return &datasource, nil
}

// FindAll retrieves all datasources with pagination
func (r *DatasourceRepository) FindAll(ctx context.Context, limit, offset int64) ([]*models.Datasource, error) {
	opts := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetLimit(limit).
		SetSkip(offset)

	cursor, err := r.collection.Find(ctx, bson.M{}, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var datasources []*models.Datasource
	if err := cursor.All(ctx, &datasources); err != nil {
		return nil, err
	}

	return datasources, nil
}

// FindByType retrieves datasources by type with pagination
func (r *DatasourceRepository) FindByType(ctx context.Context, dsType models.DatasourceType, limit, offset int64) ([]*models.Datasource, error) {
	opts := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetLimit(limit).
		SetSkip(offset)

	cursor, err := r.collection.Find(ctx, bson.M{"type": dsType}, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var datasources []*models.Datasource
	if err := cursor.All(ctx, &datasources); err != nil {
		return nil, err
	}

	return datasources, nil
}

// FindByTags retrieves datasources with any of the given tags
func (r *DatasourceRepository) FindByTags(ctx context.Context, tags []string, limit, offset int64) ([]*models.Datasource, error) {
	opts := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetLimit(limit).
		SetSkip(offset)

	filter := bson.M{"tags": bson.M{"$in": tags}}
	cursor, err := r.collection.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var datasources []*models.Datasource
	if err := cursor.All(ctx, &datasources); err != nil {
		return nil, err
	}

	return datasources, nil
}

// Update updates an existing datasource
func (r *DatasourceRepository) Update(ctx context.Context, id string, datasource *models.Datasource) error {
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return fmt.Errorf("invalid id format: %w", err)
	}

	datasource.UpdatedAt = time.Now()

	filter := bson.M{"_id": objectID}
	update := bson.M{"$set": datasource}

	result, err := r.collection.UpdateOne(ctx, filter, update)
	if err != nil {
		return err
	}

	if result.MatchedCount == 0 {
		return mongo.ErrNoDocuments
	}

	return nil
}

// UpdateHealth updates only the health information of a datasource
func (r *DatasourceRepository) UpdateHealth(ctx context.Context, id string, health models.HealthInfo) error {
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return fmt.Errorf("invalid id format: %w", err)
	}

	filter := bson.M{"_id": objectID}
	update := bson.M{
		"$set": bson.M{
			"health":     health,
			"updated_at": time.Now(),
		},
	}

	result, err := r.collection.UpdateOne(ctx, filter, update)
	if err != nil {
		return err
	}

	if result.MatchedCount == 0 {
		return mongo.ErrNoDocuments
	}

	return nil
}

// Delete deletes a datasource by ID
func (r *DatasourceRepository) Delete(ctx context.Context, id string) error {
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return fmt.Errorf("invalid id format: %w", err)
	}

	result, err := r.collection.DeleteOne(ctx, bson.M{"_id": objectID})
	if err != nil {
		return err
	}

	if result.DeletedCount == 0 {
		return mongo.ErrNoDocuments
	}

	return nil
}

// Count returns the total number of datasources
func (r *DatasourceRepository) Count(ctx context.Context) (int64, error) {
	return r.collection.CountDocuments(ctx, bson.M{})
}

// CountByType returns the number of datasources of a specific type
func (r *DatasourceRepository) CountByType(ctx context.Context, dsType models.DatasourceType) (int64, error) {
	return r.collection.CountDocuments(ctx, bson.M{"type": dsType})
}

// FindByName retrieves a datasource by name (for uniqueness check)
func (r *DatasourceRepository) FindByName(ctx context.Context, name string) (*models.Datasource, error) {
	var datasource models.Datasource
	err := r.collection.FindOne(ctx, bson.M{"name": name}).Decode(&datasource)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, err
	}

	return &datasource, nil
}

// FindUnhealthy retrieves all datasources with unhealthy status
func (r *DatasourceRepository) FindUnhealthy(ctx context.Context) ([]*models.Datasource, error) {
	filter := bson.M{
		"health.status": bson.M{
			"$in": []models.HealthStatus{
				models.HealthStatusUnhealthy,
				models.HealthStatusDegraded,
			},
		},
	}

	cursor, err := r.collection.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var datasources []*models.Datasource
	if err := cursor.All(ctx, &datasources); err != nil {
		return nil, err
	}

	return datasources, nil
}

// FindStale retrieves datasources that haven't been checked recently
func (r *DatasourceRepository) FindStale(ctx context.Context, threshold time.Duration) ([]*models.Datasource, error) {
	cutoffTime := time.Now().Add(-threshold)
	filter := bson.M{
		"$or": []bson.M{
			{"health.last_check": bson.M{"$lt": cutoffTime}},
			{"health.last_check": bson.M{"$exists": false}},
		},
	}

	cursor, err := r.collection.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var datasources []*models.Datasource
	if err := cursor.All(ctx, &datasources); err != nil {
		return nil, err
	}

	return datasources, nil
}
