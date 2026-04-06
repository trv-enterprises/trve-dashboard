---
sidebar_position: 8
---

# Dashboard Settings

Click the gear icon in the edit mode toolbar to open the Dashboard Settings modal.

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **Description** | Optional text description shown in the dashboard tile view | Empty |
| **Theme** | Visual theme — Light, Dark, or Auto (follows system preference) | Dark |
| **Auto Refresh** | How often (in seconds) to refresh component data. Set to 0 to disable. Range: 0-3600, step 5. | 0 (disabled) |
| **Title Scale** | Scale factor for panel title text (50%-200%). Previews live in the editor. | 100% |
| **Make dashboard public** | Placeholder for future access control — does not currently restrict access | Off |
| **Allow export** | Placeholder for future export feature | On |

## Applying Settings

1. Modify settings in the modal
2. Click **Apply** to close the modal
3. Changes appear as "Unsaved changes" in the toolbar
4. Click **Save** in the main toolbar to persist

Settings are saved alongside panel layout and dashboard name when you click Save.

## Title Scale Preview

The Title Scale slider adjusts the font size of panel titles in real-time while the settings modal is open, so you can see the effect before saving. This applies to the `--title-scale` CSS variable used by data table headers and other titled components.

---
