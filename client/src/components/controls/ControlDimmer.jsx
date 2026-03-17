// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useState, useEffect, useRef, useCallback } from 'react';
import { InlineLoading } from '@carbon/react';
import { LightFilled } from '@carbon/icons-react';
import PropTypes from 'prop-types';
import apiClient from '../../api/client';
import StreamConnectionManager from '../../utils/streamConnectionManager';
import { useNotifications } from '../../context/NotificationContext';
import './controls.scss';

/**
 * ControlDimmer Component
 *
 * HomeKit-style vertical slider pill for dimming lights.
 * Drag up/down to set level (0-100). Fill rises from bottom.
 * Sends value on mouse/touch release only.
 * Subscribes to MQTT state topic for live updates.
 */
function ControlDimmer({ control, onSuccess, onError }) {
  const [loading, setLoading] = useState(false);
  const [level, setLevel] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dragLevel, setDragLevel] = useState(null);
  const { addNotification } = useNotifications();
  const suppressUntilRef = useRef(0);
  const pillRef = useRef(null);

  const uiConfig = control.control_config?.ui_config || {};
  const label = uiConfig.label || 'Light';
  const min = uiConfig.min ?? 0;
  const max = uiConfig.max ?? 100;
  const step = uiConfig.step ?? 1;
  const target = control.control_config?.target || '';
  const connectionId = control.connection_id;

  // Derive state topic from command target (strip /set suffix)
  const stateTopic = target.endsWith('/set') ? target.slice(0, -4) : '';

  // The displayed level — drag value takes priority during interaction
  const displayLevel = dragging && dragLevel !== null ? dragLevel : level;
  const fillPercent = ((displayLevel - min) / (max - min)) * 100;
  const isOn = displayLevel > min;

  // Subscribe to MQTT state topic for live updates
  useEffect(() => {
    if (!connectionId || !stateTopic) return;

    const manager = StreamConnectionManager.getInstance();
    const unsubscribe = manager.subscribe(connectionId, (record) => {
      if (record.topic && record.topic !== stateTopic) return;
      if (Date.now() < suppressUntilRef.current) return;

      // Try to extract level from state record
      const stateField = uiConfig.state_field || 'level';
      let val = record[stateField];
      if (val === undefined && record.level !== undefined) val = record.level;
      if (val === undefined && record.brightness !== undefined) val = record.brightness;
      if (val === undefined) return;

      const numVal = Number(val);
      if (!isNaN(numVal)) {
        setLevel(Math.max(min, Math.min(max, numVal)));
      }
    }, {
      topics: stateTopic,
    });

    return () => unsubscribe();
  }, [connectionId, stateTopic, min, max, uiConfig.state_field]);

  // Convert a Y position within the pill to a level value
  const yToLevel = useCallback((clientY) => {
    if (!pillRef.current) return level;
    const rect = pillRef.current.getBoundingClientRect();
    // Invert: top of pill = max, bottom = min
    const ratio = 1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    const raw = min + ratio * (max - min);
    // Snap to step
    const snapped = Math.round(raw / step) * step;
    return Math.max(min, Math.min(max, snapped));
  }, [min, max, step, level]);

  const sendLevel = async (newLevel) => {
    if (loading) return;

    setLoading(true);
    suppressUntilRef.current = Date.now() + 3000;

    try {
      const result = await apiClient.executeControlCommand(control.id, newLevel);
      setLevel(newLevel);
      addNotification({
        kind: 'success',
        title: `${label} ${newLevel > min ? `${newLevel}%` : 'OFF'}`,
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

  // Mouse/touch handlers
  const handlePointerDown = (e) => {
    if (loading) return;
    e.preventDefault();
    setDragging(true);
    setDragLevel(yToLevel(e.clientY));

    const handlePointerMove = (moveEvent) => {
      setDragLevel(yToLevel(moveEvent.clientY));
    };

    const handlePointerUp = (upEvent) => {
      const finalLevel = yToLevel(upEvent.clientY);
      setLevel(finalLevel); // Optimistic — hold this value until MQTT confirms
      setDragging(false);
      setDragLevel(null);
      sendLevel(finalLevel);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  };

  // Click to toggle on/off (tap without drag)
  const handleClick = (e) => {
    // Only handle simple clicks, not drags
    if (dragging) return;
  };

  // Keyboard support
  const handleKeyDown = (e) => {
    let newLevel = level;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      newLevel = Math.min(max, level + step);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      newLevel = Math.max(min, level - step);
    } else if (e.key === 'Home') {
      newLevel = max;
    } else if (e.key === 'End') {
      newLevel = min;
    } else {
      return;
    }
    e.preventDefault();
    setLevel(newLevel);
    sendLevel(newLevel);
  };

  return (
    <div className="control-dimmer-container">
      <div
        ref={pillRef}
        className={`dimmer-pill ${isOn ? 'dimmer-on' : 'dimmer-off'} ${loading ? 'dimmer-loading' : ''} ${dragging ? 'dimmer-dragging' : ''}`}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="slider"
        tabIndex={0}
        aria-label={`${label}: ${displayLevel}%`}
        aria-valuenow={displayLevel}
        aria-valuemin={min}
        aria-valuemax={max}
      >
        <div className="dimmer-fill" style={{ height: `${fillPercent}%` }} />
        <div className="dimmer-icon-container">
          <LightFilled size={28} className="dimmer-icon" />
        </div>
        <div className="dimmer-value-overlay">
          {displayLevel > min ? `${Math.round(displayLevel)}%` : ''}
        </div>
        {loading && <InlineLoading description="" className="dimmer-inline-loading" />}
      </div>
      <span className="dimmer-label">{label}</span>
      <span className={`dimmer-state ${isOn ? 'dimmer-state-on' : ''}`}>
        {isOn ? `${Math.round(displayLevel)}%` : 'OFF'}
      </span>
    </div>
  );
}

ControlDimmer.propTypes = {
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

export default ControlDimmer;
