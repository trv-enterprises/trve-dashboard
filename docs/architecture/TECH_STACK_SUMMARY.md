# Dashboard Refactoring - Technology Stack Summary

## Final Technology Stack

### **Backend: Go**
```
Language:     Go 1.21+
Framework:    Gin (HTTP server)
Database:     MongoDB (mongo-go-driver)
Job Queue:    Asynq + Redis
WebSocket:    gorilla/websocket
OpenAPI:      Swaggo (Swagger generation)
Validation:   go-playground/validator
Config:       Viper (YAML + ENV override)
```

### **Frontend: React** (Unchanged)
```
Framework:    React 18 + Vite 5
UI Library:   Carbon Design System (g100 dark theme)
Charts:       ECharts + echarts-for-react
Routing:      React Router 6
```

### **Infrastructure**
```
Development:
  - Go server (single binary)
  - MongoDB (local or Docker)
  - Redis (local or Docker)

Production:
  - Go server (containerized)
  - MongoDB Atlas (managed)
  - Redis (managed or self-hosted)
```

---

## Key Architecture Decisions

### 1. **Go Instead of Node.js**
**Why:**
- Better performance (2-10x faster for validation/CPU tasks)
- Strong typing catches errors at compile time
- Native concurrency (goroutines) for WebSocket/tasks
- Single binary deployment (no dependencies)
- Better long-term maintainability

**Trade-offs:**
- Need to migrate existing Node.js server
- Team needs Go expertise

**Decision:** ✅ **Use Go** - Benefits outweigh migration cost

---

### 2. **MongoDB Instead of SQL**
**Why:**
- Document structure matches our data naturally
- Schema flexibility (varying metadata/configs)
- Embedded documents (no joins needed)
- Excellent for versioning (store entire history)
- Fast read performance for dashboards
- Native JSON support

**Trade-offs:**
- No ACID transactions across collections (not needed for our use case)
- Different query language

**Decision:** ✅ **Use MongoDB** - Perfect fit for document-heavy application

---

### 3. **No ORM (Direct MongoDB Driver)**
**Why:**
- MongoDB driver is simple and type-safe
- No ORM abstraction overhead
- Full control over queries
- Better performance
- Fewer dependencies

**Trade-offs:**
- Write more boilerplate code
- No automatic migrations (write manual scripts)

**Decision:** ✅ **Use mongo-go-driver directly** - MongoDB is simple enough without ORM

---

### 4. **Asynq Instead of Temporal**
**Why:**
- Much simpler infrastructure (just Redis)
- Easy to deploy and operate
- Built-in retry logic and persistence
- Web UI included for monitoring
- Good enough for our workflows
- Can migrate to Temporal later if needed

**Workflows Handled:**
- AI chart generation with retries
- Component validation pipeline
- Datasource health checks
- Dashboard update notifications

**Trade-offs:**
- Less sophisticated than Temporal
- No long-running workflow support (hours/days)
- No human-in-the-loop approvals (can add manually)

**Decision:** ✅ **Use Asynq** - Start simple, migrate to Temporal only if needed

---

### 5. **YAML Config + ENV Override**
**Why:**
- Sensible defaults in version control
- Environment-specific configs (dev/prod/test)
- Secrets via environment variables
- 12-factor app compliant
- Docker/Kubernetes friendly

**Configuration Layers:**
1. `config/config.yaml` - Base defaults
2. `config/config.{env}.yaml` - Environment overrides
3. `DASHBOARD_*` ENV vars - Runtime secrets

**Decision:** ✅ **YAML + ENV with Viper** - Industry standard approach

---

## Data Storage Strategy

### Collections

```
MongoDB Collections:
├─ layouts          - Grid layouts with embedded panels
├─ datasources      - API/WebSocket/File configs
├─ components       - Charts with embedded version history
├─ dashboards       - Dashboard definitions with embedded panel mappings
└─ chat_sessions    - D-Agent conversation history
```

### Versioning Strategy

Components store full version history as embedded array:
```json
{
  "current_version": "1.2.0",
  "versions": [
    {"version": "1.0.0", "code": "...", "created_at": "..."},
    {"version": "1.1.0", "code": "...", "created_at": "..."}
  ]
}
```

**Benefits:**
- Single query gets component + full history
- Easy rollback (swap current_version)
- No separate version tables

---

## Async Task Processing

### Asynq Task Types

1. **Chart Generation** (`chart:generation`)
   - Priority: Critical
   - Max Retries: 3
   - Timeout: 5 minutes

2. **Component Validation** (`component:validation`)
   - Priority: Default
   - Max Retries: 1
   - Timeout: 1 minute

3. **Datasource Health** (`datasource:health`)
   - Priority: Low
   - Max Retries: 3
   - Timeout: 30 seconds

4. **Dashboard Updates** (`dashboard:update`)
   - Priority: Default
   - Max Retries: 2
   - Timeout: 1 minute

### Task Flow Example

```
User Request → API → Enqueue Task (Asynq) → Redis
                                           ↓
                                     Worker Pool
                                           ↓
                                  [Task Handler]
                                     1. Call LLM
                                     2. Validate
                                     3. Save to MongoDB
                                     4. Notify via WebSocket
```

---

## API Documentation

### OpenAPI/Swagger with Swaggo

**Generation:**
```go
// @Summary Create layout
// @Description Create a new dashboard layout
// @Tags Layouts
// @Accept json
// @Produce json
// @Param layout body models.Layout true "Layout object"
// @Success 201 {object} models.Layout
// @Failure 400 {object} ErrorResponse
// @Router /api/layouts [post]
func CreateLayout(c *gin.Context) {
    // ...
}
```

**Generate spec:**
```bash
swag init -g main.go
```

