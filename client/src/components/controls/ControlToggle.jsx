// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useState, useEffect, useRef } from 'react';
import { Toggle, InlineLoading } from '@carbon/react';
import PropTypes from 'prop-types';
import apiClient from '../../api/client';
import StreamConnectionManager from '../../utils/streamConnectionManager';
import { useNotifications } from '../../context/NotificationContext';
import './controls.scss';

/**
 * ControlToggle Component
 *
 * A toggle switch that sends true/false values.
 * Subscribes to MQTT state topic for live external updates.
 */
function ControlToggle({ control, onSuccess, onError }) {
  const [loading, setLoading] = useState(false);
  const [toggled, setToggled] = useState(false);
  const { addNotification } = useNotifications();
  const suppressUntilRef = useRef(0);

  const uiConfig = control.control_config?.ui_config || {};
  const label = uiConfig.label || 'Enable';
  const offLabel = uiConfig.offLabel || 'Disable';
  const target = control.control_config?.target || '';
  const connectionId = control.connection_id;
  const stateField = uiConfig.state_field || 'state';

  // Derive state topic from command target (strip /set suffix)
  const stateTopic = target.endsWith('/set') ? target.slice(0, -4) : '';

  // Subscribe to state topic for live updates
  useEffect(() => {
    if (!connectionId || !stateTopic) return;

    const manager = StreamConnectionManager.getInstance();
    const unsubscribe = manager.subscribe(connectionId, (record) => {
      if (record.topic && record.topic !== stateTopic) return;
      if (Date.now() < suppressUntilRef.current) return;

      const state = record[stateField];
      if (state === undefined) return;

      setToggled(state === 'ON' || state === true || state === 1);
    }, {
      topics: stateTopic
    });

    return () => unsubscribe();
  }, [connectionId, stateTopic, stateField]);

  const handleToggle = async (checked) => {
    setLoading(true);
    suppressUntilRef.current = Date.now() + 3000;

    try {
      const result = await apiClient.executeControlCommand(control.id, checked);
      setToggled(checked);
      addNotification({
        kind: 'success',
        title: `${label} ${checked ? 'ON' : 'OFF'}`,
        subtitle: target ? `Published to ${target}` : result.message
      });
      if (onSuccess) onSuccess(result);
    } catch (err) {
      suppressUntilRef.current = 0;
      addNotification({
        kind: 'error',
        title: `${label} command failed`,
        subtitle: err.message
      });
      if (onError) onError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="control-toggle-container">
      <div className="toggle-wrapper">
        <Toggle
          id={`control-toggle-${control.id}`}
          labelText={toggled ? label : offLabel}
          labelA={offLabel}
          labelB={label}
          toggled={toggled}
          onToggle={handleToggle}
          disabled={loading}
          size="md"
        />
        {loading && (
          <InlineLoading description="" className="toggle-loading" />
        )}
      </div>
    </div>
  );
}

ControlToggle.propTypes = {
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

export default ControlToggle;
