// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

/**
 * Control type constants and metadata.
 * Separated from index.js to avoid circular dependencies
 * (ControlRenderer imports these, and index.js exports ControlRenderer).
 */

import {
  mdiGestureTap,
  mdiToggleSwitch,
  mdiTuneVertical,
  mdiFormTextbox,
  mdiPowerPlug,
  mdiLightbulbOn,
  mdiFormatText,
  mdiGarage
} from '@mdi/js';

// Control type constants - must match backend models.ControlType* constants
export const CONTROL_TYPES = {
  BUTTON: 'button',
  TOGGLE: 'toggle',
  SLIDER: 'slider',
  TEXT_INPUT: 'text_input',
  PLUG: 'plug',
  DIMMER: 'dimmer',
  TILE_PLUG: 'tile_plug',
  TILE_DIMMER: 'tile_dimmer',
  TILE_GARAGE_DOOR: 'tile_garage_door',
  TEXT_LABEL: 'text_label'
};

// Control type metadata for UI, discovery, and AI builder
export const CONTROL_TYPE_INFO = {
  [CONTROL_TYPES.BUTTON]: {
    label: 'Button',
    description: 'Simple action button that triggers a command when clicked',
    icon: mdiGestureTap,
    category: 'action',
    canWrite: true,
    canRead: false,
    defaultUIConfig: {
      label: 'Execute',
      kind: 'primary'
    }
  },
  [CONTROL_TYPES.TOGGLE]: {
    label: 'Toggle',
    description: 'On/off switch that sends true or false',
    icon: mdiToggleSwitch,
    category: 'switch',
    canWrite: true,
    canRead: true,
    defaultUIConfig: {
      label: 'Enable',
      offLabel: 'Disable',
      state_field: 'state'
    }
  },
  [CONTROL_TYPES.SLIDER]: {
    label: 'Slider',
    description: 'Numeric slider for setting values within a range',
    icon: mdiTuneVertical,
    category: 'numeric',
    canWrite: true,
    canRead: true,
    defaultUIConfig: {
      label: 'Value',
      min: 0,
      max: 100,
      step: 1,
      state_field: 'value'
    }
  },
  [CONTROL_TYPES.TEXT_INPUT]: {
    label: 'Text Input',
    description: 'Text field for entering custom values or commands',
    icon: mdiFormTextbox,
    category: 'input',
    canWrite: true,
    canRead: true,
    defaultUIConfig: {
      label: 'Command',
      placeholder: 'Enter value...',
      submitLabel: 'Send',
      state_field: 'value'
    }
  },
  [CONTROL_TYPES.PLUG]: {
    label: 'Plug',
    description: 'Smart plug toggle with HomeKit-style pill design',
    icon: mdiPowerPlug,
    category: 'switch',
    canWrite: true,
    canRead: true,
    defaultUIConfig: {
      label: 'Plug',
      onLabel: 'On',
      offLabel: 'Off',
      state_field: 'state'
    }
  },
  [CONTROL_TYPES.DIMMER]: {
    label: 'Dimmer',
    description: 'Vertical slider for dimming lights, drag to set level',
    icon: mdiLightbulbOn,
    category: 'numeric',
    canWrite: true,
    canRead: true,
    defaultUIConfig: {
      label: 'Light',
      min: 0,
      max: 100,
      step: 1,
      state_field: 'level'
    }
  },
  [CONTROL_TYPES.TILE_PLUG]: {
    label: 'Tile Plug',
    description: 'Compact tile showing plug on/off state. Tap to open full control.',
    icon: mdiPowerPlug,
    category: 'switch',
    canWrite: true,
    canRead: true,
    defaultUIConfig: {
      label: 'Plug',
      onLabel: 'On',
      offLabel: 'Off',
      state_field: 'state'
    }
  },
  [CONTROL_TYPES.TILE_DIMMER]: {
    label: 'Tile Dimmer',
    description: 'Compact tile showing dimmer level with vertical fill. Tap to open full control.',
    icon: mdiLightbulbOn,
    category: 'numeric',
    canWrite: true,
    canRead: true,
    defaultUIConfig: {
      label: 'Light',
      min: 0,
      max: 100,
      step: 1,
      state_field: 'level'
    }
  },
  [CONTROL_TYPES.TILE_GARAGE_DOOR]: {
    label: 'Tile Garage Door',
    description: 'Compact tile showing garage door open/closed state from a contact sensor.',
    icon: mdiGarage,
    category: 'indicator',
    canWrite: false,
    canRead: true,
    defaultUIConfig: {
      label: 'Garage',
      state_field: 'contact'
    }
  },
  [CONTROL_TYPES.TEXT_LABEL]: {
    label: 'Text Label',
    description: 'Static text display for section headers, date/time, or dashboard titles. No connection needed.',
    icon: mdiFormatText,
    category: 'decorative',
    canWrite: false,
    canRead: false,
    defaultUIConfig: {
      display_content: 'title',
      align: 'center',
      size: 'md'
    }
  }
};

// Categories for widget selector grouping
export const CONTROL_CATEGORIES = {
  switch: { label: 'Switches', description: 'On/off controls' },
  numeric: { label: 'Numeric', description: 'Sliders and dimmers' },
  action: { label: 'Actions', description: 'Buttons and triggers' },
  input: { label: 'Input', description: 'Text and command entry' },
  indicator: { label: 'Indicators', description: 'Read-only state displays' },
  decorative: { label: 'Decorative', description: 'Labels, headers, and layout elements' }
};
