// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

/**
 * Control Component Registry
 *
 * Controls register themselves by calling registerControl().
 * ControlRenderer looks up components from this registry.
 * This avoids manual switch statements and circular imports.
 */

const registry = {};

/**
 * Register a control component for a given control type.
 * Called by each control component at module load time.
 *
 * @param {string} controlType - The control type key (e.g., 'plug', 'dimmer')
 * @param {React.Component} component - The React component to render
 */
export function registerControl(controlType, component) {
  registry[controlType] = component;
}

/**
 * Get the registered component for a control type.
 * @param {string} controlType
 * @returns {React.Component|undefined}
 */
export function getControlComponent(controlType) {
  return registry[controlType];
}

/**
 * Get all registered control types.
 * @returns {string[]}
 */
export function getRegisteredTypes() {
  return Object.keys(registry);
}
