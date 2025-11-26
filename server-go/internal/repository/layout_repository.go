package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/tviviano/dashboard/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// LayoutRepository handles layout data persistence
type LayoutRepository struct {
	collection *mongo.Collection
}

// NewLayoutRepository creates a new layout repository
func NewLayoutRepository(db *mongo.Database) *LayoutRepository {
	return &LayoutRepository{
		collection: db.Collection("layouts"),
	}
}

// Create creates a new layout
func (r *LayoutRepository) Create(ctx context.Context, layout *models.Layout) error {
	layout.ID = primitive.NewObjectID()
	layout.CreatedAt = time.Now()
	layout.UpdatedAt = time.Now()

	_, err := r.collection.InsertOne(ctx, layout)
	if err != nil {
		return fmt.Errorf("failed to create layout: %w", err)
	}

	return nil
}

// FindByID finds a layout by ID
func (r *LayoutRepository) FindByID(ctx context.Context, id string) (*models.Layout, error) {
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, fmt.Errorf("invalid layout ID: %w", err)
	}

	var layout models.Layout
	err = r.collection.FindOne(ctx, bson.M{"_id": objectID}).Decode(&layout)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, fmt.Errorf("layout not found")
		}
		return nil, fmt.Errorf("failed to find layout: %w", err)
	}

	return &layout, nil
}

// FindAll finds all layouts with optional pagination
func (r *LayoutRepository) FindAll(ctx context.Context, limit, offset int64) ([]*models.Layout, error) {
	opts := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetLimit(limit).
		SetSkip(offset)

	cursor, err := r.collection.Find(ctx, bson.M{}, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to find layouts: %w", err)
	}
	defer cursor.Close(ctx)

	var layouts []*models.Layout
	if err = cursor.All(ctx, &layouts); err != nil {
		return nil, fmt.Errorf("failed to decode layouts: %w", err)
	}

	return layouts, nil
}

// Update updates an existing layout
func (r *LayoutRepository) Update(ctx context.Context, id string, layout *models.Layout) error {
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return fmt.Errorf("invalid layout ID: %w", err)
	}

	layout.UpdatedAt = time.Now()

	update := bson.M{
		"$set": bson.M{
			"name":        layout.Name,
			"description": layout.Description,
			"grid":        layout.Grid,
			"panels":      layout.Panels,
			"updated_at":  layout.UpdatedAt,
		},
	}

	result, err := r.collection.UpdateOne(ctx, bson.M{"_id": objectID}, update)
	if err != nil {
		return fmt.Errorf("failed to update layout: %w", err)
	}

	if result.MatchedCount == 0 {
		return fmt.Errorf("layout not found")
	}

	return nil
}

// Delete deletes a layout by ID
func (r *LayoutRepository) Delete(ctx context.Context, id string) error {
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return fmt.Errorf("invalid layout ID: %w", err)
	}

	result, err := r.collection.DeleteOne(ctx, bson.M{"_id": objectID})
	if err != nil {
		return fmt.Errorf("failed to delete layout: %w", err)
	}

	if result.DeletedCount == 0 {
		return fmt.Errorf("layout not found")
	}

	return nil
}

// Count returns the total number of layouts
func (r *LayoutRepository) Count(ctx context.Context) (int64, error) {
	count, err := r.collection.CountDocuments(ctx, bson.M{})
	if err != nil {
		return 0, fmt.Errorf("failed to count layouts: %w", err)
	}
	return count, nil
}

// FindByName finds a layout by name
func (r *LayoutRepository) FindByName(ctx context.Context, name string) (*models.Layout, error) {
	var layout models.Layout
	err := r.collection.FindOne(ctx, bson.M{"name": name}).Decode(&layout)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil // Not found is not an error for this method
		}
		return nil, fmt.Errorf("failed to find layout by name: %w", err)
	}

	return &layout, nil
}
