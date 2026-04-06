# Display Types

Displays are specialized visual components for specific integrations that don't use the standard chart rendering engine.

## Frigate Camera

Integrates with a Frigate NVR (Network Video Recorder) to show live camera snapshots.

### Configuration
- **Frigate Connection**: Select the API connection to your Frigate instance
- **Default Camera**: Choose which camera to display
- **MQTT Connection**: For real-time event notifications
- **Snapshot Interval**: How often to refresh the camera image (milliseconds)

### Features
- Live snapshot display with auto-refresh
- Camera selection from Frigate's camera list
- Event overlay from MQTT notifications

### Minimum Panel Size
3 columns x 4 rows

## Weather

Displays current weather information for a configured location.

### Configuration
- **Weather Location**: City/region name (e.g., "Spring, TX")
- **MQTT Connection**: For receiving weather data updates

### Features
- Current conditions display
- Temperature, humidity, and other weather metrics
- Automatic updates via MQTT subscription

### Minimum Panel Size
6 columns x 8 rows

---

[Back to Guide](README.md) | Previous: [Control Types](control-types.md) | Next: [AI Component Builder](ai-builder.md)
