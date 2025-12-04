# AI Builder Integration Plan

## Implementation Status

**Last Updated**: 2025-12-04
**Current Phase**: 2 - AI Session API (Backend) - COMPLETE
**Next Phase**: 3 - AI Agent Core (Backend)

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Chart Versioning (Backend) | ✅ Complete |
| 2 | AI Session API (Backend) | ✅ Complete |
| 3 | AI Agent Core (Backend) | ⏳ Pending |
| 4 | Frontend - Delete Dialogs | ⏳ Pending |
| 5 | Frontend Entry Points | ⏳ Pending |
| 6 | AIBuilderModal Component | ⏳ Pending |
| 7 | AIBuilderPage Component | ⏳ Pending |
| 8 | Polish & Testing | ⏳ Pending |

### Phase 1 Checklist (COMPLETE)
- [x] Update Chart model with `version` and `status` fields
- [x] Change MongoDB primary key to composite `(id, version)`
- [x] Add indexes for efficient latest-version queries
- [x] Update chart repository with versioning methods
- [x] Update chart service and handlers for versioning
- [x] Migrate existing charts to v1 final
- [ ] Update frontend to handle versioned responses (deferred - not blocking)

### Phase 2 Checklist (COMPLETE)
- [x] Create AISession model and repository (Redis-based with 24h TTL)
- [x] Create AI session endpoints (create, get, messages, events, save, cancel)
- [x] Add SSE infrastructure for event streaming
- [x] Implement session-draft relationship
- [x] Add chart-to-session mapping for quick lookups
- [x] Validate chart naming on save (reject "Untitled" prefix)
- [x] Broadcast events to SSE clients on message/chart updates

### Phase 2 New API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/sessions` | Create new AI session (creates draft chart) |
| GET | `/api/ai/sessions/:id` | Get session with current chart state |
| POST | `/api/ai/sessions/:id/messages` | Send user message |
| GET | `/api/ai/sessions/:id/events` | SSE stream for real-time updates |
| POST | `/api/ai/sessions/:id/save` | Publish draft as final (requires proper name) |
| DELETE | `/api/ai/sessions/:id` | Cancel session and delete draft |

### Phase 2 SSE Event Types
- `connected` - Initial connection established
- `message` - New message added to conversation
- `chart_update` - Chart was modified
- `status` - Session status changed
- `thinking` - AI is processing
- `streaming` - Partial text content during streaming
- `error` - Error occurred
- `ping` - Keep-alive (every 30s)

### New Chart API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/charts/:id/versions` | List all versions of a chart |
| GET | `/api/charts/:id/versions/:version` | Get specific version |
| GET | `/api/charts/:id/version-info` | Get version metadata (for delete dialogs) |
| GET | `/api/charts/:id/draft` | Get draft version (if exists) |
| DELETE | `/api/charts/:id/draft` | Delete draft only |
| DELETE | `/api/charts/:id/versions/:version` | Delete specific version |

---

## Overview

Add AI-assisted chart creation and editing capabilities to the dashboard application. The AI agent runs as a Go backend service, updating charts directly in the database, with the frontend subscribing to changes via Server-Sent Events (SSE).

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                       │
│                                                                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐   │
│  │ ChartsListPage   │  │ ChartsListPage   │  │ DashboardDetailPage      │   │
│  │ Create ▼ Button  │  │ AI Edit Icon     │  │ Panel "Edit ▼" Menu      │   │
│  │ - Create         │  │ (row action)     │  │ - Edit (modal)           │   │
│  │ - Create with AI │  │                  │  │ - Edit with AI (modal)   │   │
│  └────────┬─────────┘  └────────┬─────────┘  └──────────┬───────────────┘   │
│           │                     │                       │                   │
│           └─────────────────────┴───────────────────────┘                   │
│                                 │                                           │
│                                 ▼                                           │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    AIBuilderModal / AIBuilderPage                    │   │
│  │  ┌─────────────────────────────┬────────────────────────────────┐    │   │
│  │  │  Chat Panel (Left)          │  Preview Panel (Right)         │    │   │
│  │  │  - Conversation history     │  - Live chart preview          │    │   │
│  │  │  - User input               │  - Current chart config        │    │   │
│  │  │  - AI responses             │  - Data source info            │    │   │
│  │  │  - Tool suggestion hints    │  - ECharts catalog link        │    │   │
│  │  └─────────────────────────────┴────────────────────────────────┘    │   │
│  │                                                                      │   │
│  │  [Save] [Discard] buttons                                            │   │
│  └────────────────────────────────────────────────────────────────────┬─┘   │
│                                                                       │     │
└───────────────────────────────────────────────────────────────────────┼─────┘
                                                                        │
                         SSE: /api/ai/sessions/:id/events               │
                         POST: /api/ai/sessions/:id/messages            │
                                                                        │
                                                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GO BACKEND (Port 3001)                             │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         AI Session Handler                              │ │
