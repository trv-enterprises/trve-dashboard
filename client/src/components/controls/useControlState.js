// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useState, useEffect, useRef, useCallback } from 'react';
import StreamConnectionManager from '../../utils/streamConnectionManager';
import { deriveStateTopic, extractStateValue, SUPPRESS_DURATION_MS } from './controlUtils';

/**
 * useControlState Hook
 *
 * Subscribes to MQTT state updates for a control component.
 * Handles topic derivation, field extraction, and suppression of stale
 * messages after sending commands.
 *
 * @param {object} options
 * @param {string} options.connectionId - Connection ID for MQTT broker
 * @param {string} options.target - Command target topic (e.g., "zigbee2mqtt/device/set")
 * @param {string} options.stateField - Primary field name to extract from records
 * @param {string[]} options.fallbackFields - Additional field names to try
 * @param {function} options.transform - Transform raw value before setting state (optional)
 * @param {*} options.initialValue - Initial state value
 * @returns {{ value, connected, suppressRef, stateTopic }}
 */
export function useControlState({
  connectionId,
  target,
  stateField = 'state',
  fallbackFields = [],
  transform,
  initialValue = undefined
}) {
  const [value, setValue] = useState(initialValue);
  const [connected, setConnected] = useState(false);
  const suppressRef = useRef(0);

  const stateTopic = deriveStateTopic(target);

  // Suppress state updates temporarily (called before sending commands)
  const suppress = useCallback(() => {
    suppressRef.current = Date.now() + SUPPRESS_DURATION_MS;
  }, []);

  const clearSuppress = useCallback(() => {
    suppressRef.current = 0;
  }, []);

  useEffect(() => {
    if (!connectionId || !stateTopic) return;

    const manager = StreamConnectionManager.getInstance();
    const unsubscribe = manager.subscribe(connectionId, (record) => {
      // Filter to our topic
      if (record.topic && record.topic !== stateTopic) return;
      // Skip if we're suppressing (just sent a command)
      if (Date.now() < suppressRef.current) return;

      const raw = extractStateValue(record, stateField, fallbackFields);
      if (raw === undefined) return;

      const final = transform ? transform(raw) : raw;
      setValue(final);
    }, {
      topics: stateTopic,
      onConnect: () => setConnected(true),
      onDisconnect: () => setConnected(false)
    });

    return () => unsubscribe();
  }, [connectionId, stateTopic, stateField, fallbackFields.join(','), transform]);

  return { value, setValue, connected, suppress, clearSuppress, stateTopic };
}

export default useControlState;
