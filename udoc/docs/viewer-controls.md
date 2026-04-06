---
sidebar_position: 5
---

# Dashboard Navigation & Controls

## Keyboard Navigation

Switch between dashboards without using the mouse:

| Shortcut | Action |
|----------|--------|
| **Alt + Right Arrow** | Next dashboard (alphabetical order) |
| **Alt + Left Arrow** | Previous dashboard |

A brief overlay shows the dashboard name and position (e.g., "Main Dashboard 2 of 5").

Keyboard navigation is disabled while in edit mode.

## Fullscreen Mode

Click the fullscreen icon in the toolbar or press **F11**. In fullscreen:

- The back button is hidden
- All toolbar controls remain accessible
- Press **Escape** or click the minimize icon to exit

## Fit to Screen

Toggle between two display modes:

| Mode | Behavior |
|------|----------|
| **Fit to screen** | Dashboard scales to fill the viewport. Both axes scale independently to use all available space. |
| **Actual size** | Dashboard renders at native pixel dimensions (64x36px cells). Scrollbars appear if the dashboard is larger than the viewport. |

Your preference is saved per user and persists across sessions.

## Auto-Refresh

Dashboards can auto-refresh their data at a configurable interval:

- The green tag in the toolbar shows the interval (e.g., "Data refresh: 30s")
- Set to 0 to disable auto-refresh
- Configure via the [Dashboard Settings](dashboard-settings.md) modal in edit mode
- Auto-refresh pauses while in edit mode

## Save Thumbnail

Capture the current dashboard view as a thumbnail image for the tile grid:

1. Open the dashboard in the viewer (not edit mode)
2. Click the overflow menu
3. Select **Save Thumbnail**

The thumbnail captures the live state of all components including charts, controls, and displays.

---
