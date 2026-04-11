# Grid system and fit modes

The dashboard grid is a pixel-based CSS grid with fixed-size cells and
a configurable column count. Panels are placed onto that grid by cell
coordinates, and the grid is scaled to the viewport in one of four
ways depending on the user's fit-mode preference.

## Cells

- **Cell size**: 32 × 32 px (based on Carbon's `$spacing-08`)
- **Column count**: 12 columns at the default layout-dimension preset;
  admins can define additional presets with more or fewer columns via
  Manage mode
- **Gap**: 4 px between cells (`$spacing-02`)

A panel's geometry is stored as `{x, y, w, h}` in cell units, so a
panel that starts at column 0 row 0 and spans 6 columns by 8 rows is
`{x: 0, y: 0, w: 6, h: 8}`.

```
┌────────────────────────────────────────────────────────────────┐
│  1   2   3   4   5   6   7   8   9  10  11  12                │
├────────────────────────────────────────────────────────────────┤
│ Panel A (x:0, y:0, w:6, h:8)  │  Panel B (x:6, y:0, w:6, h:4) │
│                               ├────────────────────────────────┤
│                               │  Panel C (x:6, y:4, w:6, h:4) │
└───────────────────────────────┴────────────────────────────────┘
```

## Layout dimension presets

Admins define layout dimension presets in Manage mode. A preset
specifies the number of columns and rows the dashboard grid should
use, plus optional minimum panel sizes. When a dashboard is created,
the user picks a preset; the preset is stored on
`dashboard.settings.layout_dimension` and applied whenever the
dashboard is opened.

## Fit modes

The dashboard viewer can render the grid at four different scales.
The mode is a per-user preference (`dashboard_fit_mode` stored in
`app_config`) so every dashboard the user opens follows the same
policy.

| Mode              | Scale formula             | Behavior                                                              |
| ----------------- | ------------------------- | --------------------------------------------------------------------- |
| **Actual size**   | `1` (no transform)        | Render at native pixel size, top-left. Scroll in both directions.     |
| **Fit to window** | `min(scaleX, scaleY)`     | Uniform scale, centered. Nothing clipped. Charts stay geometric.      |
| **Fit to width**  | `scaleX`                  | Fill width exactly, scroll vertically if the content is taller.       |
| **Stretch to fill** | `scale(scaleX, scaleY)` | Fills both axes independently. May distort round chart elements.      |

**Fit to window** is the safe default — it preserves aspect ratios so
gauges stay circular, pie charts stay round, and text stays
proportional. It's what most users want most of the time.

**Fit to width** is useful on tall/scrolling dashboards or on devices
where horizontal space is the constrained axis. Vertical overflow
uses an auto-hiding scrollbar (shown on hover, hidden otherwise).

**Stretch to fill** is the legacy behavior — the old "reduce to fit"
boolean preference. It fills both axes which looks great for
text/tile-heavy dashboards where nothing is shape-sensitive, but it
distorts gauges and pies whenever the viewport aspect doesn't match
the grid aspect. Kept for back-compat and for dashboards where the
distortion doesn't matter.

**Actual size** mostly exists as a reference mode for debugging
layouts — content renders at native pixel size and may overflow the
viewport.

### Preference migration

Older builds stored a single boolean `dashboard_reduceToFit`:

- `true` → mapped to `"stretch"` (the exact old behavior)
- `false` → mapped to `"actual"`
- Unset → defaults to `"window"` (the safe new default)

Both keys are written on save for one release's worth of
back-compatibility; the old boolean is eventually removed.

## Edit mode vs view mode

Edit mode uses its own `zoom` CSS transform independent of the fit
mode. The fit-mode transform is short-circuited when
`isEditMode === true` so the two scale systems don't interact. Edit
mode also draws an extra grid-boundary overlay to show where the
current layout preset's bounds are.

## Title scale

Each dashboard has a `settings.title_scale` value (50–200, default
100) that scales the panel titles by a percentage of the base size.
It's implemented as a CSS custom property (`--title-scale`) on the
grid root, multiplied into the chart-header font size via
`calc(0.875rem * var(--title-scale, 1))`.

## Related docs

- [Frontend architecture](frontend.md) — `DashboardViewerPage` is the
  component that owns the grid + fit mode logic
- [API reference](api-reference.md) — `/api/config/user/:user_id` is
  where the fit mode preference lives
