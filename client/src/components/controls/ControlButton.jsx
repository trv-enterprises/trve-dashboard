// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useState } from 'react';
import { Button, InlineLoading } from '@carbon/react';
import PropTypes from 'prop-types';
import apiClient from '../../api/client';
import { useNotifications } from '../../context/NotificationContext';
import './controls.scss';

/**
 * ControlButton Component
 *
 * A button control that executes a command when clicked.
 * Sends null as the value (buttons just trigger actions).
 * No state subscription — buttons are fire-and-forget.
 */
function ControlButton({ control, onSuccess, onError }) {
  const [loading, setLoading] = useState(false);
  const { addNotification } = useNotifications();

  const uiConfig = control.control_config?.ui_config || {};
  const label = uiConfig.label || 'Execute';
  const kind = uiConfig.kind || 'primary';
  const target = control.control_config?.target || '';

  const handleClick = async () => {
    setLoading(true);

    try {
      const result = await apiClient.executeControlCommand(control.id, null);
      addNotification({
        kind: 'success',
        title: `${label} executed`,
        subtitle: target ? `Published to ${target}` : result.message
      });
      if (onSuccess) onSuccess(result);
    } catch (err) {
      addNotification({
        kind: 'error',
        title: `${label} failed`,
        subtitle: err.message
      });
      if (onError) onError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="control-button-container">
      <Button
        kind={kind}
        onClick={handleClick}
        disabled={loading}
        size="lg"
      >
        {loading ? (
          <InlineLoading description="Executing..." />
        ) : (
          label
        )}
      </Button>
    </div>
  );
}

ControlButton.propTypes = {
  control: PropTypes.shape({
    id: PropTypes.string.isRequired,
    connection_id: PropTypes.string,
    control_config: PropTypes.shape({
      target: PropTypes.string,
      ui_config: PropTypes.object
    })
  }).isRequired,
  onSuccess: PropTypes.func,
  onError: PropTypes.func
};

export default ControlButton;
