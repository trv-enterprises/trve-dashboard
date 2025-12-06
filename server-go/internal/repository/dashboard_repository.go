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

// DashboardRepository handles dashboard data operations
type DashboardRepository struct {
	collection *mongo.Collection
}

// NewDashboardRepository creates a new dashboard repository
func NewDashboardRepository(db *mongo.Database) *DashboardRepository {
	return &DashboardRepository{
		collection: db.Collection("dashboards"),
	}
}

// CreateIndexes creates necessary indexes for the dashboards collection
func (r *DashboardRepository) CreateIndexes(ctx context.Context) error {
	indexes := []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "name", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
		{
			Keys: bson.D{{Key: "panels.chart_id", Value: 1}}, // For finding dashboards by chart
		},
		{
			Keys: bson.D{{Key: "updated", Value: -1}},
		},
	}

	_, err := r.collection.Indexes().CreateMany(ctx, indexes)
	return err
}

// Create creates a new dashboard
func (r *DashboardRepository) Create(ctx context.Context, req *models.CreateDashboardRequest) (*models.Dashboard, error) {
	// Initialize panels if nil
	panels := req.Panels
	if panels == nil {
		panels = []models.DashboardPanel{}
	}

	dashboard := &models.Dashboard{
		ID:          uuid.New().String(),
		Name:        req.Name,
		Description: req.Description,
		Panels:      panels,
		Settings:    req.Settings,
		Metadata:    req.Metadata,
		Created:     time.Now(),
		Updated:     time.Now(),
	}

	_, err := r.collection.InsertOne(ctx, dashboard)
	if err != nil {
		return nil, fmt.Errorf("failed to insert dashboard: %w", err)
	}

	return dashboard, nil
}

// FindByID retrieves a dashboard by ID
func (r *DashboardRepository) FindByID(ctx context.Context, id string) (*models.Dashboard, error) {
	var dashboard models.Dashboard
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&dashboard)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to find dashboard: %w", err)
	}
	return &dashboard, nil
}

// FindByName retrieves a dashboard by name
func (r *DashboardRepository) FindByName(ctx context.Context, name string) (*models.Dashboard, error) {
	var dashboard models.Dashboard
	err := r.collection.FindOne(ctx, bson.M{"name": name}).Decode(&dashboard)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to find dashboard: %w", err)
	}
	return &dashboard, nil
}

// List retrieves dashboards with optional filtering and pagination
func (r *DashboardRepository) List(ctx context.Context, params models.DashboardQueryParams) ([]models.Dashboard, int64, error) {
	// Build filter
	filter := bson.M{}
	if params.Name != "" {
		filter["name"] = bson.M{"$regex": params.Name, "$options": "i"}
	}
	if params.IsPublic != nil {
		filter["settings.is_public"] = *params.IsPublic
	}
	if params.ChartID != "" {
		filter["panels.chart_id"] = params.ChartID
	}

	// Count total documents
	total, err := r.collection.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count dashboards: %w", err)
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
		SetSort(bson.D{{Key: "name", Value: 1}})

	cursor, err := r.collection.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to find dashboards: %w", err)
	}
	defer cursor.Close(ctx)

	var dashboards []models.Dashboard
	if err := cursor.All(ctx, &dashboards); err != nil {
		return nil, 0, fmt.Errorf("failed to decode dashboards: %w", err)
	}

	return dashboards, total, nil
}

// Update updates a dashboard
func (r *DashboardRepository) Update(ctx context.Context, id string, req *models.UpdateDashboardRequest) (*models.Dashboard, error) {
	update := bson.M{
		"$set": bson.M{
			"updated": time.Now(),
		},
	}

	setFields := update["$set"].(bson.M)

	if req.Name != nil {
		setFields["name"] = *req.Name
	}
	if req.Description != nil {
		setFields["description"] = *req.Description
	}
	if req.Panels != nil {
		setFields["panels"] = *req.Panels
	}
	if req.Thumbnail != nil {
		setFields["thumbnail"] = *req.Thumbnail
	}
	if req.Settings != nil {
		setFields["settings"] = *req.Settings
	}
	if req.Metadata != nil {
		setFields["metadata"] = *req.Metadata
	}

	opts := options.FindOneAndUpdate().SetReturnDocument(options.After)
	var dashboard models.Dashboard
	err := r.collection.FindOneAndUpdate(
		ctx,
		bson.M{"_id": id},
		update,
		opts,
	).Decode(&dashboard)

	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to update dashboard: %w", err)
	}

	return &dashboard, nil
}

// Delete deletes a dashboard by ID
func (r *DashboardRepository) Delete(ctx context.Context, id string) error {
	result, err := r.collection.DeleteOne(ctx, bson.M{"_id": id})
	if err != nil {
		return fmt.Errorf("failed to delete dashboard: %w", err)
	}
	if result.DeletedCount == 0 {
		return fmt.Errorf("dashboard not found")
	}
	return nil
}

// FindByChartID retrieves all dashboards using a specific chart
// Used for notifying dashboards when a chart is updated
func (r *DashboardRepository) FindByChartID(ctx context.Context, chartID string) ([]models.Dashboard, error) {
	filter := bson.M{"panels.chart_id": chartID}

	cursor, err := r.collection.Find(ctx, filter)
	if err != nil {
		return nil, fmt.Errorf("failed to find dashboards by chart: %w", err)
	}
	defer cursor.Close(ctx)

	var dashboards []models.Dashboard
	if err := cursor.All(ctx, &dashboards); err != nil {
		return nil, fmt.Errorf("failed to decode dashboards: %w", err)
	}

	return dashboards, nil
}
