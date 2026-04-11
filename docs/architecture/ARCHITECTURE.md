# TRVE Dashboards — Architecture

This page is the landing point for the architecture doc set. For any
topic larger than a paragraph, see the dedicated sub-document linked
from the index below.

## System overview

TRVE Dashboards is a full-stack application for building, viewing,
and managing real-time data visualization dashboards backed by
multiple external data sources. It includes an AI-assisted component
builder, a smart-device control plane (MQTT, WebSocket), and
real-time streaming via SSE.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        React frontend (5173)                         │
│    Vite · Carbon Design System (g100)· ECharts · React Router        │
├─────────────────────────────────────────────────────────────────────┤
│  Design mode      │  View mode           │  Manage mode              │
│  - Connections    │  - Dashboard viewer  │  - Users                  │
│  - Components     │  - Real-time data    │  - Settings               │
│  - Dashboards     │  - Fit modes         │  - Devices + Device types │
│  - AI Builder     │  - Fullscreen        │                           │
└─────────────────────────────────────────────────────────────────────┘
                             │
                             │ REST · SSE · WebSocket
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Go backend (port 3001)                          │
│               Gin · Eclipse Paho (MQTT) · Anthropic SDK              │
├─────────────────────────────────────────────────────────────────────┤
│  Handlers ──▶ Services ──▶ Repositories  ──▶  MongoDB 7              │
│                │                                                     │
│                ├──▶ Datasource adapters ──▶  SQL · REST · CSV        │
│                │     (registry-based)         MQTT · WebSocket · TCP │
│                │                               UDP · Prometheus      │
│                │                               EdgeLake · ts-store   │
│                │                               Frigate NVR           │
│                │                                                     │
│                └──▶ Streaming engine    ──▶  SSE fan-out             │
│                      (ring buffer,              to browser           │
│                       retained-state cache,     subscribers          │
│                       aggregators)                                   │
└─────────────────────────────────────────────────────────────────────┘
```

## Technology stack

This is the **one place** current version numbers live. The rest of
the doc set should reference this table rather than restating
versions inline.

### Frontend

| Technology         | Version | Purpose                                 |
| ------------------ | ------- | --------------------------------------- |
| React              | 19      | UI framework                            |
| Vite               | 7       | Build tool + dev server                 |
| React Router       | 7       | Client-side routing                     |
| Carbon Design Sys. | 11      | UI components (g100 dark theme)         |
| ECharts            | 6       | Data visualization                      |
| SCSS               | -       | Styling with Carbon tokens              |

### Backend

| Technology          | Version | Purpose                                |
| ------------------- | ------- | -------------------------------------- |
| Go                  | 1.24    | Primary language                       |
| Gin                 | 1.x     | HTTP framework                         |
| MongoDB             | 7       | Primary database                       |
| Eclipse Paho Go v2  | -       | MQTT client (`autopaho`)               |
| Anthropic SDK       | -       | AI Builder (Claude)                    |
| Swaggo              | 1.8     | OpenAPI / Swagger generation           |
| Viper               | 1.x     | Configuration management               |

## Document index

Topic-focused sub-docs. Start wherever matches your question.

| Document                                            | What it covers                                                               |
| --------------------------------------------------- | ---------------------------------------------------------------------------- |
| [Data model](data-model.md)                         | Entity schemas (dashboards, charts, connections, users, devices, AI sessions) |
| [Backend architecture](backend.md)                  | Layered architecture, directory layout, startup sequence, services           |
| [Frontend architecture](frontend.md)                | Vite app, DynamicComponentLoader, StreamConnectionManager, control renderer   |
| [Streaming](streaming.md)                           | SSE, MQTT stream, retained-state cache, ring buffer, aggregators             |
| [Connections](connections.md)                       | Connection registry and per-type adapters                                    |
| [Database](database.md)                             | Collations, migrations, indexing strategy, secret masking                    |
| [API reference](api-reference.md)                   | Full endpoint tables by domain                                               |
| [Grid system](grid-system.md)                       | 32px cells, 12 columns, fit modes, layout-dimension presets                  |
| [AI Chart Editor](AI_CHART_EDITOR_ARCHITECTURE.md)  | AI Builder session lifecycle, tools, system prompt                           |

## Application modes

The UI is divided into three modes. Mode switching is a left-sidebar
toggle; users always see the mode matching their current route.

**Design mode** (`/design/*`) is for authoring: defining connections
to external data, building components (charts, controls, displays),
composing dashboards from components, and managing layout presets.
The AI Builder lives inside this mode as an alternate path to
component creation.

**View mode** (`/view/*`) is the runtime for end users: dashboards
render with live data, auto-refresh based on their settings, and
support fullscreen for kiosk-style displays. The four fit modes
(Actual / Fit to window / Fit to width / Stretch to fill) live here.

**Manage mode** (`/manage/*`) is for system administration: user
management with role-based access (Admin / Designer / Support),
global settings, smart device management, and device-type
definitions.

## Related

- [Deployment](../DEPLOYMENT.md) — production deployment, env vars,
  Docker Compose
- [Test plan](../TEST_PLAN.md)
- [Third-party licenses](../../THIRD_PARTY_LICENSES.md)
- Project `CLAUDE.md` — conventions for contributors
- Swagger UI at `http://<host>:3001/swagger/index.html`
