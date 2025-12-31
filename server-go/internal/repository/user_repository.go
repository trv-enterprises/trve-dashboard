package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/tviviano/dashboard/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// UserRepository handles user database operations
type UserRepository struct {
	collection *mongo.Collection
}

// NewUserRepository creates a new user repository
func NewUserRepository(db *mongo.Database) *UserRepository {
	return &UserRepository{
		collection: db.Collection("users"),
	}
}

// CreateIndexes creates indexes for the users collection
func (r *UserRepository) CreateIndexes(ctx context.Context) error {
	indexes := []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "guid", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
		{
			Keys:    bson.D{{Key: "name", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
		{
			Keys: bson.D{{Key: "active", Value: 1}},
		},
	}

	_, err := r.collection.Indexes().CreateMany(ctx, indexes)
	return err
}

// Create creates a new user
func (r *UserRepository) Create(ctx context.Context, user *models.User) error {
	if user.ID == "" {
		user.ID = uuid.New().String()
	}
	if user.GUID == "" {
		user.GUID = uuid.New().String()
	}
	now := time.Now()
	user.Created = now
	user.Updated = now

	// Ensure at least VIEW capability
	hasView := false
	for _, cap := range user.Capabilities {
		if cap == models.CapabilityView {
			hasView = true
			break
		}
	}
	if !hasView {
		user.Capabilities = append([]models.Capability{models.CapabilityView}, user.Capabilities...)
	}

	_, err := r.collection.InsertOne(ctx, user)
	return err
}

// GetByID retrieves a user by ID
func (r *UserRepository) GetByID(ctx context.Context, id string) (*models.User, error) {
	var user models.User
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&user)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

// GetByGUID retrieves a user by GUID (for authentication)
func (r *UserRepository) GetByGUID(ctx context.Context, guid string) (*models.User, error) {
	var user models.User
	err := r.collection.FindOne(ctx, bson.M{"guid": guid, "active": true}).Decode(&user)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

// GetByName retrieves a user by name
func (r *UserRepository) GetByName(ctx context.Context, name string) (*models.User, error) {
	var user models.User
	err := r.collection.FindOne(ctx, bson.M{"name": name}).Decode(&user)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

// Update updates an existing user
func (r *UserRepository) Update(ctx context.Context, user *models.User) error {
	user.Updated = time.Now()

	result, err := r.collection.ReplaceOne(
		ctx,
		bson.M{"_id": user.ID},
		user,
	)
	if err != nil {
		return err
	}
	if result.MatchedCount == 0 {
		return errors.New("user not found")
	}
	return nil
}

// Delete deletes a user by ID
func (r *UserRepository) Delete(ctx context.Context, id string) error {
	result, err := r.collection.DeleteOne(ctx, bson.M{"_id": id})
	if err != nil {
		return err
	}
	if result.DeletedCount == 0 {
		return errors.New("user not found")
	}
	return nil
}

// List returns a paginated list of users
func (r *UserRepository) List(ctx context.Context, page, pageSize int) ([]models.User, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}

	// Count total
	total, err := r.collection.CountDocuments(ctx, bson.M{})
	if err != nil {
		return nil, 0, err
	}

	// Find with pagination
	opts := options.Find().
		SetSkip(int64((page - 1) * pageSize)).
		SetLimit(int64(pageSize)).
		SetSort(bson.D{{Key: "name", Value: 1}})

	cursor, err := r.collection.Find(ctx, bson.M{}, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var users []models.User
	if err := cursor.All(ctx, &users); err != nil {
		return nil, 0, err
	}

	return users, total, nil
}

// UpsertByName creates or updates a user by name (for seeding)
func (r *UserRepository) UpsertByName(ctx context.Context, user *models.User) error {
	now := time.Now()
	user.Updated = now

	filter := bson.M{"name": user.Name}
	update := bson.M{
		"$set": bson.M{
			"guid":         user.GUID,
			"email":        user.Email,
			"capabilities": user.Capabilities,
			"active":       user.Active,
			"updated":      now,
		},
		"$setOnInsert": bson.M{
			"_id":     user.ID,
			"name":    user.Name,
			"created": now,
		},
	}

	opts := options.Update().SetUpsert(true)
	_, err := r.collection.UpdateOne(ctx, filter, update, opts)
	return err
}

// Count returns the total number of users
func (r *UserRepository) Count(ctx context.Context) (int64, error) {
	return r.collection.CountDocuments(ctx, bson.M{})
}
