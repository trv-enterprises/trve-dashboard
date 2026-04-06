---
sidebar_position: 21
---

# Grid & Layout System

## Grid Fundamentals

Dashboards use a CSS grid with fixed cell dimensions:

| Property | Value |
|----------|-------|
| **Cell width** | 64px |
| **Cell height** | 36px |
| **Aspect ratio** | 16:9 |
| **Gap between cells** | 8px |

Panels are positioned and sized in grid units (columns x rows). A panel with size 3x4 occupies 3 columns and 4 rows.

## Dimension Presets

Layout dimension presets define the maximum grid area. Common presets:

| Preset | Resolution | Use Case |
|--------|-----------|----------|
| 1728x1117 MAC | 1728 x 1117 | MacBook displays |
| 1920x1080 HD | 1920 x 1080 | Standard HD monitors |
| 2560x1440 2K | 2560 x 1440 | QHD / 2K monitors |
| 3840x2160 4K | 3840 x 2160 | 4K / UHD displays |

The number of grid columns and rows is calculated from the preset dimensions, accounting for the application header (48px), toolbar (57px), and padding.

## Boundary Lines

In edit mode, red dashed lines indicate the dimension boundary:
- **Right edge**: Vertical red dashed line at the maximum column
- **Bottom edge**: Horizontal red dashed line at the maximum row

Panels cannot be dragged or resized beyond these boundaries.

## Fit-to-Screen Scaling

In view mode, the fit-to-screen toggle scales the entire grid to fit the viewport:

- Uses CSS `transform: scale(x, y)` — each axis scales independently
- Preserves the visual layout while filling available space
- The browser handles text and element scaling at the compositor level

In edit mode, zoom controls (10%-100%) use uniform `transform: scale(n)` for proportional scaling.

## Panel Positioning

Panel positions use zero-indexed grid coordinates:
- `x`: Column position (0 = leftmost)
- `y`: Row position (0 = topmost)
- `w`: Width in columns
- `h`: Height in rows

In CSS Grid, these translate to:
```
gridColumn: (x + 1) / span w
gridRow: (y + 1) / span h
```

---