│  │                                                                         │ │
│  │  POST /api/ai/sessions           - Create new AI session                │ │
│  │  GET  /api/ai/sessions/:id       - Get session state                    │ │
│  │  POST /api/ai/sessions/:id/messages - Send user message                 │ │
│  │  GET  /api/ai/sessions/:id/events   - SSE stream for updates            │ │
│  │  DELETE /api/ai/sessions/:id     - End session                          │ │
│  └───────────────────────────────────────────────┬────────────────────────┘ │
│                                                   │                          │
│  ┌────────────────────────────────────────────────▼────────────────────────┐ │
│  │                         AI Agent Service                                 │ │
│  │                                                                          │ │
│  │  - Anthropic API client                                                  │ │
│  │  - System prompt with componentSpec + ECharts knowledge                  │ │
│  │  - Tool definitions for chart editing                                    │ │
│  │  - Session state management (Redis)                                      │ │
│  │  - Chart draft management                                                │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  AI Agent Tools (Direct Go Implementation):                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  update_chart_config   - Update chart type, name, description            │ │
│  │  update_data_mapping   - Set x/y axis, group by, labels, formats        │ │
│  │  update_filters        - Add/remove data filters                         │ │
│  │  update_aggregation    - Set aggregation (first, last, avg, etc.)       │ │
│  │  set_custom_code       - Enable custom code mode with full React/ECharts │ │
│  │  query_datasource      - Test query against data source                  │ │
│  │  preview_data          - Get sample data for preview                     │ │
│  │  list_datasources      - Show available data sources                     │ │
│  │  get_echarts_options   - Get available ECharts configurations           │ │
│  │  suggest_missing_tools - Tell user about ECharts features not supported │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Data Model Changes

### Chart Versioning Model

Charts now use a composite primary key of `(id, version)` with a status field.

```go
// In server-go/internal/models/chart.go

type Chart struct {
    ID            string                 `json:"id" bson:"id"`                   // UUID - same across versions
    Version       int                    `json:"version" bson:"version"`         // Version number (1, 2, 3...)
    Status        string                 `json:"status" bson:"status"`           // "draft" | "final"
    Name          string                 `json:"name" bson:"name" binding:"required"`
    // ... existing fields ...
    AISessionID   string                 `json:"ai_session_id,omitempty" bson:"ai_session_id,omitempty"` // Active AI session (drafts only)
}

// MongoDB composite primary key: { id: 1, version: 1 }
// Index for efficient "latest version" queries: { id: 1, version: -1 }

// Status constants
const (
    ChartStatusDraft = "draft"  // AI work in progress, not visible in dashboards
    ChartStatusFinal = "final"  // Saved/committed version
)
```

### Versioning Rules

**Primary Key**: `(id, version)` - UUID stays same, version increments

**Status Values**:
- `draft`: AI is actively editing. Only ONE draft allowed per chart UUID. Not shown in dashboards.
- `final`: Saved/committed version. Multiple final versions kept for history.

**Latest Version**: `MAX(version)` per chart id (could be draft or final)

**Dashboard References**: Use `chart_id` (UUID only). When rendering, fetch `MAX(version) WHERE status = 'final'`

### Version Lifecycle

