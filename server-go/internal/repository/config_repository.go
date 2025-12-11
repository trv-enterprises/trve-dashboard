package repository

import (
	"context"
	"time"

	"github.com/tviviano/dashboard/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// ConfigRepository handles database operations for app configuration
type ConfigRepository struct {
	collection *mongo.Collection
}

// NewConfigRepository creates a new ConfigRepository
func NewConfigRepository(db *mongo.Database) *ConfigRepository {
	return &ConfigRepository{
		collection: db.Collection("app_config"),
	}
}

// GetSystemConfig retrieves the system configuration
func (r *ConfigRepository) GetSystemConfig(ctx context.Context) (*models.AppConfig, error) {
	var config models.AppConfig
	err := r.collection.FindOne(ctx, bson.M{
		"scope": models.ConfigScopeSystem,
	}).Decode(&config)

	if err == mongo.ErrNoDocuments {
		// Return empty config if none exists
		return &models.AppConfig{
			ID:       "system",
			Scope:    models.ConfigScopeSystem,
			Settings: make(map[string]interface{}),
			Created:  time.Now(),
			Updated:  time.Now(),
		}, nil
	}

	if err != nil {
		return nil, err
	}

	return &config, nil
}

// UpsertSystemConfig updates or creates the system configuration
func (r *ConfigRepository) UpsertSystemConfig(ctx context.Context, settings map[string]interface{}) (*models.AppConfig, error) {
	now := time.Now()

	filter := bson.M{"scope": models.ConfigScopeSystem}
	update := bson.M{
		"$set": bson.M{
			"settings": settings,
			"updated":  now,
		},
		"$setOnInsert": bson.M{
			"_id":     "system",
			"scope":   models.ConfigScopeSystem,
			"created": now,
		},
	}

	opts := options.FindOneAndUpdate().
		SetUpsert(true).
		SetReturnDocument(options.After)

	var config models.AppConfig
	err := r.collection.FindOneAndUpdate(ctx, filter, update, opts).Decode(&config)
	if err != nil {
		return nil, err
	}

	return &config, nil
}

// UpdateSystemConfigKey updates a single key in system configuration
func (r *ConfigRepository) UpdateSystemConfigKey(ctx context.Context, key string, value interface{}) error {
	now := time.Now()

	filter := bson.M{"scope": models.ConfigScopeSystem}
	update := bson.M{
		"$set": bson.M{
			"settings." + key: value,
			"updated":         now,
		},
		"$setOnInsert": bson.M{
			"_id":     "system",
			"scope":   models.ConfigScopeSystem,
			"created": now,
		},
	}

	opts := options.Update().SetUpsert(true)
	_, err := r.collection.UpdateOne(ctx, filter, update, opts)
	return err
}

// GetUserConfig retrieves configuration for a specific user
func (r *ConfigRepository) GetUserConfig(ctx context.Context, userID string) (*models.AppConfig, error) {
	var config models.AppConfig
	err := r.collection.FindOne(ctx, bson.M{
		"scope":   models.ConfigScopeUser,
		"user_id": userID,
	}).Decode(&config)

	if err == mongo.ErrNoDocuments {
		// Return empty config if none exists
		return &models.AppConfig{
			ID:       "user_" + userID,
			Scope:    models.ConfigScopeUser,
			UserID:   userID,
			Settings: make(map[string]interface{}),
			Created:  time.Now(),
			Updated:  time.Now(),
		}, nil
	}

	if err != nil {
		return nil, err
	}

	return &config, nil
}

// UpsertUserConfig updates or creates user configuration
func (r *ConfigRepository) UpsertUserConfig(ctx context.Context, userID string, settings map[string]interface{}) (*models.AppConfig, error) {
	now := time.Now()

	filter := bson.M{
		"scope":   models.ConfigScopeUser,
		"user_id": userID,
	}
	update := bson.M{
		"$set": bson.M{
			"settings": settings,
			"updated":  now,
		},
		"$setOnInsert": bson.M{
			"_id":     "user_" + userID,
			"scope":   models.ConfigScopeUser,
			"user_id": userID,
			"created": now,
		},
	}

	opts := options.FindOneAndUpdate().
		SetUpsert(true).
		SetReturnDocument(options.After)

	var config models.AppConfig
	err := r.collection.FindOneAndUpdate(ctx, filter, update, opts).Decode(&config)
	if err != nil {
		return nil, err
	}

	return &config, nil
}

// UpdateUserConfigKey updates a single key in user configuration
func (r *ConfigRepository) UpdateUserConfigKey(ctx context.Context, userID string, key string, value interface{}) error {
	now := time.Now()

	filter := bson.M{
		"scope":   models.ConfigScopeUser,
		"user_id": userID,
	}
	update := bson.M{
		"$set": bson.M{
			"settings." + key: value,
			"updated":         now,
		},
		"$setOnInsert": bson.M{
			"_id":     "user_" + userID,
			"scope":   models.ConfigScopeUser,
			"user_id": userID,
			"created": now,
		},
	}

	opts := options.Update().SetUpsert(true)
	_, err := r.collection.UpdateOne(ctx, filter, update, opts)
	return err
}

// CreateIndexes creates necessary indexes for the config collection
func (r *ConfigRepository) CreateIndexes(ctx context.Context) error {
	indexes := []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "scope", Value: 1}},
			Options: options.Index(),
		},
		{
			Keys:    bson.D{{Key: "scope", Value: 1}, {Key: "user_id", Value: 1}},
			Options: options.Index().SetUnique(true).SetPartialFilterExpression(bson.M{"user_id": bson.M{"$exists": true}}),
		},
	}

	_, err := r.collection.Indexes().CreateMany(ctx, indexes)
	return err
}
