# Connections

"Connection" is the user-facing name for an external data or device
endpoint the dashboard talks to. Internally the code calls them
`datasources` and the MongoDB collection is named `datasources` for
backwards compatibility. The UI and `/api/connections` endpoints are
the canonical names going forward; `/api/datasources` is kept as a
deprecated alias.

Every connection has:

- A unique case-insensitive `name` (scoped by the MongoDB collation
  described in [database.md](database.md))
- A `type` string that chooses the adapter and config shape
- A per-type `config` sub-document with credentials and routing
  details
- Optional `tags` (see the shared tag filtering in the frontend)
- Capability metadata (`canRead`, `canWrite`, `canStream`) contributed
  by the adapter
- A `health` sub-document maintained by a background check sweep
- `mask_secrets` (default true) controlling whether sensitive fields
  are scrubbed on API responses

## Adapter registry

Adapters live under `internal/datasource/` and are registered at
init time with `internal/registry/`. Each adapter supplies:

- A **type ID** like `"db.postgres"`, `"stream.mqtt"`, `"store.tsstore"`
- A **label** shown in the UI
- A **capability set** (read/write/stream)
- A **config schema** describing each field (name, type, required,
  options, description) — used by the frontend to render the editor
  form without hard-coding per-type UI
- A **factory function** `(config map[string]interface{}) (Adapter, error)`

The adapter interface is deliberately small. An adapter implements
whichever of these fit its capabilities:

- `Query(ctx, query) (*ResultSet, error)` — point-in-time read
- `Stream(ctx) (<-chan Record, error)` — continuous read
- `Write(ctx, payload) error` — command / publish
- `Schema(ctx) (*Schema, error)` — introspection (optional)

The `ResultSet` returned by `Query` is normalized: `{ columns:
[]string, rows: [][]interface{}, metadata: map }`. This is the same
shape across SQL, REST, CSV, Prometheus, EdgeLake, and ts-store, so
the React data layer and chart components don't care which type
they're rendering.

## Built-in types

### `db.postgres` / `db.mysql` / `db.sqlite` / `db.mssql` / `db.oracle`

Generic SQL adapter backed by Go's `database/sql` plus per-dialect
drivers (`lib/pq`, `go-sql-driver/mysql`, `mattn/go-sqlite3`, etc.).

- **Config**: host, port, database, username, password, ssl mode,
  query timeout, connection pool size
- **Capabilities**: read, query. No streaming.
- **Schema discovery**: lists tables and columns via
  `information_schema`.
- **Query type**: raw SQL with parameter substitution (`$1`, `?`,
  etc. per dialect).

The visual SQL query builder (`client/src/components/SQLQueryBuilder.jsx`)
uses the discovered schema to offer column selection, filtering, and
ordering without typing raw SQL.

### `api.rest`

HTTP/JSON REST API adapter.

- **Config**: base URL, method, path template, headers, auth (Bearer,
  Basic, API-Key, or none), retry policy, response extraction path
- **Capabilities**: read. Writes are possible but not currently
  exposed through the UI.
- **Secrets**: bearer tokens and API keys are masked via
  `SanitizeForAPI`.

### `api.prometheus`

Prometheus-specific adapter with a visual PromQL query builder.

- **Config**: Prometheus server URL, optional basic auth
- **Capabilities**: read, schema discovery
- **Schema**: lists metric names and label values via
  `/api/v1/labels` and `/api/v1/label/:name/values`
- **Query type**: both instant and range PromQL queries
- **Editor**: `PrometheusQueryBuilder.jsx` composes PromQL from a
  metric dropdown + label filter chips instead of raw text

### `api.edgelake`

EdgeLake / AnyLog distributed-database adapter.

- **Config**: EdgeLake node URL, credentials
- **Capabilities**: read, schema discovery (cascading: databases →
  tables → columns)
- **Schema endpoints**: `/api/connections/:id/edgelake/databases`,
  `/.../tables`, `/.../schema`
- **Editor**: `EdgeLakeQueryBuilder.jsx` drives a visual builder for
  SELECT queries against discovered tables

### `file.csv`

Local file or HTTP URL CSV reader.

- **Config**: file path or URL, has_header flag, delimiter, optional
  column type hints, watch_changes flag
- **Capabilities**: read
- **Detection**: URL-mode checks the URL with an HTTP HEAD; local
  mode uses `os.Stat`. Both paths are exercised by `Test connection`.

### `stream.websocket`

