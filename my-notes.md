# need to construct a way to select tables and fields and relate them to the charts

# our MCP server needs to stand up the ability to look at a couple of fields and suggest fields. When building a chart it needs to ask the user which fields..





Auto-discovery (Grafana queries the source for schema):

Prometheus/InfluxDB – Grafana queries the metrics endpoint to get available metric names, labels, and tag keys. You get autocomplete dropdowns.
Elasticsearch – Grafana fetches index mappings to know field names and types.
SQL databases (Postgres, MySQL) – Grafana can query information_schema to discover tables and columns. The query builder shows available fields.
Loki – Discovers label names from the Loki API.

Semi-automatic:

JSON/REST APIs – Grafana doesn't know the schema until it gets data back. You often run a query first, then Grafana parses the response to find available fields for visualization.
CSV/Excel plugins – Reads headers from the file.

User must know:

Raw PromQL/SQL mode – If you bypass the visual builder and write raw queries, you're on your own.
Custom data sources – Depends entirely on whether the plugin author implemented schema discovery.

For your EdgeLake/AnyLog context:
Since you have that MCP server with listColumns, listTables, etc., a Grafana data source plugin could call those to populate dropdowns - but someone would need to build that integration. Otherwise users need to know the schema upfront or reference your API to discover it.
Is this for the dashboard generator - trying to figure out how to present available fields to users?