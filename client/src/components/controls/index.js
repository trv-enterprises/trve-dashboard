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
export { default as ControlPlug } from './ControlPlug';
export { default as ControlDimmer } from './ControlDimmer';
export { default as ControlRenderer } from './ControlRenderer';

// Shared hooks and utilities
export { useControlState } from './useControlState';
export { useControlCommand } from './useControlCommand';
export * from './controlUtils';

// Re-export types and metadata from controlTypes (avoids circular deps)
export { CONTROL_TYPES, CONTROL_TYPE_INFO, CONTROL_CATEGORIES } from './controlTypes';
