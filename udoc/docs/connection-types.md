---
sidebar_position: 16
---

# Connection Types

## SQL Database

Connect to relational databases for structured data queries.

**Supported Drivers**: PostgreSQL, MySQL, SQLite, MSSQL, Oracle

**Configuration**:
- Host, Port, Database name
- Username and Password
- SSL mode
- Connection pool settings
- Query timeout

**Usage**: Write SQL queries in the chart editor's query configuration. Supports parameterized queries.

## REST API

Connect to HTTP APIs for fetching data.

**Configuration**:
- Base URL
- Default headers
- Authentication: None, Basic (user/pass), Bearer token, API Key
- Retry settings
- Response timeout

**Usage**: Configure HTTP method, path, query parameters, and body in the chart editor. Response data is parsed and mapped to chart fields.

## WebSocket

Bidirectional real-time connections for streaming data and sending commands.

**Configuration**:
- WebSocket URL (ws:// or wss://)
- Protocol
- Reconnect settings (interval, max attempts)
- Parser config (JSON path, regex)

**Usage**: Subscribe to messages for real-time chart updates. Controls use WebSocket to send commands to devices.

## MQTT

Message broker connections for IoT device communication.

**Configuration**:
- Broker host and port
- Client ID
- Username and Password
- SSL/TLS settings

**Features**:
- Topic discovery: Browse available topics on the broker
- Topic sampling: Preview message payloads and data structure
- Multi-topic subscription
- Bidirectional: Subscribe for state, publish for commands

**Usage**: Primary connection type for control components (plugs, dimmers, toggles). Charts can also subscribe to MQTT topics for real-time data.

## CSV File

Read data from CSV files.

**Configuration**:
- File path
- Delimiter character
- Header row detection
- Encoding
- Watch for changes

**Usage**: Static data sets, configuration files, or regularly updated exports.

## TS-Store

Connect to a TS-Store time-series database.

**Configuration**:
- Protocol (http/https)
- Host and Port
- Store name
- API key

**Usage**: Time-series data queries for monitoring dashboards.

## Prometheus

Connect to a Prometheus metrics server.

**Configuration**:
- Base URL
- Credentials (optional)
- Query timeout

**Features**:
- Schema discovery: Browse available metrics
- Visual PromQL builder
- Label value autocomplete

**Usage**: Infrastructure monitoring dashboards. Supports instant queries and range queries.

## EdgeLake

Connect to an EdgeLake distributed database network.

**Configuration**:
- Host and Port
- Query timeout

**Features**:
- Cascading schema discovery: Database > Table > Columns
- Distributed query support across network nodes
- Visual query builder

**Usage**: Edge computing and IoT data aggregation dashboards.

---