| Action | Result |
|--------|--------|
| New chart (AI) | Creates `(new-uuid, v1, draft)` |
| New chart (manual) | Creates `(new-uuid, v1, final)` |
| Edit existing (AI, latest is final) | Creates `(same-uuid, v+1, draft)` |
| Edit existing (AI, latest is draft) | Must delete draft first OR resume that session |
| Edit existing (manual) | Updates current final version in place (no new version) |
| Save AI draft | Changes status from `draft` to `final` |
| Discard AI draft | Deletes that version row |

### Delete Behavior

**Deleting a Draft** (latest version is draft):
- Simple confirmation dialog: "Discard draft? This will revert to the previous saved version."
- Deletes the draft version
- List reverts to previous final version

**Deleting a Final** (latest version is final, has previous versions):
- Choice dialog with radio buttons:
  - ● Delete this version only (v3) - DEFAULT
  - ○ Delete all versions
- "Delete this version" removes that row, list shows previous version
- "Delete all versions" removes all rows with that UUID

**Deleting a Final** (only one version exists):
- Simple confirmation: "Delete chart? This will permanently delete this chart."

### Delete Dialog Examples

```
┌─────────────────────────────────────────────┐
│  Discard draft?                             │
├─────────────────────────────────────────────┤
│  This will discard your draft changes to    │
│  "Temperature Chart" and revert to the      │
│  previous saved version.                    │
│                                             │
│  [Cancel]                    [Discard]      │
└─────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────┐
│  Delete "Temperature Chart"                 │
├─────────────────────────────────────────────┤
│  ● Delete this version only (v3)            │  ← DEFAULT
│    Reverts to previous version (v2)         │
│                                             │
│  ○ Delete all versions                      │
│    Permanently removes this chart           │
│                                             │
│  [Cancel]                    [Delete]       │
└─────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────┐
│  Delete "Temperature Chart"?                │
├─────────────────────────────────────────────┤
│  This will permanently delete this chart.   │
│  This action cannot be undone.              │
│                                             │
│  [Cancel]                    [Delete]       │
└─────────────────────────────────────────────┘
```

### List View Queries

```sql
-- Get latest version of each chart for list view
SELECT * FROM charts c1
WHERE version = (
    SELECT MAX(version) FROM charts c2 WHERE c2.id = c1.id
)

-- Get latest FINAL version for dashboard rendering
SELECT * FROM charts c1
WHERE status = 'final' AND version = (
    SELECT MAX(version) FROM charts c2
    WHERE c2.id = c1.id AND c2.status = 'final'
)
```

### AI Session Model

```go
// In server-go/internal/models/ai_session.go

type AISession struct {
    ID           string                 `json:"id" bson:"_id"`
    ChartID      string                 `json:"chart_id" bson:"chart_id"`           // Chart UUID being edited
    ChartVersion int                    `json:"chart_version" bson:"chart_version"` // Version being edited (always a draft)
    Messages     []AIMessage            `json:"messages" bson:"messages"`
    Status       string                 `json:"status" bson:"status"`               // "active" | "completed" | "cancelled"
    Created      time.Time              `json:"created" bson:"created"`
    Updated      time.Time              `json:"updated" bson:"updated"`
}

type AIMessage struct {
    ID        string    `json:"id" bson:"id"`
    Role      string    `json:"role" bson:"role"`         // "user" | "assistant" | "system"
    Content   string    `json:"content" bson:"content"`
    ToolCalls []ToolCall `json:"tool_calls,omitempty" bson:"tool_calls,omitempty"`
    Timestamp time.Time `json:"timestamp" bson:"timestamp"`
}

type ToolCall struct {
    ID       string `json:"id" bson:"id"`
    Name     string `json:"name" bson:"name"`
    Input    string `json:"input" bson:"input"`     // JSON string
    Output   string `json:"output" bson:"output"`   // JSON string
}
```

## Frontend Components

### 1. UI Entry Points

