// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useState, useCallback } from 'react';
import apiClient from '../../api/client';
import { useNotifications } from '../../context/NotificationContext';

/**
 * useControlCommand Hook
 *
 * Handles command execution for control components, including
 * loading state, notifications, and state suppression coordination.
 *
 * For read-only controls (sensors, indicators), don't use this hook —
 * only useControlState is needed.
 *
 * @param {object} options
 * @param {string} options.controlId - Chart/component ID for the control
 * @param {string} options.label - Display label for notifications
 * @param {string} options.target - Command target topic (for notification display)
 * @param {function} options.onSuppress - Called before sending (from useControlState.suppress)
 * @param {function} options.onClearSuppress - Called on error (from useControlState.clearSuppress)
 * @param {function} options.onSuccess - Optional success callback
 * @param {function} options.onError - Optional error callback
 * @returns {{ execute, loading }}
 */
export function useControlCommand({
  controlId,
  label,
  target,
  onSuppress,
  onClearSuppress,
  onSuccess,
  onError
}) {
  const [loading, setLoading] = useState(false);
  const { addNotification } = useNotifications();

  const execute = useCallback(async (value, successMessage) => {
    setLoading(true);
    if (onSuppress) onSuppress();

    try {
      const result = await apiClient.executeControlCommand(controlId, value);
      addNotification({
        kind: 'success',
        title: successMessage || `${label} command sent`,
        subtitle: target ? `Published to ${target}` : result.message
      });
      if (onSuccess) onSuccess(result);
      return result;
    } catch (err) {
      if (onClearSuppress) onClearSuppress();
      addNotification({
        kind: 'error',
        title: `${label} command failed`,
        subtitle: err.message
      });
      if (onError) onError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [controlId, label, target, onSuppress, onClearSuppress, onSuccess, onError, addNotification]);

  return { execute, loading };
}

export default useControlCommand;
