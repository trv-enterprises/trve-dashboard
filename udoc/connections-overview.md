# Connections Overview

Connections define how the dashboard fetches data and communicates with external systems. Manage connections from Design Mode > Connections.

## Connection List

The connections page shows all configured connections with:
- Name and description
- Connection type (SQL, API, WebSocket, etc.)
- Number of components using this connection
- Last modified date

Use the search bar to filter by name, description, or type. Switch between list and tile views.

## Creating a Connection

1. Click the **Create** button
2. Select the connection type
3. Fill in the type-specific configuration
4. Use **Test Connection** to verify the settings
5. Click **Save**

## Testing Connections

The connection editor includes a test feature:
1. Enter test parameters (query, message, etc.)
2. Click **Test**
3. View the response data to verify the connection works

## Connection Usage

The chart count column shows how many components reference each connection. Deleting a connection that's in use by components will cause those components to fail to load data.

---

[Back to Guide](README.md) | Previous: [AI Builder](ai-builder.md) | Next: [Connection Types](connection-types.md)