#### A. ChartsListPage - Dropdown Create Button
```jsx
// Replace single Create button with ComboButton
<ComboButton label="Create" onClick={handleCreate}>
  <MenuItem label="Create" onClick={handleCreate} />
  <MenuItem label="Create with AI" onClick={handleCreateWithAI} renderIcon={WatsonxAi} />
</ComboButton>
```

#### B. ChartsListPage - AI Edit Icon in Actions Column
```jsx
// Add AI icon next to trash can
<TableCell key={cell.id} className="actions-cell">
  <IconButton
    kind="ghost"
    label="Edit with AI"
    onClick={(e) => handleAIEdit(e, chart)}
    size="sm"
  >
    <WatsonxAi size={16} />
  </IconButton>
  <IconButton
    kind="ghost"
    label="Delete"
    onClick={(e) => handleDelete(e, chart)}
    size="sm"
  >
    <TrashCan size={16} />
  </IconButton>
</TableCell>
```

#### C. DashboardDetailPage - Panel Edit Menu
```jsx
// Replace single Edit button with dropdown menu
<OverflowMenu size="sm" flipped>
  <OverflowMenuItem itemText="Edit" onClick={() => openChartEditor(panel.id)} />
  <OverflowMenuItem itemText="Edit with AI" onClick={() => openAIEditor(panel.id)} />
</OverflowMenu>
```

### 2. AIBuilderModal Component

New component for the AI chat interface. Used as:
- **Modal** when launched from DashboardDetailPage
- **Full page** when launched from ChartsListPage or ChartDetailPage

```jsx
// client/src/components/AIBuilderModal.jsx

function AIBuilderModal({
  isOpen,
  onClose,
  chartId,           // Existing chart ID (edit mode) or null (create mode)
  panelId,           // Panel ID if from dashboard editor
  onSave             // Callback when user saves
}) {
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chartPreview, setChartPreview] = useState(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // SSE connection for real-time updates
  useEffect(() => {
    if (!session?.id) return;

    const eventSource = new EventSource(`/api/ai/sessions/${session.id}/events`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'message') {
        setMessages(prev => [...prev, data.message]);
      } else if (data.type === 'chart_update') {
        setChartPreview(data.chart);
      } else if (data.type === 'tool_suggestion') {
        // Show hint about missing tools
      }
    };

    return () => eventSource.close();
  }, [session?.id]);

  // Start AI session
  const startSession = async () => {
    const response = await apiClient.createAISession({ chart_id: chartId });
    setSession(response);
    setChartPreview(response.draft_chart);
  };

  // Send message to AI
  const sendMessage = async () => {
    await apiClient.sendAIMessage(session.id, { content: input });
    setInput('');
  };

  // Save final chart
  const handleSave = async () => {
    // The draft chart is already saved in the backend
    // Just need to promote it from draft to published
    await apiClient.publishAIDraft(session.id);
    onSave?.(chartPreview);
    onClose();
  };

  return (
    <Modal open={isOpen} onClose={onClose} size="lg">
      <div className="ai-builder">
        {/* Left: Chat Panel */}
        <div className="chat-panel">
          <div className="messages">
            {messages.map(msg => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
          </div>
          <div className="input-area">
            <TextArea value={input} onChange={e => setInput(e.target.value)} />
            <Button onClick={sendMessage} disabled={loading}>Send</Button>
          </div>
          <div className="echarts-link">
            <Link href="https://echarts.apache.org/examples/en/index.html" target="_blank">
              Browse ECharts Examples
            </Link>
          </div>
        </div>

        {/* Right: Preview Panel */}
        <div className="preview-panel">
          <h4>Live Preview</h4>
          {chartPreview && (
            <DynamicComponentLoader chart={chartPreview} />
          )}
          <div className="chart-config">
            {/* Read-only view of current config */}
          </div>
        </div>
      </div>

      <ModalFooter>
        <Button kind="secondary" onClick={onClose}>Discard</Button>
        <Button kind="primary" onClick={handleSave}>Save Chart</Button>
      </ModalFooter>
    </Modal>
  );
}
```

### 3. AIBuilderPage Component

Full-page version for standalone chart creation/editing:

