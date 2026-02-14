// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

/**
 * Control Components Registry
 *
 * Control components are interactive UI elements that send commands to connections.
 * They are stored as charts with component_type="control".
 */

export { default as ControlButton } from './ControlButton';
export { default as ControlToggle } from './ControlToggle';
export { default as ControlSlider } from './ControlSlider';
export { default as ControlTextInput } from './ControlTextInput';
export { default as ControlRenderer } from './ControlRenderer';

// Control type constants - must match backend models.ControlType* constants
export const CONTROL_TYPES = {
  BUTTON: 'button',
  TOGGLE: 'toggle',
  SLIDER: 'slider',
  TEXT_INPUT: 'text_input'
};

// Control type metadata for UI
export const CONTROL_TYPE_INFO = {
  [CONTROL_TYPES.BUTTON]: {
    label: 'Button',
    description: 'Simple action button that triggers a command when clicked',
    icon: 'TouchInteraction',
    defaultUIConfig: {
      label: 'Execute',
      kind: 'primary' // primary, secondary, danger, ghost
    }
  },
  [CONTROL_TYPES.TOGGLE]: {
    label: 'Toggle',
    description: 'On/off switch that sends true or false',
    icon: 'Toggle',
    defaultUIConfig: {
      label: 'Enable',
      offLabel: 'Disable'
    }
  },
  [CONTROL_TYPES.SLIDER]: {
    label: 'Slider',
    description: 'Numeric slider for setting values within a range',
    icon: 'Slider',
    defaultUIConfig: {
      label: 'Value',
      min: 0,
      max: 100,
      step: 1
    }
  },
  [CONTROL_TYPES.TEXT_INPUT]: {
    label: 'Text Input',
    description: 'Text field for entering custom values or commands',
    icon: 'TextInput',
    defaultUIConfig: {
      label: 'Command',
      placeholder: 'Enter value...',
      submitLabel: 'Send'
    }
  }
};
