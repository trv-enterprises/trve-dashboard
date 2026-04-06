---
sidebar_position: 18
---

# System Settings

Configure system-wide settings from Manage Mode > Settings. Requires the Manage capability.

## Available Settings

| Setting | Category | Description |
|---------|----------|-------------|
| **Layout Dimensions** | Layout | Available dimension presets for dashboards. Each preset defines max width and height in pixels. |
| **Default Layout Dimension** | Layout | The preset selected by default when creating new dashboards. |
| **Config Refresh Interval** | Dashboard | How often (seconds) the frontend refreshes dashboard/chart configuration from the server. Default: 120s. |
| **Max Code Size** | Validation | Maximum allowed size (bytes) for component code. Hidden setting. |
| **Dangerous Patterns** | Validation | Regex patterns blocked in component code (e.g., eval, innerHTML). Hidden setting. |
| **Allowed Imports** | Validation | Packages allowed in component code (react, echarts, @carbon/react). Hidden setting. |

## Editing Settings

1. Click the **Edit** button next to a setting
2. A custom editor modal opens for that setting type
3. Modify the value
4. Click **Save**

### Layout Dimensions Editor

Manages the list of available screen dimension presets:
- Each preset has a name, max width, and max height
- Add new presets for specific screen sizes
- Remove presets no longer needed
- Common presets: 1728x1117 (Mac), 1920x1080 (HD), 2560x1440 (2K), 3840x2160 (4K)

## Hidden vs Editable Settings

- **Editable settings**: Stored in the database, modified through the UI, persist across restarts
- **Hidden settings**: Reload from the YAML config file on each server restart. These are system-level settings not intended for UI modification.

## Configuration File

Settings are seeded from `server-go/config/config.yaml` on first server start. After initial seeding, editable settings live in MongoDB and take precedence over the YAML file.

---