```jsx
// client/src/pages/AIBuilderPage.jsx

function AIBuilderPage() {
  const { chartId } = useParams(); // 'new' or existing chart ID
  const navigate = useNavigate();

  // Same logic as modal but full page layout
  // Left side: Chat (similar to existing ChartEditor read-only)
  // Right side: Preview with live chart

  const handleSave = () => {
    navigate('/design/charts');
  };

  const handleDiscard = () => {
    navigate('/design/charts');
  };

  return (
    <div className="ai-builder-page">
      {/* Similar layout to modal but full page */}
    </div>
  );
}
```

## Backend Implementation

### 1. AI Session Endpoints

```go
// server-go/internal/handlers/ai_handler.go

// CreateAISession - POST /api/ai/sessions
// Creates a draft chart and AI session
func (h *AIHandler) CreateAISession(c *gin.Context) {
    var req CreateAISessionRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }

    session, err := h.service.CreateSession(c, req.ChartID)
    if err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }

    c.JSON(200, session)
}

// SendMessage - POST /api/ai/sessions/:id/messages
// Sends user message to AI agent
func (h *AIHandler) SendMessage(c *gin.Context) {
    sessionID := c.Param("id")
    var req SendMessageRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }

    // This triggers the AI agent to process the message
    // Agent will update the draft chart and send SSE events
    err := h.service.ProcessMessage(c, sessionID, req.Content)
    if err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }

    c.JSON(200, gin.H{"status": "processing"})
}

// StreamEvents - GET /api/ai/sessions/:id/events
// SSE endpoint for real-time updates
func (h *AIHandler) StreamEvents(c *gin.Context) {
    sessionID := c.Param("id")

    c.Header("Content-Type", "text/event-stream")
    c.Header("Cache-Control", "no-cache")
    c.Header("Connection", "keep-alive")

    // Subscribe to session events via Redis pub/sub
    events := h.service.SubscribeToSession(c, sessionID)

    for event := range events {
        c.SSEvent("message", event)
        c.Writer.Flush()
    }
}

// PublishDraft - POST /api/ai/sessions/:id/publish
// Promotes draft chart to published status
func (h *AIHandler) PublishDraft(c *gin.Context) {
    sessionID := c.Param("id")

    chart, err := h.service.PublishDraft(c, sessionID)
    if err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }

    c.JSON(200, chart)
}
```

### 2. AI Agent Service

```go
// server-go/internal/service/ai_agent_service.go

type AIAgentService struct {
    anthropic     *anthropic.Client
    chartService  *ChartService
    dsService     *DatasourceService
    sessionRepo   *AISessionRepository
    redis         *redis.Client
}

func (s *AIAgentService) CreateSession(ctx context.Context, chartID string) (*AISession, error) {
    var draftChart *Chart
    var chartUUID string
    var draftVersion int

    if chartID != "" {
        // Editing existing chart
        // First check if there's already a draft for this chart
        existingDraft, _ := s.chartService.GetDraftForChart(ctx, chartID)
        if existingDraft != nil {
            return nil, errors.New("chart already has a draft - delete it first or resume that session")
        }

        // Get latest final version
        latest, err := s.chartService.GetLatestFinalChart(ctx, chartID)
        if err != nil {
            return nil, err
        }

        // Create new draft version
        chartUUID = latest.ID
        draftVersion = latest.Version + 1
        draftChart = s.createDraftCopy(latest, draftVersion)
    } else {
        // Creating new chart - create v1 draft
        chartUUID = uuid.New().String()
        draftVersion = 1
        draftChart = &Chart{
            ID:      chartUUID,
            Version: draftVersion,
            Status:  ChartStatusDraft,
            Name:    "Untitled Chart",
        }
    }

    // Save draft chart
    if err := s.chartService.CreateChartVersion(ctx, draftChart); err != nil {
        return nil, err
    }

    // Create session
    session := &AISession{
        ID:           uuid.New().String(),
        ChartID:      chartUUID,
        ChartVersion: draftVersion,
        Status:       "active",
        Messages:     []AIMessage{},
        Created:      time.Now(),
        Updated:      time.Now(),
    }

    if err := s.sessionRepo.Create(ctx, session); err != nil {
        return nil, err
    }

    return session, nil
}

func (s *AIAgentService) ProcessMessage(ctx context.Context, sessionID, content string) error {
    session, err := s.sessionRepo.Get(ctx, sessionID)
    if err != nil {
        return err
    }

    // Add user message
    userMsg := AIMessage{
        ID:        uuid.New().String(),
        Role:      "user",
        Content:   content,
        Timestamp: time.Now(),
    }
    session.Messages = append(session.Messages, userMsg)

    // Broadcast user message via SSE
    s.broadcastEvent(sessionID, "message", userMsg)

    // Call Anthropic API with tools
    response, err := s.callAnthropicWithTools(ctx, session)
    if err != nil {
        return err
    }

    // Process tool calls and responses
    for _, toolUse := range response.ToolCalls {
        result := s.executeTool(ctx, session.ChartID, toolUse)

        // If chart was updated, broadcast the update
        if s.isChartUpdateTool(toolUse.Name) {
            chart, _ := s.chartService.GetChart(ctx, session.ChartID)
            s.broadcastEvent(sessionID, "chart_update", chart)
        }
    }

    // Add assistant message
    assistantMsg := AIMessage{
        ID:        uuid.New().String(),
        Role:      "assistant",
        Content:   response.Content,
        ToolCalls: response.ToolCalls,
        Timestamp: time.Now(),
    }
    session.Messages = append(session.Messages, assistantMsg)

    // Broadcast assistant message
    s.broadcastEvent(sessionID, "message", assistantMsg)

    // Save session
    return s.sessionRepo.Update(ctx, session)
}
```

