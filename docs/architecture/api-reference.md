# API reference

All API routes live under `/api/*` on the Go backend (port 3001 by
default). All routes except `/api/auth/login`, `/health`,
`/api/ws/status`, and `/api/streams/inbound/:datasourceId` require
authentication via the `X-User-ID` header.

For request/response payloads, see the Swagger UI at
`http://<host>:3001/swagger/index.html`. This page is the
endpoint directory — what exists, what it does, where it lives in
the code.

## Auth

| Method | Endpoint           | Description                        |
| ------ | ------------------ | ---------------------------------- |
| POST   | `/api/auth/login`  | Login — returns user profile       |
| GET    | `/api/auth/me`     | Get the currently authenticated user |

## Connections

"Connection" is the user-facing term; `/api/datasources` is a
deprecated alias kept for backwards compatibility. Both route groups
are served by the same handler.

| Method     | Endpoint                                    | Description                               |
| ---------- | ------------------------------------------- | ----------------------------------------- |
| GET        | `/api/connections`                          | List connections (filtered, paginated)    |
| POST       | `/api/connections`                          | Create a connection                       |
| GET        | `/api/connections/:id`                      | Get one                                   |
| PUT        | `/api/connections/:id`                      | Update                                    |
| DELETE     | `/api/connections/:id`                      | Delete                                    |
| POST       | `/api/connections/test`                     | Test a connection (by config or by `id`)  |
| POST       | `/api/connections/:id/health`               | Re-run health check                       |
| POST       | `/api/connections/:id/query`                | Execute a query against the connection    |
| GET        | `/api/connections/:id/schema`               | Get schema (for types that support it)    |
| GET        | `/api/connections/:id/stream`               | SSE data stream (with optional `?topics=`) |
| GET        | `/api/connections/:id/stream/status`        | Stream status                             |
| POST       | `/api/connections/:id/stream/aggregated`    | Subscribe to bucket-aggregated stream     |
| GET        | `/api/connections/aggregators`              | Get aggregator stats                      |
| POST       | `/api/connections/:id/command`              | Execute a command (bidirectional types)   |
| POST       | `/api/connections/:id/discover-devices`     | Discover devices via this connection      |
| GET        | `/api/connections/:id/mqtt/topics`          | MQTT topic discovery                      |
| GET        | `/api/connections/:id/mqtt/sample`          | Sample messages from an MQTT topic        |
| GET        | `/api/connections/:id/prometheus/labels/:label/values` | Prometheus label value lookup |
| GET        | `/api/connections/:id/edgelake/databases`   | EdgeLake database list                    |
| GET        | `/api/connections/:id/edgelake/tables`      | EdgeLake table list                       |
| GET        | `/api/connections/:id/edgelake/schema`      | EdgeLake table schema                     |
| GET        | `/api/connections/streams`                  | List active stream subscriptions          |

## Components (charts, controls, displays)

Component is the umbrella term for chart + control + display. They
all live in the `charts` collection.

| Method | Endpoint                                     | Description                          |
| ------ | -------------------------------------------- | ------------------------------------ |
| GET    | `/api/charts`                                | List components (filter + page)      |
| POST   | `/api/charts`                                | Create component                     |
| GET    | `/api/charts/summaries`                      | Lightweight list for pickers         |
| GET    | `/api/charts/:id`                            | Get the latest version               |
| PUT    | `/api/charts/:id`                            | Update (creates a new version)       |
| DELETE | `/api/charts/:id`                            | Delete all versions                  |
| GET    | `/api/charts/:id/versions`                   | List all versions                    |
| GET    | `/api/charts/:id/versions/:version`          | Get a specific version               |
| DELETE | `/api/charts/:id/versions/:version`          | Delete a specific version            |
| GET    | `/api/charts/:id/version-info`               | Version chain summary                |
| GET    | `/api/charts/:id/draft`                      | Get the draft version (if any)       |
| DELETE | `/api/charts/:id/draft`                      | Delete the draft version             |
| POST   | `/api/controls/:id/execute`                  | Execute a control command            |

## Dashboards

| Method | Endpoint                     | Description                                   |
| ------ | ---------------------------- | --------------------------------------------- |
| GET    | `/api/dashboards`            | List dashboards (filter + page + tags)        |
| POST   | `/api/dashboards`            | Create                                        |
| GET    | `/api/dashboards/:id`        | Get one                                       |
| GET    | `/api/dashboards/:id/details`| Get with expanded layout + referenced charts  |
| PUT    | `/api/dashboards/:id`        | Update                                        |
| DELETE | `/api/dashboards/:id`        | Delete                                        |

## Tags

`GET /api/tags` returns the merged shared tag pool across
connections, components, and dashboards with per-entity-type
usage counts. Powers the `<TagFilter>` component in the list pages
and the autocomplete suggestions in `<TagInput>`.

| Method | Endpoint     | Description                              |
| ------ | ------------ | ---------------------------------------- |
| GET    | `/api/tags`  | Merged tag pool with per-type counts     |

## Devices

