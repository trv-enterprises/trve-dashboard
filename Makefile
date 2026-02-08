.PHONY: help build release docker-build docker-push clean

# Configuration
REGISTRY ?= 100.127.19.27:5000
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
BUILD_NUM ?= $(shell cat client/build.json | grep buildNumber | awk '{print $$2}' | tr -d ',')
IMAGE_TAG ?= $(VERSION)

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ''
	@echo 'Current version: $(VERSION)+$(BUILD_NUM)'
	@echo 'Registry: $(REGISTRY)'

build: ## Build client and server
	@echo "Building client..."
	cd client && npm ci && npm run build
	@echo "Building server..."
	cd server-go && make release-build VERSION=$(VERSION) BUILD_NUM=$(BUILD_NUM)
	@echo "✓ Build complete"

docker-build: ## Build Docker images
	@echo "Building Docker images with tag: $(IMAGE_TAG)"
	docker build -t $(REGISTRY)/dashboard-server:$(IMAGE_TAG) ./server-go
	docker build -t $(REGISTRY)/dashboard-client:$(IMAGE_TAG) ./client
	docker tag $(REGISTRY)/dashboard-server:$(IMAGE_TAG) $(REGISTRY)/dashboard-server:latest
	docker tag $(REGISTRY)/dashboard-client:$(IMAGE_TAG) $(REGISTRY)/dashboard-client:latest
	@echo "✓ Docker images built"
	@docker images | grep dashboard

docker-push: ## Push Docker images to registry
	@echo "Pushing to $(REGISTRY)..."
	docker push $(REGISTRY)/dashboard-server:$(IMAGE_TAG)
	docker push $(REGISTRY)/dashboard-server:latest
	docker push $(REGISTRY)/dashboard-client:$(IMAGE_TAG)
	docker push $(REGISTRY)/dashboard-client:latest
	@echo "✓ Images pushed to registry"

release: build docker-build docker-push ## Full release: build, docker, push
	@echo ""
	@echo "============================================"
	@echo "Release $(VERSION)+$(BUILD_NUM) complete!"
	@echo "============================================"
	@echo ""
	@echo "Images available at:"
	@echo "  $(REGISTRY)/dashboard-server:$(IMAGE_TAG)"
	@echo "  $(REGISTRY)/dashboard-client:$(IMAGE_TAG)"
	@echo ""
	@echo "To deploy, update your docker-compose to use these images"

package: build ## Create release tarball
	@echo "Creating release package..."
	mkdir -p dist
	tar -czf dist/dashboard-$(VERSION).tar.gz \
		server-go/dist/ \
		client/dist/ \
		docker-compose.prod.yml \
		DEPLOYMENT.md \
		.env.example
	@echo "✓ Package created: dist/dashboard-$(VERSION).tar.gz"
	@ls -lh dist/dashboard-$(VERSION).tar.gz

clean: ## Clean build artifacts
	rm -rf dist/
	rm -rf server-go/dist/
	rm -rf client/dist/
	@echo "✓ Cleaned"

.DEFAULT_GOAL := help
