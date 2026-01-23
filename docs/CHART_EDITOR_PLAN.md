# Chart Editor Enhancement Plan

## Overview
Enhance the Chart Editor to show/hide data mapping fields based on chart type and add chart-specific parameter configurations.

## Current Chart Types
1. **bar** - Bar chart
2. **line** - Line chart
3. **area** - Area chart (filled line)
4. **pie** - Pie/donut chart
5. **scatter** - Scatter plot
6. **gauge** - Gauge/speedometer
7. **dataview** - Data table
8. **custom** - Custom code

---

## Data Mapping Fields by Chart Type

| Field | bar | line | area | pie | scatter | gauge | dataview |
|-------|-----|------|------|-----|---------|-------|----------|
| X-Axis Column | ✓ | ✓ | ✓ | ✓ (categories) | ✓ | ✗ | ✗ |
| Y-Axis Column(s) | ✓ (multi) | ✓ (multi) | ✓ (multi) | ✓ (single) | ✓ (single) | ✓ (single) | ✗ |
| Series Column | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| X-Axis Label | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ |
| Y-Axis Label | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ |
| X-Axis Format | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Visible Columns | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Filters | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Aggregation | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Sort | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ |
| Limit | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ |
| Time Bucket | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ |

### Notes:
- **gauge**: Only needs a single value column, no axes
- **pie**: X-axis is for category names, single Y for values
- **scatter**: Both X and Y are numeric values (not categories)
- **dataview**: Uses visible_columns instead of axis mapping

---

## Chart-Specific Parameters

### Gauge Chart
Current ECharts config uses `axisLine.lineStyle.color` array for thresholds:
```javascript
axisLine: {
  lineStyle: {
    color: [
      [0.7, '#24a148'],  // green: 0-70%
      [0.9, '#f1c21b'],  // yellow: 70-90%
      [1, '#da1e28']     // red: 90-100%
    ],
    width: 18
  }
}
```

**Proposed UI Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| min | number | 0 | Minimum gauge value |
| max | number | 100 | Maximum gauge value |
| warningThreshold | number | 70 | Value where yellow zone starts (%) |
| dangerThreshold | number | 90 | Value where red zone starts (%) |
| unit | string | '' | Unit suffix (e.g., '°F', '%', 'psi') |
| arcWidth | number | 18 | Width of the gauge arc |

### Pie Chart
```javascript
series: [{
  type: 'pie',
  radius: '70%',  // or ['40%', '70%'] for donut
  center: ['50%', '50%']
}]
```

**Proposed UI Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| radius | number | 70 | Outer radius as % of container |
| innerRadius | number | 0 | Inner radius for donut (0 = pie) |
| showLabels | boolean | true | Show slice labels |
| showLegend | boolean | true | Show legend |

### Bar/Line/Area Charts
```javascript
series: [{
  type: 'bar',
  smooth: true,  // line/area only
  areaStyle: {}, // area only
  stack: 'total' // for stacked charts
}]
```

**Proposed UI Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| stacked | boolean | false | Stack multiple series |
| smooth | boolean | true | Smooth curves (line/area) |
| showDataLabels | boolean | false | Show values on bars/points |

### Scatter Chart
```javascript
series: [{
  type: 'scatter',
  symbolSize: 15
}]
```

**Proposed UI Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| symbolSize | number | 15 | Size of scatter points |
| showTrendline | boolean | false | Show regression line (future) |

### DataView (Table)
**Proposed UI Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| pageSize | number | 10 | Rows per page |
| showSearch | boolean | true | Show search box |
| sortable | boolean | true | Enable column sorting |

---

## Implementation Plan

### Phase 1: Conditional Data Mapping Fields
1. Create a config object mapping chart types to applicable fields
2. Update ChartEditor to conditionally render data mapping fields
3. Clear irrelevant fields when chart type changes

**Config structure:**
```javascript
const CHART_TYPE_CONFIG = {
  bar: {
    hasXAxis: true,
    hasYAxis: true,
    multipleYAxis: true,
    hasSeriesColumn: true,
    hasAxisLabels: true,
    hasXAxisFormat: true,
    hasTimeBucket: true,
  },
  gauge: {
    hasXAxis: false,
    hasYAxis: true,
    multipleYAxis: false,
    hasSeriesColumn: false,
    hasAxisLabels: false,
    hasXAxisFormat: false,
    hasTimeBucket: true,  // for streaming aggregation
  },
  pie: {
    hasXAxis: true,  // categories
    hasYAxis: true,
    multipleYAxis: false,
    hasSeriesColumn: false,
    hasAxisLabels: false,
    hasXAxisFormat: true,
    hasTimeBucket: false,
  },
  // ... etc
};
```

### Phase 2: Chart-Specific Parameters UI
1. Add `chart_options` field to chart model (backend + frontend)
2. Create parameter input components for each chart type
3. Update code generator to use chart_options
4. Add collapsible "Chart Options" section in editor

**Data model addition:**
```javascript
// In chart object
chart_options: {
  // Gauge
  min: 0,
  max: 100,
  warningThreshold: 70,
  dangerThreshold: 90,
  unit: '°F',

  // Pie
  innerRadius: 0,
  showLabels: true,

  // Bar/Line/Area
  stacked: false,
  smooth: true,
}
```

### Phase 3: Code Generator Updates
1. Update `generateGaugeCode` to use threshold parameters
2. Update `generatePieCode` to use radius/donut parameters
3. Update axis chart generators for stacking/smoothing options
4. Ensure ChartEditor templates match

---

## UI Mockup

```
┌─────────────────────────────────────────────────────────┐
│ Chart Editor                                             │
├─────────────────────────────────────────────────────────┤
│ Chart Type: [Gauge ▼]                                   │
│                                                         │
│ ┌─ Data Mapping ─────────────────────────────────────┐ │
│ │ Value Column: [temperature ▼]                       │ │
│ │                                                     │ │
│ │ ┌─ Filters ───────────────────────────────────┐   │ │
│ │ │ sensor_type = temperature                    │   │ │
│ │ │ location = Warehouse                         │   │ │
│ │ └─────────────────────────────────────────────┘   │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─ Gauge Options ────────────────────────────────────┐ │
│ │ Min Value: [0    ]  Max Value: [100  ]            │ │
│ │                                                     │ │
│ │ Warning Threshold (yellow): [70   ] %              │ │
│ │ Danger Threshold (red):     [90   ] %              │ │
│ │                                                     │ │
│ │ Unit Suffix: [°F  ]                                │ │
│ │ Arc Width:   [18  ] px                             │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Files to Modify

### Frontend
1. `client/src/components/ChartEditor.jsx` - Main editor component
2. `client/src/utils/chartCodeGenerator.js` - Code generation
3. `client/src/components/ChartEditor.scss` - Styling for new sections

### Backend
1. `server-go/internal/models/chart.go` - Add chart_options field
2. `server-go/internal/ai/system_prompt.go` - Update AI examples

---

## Migration Considerations
- Existing charts without `chart_options` should use defaults
- No database migration needed (chart_options is optional JSON field)
- Backward compatible - old charts continue to work

---

## Priority Order
1. **High**: Hide irrelevant data mapping fields per chart type
2. **High**: Add gauge threshold parameters (most requested)
3. **Medium**: Add pie donut/radius options
4. **Low**: Add bar/line stacking options
5. **Low**: Add dataview pagination options
