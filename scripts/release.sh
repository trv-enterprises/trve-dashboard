#!/bin/bash
set -e

# Dashboard Release Script
# Usage: ./scripts/release.sh v0.2.0
#
# Creates multi-architecture releases:
#   - Tarballs: dashboard-<version>-linux-amd64.tar.gz, dashboard-<version>-linux-arm64.tar.gz
#   - Docker: Multi-arch images (linux/amd64, linux/arm64) with version and latest tags

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

# Architecture targets
ARCHS=("amd64" "arm64")

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

# Build multi-arch Docker images
log "Building multi-arch Docker images (amd64 + arm64)..."

# Ensure buildx builder exists with insecure registry support
if ! docker buildx inspect multiarch-builder >/dev/null 2>&1; then
    log "Creating buildx builder with insecure registry support..."
    cat > /tmp/buildkitd.toml <<EOF
[registry."$REGISTRY"]
  http = true
  insecure = true
EOF
    docker buildx create --name multiarch-builder \
        --driver docker-container \
        --driver-opt "network=host" \
        --buildkitd-config /tmp/buildkitd.toml
fi
docker buildx use multiarch-builder

# Build and push server image (multi-arch manifest)
log "Building dashboard-server for linux/amd64,linux/arm64..."
docker buildx build --platform linux/amd64,linux/arm64 \
    -t "$REGISTRY/dashboard-server:$VERSION" \
    -t "$REGISTRY/dashboard-server:latest" \
    --push \
    ./server-go

# Build and push client image (multi-arch manifest)
log "Building dashboard-client for linux/amd64,linux/arm64..."
docker buildx build --platform linux/amd64,linux/arm64 \
    -t "$REGISTRY/dashboard-client:$VERSION" \
    -t "$REGISTRY/dashboard-client:latest" \
    --push \
    ./client

# Commit version changes
log "Committing version changes..."
git add client/package.json client/build.json
git commit -m "Release $VERSION (BUILD $BUILD_NUM)" || true

# Create git tag
log "Creating git tag $VERSION..."
git tag -a "$VERSION" -m "Release $VERSION (BUILD $BUILD_NUM)"

# Docker images already pushed by buildx

# Create architecture-specific tarballs
log "Creating release tarballs..."
mkdir -p dist

for arch in "${ARCHS[@]}"; do
    log "Creating tarball for linux-$arch..."

    # Create temp directory for this architecture
    TARBALL_DIR="dist/dashboard-$VERSION-linux-$arch"
    mkdir -p "$TARBALL_DIR"

    # Copy architecture-specific server binary
    cp "server-go/dist/server-linux-$arch" "$TARBALL_DIR/server"

    # Copy client dist (same for all architectures)
    cp -r client/dist "$TARBALL_DIR/client-dist"

    # Copy deployment files
    cp docker-compose.prod.yml "$TARBALL_DIR/"
    cp DEPLOYMENT.md "$TARBALL_DIR/" 2>/dev/null || true
    cp .env.example "$TARBALL_DIR/" 2>/dev/null || true

    # Create tarball
    tar -czf "dist/dashboard-$VERSION-linux-$arch.tar.gz" -C dist "dashboard-$VERSION-linux-$arch"

    # Cleanup temp directory
    rm -rf "$TARBALL_DIR"
done

# Also create a darwin-arm64 tarball for local development
log "Creating tarball for darwin-arm64..."
TARBALL_DIR="dist/dashboard-$VERSION-darwin-arm64"
mkdir -p "$TARBALL_DIR"
cp "server-go/dist/server-darwin-arm64" "$TARBALL_DIR/server"
cp -r client/dist "$TARBALL_DIR/client-dist"
cp docker-compose.prod.yml "$TARBALL_DIR/" 2>/dev/null || true
cp DEPLOYMENT.md "$TARBALL_DIR/" 2>/dev/null || true
cp .env.example "$TARBALL_DIR/" 2>/dev/null || true
tar -czf "dist/dashboard-$VERSION-darwin-arm64.tar.gz" -C dist "dashboard-$VERSION-darwin-arm64"
rm -rf "$TARBALL_DIR"

# Get GitHub owner from remote
GITHUB_OWNER=$(git remote get-url origin | sed -n 's/.*github.com[:/]\([^/]*\)\/.*/\1/p')

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}Release $VERSION+$BUILD_NUM complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "Private Registry (multi-arch: amd64 + arm64):"
echo "  - $REGISTRY/dashboard-server:$VERSION"
echo "  - $REGISTRY/dashboard-client:$VERSION"
echo ""
echo "Tarballs:"
for arch in "${ARCHS[@]}"; do
    echo "  - dist/dashboard-$VERSION-linux-$arch.tar.gz"
done
echo "  - dist/dashboard-$VERSION-darwin-arm64.tar.gz"
echo ""
echo "Next steps:"
echo "  1. Push the tag:  git push origin $VERSION"
echo "  2. Push main:     git push origin main"
echo ""
echo "  GitHub Actions will automatically publish to ghcr.io:"
echo "    - ghcr.io/$GITHUB_OWNER/dashboard-server:$VERSION"
echo "    - ghcr.io/$GITHUB_OWNER/dashboard-client:$VERSION"
echo ""
echo "  3. Create GitHub release (optional):"
echo "     gh release create $VERSION dist/dashboard-$VERSION-linux-*.tar.gz dist/dashboard-$VERSION-darwin-*.tar.gz"
echo ""
echo "To deploy from public registry:"
echo "  docker pull ghcr.io/$GITHUB_OWNER/dashboard-server:$VERSION"
echo "  docker pull ghcr.io/$GITHUB_OWNER/dashboard-client:$VERSION"
