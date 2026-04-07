// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

package database

import (
	"context"
	"log"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// RunMigrations executes one-time data migrations.
// Each migration checks a flag in a "migrations" collection before running.
func RunMigrations(ctx context.Context, db *mongo.Database) error {
	migrations := []struct {
		name string
		fn   func(ctx context.Context, db *mongo.Database) error
	}{
		{"double_panel_cells_32px", migratePanelCellsTo32px},
	}

	coll := db.Collection("migrations")

	for _, m := range migrations {
		// Check if already applied
		count, err := coll.CountDocuments(ctx, bson.M{"_id": m.name})
		if err != nil {
			return err
		}
		if count > 0 {
			continue
		}

		log.Printf("Running migration: %s", m.name)
		if err := m.fn(ctx, db); err != nil {
			log.Printf("Migration %s failed: %v", m.name, err)
			return err
		}

		// Mark as applied
		_, err = coll.InsertOne(ctx, bson.M{"_id": m.name})
		if err != nil {
			return err
		}
		log.Printf("Migration %s completed", m.name)
	}

	return nil
}

// migratePanelCellsTo32px doubles all panel x, y, w, h values to account for
// cell size change from 64x36 to 32x32. The x and w are doubled (64→32 width),
// and y and h are scaled by 36/32 then doubled (36→32 height) to preserve
// approximate pixel positions.
func migratePanelCellsTo32px(ctx context.Context, db *mongo.Database) error {
	coll := db.Collection("dashboards")

	cursor, err := coll.Find(ctx, bson.M{})
	if err != nil {
		return err
	}
	defer cursor.Close(ctx)

	updated := 0
	for cursor.Next(ctx) {
		var doc bson.M
		if err := cursor.Decode(&doc); err != nil {
			continue
		}

		panels, ok := doc["panels"].(bson.A)
		if !ok || len(panels) == 0 {
			continue
		}

		newPanels := make(bson.A, len(panels))
		for i, p := range panels {
			panel, ok := p.(bson.M)
			if !ok {
				newPanels[i] = p
				continue
			}

			// Double x and w (64px → 32px columns)
			if x, ok := panel["x"].(int32); ok {
				panel["x"] = x * 2
			}
			if w, ok := panel["w"].(int32); ok {
				panel["w"] = w * 2
			}
			// Double y and h (36px → 32px rows, approximate)
			if y, ok := panel["y"].(int32); ok {
				panel["y"] = y * 2
			}
			if h, ok := panel["h"].(int32); ok {
				panel["h"] = h * 2
			}

			newPanels[i] = panel
		}

		_, err := coll.UpdateByID(ctx, doc["_id"], bson.M{"$set": bson.M{"panels": newPanels}})
		if err != nil {
			log.Printf("Failed to update dashboard %v: %v", doc["_id"], err)
			continue
		}
		updated++
	}

	log.Printf("Migrated %d dashboards (doubled panel cell coordinates)", updated)
	return nil
}
