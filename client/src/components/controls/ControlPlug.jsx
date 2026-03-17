// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useState, useEffect, useRef } from 'react';
import { InlineLoading } from '@carbon/react';
import { Power } from '@carbon/icons-react';
import PropTypes from 'prop-types';
import apiClient from '../../api/client';
import StreamConnectionManager from '../../utils/streamConnectionManager';
import { useNotifications } from '../../context/NotificationContext';
import './controls.scss';

/**
 * ControlPlug Component
 *
 * HomeKit-style pill with a sliding thumb that moves up (ON) or down (OFF).
 * Subscribes to the device's MQTT state topic to stay in sync with external changes.
 */
function ControlPlug({ control, onSuccess, onError }) {
  const [loading, setLoading] = useState(false);
  const [toggled, setToggled] = useState(false);
  const [connected, setConnected] = useState(false);
  const { addNotification } = useNotifications();
  // After sending a command, ignore stream updates briefly so stale messages
  // don't revert the optimistic UI update before the device confirms
  const suppressUntilRef = useRef(0);

  const uiConfig = control.control_config?.ui_config || {};
  const label = uiConfig.label || 'Plug';
  const onLabel = uiConfig.onLabel || 'On';
  const offLabel = uiConfig.offLabel || 'Off';
  const target = control.control_config?.target || '';
  const connectionId = control.connection_id;

  // Derive state topic from command target (strip /set suffix)
  const stateTopic = target.endsWith('/set') ? target.slice(0, -4) : '';

  // Subscribe to MQTT state topic for live updates
  useEffect(() => {
    if (!connectionId || !stateTopic) return;

    const manager = StreamConnectionManager.getInstance();
    const unsubscribe = manager.subscribe(connectionId, (record) => {
      if (record.topic && record.topic !== stateTopic) return;
      if (Date.now() < suppressUntilRef.current) return;

      const state = record.state;
      if (state === undefined) return;

      setToggled(state === 'ON' || state === true);
    }, {
      topics: stateTopic,
      onConnect: () => setConnected(true),
      onDisconnect: () => setConnected(false)
    });

    return () => unsubscribe();
  }, [connectionId, stateTopic, label]);

  const handleClick = async () => {
    if (loading) return;

    const newValue = !toggled;
    setLoading(true);
    suppressUntilRef.current = Date.now() + 3000;

    try {
      const result = await apiClient.executeControlCommand(control.id, newValue);
      // Optimistic update — will be confirmed by the stream message
      setToggled(newValue);
      addNotification({
        kind: 'success',
        title: `${label} ${newValue ? 'ON' : 'OFF'}`,
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
    <div className="control-plug-container">
      <div
        className={`plug-pill ${toggled ? 'plug-on' : 'plug-off'} ${loading ? 'plug-loading' : ''}`}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
        aria-label={`${label}: ${toggled ? onLabel : offLabel}`}
        aria-pressed={toggled}
      >
        <div className="plug-fill" />
        <div className="plug-thumb">
          <Power size={24} className="plug-icon" />
        </div>
        {loading && <InlineLoading description="" className="plug-inline-loading" />}
      </div>
      <span className="plug-label">{label}</span>
      <span className={`plug-state ${toggled ? 'plug-state-on' : ''}`}>
        {toggled ? onLabel.toUpperCase() : offLabel.toUpperCase()}
      </span>
    </div>
  );
}

ControlPlug.propTypes = {
  control: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string,
    connection_id: PropTypes.string,
    control_config: PropTypes.shape({
      target: PropTypes.string,
      ui_config: PropTypes.object
    })
  }).isRequired,
  onSuccess: PropTypes.func,
  onError: PropTypes.func
};

export default ControlPlug;
