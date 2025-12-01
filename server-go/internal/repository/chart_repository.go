package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/tviviano/dashboard/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// ChartRepository handles chart database operations
type ChartRepository struct {
	collection *mongo.Collection
}

// NewChartRepository creates a new chart repository
func NewChartRepository(db *mongo.Database) *ChartRepository {
	return &ChartRepository{
		collection: db.Collection("charts"),
	}
}

// CreateIndexes creates necessary indexes for the charts collection
func (r *ChartRepository) CreateIndexes(ctx context.Context) error {
	indexes := []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "name", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
		{
			Keys: bson.D{{Key: "chart_type", Value: 1}},
		},
		{
			Keys: bson.D{{Key: "datasource_id", Value: 1}},
		},
		{
			Keys: bson.D{{Key: "tags", Value: 1}},
		},
		{
			Keys: bson.D{{Key: "updated", Value: -1}},
		},
	}

	_, err := r.collection.Indexes().CreateMany(ctx, indexes)
	return err
}

// Create inserts a new chart
func (r *ChartRepository) Create(ctx context.Context, chart *models.Chart) error {
	if chart.ID == "" {
		chart.ID = uuid.New().String()
	}
	now := time.Now()
	chart.Created = now
	chart.Updated = now

	_, err := r.collection.InsertOne(ctx, chart)
	return err
}

// FindByID retrieves a chart by ID
func (r *ChartRepository) FindByID(ctx context.Context, id string) (*models.Chart, error) {
	var chart models.Chart
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&chart)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &chart, nil
}

// FindByName retrieves a chart by name
func (r *ChartRepository) FindByName(ctx context.Context, name string) (*models.Chart, error) {
	var chart models.Chart
	err := r.collection.FindOne(ctx, bson.M{"name": name}).Decode(&chart)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &chart, nil
}

// FindAll retrieves charts with pagination and optional filters
func (r *ChartRepository) FindAll(ctx context.Context, params models.ChartQueryParams) ([]models.Chart, int64, error) {
	filter := bson.M{}

	if params.Name != "" {
		filter["name"] = bson.M{"$regex": params.Name, "$options": "i"}
	}
	if params.ChartType != "" {
		filter["chart_type"] = params.ChartType
	}
	if params.DatasourceID != "" {
		filter["datasource_id"] = params.DatasourceID
	}
	if params.Tag != "" {
		filter["tags"] = params.Tag
	}

	// Count total matching documents
	total, err := r.collection.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	// Set defaults
	page := params.Page
	if page < 1 {
		page = 1
	}
	pageSize := params.PageSize
	if pageSize < 1 {
		pageSize = 20
	}

	skip := int64((page - 1) * pageSize)
	limit := int64(pageSize)

	opts := options.Find().
		SetSkip(skip).
		SetLimit(limit).
		SetSort(bson.D{{Key: "updated", Value: -1}})

	cursor, err := r.collection.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var charts []models.Chart
	if err := cursor.All(ctx, &charts); err != nil {
		return nil, 0, err
	}

	return charts, total, nil
}

// FindSummaries returns lightweight chart summaries for card display
func (r *ChartRepository) FindSummaries(ctx context.Context, limit int64) ([]models.ChartSummary, error) {
	if limit <= 0 {
		limit = 50
	}

	opts := options.Find().
		SetLimit(limit).
		SetSort(bson.D{{Key: "updated", Value: -1}}).
		SetProjection(bson.M{
			"_id":           1,
			"name":          1,
			"description":   1,
			"chart_type":    1,
			"datasource_id": 1,
			"thumbnail":     1,
			"tags":          1,
		})

	cursor, err := r.collection.Find(ctx, bson.M{}, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var summaries []models.ChartSummary
	for cursor.Next(ctx) {
		var doc bson.M
		if err := cursor.Decode(&doc); err != nil {
			continue
		}

		summary := models.ChartSummary{
			ID:           getString(doc, "_id"),
			Name:         getString(doc, "name"),
			Description:  getString(doc, "description"),
			ChartType:    getString(doc, "chart_type"),
			DatasourceID: getString(doc, "datasource_id"),
			Thumbnail:    getString(doc, "thumbnail"),
		}

		if tags, ok := doc["tags"].(bson.A); ok {
			for _, t := range tags {
				if s, ok := t.(string); ok {
					summary.Tags = append(summary.Tags, s)
				}
			}
		}

		summaries = append(summaries, summary)
	}

	return summaries, nil
}

// Update updates an existing chart
func (r *ChartRepository) Update(ctx context.Context, id string, chart *models.Chart) error {
	chart.Updated = time.Now()
	_, err := r.collection.ReplaceOne(ctx, bson.M{"_id": id}, chart)
	return err
}

// Delete removes a chart by ID
func (r *ChartRepository) Delete(ctx context.Context, id string) error {
	_, err := r.collection.DeleteOne(ctx, bson.M{"_id": id})
	return err
}

// Count returns total number of charts
func (r *ChartRepository) Count(ctx context.Context) (int64, error) {
	return r.collection.CountDocuments(ctx, bson.M{})
}

// FindByDatasourceID retrieves all charts using a specific data source
func (r *ChartRepository) FindByDatasourceID(ctx context.Context, datasourceID string) ([]models.Chart, error) {
	cursor, err := r.collection.Find(ctx, bson.M{"datasource_id": datasourceID})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var charts []models.Chart
	if err := cursor.All(ctx, &charts); err != nil {
		return nil, err
	}
	return charts, nil
}

// Helper to get string from bson.M
func getString(doc bson.M, key string) string {
	if v, ok := doc[key].(string); ok {
		return v
	}
	return ""
}