### 3. AI Tool Definitions

```go
// server-go/internal/ai/tools.go

var AITools = []anthropic.Tool{
    {
        Name:        "update_chart_config",
        Description: "Update basic chart configuration like name, description, and chart type",
        InputSchema: map[string]interface{}{
            "type": "object",
            "properties": map[string]interface{}{
                "name":        {"type": "string", "description": "Chart name"},
                "description": {"type": "string", "description": "Chart description"},
                "chart_type":  {"type": "string", "enum": []string{"bar", "line", "area", "pie", "scatter", "gauge", "heatmap", "radar", "funnel", "custom"}},
            },
        },
    },
    {
        Name:        "update_data_mapping",
        Description: "Configure how data maps to chart axes and series",
        InputSchema: map[string]interface{}{
            "type": "object",
            "properties": map[string]interface{}{
                "datasource_id": {"type": "string", "description": "ID of the data source to use"},
                "x_axis":        {"type": "string", "description": "Column for X axis"},
                "x_axis_label":  {"type": "string", "description": "Label for X axis"},
                "x_axis_format": {"type": "string", "description": "Format for X axis values"},
                "y_axis":        {"type": "array", "items": {"type": "string"}, "description": "Columns for Y axis"},
                "y_axis_label":  {"type": "string", "description": "Label for Y axis"},
                "group_by":      {"type": "string", "description": "Column to group data by"},
            },
        },
    },
    {
        Name:        "update_filters",
        Description: "Add or update data filters",
        InputSchema: map[string]interface{}{
            "type": "object",
            "properties": map[string]interface{}{
                "filters": {
                    "type": "array",
                    "items": map[string]interface{}{
                        "type": "object",
                        "properties": map[string]interface{}{
                            "field": {"type": "string"},
                            "op":    {"type": "string", "enum": []string{"eq", "neq", "gt", "gte", "lt", "lte", "contains", "in"}},
                            "value": {},
                        },
                    },
                },
            },
        },
    },
    {
        Name:        "update_aggregation",
        Description: "Configure data aggregation",
        InputSchema: map[string]interface{}{
            "type": "object",
            "properties": map[string]interface{}{
                "type":    {"type": "string", "enum": []string{"first", "last", "min", "max", "avg", "sum", "count", "limit"}},
                "field":   {"type": "string", "description": "Field to aggregate"},
                "sort_by": {"type": "string", "description": "Field to sort by (for first/last)"},
                "count":   {"type": "integer", "description": "Row count (for limit)"},
            },
        },
    },
    {
        Name:        "set_custom_code",
        Description: "Enable custom code mode and set React component code. Use this for complex charts not supported by standard config.",
        InputSchema: map[string]interface{}{
            "type": "object",
            "properties": map[string]interface{}{
                "component_code": {"type": "string", "description": "Full React component code"},
            },
            "required": []string{"component_code"},
        },
    },
    {
        Name:        "query_datasource",
        Description: "Execute a test query against a data source to see sample data",
        InputSchema: map[string]interface{}{
            "type": "object",
            "properties": map[string]interface{}{
                "datasource_id": {"type": "string"},
                "query":         {"type": "string", "description": "Query to execute"},
                "limit":         {"type": "integer", "default": 10},
            },
            "required": []string{"datasource_id"},
        },
    },
    {
        Name:        "list_datasources",
        Description: "List all available data sources",
        InputSchema: map[string]interface{}{
            "type": "object",
            "properties": map[string]interface{}{},
        },
    },
    {
        Name:        "preview_data",
        Description: "Get sample data for the current chart configuration",
        InputSchema: map[string]interface{}{
            "type": "object",
            "properties": map[string]interface{}{
                "limit": {"type": "integer", "default": 10},
            },
        },
    },
    {
        Name:        "suggest_missing_tools",
        Description: "When user requests an ECharts feature not supported by current tools, explain what would be needed",
        InputSchema: map[string]interface{}{
            "type": "object",
            "properties": map[string]interface{}{
                "feature":    {"type": "string", "description": "The ECharts feature being requested"},
                "suggestion": {"type": "string", "description": "Explanation of what tools/config would need to be added"},
            },
            "required": []string{"feature", "suggestion"},
        },
    },
}
```

