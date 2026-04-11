# Dashboard Deployment Guide

## Quick Start (Docker Compose)

```bash
# 1. Copy and configure environment
cp .env.example .env
# Edit .env with your ANTHROPIC_API_KEY and DOMAIN

# 2. Build and start all services
docker compose -f docker-compose.prod.yml up -d --build

# 3. Check status
docker compose -f docker-compose.prod.yml ps
```

Your dashboard will be available at:
- `http://localhost` (if DOMAIN=localhost)
- `https://your-domain.com` (if using a real domain with DNS configured)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     CADDY (Port 80/443)                          │
│  - Serves React static files                                     │
│  - Reverse proxies /api/* to Go backend                         │
│  - Automatic HTTPS via Let's Encrypt                            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GO SERVER (Port 3001)                         │
│  - REST API, WebSocket, AI sessions                             │
└─────────────────────────────────────────────────────────────────┘
                    │                       │
                    ▼                       ▼
            ┌──────────────┐        ┌──────────────┐
            │   MongoDB    │        │    Redis     │
            └──────────────┘        └──────────────┘
```

---

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | API key for AI features |
| `DOMAIN` | Domain for HTTPS (e.g., `dashboard.example.com` or `localhost`) |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `DASHBOARD_SERVER_PORT` | `3001` | Go server port |
| `DASHBOARD_SERVER_MODE` | `release` | Gin mode (release/debug) |
| `DASHBOARD_MONGODB_URI` | `mongodb://mongodb:27017` | MongoDB connection string |
| `DASHBOARD_MONGODB_DATABASE` | `dashboard` | Database name |
| `DASHBOARD_REDIS_ADDR` | `redis:6379` | Redis address |

---

## HTTPS Configuration

### Public Domain (Automatic Let's Encrypt)

1. Point your DNS to your server's IP
2. Open ports 80 and 443 on your firewall
3. Set `DOMAIN=your-domain.com` in `.env`
4. Start the containers - Caddy will automatically obtain certificates

### Local/Private Deployment

Set `DOMAIN=localhost` - Caddy will use a self-signed certificate.

### Custom Certificates

Mount your certificates into the Caddy container:

```yaml
# In docker-compose.prod.yml
caddy:
  volumes:
    - ./certs:/etc/caddy/certs:ro
```

Update Caddyfile:
```caddyfile
your-domain.com {
    tls /etc/caddy/certs/cert.pem /etc/caddy/certs/key.pem
    # ... rest of config
}
```

---

## Manual Deployment (Without Docker)

### 1. Build the Go Server

```bash
cd server-go
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o bin/server cmd/server/main.go
```

### 2. Build the React Client

```bash
cd client
npm ci
npm run build
# Output: client/dist/
```

### 3. Deploy Files

Copy to your server:
- `server-go/bin/server` → `/opt/dashboard/server`
- `server-go/config/` → `/opt/dashboard/config/`
- `client/dist/` → `/var/www/dashboard/`

### 4. Configure Systemd Service

Create `/etc/systemd/system/dashboard.service`:

```ini
[Unit]
Description=Dashboard API Server
After=network.target mongodb.service redis.service

[Service]
Type=simple
User=dashboard
WorkingDirectory=/opt/dashboard
ExecStart=/opt/dashboard/server
Restart=always
Environment=DASHBOARD_SERVER_MODE=release
Environment=DASHBOARD_MONGODB_URI=mongodb://localhost:27017
Environment=DASHBOARD_REDIS_ADDR=localhost:6379

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable dashboard
sudo systemctl start dashboard
```

### 5. Configure Caddy (Manual Install)

Install Caddy: https://caddyserver.com/docs/install

Create `/etc/caddy/Caddyfile`:
```caddyfile
your-domain.com {
    root * /var/www/dashboard
    file_server

    handle /api/* {
        reverse_proxy localhost:3001
    }

    handle /health {
        reverse_proxy localhost:3001
    }

    try_files {path} /index.html
    encode gzip
}
```

```bash
sudo systemctl restart caddy
```

---

## Updating

```bash
# Pull latest code
git pull

# Rebuild and restart
docker compose -f docker-compose.prod.yml up -d --build
```

### Database migrations

Database migrations run automatically at server startup via
`database.RunMigrations`. Each migration is tracked in the
`migrations` collection and is idempotent — safe to re-run. In
particular, the first startup after upgrading to a build that
introduced case-insensitive collation will rebuild each affected
collection (copy + drop + rename under the hood). This is normal
and takes a few seconds on a homelab-scale deployment. Back up the
database first if you're worried. See
[`docs/architecture/database.md`](architecture/database.md) for
migration details.

---

## Backup & Restore

### Backup MongoDB

```bash
# Create backup
docker compose -f docker-compose.prod.yml exec mongodb mongodump --out /data/backup

# Copy from container
docker cp $(docker compose -f docker-compose.prod.yml ps -q mongodb):/data/backup ./backup
```

### Restore MongoDB

```bash
# Copy to container
docker cp ./backup $(docker compose -f docker-compose.prod.yml ps -q mongodb):/data/backup

# Restore
docker compose -f docker-compose.prod.yml exec mongodb mongorestore /data/backup
```

---

## Troubleshooting

### Check Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f server
docker compose -f docker-compose.prod.yml logs -f caddy
```

### Health Checks

```bash
# API health
curl http://localhost:3001/health

# Check container health status
docker compose -f docker-compose.prod.yml ps
```

### Certificate Issues

If Caddy fails to obtain certificates:
1. Verify DNS points to your server
2. Check ports 80/443 are open
3. View Caddy logs: `docker compose logs caddy`

### Database Connection Issues

```bash
# Test MongoDB
docker compose -f docker-compose.prod.yml exec mongodb mongosh --eval "db.runCommand('ping')"

# Test Redis
docker compose -f docker-compose.prod.yml exec redis redis-cli ping
```

---

## Security Recommendations

1. **Firewall**: Only expose ports 80, 443 publicly
2. **MongoDB**: Not exposed externally by default (good)
3. **Redis**: Not exposed externally by default (good)
4. **API Key**: Never commit `.env` to version control
5. **Updates**: Regularly update base images for security patches

---

## Resource Requirements

Minimum recommended:
- **CPU**: 2 cores
- **RAM**: 2GB
- **Disk**: 20GB (includes MongoDB data)

For production with multiple users:
- **CPU**: 4+ cores
- **RAM**: 4-8GB
- **Disk**: 50GB+ SSD
