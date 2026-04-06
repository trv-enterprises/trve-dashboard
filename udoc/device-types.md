# Device Types

Device types define the capabilities and command schemas for devices controlled through the dashboard. Manage from Manage Mode > Device Types.

## Built-in Device Types

The system includes several built-in device types:

| Device Type | Category | Protocol |
|-------------|----------|----------|
| **Zigbee Switch** | Smart Home | Zigbee |
| **Zigbee Dimmer** | Smart Home | Zigbee |
| **Caseta Switch** | Smart Home | Lutron Caseta |
| **Caseta Dimmer** | Smart Home | Lutron Caseta |
| **Caseta Shade** | Smart Home | Lutron Caseta |
| **Caseta Fan** | Smart Home | Lutron Caseta |

Built-in device types are view-only and cannot be modified or deleted.

## Custom Device Types

Create custom device types for your specific hardware:

1. Click **Add Device Type**
2. Configure:
   - **Name**: Unique identifier
   - **Category**: Grouping (e.g., "Smart Home", "Industrial")
   - **Subtype**: Further classification
   - **Protocol**: Communication protocol
   - **Capabilities**: List of features (e.g., "on_off", "brightness", "color")
   - **Supported Control Types**: Which dashboard controls can interact with this device type

Custom device types can be edited and deleted.

## Device Discovery

Some connections support automatic device discovery. From a connection's page, you can discover devices on the network and import them with their device type automatically assigned.

---

[Back to Guide](README.md) | Previous: [System Settings](system-settings.md) | Next: [Keyboard Shortcuts](keyboard-shortcuts.md)