### 4. System Prompt

```go
// server-go/internal/ai/system_prompt.go

const SystemPrompt = `You are an AI assistant helping users create and edit data visualization charts for a dashboard application.

## Your Capabilities

1. **Chart Configuration**: You can set chart type (bar, line, area, pie, scatter, gauge, heatmap, radar, funnel) and basic properties.

2. **Data Mapping**: You can configure how data from sources maps to chart axes:
   - X axis: category data (time, labels)
   - Y axis: value data (one or more series)
   - Group by: split into multiple series
   - Axis labels: descriptive labels like "Temperature (°F)"

3. **Data Filters**: You can add filters to show only relevant data.

4. **Aggregation**: You can aggregate data (first, last, min, max, avg, sum, count).

5. **Custom Code**: For complex visualizations, you can write full React components with ECharts.

## Available Data Sources

Use the list_datasources tool to see what data sources are available. Each source has:
- ID: Used to reference the source
- Type: sql, api, csv, socket
- Connection info

## ECharts Reference

Users can browse ECharts examples at: https://echarts.apache.org/examples/en/index.html

When users reference chart types from that catalog:
- If the chart type is supported (bar, line, pie, etc.), configure it directly
- If the chart type requires custom configuration not in our tools, use set_custom_code to write the component
- If a feature truly cannot be implemented, use suggest_missing_tools to explain what would be needed

## Design System

All charts use Carbon Design System g100 (dark theme):
- Background: #161616
- Text: #f4f4f4, #c6c6c6
- Primary: #0f62fe (blue)
- Success: #24a148 (green)
- Warning: #f1c21b (yellow)
- Error: #da1e28 (red)

## Workflow

1. Understand what the user wants to visualize
2. Check available data sources and their schemas
3. Configure the chart step by step, showing previews
4. Refine based on user feedback
5. The user will click "Save" when satisfied

Always be helpful and suggest improvements when appropriate.`
```

## Implementation Phases

### Phase 1: Chart Versioning (Backend)
1. Update Chart model with `version` and `status` fields
2. Change MongoDB primary key to composite `(id, version)`
3. Add indexes for efficient latest-version queries
4. Update chart repository with versioning methods:
   - `GetLatestChart(id)` - latest version (draft or final)
   - `GetLatestFinalChart(id)` - latest final version (for dashboards)
   - `GetDraftForChart(id)` - get draft if exists
   - `CreateChartVersion(chart)` - insert new version
   - `DeleteChartVersion(id, version)` - delete specific version
   - `DeleteAllChartVersions(id)` - delete all versions
