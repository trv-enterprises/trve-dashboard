---
sidebar_position: 12
---

# Control Types

Controls are interactive UI elements that send commands to devices via bidirectional connections (MQTT, WebSocket). Most controls can both read device state and send commands.

## Available Control Types

| Type | Description | Can Read | Can Write |
|------|-------------|----------|-----------|
| **Button** | Simple action button that sends a command on click | No | Yes |
| **Toggle** | On/off switch showing current state | Yes | Yes |
| **Slider** | Numeric range slider for dimmers, volumes, etc. | Yes | Yes |
| **Text Input** | Text field for sending custom commands | Yes | Yes |
| **Plug** | Smart plug with pill-shaped on/off design | Yes | Yes |
| **Dimmer** | Vertical light dimmer with brightness slider | Yes | Yes |
| **Tile Plug** | Compact plug tile with popup for details | Yes | Yes |
| **Tile Dimmer** | Compact dimmer tile with popup for brightness | Yes | Yes |
| **Text Label** | Static text for section headers and labels | No | No |

## How Controls Work

### State Subscription
Controls that can read state subscribe to an MQTT topic to receive the current device state. The state is extracted from the message using a configurable field path.

### Command Execution
Controls that can write send commands when the user interacts with them (click, toggle, slide). Commands are sent to the configured connection with the appropriate payload.

### Connection Requirements
- Controls require a **bidirectional connection** (MQTT or WebSocket)
- The connection must support both subscribing (for state) and publishing (for commands)
- Text Labels require no connection

## Compact Tile Controls

Tile Plug and Tile Dimmer are compact versions designed for dense dashboards:

- Small footprint (minimum 2x3 grid cells)
- Show basic state (on/off, brightness level)
- Click to open a popup with full control interface
- Ideal for home automation dashboards with many devices

## Text Labels

Text Labels are non-interactive components for adding section headers, spacers, or annotations to dashboards. They require no connection and have a minimum size of 1x1 grid cell.

---