**Swagger UI:**
```
http://localhost:3001/swagger/
```

**Benefits:**
- Auto-generated documentation
- Interactive API testing
- Client code generation (TypeScript, Python, etc.)
- Request/response validation

---

## Deployment

### Development

```bash
# Start MongoDB
docker run -d -p 27017:27017 mongo:7

# Start Redis
docker run -d -p 6379:6379 redis:7-alpine

# Run server
cd server && go run main.go

# Run worker (separate process)
cd server && go run cmd/worker/main.go

# Run client
cd client && npm run dev
```

### Production (Docker Compose)

```yaml
services:
  server:
    image: dashboard-server:latest
    environment:
      - ENV=production
      - DASHBOARD_MONGODB_URI=mongodb://mongo:27017
      - DASHBOARD_REDIS_ADDR=redis:6379
      - DASHBOARD_LLM_API_KEY=${LLM_API_KEY}
    ports:
      - "3001:3001"

  worker:
    image: dashboard-server:latest
    command: /app/worker
    environment:
      - ENV=production
      - DASHBOARD_MONGODB_URI=mongodb://mongo:27017
      - DASHBOARD_REDIS_ADDR=redis:6379

  mongo:
    image: mongo:7
    volumes:
      - mongo-data:/data/db

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
```

### Kubernetes

```yaml
# ConfigMap for base config
apiVersion: v1
kind: ConfigMap
metadata:
  name: dashboard-config
data:
  config.production.yaml: |
    server:
      port: 3001

---
# Secret for sensitive data
apiVersion: v1
kind: Secret
metadata:
  name: dashboard-secrets
stringData:
  DASHBOARD_LLM_API_KEY: sk-ant-...
  DASHBOARD_MONGODB_URI: mongodb://...
```

---

## Performance Characteristics

### Expected Performance

**API Endpoints:**
- List layouts/dashboards: < 50ms
- Get single resource: < 20ms
- Create/Update: < 100ms
- AI chart generation: 10-30 seconds (async)

**WebSocket:**
- Connection capacity: 10,000+ concurrent
- Message latency: < 10ms

**Task Processing:**
- Throughput: 100-1000 tasks/second
- Concurrent workers: Configurable (default: 10)

**Database:**
- Read queries: < 10ms (with indexes)
- Write operations: < 20ms
- Bulk operations: 1000+ docs/second

---

## Monitoring & Observability

### Asynq Web UI
```
http://localhost:8080/asynq
```
- Task queue status
- Failed tasks with errors
- Retry history
- Performance metrics

### Swagger UI
```
http://localhost:3001/swagger/
```
- API documentation
- Interactive testing
- Request/response schemas

### Logging
- Structured JSON logs
- Configurable levels (debug, info, warn, error)
- Output to stdout or file

### Future: Add Observability Stack
- Prometheus (metrics)
- Grafana (dashboards)
- Jaeger (distributed tracing)
- ELK Stack (log aggregation)

---

## Security

### Component Validation
- Syntax validation (Go AST parser)
- Security scanning (dangerous patterns)
- Blocked patterns: eval, innerHTML, script tags, external imports
- Allowed: React hooks, ECharts, Carbon components

### Authentication (Future)
- JWT tokens
- Session management
- Role-based access control

### Data Security
- MongoDB encryption at rest
- TLS for MongoDB connections
- Environment variables for secrets
- No secrets in version control

---

## Migration Path

### Phase 1: New Go Server (Parallel)
- Build Go server alongside Node.js
- Implement new features (Layouts, Dashboards, D-Agent)
- Keep existing Component API in Node.js

### Phase 2: Gradual Migration
- Port existing Component API to Go
- Migrate data from files to MongoDB
- Run both servers simultaneously
- Update client to use Go server

### Phase 3: Sunset Node.js
- Verify all features working in Go
- Switch traffic to Go server
- Decommission Node.js server

---

## Success Metrics

### Performance
- [ ] API response times < 100ms (p95)
- [ ] AI chart generation < 30 seconds
- [ ] Support 10,000+ WebSocket connections
- [ ] Task processing rate > 100/sec

### Reliability
- [ ] 99.9% uptime
- [ ] Zero data loss
- [ ] Automatic task retries working
- [ ] Graceful degradation on errors

### Developer Experience
- [ ] Complete Swagger documentation
- [ ] Docker Compose for local dev
- [ ] One-command setup
- [ ] Clear error messages

### Security
- [ ] All components pass validation
- [ ] No dangerous patterns in production
- [ ] Secrets never in logs
- [ ] Audit log for sensitive operations

---

## Documentation

### Core Documents
1. **REFACTOR_PLAN.md** - Complete refactoring plan with all phases
2. **ASYNQ_TASKS.md** - Async task implementation details
3. **TECH_STACK_SUMMARY.md** - This document
4. **ARCHITECTURE.md** - System architecture diagrams (existing)
5. **CLAUDE.md** - Project instructions for AI (existing)

### API Documentation
- **Swagger UI** - Auto-generated from code annotations
- **OpenAPI Spec** - `swagger.json` and `swagger.yaml`

---

## Next Steps

1. ✅ **Planning Complete** - Architecture and tech stack finalized
2. ⏭️ **Phase 1: Foundation** - Setup Go server, MongoDB, Redis, config system
3. ⏭️ **Phase 2-6: Core Features** - Implement Layouts, Datasources, Charts, Dashboards, View Mode
4. ⏭️ **Phase 7: D-Agent & Security** - AI generation, validation, versioning
5. ⏭️ **Phase 8: Manage Mode** - Admin interface

**Ready to begin implementation!**

---

**Document Version**: 1.0
**Last Updated**: 2025-11-20
**Status**: Finalized - Ready for Implementation