5. Update chart service and handlers for versioning
6. Migrate existing charts to v1 final

### Phase 2: AI Session API (Backend)
1. Create AISession model and repository
2. Create AI session endpoints (create, get, delete, publish)
3. Add SSE infrastructure for event streaming
4. Implement session-draft relationship

### Phase 3: AI Agent Core (Backend)
1. Set up Anthropic API client in Go
2. Implement tool execution framework
3. Create chart editing tools (update_chart_config, update_data_mapping, etc.)
4. Implement conversation loop with tool calls
5. Wire up SSE event broadcasting

### Phase 4: Frontend - Delete Dialogs
1. Create versioned delete dialog component
2. Update ChartsListPage with version-aware delete logic
3. Detect draft vs final, single vs multiple versions
4. Show appropriate dialog variant

### Phase 5: Frontend Entry Points
1. Add ComboButton to ChartsListPage with "Create with AI" option
2. Add AI edit icon to charts list row actions
3. Add dropdown menu to DashboardDetailPage panel edit
4. Create routing for AI builder pages

### Phase 6: AIBuilderModal Component
1. Create basic modal layout (chat + preview)
2. Implement SSE subscription for real-time updates
3. Build chat interface with message history
4. Add chart preview using DynamicComponentLoader
5. Implement save/discard actions

### Phase 7: AIBuilderPage Component
1. Create full-page version of AI builder
2. Add read-only chart config display (like existing editor)
3. Wire up routing from ChartsListPage

### Phase 8: Polish & Testing
1. Update componentSpec with latest chart capabilities
2. Add ECharts catalog link and hints
3. Error handling and edge cases
4. Test end-to-end flows
5. Session/draft cleanup cron job

## Open Questions

1. **Session Cleanup**: How long to keep abandoned draft charts and sessions? Auto-cleanup after 24 hours?

2. **Data Preview Limits**: How much sample data to show? Currently planning 10 rows default.

3. **Custom Code Validation**: Should we validate custom component code before saving?

4. **Version History UI**: Future enhancement - add UI to browse/restore previous versions?

## Dependencies

### Go Packages
```go
// Anthropic Go SDK
github.com/anthropics/anthropic-sdk-go

// SSE support (already have gin)
// Redis pub/sub (already have)
```

### Frontend
```jsx
// Carbon icons
import { WatsonxAi } from '@carbon/icons-react';

// Already have: ComboButton, OverflowMenu, Modal, etc.
```

## Routes Summary

### New API Routes
```
POST   /api/ai/sessions              - Create AI session
GET    /api/ai/sessions/:id          - Get session details
POST   /api/ai/sessions/:id/messages - Send user message
GET    /api/ai/sessions/:id/events   - SSE event stream
POST   /api/ai/sessions/:id/publish  - Publish draft chart
DELETE /api/ai/sessions/:id          - Cancel session
```

### New Frontend Routes
```
/design/charts/ai/new              - Create chart with AI (full page)
/design/charts/ai/:chartId         - Edit chart with AI (full page)
```

## File Structure

```
server-go/
├── internal/
│   ├── models/
│   │   └── ai_session.go          # AISession, AIMessage models
│   ├── repository/
│   │   └── ai_session_repository.go
│   ├── service/
│   │   └── ai_agent_service.go    # Core AI agent logic
│   ├── handlers/
│   │   └── ai_handler.go          # HTTP handlers
│   └── ai/
│       ├── tools.go               # Tool definitions
│       ├── tool_executor.go       # Tool execution logic
│       └── system_prompt.go       # System prompt

client/
├── src/
│   ├── components/
│   │   └── AIBuilderModal.jsx     # Modal version
│   ├── pages/
│   │   └── AIBuilderPage.jsx      # Full page version
│   └── api/
│       └── client.js              # Add AI session methods
```
