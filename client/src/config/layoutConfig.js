/**
 * Layout Configuration
 *
 * Defines standard dimensions and spacing for the dashboard layout system.
 * Based on Carbon Design System spacing tokens and grid patterns.
 */

// Base spacing unit - Carbon Design $spacing-08
export const SPACING_UNIT = 32; // 32px

// Canvas configuration
export const CANVAS = {
  maxWidth: 1920,
  maxHeight: 1080,
  backgroundColor: '#161616', // Carbon g100 background
};

// Grid configuration
export const GRID = {
  columns: 12, // 12-column grid
  rowHeight: SPACING_UNIT, // 32px per row
  spacing: SPACING_UNIT, // 32px between panels
  snapToGrid: true,
};

// Default panel dimensions (in pixels)
export const PANEL = {
  defaultWidth: 320, // 10 * SPACING_UNIT
  defaultHeight: 256, // 8 * SPACING_UNIT
  minWidth: 160, // 5 * SPACING_UNIT
  minHeight: 160, // 5 * SPACING_UNIT
  maxWidth: 1280, // 40 * SPACING_UNIT
  maxHeight: 1280, // 40 * SPACING_UNIT
};

// Panel controls configuration
export const CONTROLS = {
  dragHandleSize: 24, // Circle size for drag handle
  resizeHandleSize: 16, // Bottom-right corner handle
  borderWidth: 2,
  selectedBorderColor: '#0f62fe', // Carbon blue60
  hoverBorderColor: '#4589ff', // Carbon blue50
  defaultBorderColor: '#393939', // Carbon gray80
};

// Mode configuration
export const MODES = {
  DESIGN: 'design',
  VIEW: 'view',
  MANAGE: 'manage',
};

// Design mode sections
export const DESIGN_SECTIONS = {
  LAYOUTS: 'layouts',
  DATASOURCES: 'datasources',
  CHARTS: 'charts',
  DASHBOARDS: 'dashboards',
};

// Z-index layers
export const Z_INDEX = {
  panel: 1,
  panelHover: 2,
  panelDragging: 10,
  controls: 5,
  modal: 100,
  tooltip: 200,
};

// Animation durations (ms)
export const ANIMATION = {
  panelTransition: 200,
  hoverDelay: 100,
  tooltipDelay: 300,
};

export default {
  SPACING_UNIT,
  CANVAS,
  GRID,
  PANEL,
  CONTROLS,
  MODES,
  DESIGN_SECTIONS,
  Z_INDEX,
  ANIMATION,
};
