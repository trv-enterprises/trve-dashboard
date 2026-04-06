---
sidebar_position: 4
---

# Viewing Dashboards

## Dashboard Selection

Navigate to View Mode to see the dashboard tile grid. Each tile shows:

- Thumbnail preview of the dashboard layout
- Dashboard name and description
- Tags indicating auto-refresh interval, panel count, and data sources
- A star icon if it's your default dashboard

Click a tile to open the dashboard in the viewer.

## Setting a Default Dashboard

Your default dashboard loads automatically when you open the application.

1. Open the dashboard you want as your default
2. Click the overflow menu (three dots) in the toolbar
3. Select **Set as Default**

The star icon appears next to the dashboard name in the tile view. Each user has their own default dashboard preference.

## Dashboard Viewer

The viewer renders all dashboard panels with live data. Components refresh automatically based on the dashboard's configured refresh interval.

### Toolbar

The toolbar at the top of the viewer provides:

| Control | Description |
|---------|-------------|
| **Back arrow** | Return to dashboard tile grid |
| **Dashboard name** | Displayed in the header |
| **Refresh tag** | Shows the auto-refresh interval (e.g., "Data refresh: 30s") |
| **Last refresh** | Timestamp of the most recent data refresh |
| **Refresh button** | Manually refresh all components |
| **Fullscreen** | Toggle browser fullscreen mode |
| **Fit to screen** | Scale the dashboard to fit within the viewport |
| **Overflow menu** | Additional actions (Edit, Save Thumbnail, Set as Default) |

### Interacting with Components

- **Charts**: Display data visualizations that update automatically
- **Controls**: Buttons, toggles, sliders, and plugs that send commands to connected devices via MQTT or WebSocket
- **Displays**: Special components like camera feeds and weather widgets
- **Double-click** a chart panel to open a data modal showing the raw data table

---
