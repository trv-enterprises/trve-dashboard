// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

package database

import (
	"context"
	"fmt"
	"time"

	"github.com/tviviano/dashboard/config"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readpref"
)

// MongoDB holds the MongoDB client and database
type MongoDB struct {
	Client   *mongo.Client
	Database *mongo.Database
}

// NewMongoDB creates a new MongoDB connection
func NewMongoDB(cfg config.MongoDBConfig) (*MongoDB, error) {
	ctx, cancel := context.WithTimeout(context.Background(), cfg.ConnectionTimeout)
	defer cancel()

	// Set client options
	clientOptions := options.Client().
		ApplyURI(cfg.URI).
		SetMaxPoolSize(cfg.MaxPoolSize).
		SetMinPoolSize(cfg.MinPoolSize)

	// Connect to MongoDB
	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to mongodb: %w", err)
	}

	// Ping the database
	if err := client.Ping(ctx, readpref.Primary()); err != nil {
		return nil, fmt.Errorf("failed to ping mongodb: %w", err)
	}

	database := client.Database(cfg.Database)

	fmt.Printf("✓ Connected to MongoDB: %s\n", cfg.Database)

	return &MongoDB{
		Client:   client,
		Database: database,
	}, nil
}

// Disconnect closes the MongoDB connection
func (m *MongoDB) Disconnect() error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := m.Client.Disconnect(ctx); err != nil {
		return fmt.Errorf("failed to disconnect from mongodb: %w", err)
	}

	fmt.Println("✓ Disconnected from MongoDB")
	return nil
}

// Collection returns a collection
func (m *MongoDB) Collection(name string) *mongo.Collection {
	return m.Database.Collection(name)
}

// Collections returns collection helpers
func (m *MongoDB) Collections() Collections {
	return Collections{
		Datasources:  m.Collection("datasources"),
		Dashboards:   m.Collection("dashboards"),
		ChatSessions: m.Collection("chat_sessions"),
	}
}

// Collections holds references to all collections
type Collections struct {
	Datasources  *mongo.Collection
	Dashboards   *mongo.Collection
	ChatSessions *mongo.Collection
}

// CreateIndexes creates indexes for all collections
func (m *MongoDB) CreateIndexes(ctx context.Context) error {
	collections := m.Collections()

	// Datasources indexes
	if err := createIndexes(ctx, collections.Datasources, datasourceIndexes()); err != nil {
		return fmt.Errorf("datasources indexes: %w", err)
	}

	// Dashboards indexes
	if err := createIndexes(ctx, collections.Dashboards, dashboardIndexes()); err != nil {
		return fmt.Errorf("dashboards indexes: %w", err)
	}

	// Chat sessions indexes
	if err := createIndexes(ctx, collections.ChatSessions, chatSessionIndexes()); err != nil {
		return fmt.Errorf("chat_sessions indexes: %w", err)
	}

	fmt.Println("✓ Created MongoDB indexes")
	return nil
}

func createIndexes(ctx context.Context, collection *mongo.Collection, models []mongo.IndexModel) error {
	if len(models) == 0 {
		return nil
	}

	_, err := collection.Indexes().CreateMany(ctx, models)
	return err
}

// Index model helpers
func datasourceIndexes() []mongo.IndexModel {
	return []mongo.IndexModel{
		{
			Keys:    map[string]interface{}{"name": 1},
			Options: options.Index().SetUnique(true),
		},
		{
			Keys: map[string]interface{}{"type": 1},
		},
		{
			Keys: map[string]interface{}{"created_at": -1},
		},
	}
}

func dashboardIndexes() []mongo.IndexModel {
	return []mongo.IndexModel{
		{
			Keys:    map[string]interface{}{"name": 1},
			Options: options.Index().SetUnique(true),
		},
		{
			Keys: map[string]interface{}{"panels.chart_id": 1},
		},
		{
			Keys: map[string]interface{}{"created_at": -1},
		},
	}
}

func chatSessionIndexes() []mongo.IndexModel {
	return []mongo.IndexModel{
		{
			Keys: bson.D{
				{Key: "user_id", Value: 1},
				{Key: "created_at", Value: -1},
			},
		},
	}
}
