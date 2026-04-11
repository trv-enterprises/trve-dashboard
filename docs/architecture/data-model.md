# Data model

The dashboard persists everything it knows in MongoDB. This page
describes the shape of each core entity. For collection-level
concerns (indexes, collations, migrations), see
[database.md](database.md).

All entities use UUID string IDs assigned at create time; none rely
on MongoDB's `ObjectId`. Most entities carry `created` and `updated`
timestamps; the ones that don't are explicitly noted.

## Dashboard

A dashboard is a named grid layout plus a set of panels, each panel
placing either a component (chart / control / display) or a native
text label onto grid cells.

```json
{
  "id": "9f8b...e4",
  "name": "Home Kiosk",
  "description": "Main living-room kiosk dashboard",
  "tags": ["home", "kiosk"],
  "panels": [
    {
      "id": "panel-1",
      "x": 0, "y": 0, "w": 6, "h": 8,
      "chart_id": "b2c9...c0"
    },
    {
      "id": "panel-2",
      "x": 6, "y": 0, "w": 6, "h": 4,
      "text_config": {
        "content": "Welcome home",
        "display_content": "title",
        "size": 48,
        "align": "center"
      }
    }
  ],
  "thumbnail": "data:image/png;base64,...",
  "settings": {
    "theme": "dark",
    "refresh_interval": 30,
    "title_scale": 100,
    "is_public": false,
    "allow_export": true,
    "layout_dimension": "default-12col"
  },
  "created": "2026-04-01T12:00:00Z",
  "updated": "2026-04-11T09:14:00Z"
}
```

Panels without `chart_id` and without `text_config` are placeholder
empty panels (common during authoring). The `thumbnail` field is a
captured preview used on list pages. `settings.layout_dimension`
names a preset from the `layouts` collection.

- **Collection**: `dashboards`
- **Name**: case-insensitive unique
- **Grid geometry**: `{x, y, w, h}` are in grid cells, not pixels.
  See [grid-system.md](grid-system.md).

## Chart (component)

Charts, controls, and displays are all stored in the same `charts`
collection with a `component_type` discriminator. This is for
historical reasons — the frontend now consistently calls them
"components" in the UI.

```json
{
  "id": "b2c9...c0",
  "version": 3,
  "status": "final",
  "component_type": "chart",
  "name": "Temperature by Location",
  "title": "Temperature by Location",
  "description": "Last hour, binned per minute",
  "chart_type": "line",
  "tags": ["temperature", "sensors"],
  "datasource_id": "a1e4...7b",
  "query_config": {
    "raw": "since:1h",
    "type": "stream_filter",
    "params": { "limit": 500 }
  },
  "data_mapping": {
    "x_axis": "timestamp",
    "y_axis": ["temperature"],
    "series": "location",
    "time_bucket": {
      "interval": 60,
      "function": "avg",
      "value_cols": ["temperature"],
      "timestamp_col": "timestamp"
    }
  },
  "component_code": "const Component = () => { ... }",
  "use_custom_code": false,
  "options": { "legend": { "show": true } },
  "created": "2026-03-12T08:00:00Z",
  "updated": "2026-04-05T16:22:00Z"
}
```

### `component_type`

| Value     | Meaning                                               |
| --------- | ----------------------------------------------------- |
| `chart`   | ECharts visualization (bar, line, gauge, table, ...)  |
| `control` | Interactive control (button, toggle, dimmer, ...)     |
| `display` | Non-chart visual (Frigate camera, weather, alerts)    |

Each component type uses different sub-documents:

- Charts use `chart_type`, `query_config`, `data_mapping`, `options`,
  and optionally `component_code` + `use_custom_code` for the
  dynamic React code path.
- Controls carry a `control_config` sub-document with
  `control_type`, `target`, `ui_config`, optional `device_type_id`.
- Displays carry a `display_config` sub-document with
  `display_type` and per-type fields (Frigate connection, weather
  topic prefix, alerts severity, etc.).

See [frontend.md](frontend.md) for how each type is rendered and
[connections.md](connections.md) for how `datasource_id` is resolved.

### Versioning

Charts support version history: editing an existing chart creates a
new version with an incremented `version` number but the same `id`.
The most recent `status: "final"` version is what dashboards render;
`status: "draft"` is a work-in-progress save that hasn't been
promoted.

- **Collection**: `charts`
- **Uniqueness**: `(id, version)` is unique. Multiple versions share
  a logical `id`.
- **Name**: not a unique index in the database because the same name
  is shared across versions. The `ChartService` enforces
  case-insensitive name uniqueness in application code by querying
  for an existing chart with the same name whose logical `id`
  differs.

## Datasource (connection)

A datasource is an external data or device endpoint. Connection is
the user-facing name; `datasource` is the internal name and the
MongoDB collection name.

