// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

/**
 * Shared utilities for control components.
 */

// After sending a command, ignore incoming state updates for this duration
// so stale MQTT messages don't revert the optimistic UI update
export const SUPPRESS_DURATION_MS = 3000;

/**
 * Derive the state topic from a command target.
 * Convention: command target ends with "/set", state topic is the same path without "/set".
 * Example: "zigbee2mqtt/dining_room_plug/set" → "zigbee2mqtt/dining_room_plug"
 */
export function deriveStateTopic(target) {
  if (!target) return '';
  return target.endsWith('/set') ? target.slice(0, -4) : target;
}

/**
 * Normalize a value to boolean (on/off).
 * Handles the various representations from different MQTT devices.
 */
export function normalizeBoolean(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const upper = value.toUpperCase();
    return upper === 'ON' || upper === 'TRUE' || upper === '1';
  }
  return false;
}

/**
 * Extract a state value from an MQTT record, trying the configured field
 * then common fallbacks.
 *
 * @param {object} record - The MQTT message record
 * @param {string} stateField - Primary field name to check
 * @param {string[]} fallbacks - Additional field names to try
 * @returns {*} The extracted value, or undefined if not found
 */
export function extractStateValue(record, stateField, fallbacks = []) {
  if (record[stateField] !== undefined) return record[stateField];
  for (const field of fallbacks) {
    if (record[field] !== undefined) return record[field];
  }
  return undefined;
}
