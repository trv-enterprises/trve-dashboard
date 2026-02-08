#!/bin/bash
set -e

# Dashboard Release Script
# Usage: ./scripts/release.sh v0.2.0

REGISTRY="100.127.19.27:5000"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() { echo -e "${GREEN}[RELEASE]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Check for version argument
if [ -z "$1" ]; then
    echo "Usage: $0 <version>"
    echo "Example: $0 v0.2.0"
    echo ""
    echo "Current tags:"
    git tag --sort=-version:refname | head -5
    exit 1
fi

VERSION=$1
BUILD_NUM=$(cat client/build.json | grep buildNumber | awk '{print $2}' | tr -d ',')

# Validate version format
if [[ ! "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    error "Version must be in format vX.Y.Z (e.g., v0.2.0)"
fi

log "Preparing release $VERSION+$BUILD_NUM"

# Check for uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
    warn "You have uncommitted changes:"
    git status --short
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check if tag already exists
if git rev-parse "$VERSION" >/dev/null 2>&1; then
    error "Tag $VERSION already exists"
fi

# Update package.json version (strip 'v' prefix)
PKG_VERSION=${VERSION#v}
log "Updating client/package.json to version $PKG_VERSION"
cd client
npm version --no-git-tag-version "$PKG_VERSION"
cd ..

# Build client
log "Building client..."
cd client
npm ci --legacy-peer-deps
npm run build
cd ..

# Build server binaries
log "Building server binaries..."
cd server-go
make release-build VERSION="$VERSION" BUILD_NUM="$BUILD_NUM"
cd ..

# Build Docker images
log "Building Docker images..."
docker build -t "$REGISTRY/dashboard-server:$VERSION" ./server-go
docker build -t "$REGISTRY/dashboard-client:$VERSION" ./client
docker tag "$REGISTRY/dashboard-server:$VERSION" "$REGISTRY/dashboard-server:latest"
docker tag "$REGISTRY/dashboard-client:$VERSION" "$REGISTRY/dashboard-client:latest"

# Commit version changes
log "Committing version changes..."
git add client/package.json client/build.json
git commit -m "Release $VERSION (BUILD $BUILD_NUM)" || true

# Create git tag
log "Creating git tag $VERSION..."
git tag -a "$VERSION" -m "Release $VERSION (BUILD $BUILD_NUM)"

# Push Docker images
log "Pushing Docker images to $REGISTRY..."
docker push "$REGISTRY/dashboard-server:$VERSION"
docker push "$REGISTRY/dashboard-server:latest"
docker push "$REGISTRY/dashboard-client:$VERSION"
docker push "$REGISTRY/dashboard-client:latest"

# Create tarball
log "Creating release tarball..."
mkdir -p dist
tar -czf "dist/dashboard-$VERSION.tar.gz" \
    server-go/dist/ \
    client/dist/ \
    docker-compose.prod.yml \
    DEPLOYMENT.md \
    .env.example

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}Release $VERSION+$BUILD_NUM complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "Artifacts:"
echo "  - Docker: $REGISTRY/dashboard-server:$VERSION"
echo "  - Docker: $REGISTRY/dashboard-client:$VERSION"
echo "  - Tarball: dist/dashboard-$VERSION.tar.gz"
echo ""
echo "Next steps:"
echo "  1. Push the tag:  git push origin $VERSION"
echo "  2. Push main:     git push origin main"
echo "  3. Create GitHub release (optional):"
echo "     gh release create $VERSION dist/dashboard-$VERSION.tar.gz"
echo ""
echo "To deploy on your server:"
echo "  docker pull $REGISTRY/dashboard-server:$VERSION"
echo "  docker pull $REGISTRY/dashboard-client:$VERSION"