```json
{
  "_id": "67ff...3a",
  "name": "Home MQTT Broker",
  "description": "Mosquitto on services-lxc",
  "type": "mqtt",
  "tags": ["home", "mqtt"],
  "config": {
    "mqtt": {
      "host": "192.168.1.216",
      "port": 1883,
      "client_id": "dashboard",
      "username": "dashboard",
      "password": "********",
      "clean_session": true,
      "keepalive": 60
    }
  },
  "mask_secrets": true,
  "health": {
    "status": "healthy",
    "last_check": "2026-04-11T09:15:23Z",
    "last_success": "2026-04-11T09:15:23Z",
    "response_time": 42
  },
  "created_at": "2026-01-15T10:00:00Z",
  "updated_at": "2026-04-10T18:00:00Z"
}
```

- `type` selects the config sub-document (`config.mqtt`, `config.sql`,
  `config.frigate`, ...)
- `mask_secrets: true` means secret fields are replaced with
  `"********"` on API responses. The update path resolves masked
  values back to the stored real values via `preserveSecrets`.
- `health` is maintained by a background sweep; the list-page status
  indicator reads from it.
- `_id` is a MongoDB `ObjectId` here (not a UUID) — datasources
  predate the convention.

See [connections.md](connections.md) for the per-type `config`
fields.

## AI session

Short-lived state for an AI Builder conversation. TTL-expired by
MongoDB.

```json
{
  "id": "sess-7f...",
  "chart_id": "b2c9...c0",
  "status": "active",
  "context": { "panel_id": "panel-1", "dashboard_id": "9f8b...e4" },
  "messages": [
    { "role": "user", "content": "Show me temp by location" },
    { "role": "assistant", "content": "..." }
  ],
  "draft_chart": { "... chart being built ..." },
  "created_at": "2026-04-11T09:00:00Z",
  "expires_at": "2026-04-11T10:00:00Z"
}
```

- **Collection**: `ai_sessions`
- **TTL**: `expires_at` field indexed with `ExpireAfterSeconds: 0`,
  so MongoDB sweeps expired sessions automatically.
- `status` transitions: `active → saved | cancelled`.

## Device and device type

Devices are instances of device types. Device types carry the
command schemas and default UI bindings; devices reference a type
and bind it to a specific target (MQTT topic, WebSocket endpoint,
etc.).

```json
// device_type
{
  "id": "zigbee-dimmer",
  "name": "Zigbee Dimmer",
  "category": "lighting",
  "protocol": "mqtt",
  "is_built_in": true,
  "supported_types": ["dimmer", "toggle", "slider"],
  "commands": {
    "dimmer": { "template": { "brightness": "{{value}}" } },
    "toggle": { "template": { "state": "{{value}}" }, "value_map": { "true": "ON", "false": "OFF" } }
  },
  "state_query": { "template": { "get": "state" }, "interval_ms": 5000 },
  "response": { "success_path": "$.success", "state_path": "$.brightness" }
}
```

```json
// device
{
  "id": "...",
  "device_type_id": "zigbee-dimmer",
  "connection_id": "67ff...3a",
  "name": "Kitchen lights",
  "room": "Kitchen",
  "target": "zigbee2mqtt/kitchen/set",
  "enabled": true
}
```

- **Collections**: `devices`, `device_types`
- **Name**: case-insensitive unique on both collections
- The `capabilities` metadata on device types (`canWrite`, `canRead`,
  etc.) is used to filter which controls are compatible

## User

```json
{
  "id": "u-...",
  "guid": "admin-a1b2c3",
  "name": "Admin",
  "active": true,
  "role": "admin",
  "created_at": "2026-01-01T00:00:00Z"
}
```

- **Collection**: `users`
- **`guid`**: opaque string used as the value of the `X-User-ID`
  header for auth. Unique across users.
- **`name`**: case-insensitive unique
- **`role`**: `admin`, `designer`, `support` (matches the pseudo
  users seeded on first startup)

## Layout (preset)

```json
{
  "id": "default-12col",
  "name": "Default 12-column",
  "cols": 12,
  "rows": 24,
  "cell_size": 32,
  "gap": 4
}
```

Layout presets are referenced from dashboards via
`dashboard.settings.layout_dimension`. Admins manage the preset
library through Manage mode.

## App config and settings

`app_config` holds runtime configuration scoped to either
`system` (global) or a specific `user_id`. User-scoped records are
how per-user preferences like `dashboard_fit_mode` are stored.
`settings` is for admin-surfaced configuration items displayed in
Manage mode (default layout preset, tile font size, etc.).

Both collections use programmatic keys, not human names, so neither
gets case-insensitive collation.

## Control schemas

`control_schemas` holds reusable command schemas that can be shared
across device types. Each schema defines `commands`, `state_query`,
and `response` fields that device types can inherit. Useful when
many devices speak the same wire protocol (e.g. JSON-RPC switches).

## Related docs

- [Database](database.md) — indexes, collations, secret masking,
  migrations
- [Connections](connections.md) — per-type `config` sub-documents
- [Frontend architecture](frontend.md) — how components consume these
  shapes at render time
- [API reference](api-reference.md) — endpoint tables for CRUD
