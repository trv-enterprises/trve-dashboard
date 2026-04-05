// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

package database

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/trv-enterprises/trve-dashboard/config"
)

// Redis holds the Redis client
type Redis struct {
	Client *redis.Client
}

// NewRedis creates a new Redis connection
func NewRedis(cfg config.RedisConfig) (*Redis, error) {
	client := redis.NewClient(&redis.Options{
		Addr:         cfg.Addr,
		Password:     cfg.Password,
		DB:           cfg.DB,
		MaxRetries:   cfg.MaxRetries,
		PoolSize:     cfg.PoolSize,
		MinIdleConns: cfg.MinIdleConns,
	})

	// Ping Redis
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to redis: %w", err)
	}

	fmt.Printf("✓ Connected to Redis: %s\n", cfg.Addr)

	return &Redis{Client: client}, nil
}

// Close closes the Redis connection
func (r *Redis) Close() error {
	if err := r.Client.Close(); err != nil {
		return fmt.Errorf("failed to close redis connection: %w", err)
	}

	fmt.Println("✓ Disconnected from Redis")
	return nil
}
