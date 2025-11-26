.PHONY: help install run dev build test clean docker-up docker-down swagger

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install dependencies
	go mod download
	go install github.com/swaggo/swag/cmd/swag@latest
	@echo "✓ Dependencies installed"

tidy: ## Tidy dependencies
	go mod tidy
	@echo "✓ Dependencies tidied"

swagger: ## Generate Swagger documentation
	swag init -g cmd/server/main.go -o docs
	@echo "✓ Swagger docs generated"

run: ## Run the server
	go run cmd/server/main.go

dev: ## Run the server with live reload (requires air)
	air

build: ## Build the server binary
	go build -o bin/server cmd/server/main.go
	go build -o bin/worker cmd/worker/main.go
	@echo "✓ Binaries built in ./bin/"

test: ## Run tests
	go test -v -race -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html
	@echo "✓ Tests completed. Coverage report: coverage.html"

clean: ## Clean build artifacts
	rm -rf bin/ docs/ coverage.out coverage.html
	@echo "✓ Cleaned"

docker-up: ## Start MongoDB and Redis
	cd .. && docker-compose up -d mongodb redis asynqmon
	@echo "✓ MongoDB, Redis, and Asynq Monitor started"
	@echo "  - MongoDB: mongodb://localhost:27017"
	@echo "  - Redis: localhost:6379"
	@echo "  - Asynq Monitor: http://localhost:8080"

docker-down: ## Stop all Docker services
	cd .. && docker-compose down
	@echo "✓ Docker services stopped"

docker-logs: ## View Docker logs
	cd .. && docker-compose logs -f

lint: ## Run linter
	golangci-lint run ./...

fmt: ## Format code
	go fmt ./...
	@echo "✓ Code formatted"

vet: ## Run go vet
	go vet ./...
	@echo "✓ Vet passed"

all: install swagger build ## Install, generate swagger, and build

.DEFAULT_GOAL := help
