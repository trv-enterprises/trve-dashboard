# Thumbnail Capture Issue - Debug Journal

## Problem Statement
When capturing dashboard thumbnails using html2canvas, the charts render at incorrect (larger) sizes, causing:
1. Right-side charts to be truncated/clipped
2. All charts appearing larger than their panel containers
3. Proportions not matching the editor view

## Key Observations

### From Debug Output
- Grid dimensions are correct: 1920x1080 (30 cols × 64px, 30 rows × 36px)
- Panel positions are correct in cell units
- **scrollWidth is 2152px** but grid width is 1920px (232px overflow)
- scrollWidth remains 2152 even AFTER forcing panel sizes
- Canvas dimensions are correct (480x270 at 0.25 scale)

### Visual Observations
- During thumbnail capture, charts visibly render LARGER than in editor
- The render size is closer to the realtime/fullscreen view than the editor layout
- ALL panels are affected, not just the right one (right is just most visible due to clipping)

## Root Cause Analysis

The 232px overflow (2152 - 1920 = 232) suggests content extending beyond grid.

Possible causes:
1. ECharts canvas rendering at wrong size before we can resize it
2. ECharts using cached/wrong container dimensions
3. Something in preview mode triggers different sizing behavior
4. CSS Grid cells expanding despite fixed pixel sizes

## Attempts Made

### Build 295 - Remove margin from capture dimensions
- Changed `captureWidth = Math.max(gridWidth, contentWidth)` to not add CELL_WIDTH margin
- **Result**: Still had overflow issues

### Build 296 - Auto-scale panels on dimension change
- Added logic to proportionally scale panel positions when changing to smaller dimension
- **Result**: Helps with panel positions, doesn't fix chart rendering

### Build 297 - Remove margin from container sizing
- Removed CELL_WIDTH/CELL_HEIGHT margin from container and capture calculations
- **Result**: Grey bar reduced but charts still oversized

### Build 298 - Add clip-path and force panel clipping
- Added `clipPath: inset(0 0 0 0)` to grid and panels
- Also clipped panel items
- **Result**: Still not working

### Build 299 - Force explicit pixel dimensions on panels
- After React re-renders in preview mode, force grid template columns/rows
- Force each panel to exact pixel dimensions (width, height, maxWidth, maxHeight)
- Wait for styles, then resize ECharts, wait more
- **Result**: Panel sizing shows in logs but charts still oversized

### Build 300 - Explicit ECharts resize with dimensions
- Call `instance.resize({ width: panelWidth, height: panelHeight })` with exact dimensions
- Use data-panel-w and data-panel-h attributes to map panel dimensions
- **Result**: ECharts resize logs not appearing - may not be finding instances

### Build 301 - Diagnostics and canvas forcing
- Added logging for window.echarts availability
- Added logging for each ECharts instance lookup
- Force canvas maxWidth/maxHeight directly
- In onclone: force panel AND canvas dimensions (including canvas.width/height attributes)
- **Result**: CRITICAL FINDING!
  - `window.echarts` is NOT available (library not exposed globally)
  - Setting `canvas.width`/`canvas.height` CLEARS the canvas content!
  - This caused completely blank charts in thumbnail

### Build 302 - Fix canvas clearing bug
- Removed `canvas.width = X` and `canvas.height = Y` from onclone
- Only set CSS style dimensions, not canvas attributes
- Added `objectFit: contain` to scale canvas content
- **Result**: Charts now visible! But still truncated on right. scrollWidth still 2152.

### Build 303 - Import echarts directly
- Added `import * as echarts from 'echarts'` to DashboardDetailPage.jsx
- Use imported echarts library instead of window.echarts
- Now can actually call `echarts.getInstanceByDom()` and `instance.resize()`
- **Result**: ECharts resize works! Charts visible but still truncated due to margins

### Build 304 - Remove gaps between panels ✅ FIXED
- User identified: "There are margins, these margins are pushing the right chart off of the page"
- Root cause: `.thumbnail-capture .panel-grid` had `gap: spacing.$spacing-03` (8px gaps)
- With multiple panels, the 8px gaps accumulated and pushed rightmost panel beyond 1920px
- **Fix**:
  - Changed `gap: spacing.$spacing-03` to `gap: 0 !important`
  - Added `margin: 0 !important` on panel-item
  - Added margin/padding resets throughout the thumbnail capture chain
  - Reset margins on echarts-for-react and component-preview children
- **Result**: ✅ SUCCESS - All 4 panels now visible in thumbnail for both small and large dimensions

## Technical Details

### Panel Data (from debug)
```
Panel 0: x=0, y=0, w=8, h=13 => 512x468px
Panel 1: x=8, y=0, w=14, h=13 => 896x468px
Panel 2: x=0, y=13, w=30, h=16 => 1920x576px
Panel 3: x=22, y=0, w=8, h=13 => 512x468px (ends at 1920px)
```

### Grid Configuration
- CELL_WIDTH: 64px
- CELL_HEIGHT: 36px
- GRID_COLS: 30 (for 1920px)
- GRID_ROWS: 30 (for 1080px)

### html2canvas Options
```javascript
{
  scale: 0.25,
  backgroundColor: '#161616',
  width: 1920,
  height: 1080,
  windowWidth: 2120,
  windowHeight: 1280
}
```

## Questions to Investigate

1. Why is scrollWidth 2152 when all panels fit within 1920?
2. Is window.echarts defined? (Build 301 will tell us)
3. Are ECharts instances being found via getInstanceByDom?
4. Why do charts render larger during preview mode switch?
5. Is there CSS that causes grid cells to expand?

## Potential Alternative Approaches

1. **Don't switch to preview mode** - capture design view instead (shows placeholders)
2. **Server-side rendering** - render thumbnails on backend
3. **Use different library** - puppeteer/playwright for screenshots
4. **Pre-render approach** - render charts to offscreen canvas at correct size first
5. **Delay capture until after resize** - ensure ECharts has fully resized before capture

## Files Modified
- `/client/src/pages/DashboardDetailPage.jsx` - captureThumbnail function
- `/client/src/pages/DashboardDetailPage.scss` - thumbnail-capture class styles

## Related Code Locations
- `captureThumbnail()` - Line ~478 in DashboardDetailPage.jsx
- Panel rendering - Line ~990 in DashboardDetailPage.jsx
- DynamicComponentLoader - handles chart rendering
- ReactECharts - ECharts wrapper component

---
Last Updated: Build 304