Generic WebSocket adapter, bidirectional.

- **Config**: URL, optional headers, parser config (JSON path
  extraction or regex), message format, reconnect policy
- **Capabilities**: read, write, stream
- **Parser**: messages can be parsed as JSON (with a `data_path`
  extractor) or regex. Normalized into `Record` maps before
  fan-out.
- **Writes**: `POST /api/controls/:id/execute` sends arbitrary
  bidirectional commands through the WebSocket.

### `stream.tcp` / `stream.udp`

Raw TCP / UDP socket adapters. Same config/capability shape as
WebSocket minus some of the protocol-specific fields.

### `stream.mqtt`

MQTT broker adapter. Eclipse Paho v2 (`autopaho`) for the transport.

- **Config**: broker host + port, client ID, TLS, username, password,
  keepalive, clean session flag, topic discovery scope
- **Capabilities**: read, write, stream
- **Topic discovery**: `GET /api/connections/:id/mqtt/topics` walks
  the broker's tree of topics the client is subscribed to, with a
  sample-mode option that captures a few messages for each topic so
  the UI can preview shapes. `MQTTTopicSelector.jsx` renders this
  as a tree picker.
- **Publishing**: `POST /api/controls/:id/execute` routes through
  the connection's MQTT client to publish a command. Controls use
  this to drive smart devices.
- **Streaming**: handled by `streaming/mqtt_stream.go` with the
  per-topic retained-state cache described in
  [streaming.md](streaming.md).

### `store.tsstore`

ts-store is a Go-based time-series circular-buffer store (separate
project in `simulators/` for local testing).

- **Config**: base URL, API key, store name, ring size
- **Capabilities**: read, stream (via WebSocket push)
- **Schema**: discovered at runtime by sampling recent objects and
  probing JSON structure
- **Query types**: `newest`, `oldest`, `since:DURATION`,
  `range:START:END` (epoch-nanosecond range)
- **Streaming**: `streaming/tsstore_stream.go`, described in
  [streaming.md](streaming.md)
- **Push direction**: ts-store can also push data into the dashboard
  via `GET /api/streams/inbound/:datasourceId` — an inbound WebSocket
  endpoint the ts-store server dials into

### `nvr.frigate`

Frigate NVR (Network Video Recorder) adapter. Frigate is an
open-source video surveillance system with AI-based object
detection.

- **Config**: base URL (HTTP API), go2rtc URL (live stream),
  username, password
- **Capabilities**: read, schema (camera discovery)
- **Proxied endpoints** (all under
  `/api/frigate/:connection_id/...`):
  - `cameras` — list configured cameras
  - `snapshot/:camera` — current still image
  - `events/:camera` — recent detection events
  - `event/:event_id/clip` — MP4 clip (Range-aware for scrubbing)
  - `event/:event_id/snapshot` — detection-event still
  - `reviews` — Frigate review segments (defaults to `reviewed=0`)
  - `review/:review_id/thumbnail` — WebP thumbnail (requires
    `?camera=` query)
  - `reviews/viewed` — mark one or more reviews as reviewed
  - `info` — Frigate system info
  - `live/:camera` — live video proxy via go2rtc

All Frigate requests are proxied through the backend because browsers
can't hit the Frigate host directly (CORS + network segmentation).

## Testing and health

`POST /api/connections/test` takes a full connection config (or an
ID to resolve masked secrets from the DB) and tries to connect,
authenticate, and issue a minimal probe. For SQL it's `SELECT 1`;
for REST it's a `HEAD` on the base URL; for MQTT it's a connect +
subscribe to `$SYS/#` briefly; for ts-store it's a stats call; for
Frigate it's `GET /api/config`; and so on.

The test result includes `{ success, status, message, response_time_ms }`
so the UI can show both a pass/fail and a latency number.

`POST /api/connections/:id/health` runs the same test against a
stored connection, without taking credentials off the wire. The
background health sweep uses this to keep `connection.health`
current for the list page's status indicators.

## Related docs

- [Database](database.md) — where connections and their health data
  are persisted
- [Streaming](streaming.md) — how read-streams become SSE frames
- [API reference](api-reference.md) — full endpoint tables
- [Datasource processing](../datasources/DATASOURCE_PROCESSING.md) —
  post-query filtering, aggregation, and column-mapping pipeline
- [ts-store architecture](../datasources/TSSTORE_ARCHITECTURE.md) —
  deep dive on the ts-store circular-buffer adapter