| Method | Endpoint                        | Description                          |
| ------ | ------------------------------- | ------------------------------------ |
| GET    | `/api/devices`                  | List devices                         |
| POST   | `/api/devices`                  | Create a device                      |
| POST   | `/api/devices/import`           | Bulk import devices                  |
| GET    | `/api/devices/:id`              | Get one                              |
| PUT    | `/api/devices/:id`              | Update                               |
| DELETE | `/api/devices/:id`              | Delete                               |
| GET    | `/api/device-types`             | List device types                    |
| POST   | `/api/device-types`             | Create a custom device type          |
| GET    | `/api/device-types/categories`  | List device type categories          |
| GET    | `/api/device-types/control-types` | Valid control-type values for types |
| GET    | `/api/device-types/:id`         | Get one                              |
| PUT    | `/api/device-types/:id`         | Update                               |
| DELETE | `/api/device-types/:id`         | Delete                               |

## Frigate NVR

All Frigate routes are proxied through the backend so the browser
doesn't need direct network access to the NVR host. All require a
`:connection_id` that resolves to a `type: "frigate"` connection.

| Method | Endpoint                                              | Description                         |
| ------ | ----------------------------------------------------- | ----------------------------------- |
| GET    | `/api/frigate/:connection_id/info`                    | Frigate system info                 |
| GET    | `/api/frigate/:connection_id/cameras`                 | List configured cameras             |
| GET    | `/api/frigate/:connection_id/snapshot/:camera`        | Current camera snapshot (JPEG)      |
| GET    | `/api/frigate/:connection_id/live/:camera`            | Live stream proxy (via go2rtc)      |
| GET    | `/api/frigate/:connection_id/events/:camera`          | Recent detection events             |
| GET    | `/api/frigate/:connection_id/event/:event_id/clip`    | Event clip MP4 (Range-aware)        |
| GET    | `/api/frigate/:connection_id/event/:event_id/snapshot`| Event snapshot JPEG                 |
| GET    | `/api/frigate/:connection_id/reviews`                 | Review segments (defaults unreviewed) |
| GET    | `/api/frigate/:connection_id/review/:review_id/thumbnail` | Review thumbnail (WebP, `?camera=`) |
| POST   | `/api/frigate/:connection_id/reviews/viewed`          | Mark reviews as viewed              |

## AI Sessions

| Method | Endpoint                                  | Description                          |
| ------ | ----------------------------------------- | ------------------------------------ |
| POST   | `/api/ai/sessions`                        | Create a session                     |
| GET    | `/api/ai/sessions/:id`                    | Get session state                    |
| POST   | `/api/ai/sessions/:id/messages`           | Send a message (SSE response stream) |
| GET    | `/api/ai/sessions/:id/ws`                 | WebSocket channel for the session    |
| POST   | `/api/ai/sessions/:id/save`               | Save the draft chart                 |
| DELETE | `/api/ai/sessions/:id`                    | Cancel the session                   |
| GET    | `/api/ai/debug`                           | AI debug WebSocket                   |
| GET    | `/api/ai/debug/status`                    | AI debug status                      |

## Users

| Method | Endpoint          | Description                     |
| ------ | ----------------- | ------------------------------- |
| GET    | `/api/users`      | List users                      |
| POST   | `/api/users`      | Create a user                   |
| GET    | `/api/users/:id`  | Get one                         |
| PUT    | `/api/users/:id`  | Update                          |
| DELETE | `/api/users/:id`  | Delete                          |

## Registry and config

| Method | Endpoint                               | Description                              |
| ------ | -------------------------------------- | ---------------------------------------- |
| GET    | `/api/registry/connections`            | List registered connection types         |
| GET    | `/api/registry/connections/:typeId`    | Get metadata for a single connection type|
| GET    | `/api/registry/categories`             | List connection categories               |
| GET    | `/api/config/system`                   | Get system-wide app config               |
| PUT    | `/api/config/system`                   | Update system-wide app config            |
| GET    | `/api/config/user/:user_id`            | Get per-user config                      |
| PUT    | `/api/config/user/:user_id`            | Update per-user config                   |
| GET    | `/api/settings`                        | List admin settings                      |
| GET    | `/api/settings/:key`                   | Get a setting                            |
| PUT    | `/api/settings/:key`                   | Update a setting                         |

## Status and monitoring

| Method | Endpoint               | Description                                           |
| ------ | ---------------------- | ----------------------------------------------------- |
| GET    | `/health`              | Health check (MongoDB status + services)              |
| GET    | `/version`             | Build version info                                    |
| GET    | `/api/ws/status`       | WebSocket for periodic server status updates          |

The `/api/ws/status` endpoint accepts an `?interval=Ns` query (e.g.
`interval=5s`). Pass `interval=0` for a single-shot response that
closes immediately.

## MCP

| Method | Endpoint         | Description                              |
| ------ | ---------------- | ---------------------------------------- |
| GET    | `/mcp/sse`       | Integrated MCP SSE endpoint              |
| POST   | `/mcp/message`   | Send a message to the MCP handler        |

## Inbound streams

Used by ts-store (and similar push sources) to stream data INTO the
dashboard rather than the usual pull/subscribe direction.

| Method | Endpoint                                    | Description                             |
| ------ | ------------------------------------------- | --------------------------------------- |
| GET    | `/api/streams/inbound/:datasourceId`        | Inbound WebSocket (auth not required)   |

## Related docs

- [Swagger UI](http://localhost:3001/swagger/index.html) — payload
  shapes and full examples
- [Backend architecture](backend.md) — where handlers sit in the
  layered design
- [Connections](connections.md) — per-type details for the
  connection endpoints
- [Streaming](streaming.md) — how the stream endpoints work under
  the hood
