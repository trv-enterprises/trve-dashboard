// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useState, useEffect, useCallback, useRef } from 'react';
import { Slider, Button, InlineLoading } from '@carbon/react';
import { Send } from '@carbon/icons-react';
import PropTypes from 'prop-types';
import apiClient from '../../api/client';
import StreamConnectionManager from '../../utils/streamConnectionManager';
import { useNotifications } from '../../context/NotificationContext';
import './controls.scss';

/**
 * ControlSlider Component
 *
 * A slider control that sends numeric values.
 * Subscribes to MQTT state topic for live external updates.
 */
function ControlSlider({ control, onSuccess, onError }) {
  const [loading, setLoading] = useState(false);
  const { addNotification } = useNotifications();
  const suppressUntilRef = useRef(0);

  const uiConfig = control.control_config?.ui_config || {};
  const label = uiConfig.label || 'Value';
  const min = uiConfig.min ?? 0;
  const max = uiConfig.max ?? 100;
  const step = uiConfig.step ?? 1;
  const sendOnRelease = uiConfig.send_on_release !== false;
  const target = control.control_config?.target || '';
  const connectionId = control.connection_id;
  const stateField = uiConfig.state_field || 'value';

  const [value, setValue] = useState(min);

  // Derive state topic from command target (strip /set suffix)
  const stateTopic = target.endsWith('/set') ? target.slice(0, -4) : '';

  // Subscribe to state topic for live updates
  useEffect(() => {
    if (!connectionId || !stateTopic) return;

    const manager = StreamConnectionManager.getInstance();
    const unsubscribe = manager.subscribe(connectionId, (record) => {
      if (record.topic && record.topic !== stateTopic) return;
      if (Date.now() < suppressUntilRef.current) return;

      const newValue = record[stateField];
      if (newValue === undefined || typeof newValue !== 'number') return;

      setValue(newValue);
    }, {
      topics: stateTopic
    });

    return () => unsubscribe();
  }, [connectionId, stateTopic, stateField]);

  const sendValue = useCallback(async (valueToSend) => {
    setLoading(true);
    suppressUntilRef.current = Date.now() + 3000;

    try {
      const result = await apiClient.executeControlCommand(control.id, valueToSend);
      addNotification({
        kind: 'success',
        title: `${label} set to ${valueToSend}`,
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
  }, [control.id, label, target, onSuccess, onError, addNotification]);

  const handleChange = ({ value: newValue }) => {
    setValue(newValue);
  };

  const handleRelease = () => {
    if (sendOnRelease) {
      sendValue(value);
    }
  };

  const handleSendClick = () => {
    sendValue(value);
  };

  return (
    <div className="control-slider-container">
      <div className="slider-header">
        <span className="slider-label">{label}</span>
        <span className="slider-value">{value}</span>
      </div>
      <div className="slider-row">
        <Slider
          id={`control-slider-${control.id}`}
          labelText=""
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          onRelease={handleRelease}
          disabled={loading}
          hideTextInput
        />
        {!sendOnRelease && (
          <Button
            kind="primary"
            size="sm"
            hasIconOnly
            renderIcon={Send}
            iconDescription="Send value"
            onClick={handleSendClick}
            disabled={loading}
          />
        )}
        {loading && (
          <InlineLoading description="" className="slider-loading" />
        )}
      </div>
    </div>
  );
}

ControlSlider.propTypes = {
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

export default ControlSlider;
