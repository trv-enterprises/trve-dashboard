// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useState, useEffect, useRef } from 'react';
import { TextInput, Button, InlineLoading } from '@carbon/react';
import { Send } from '@carbon/icons-react';
import PropTypes from 'prop-types';
import apiClient from '../../api/client';
import StreamConnectionManager from '../../utils/streamConnectionManager';
import { useNotifications } from '../../context/NotificationContext';
import './controls.scss';

/**
 * ControlTextInput Component
 *
 * A text input control that sends string values.
 * Subscribes to MQTT state topic for live external updates.
 */
function ControlTextInput({ control, onSuccess, onError }) {
  const [loading, setLoading] = useState(false);
  const [value, setValue] = useState('');
  const [lastReceived, setLastReceived] = useState('');
  const { addNotification } = useNotifications();
  const suppressUntilRef = useRef(0);

  const uiConfig = control.control_config?.ui_config || {};
  const label = uiConfig.label || 'Command';
  const placeholder = uiConfig.placeholder || 'Enter value...';
  const submitLabel = uiConfig.submitLabel || 'Send';
  const clearOnSend = uiConfig.clear_on_send !== false;
  const target = control.control_config?.target || '';
  const connectionId = control.connection_id;
  const stateField = uiConfig.state_field || 'value';

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
      if (newValue === undefined) return;

      setLastReceived(String(newValue));
    }, {
      topics: stateTopic
    });

    return () => unsubscribe();
  }, [connectionId, stateTopic, stateField]);

  const sendValue = async () => {
    if (!value.trim()) return;

    setLoading(true);
    suppressUntilRef.current = Date.now() + 3000;

    try {
      const result = await apiClient.executeControlCommand(control.id, value);
      addNotification({
        kind: 'success',
        title: `${label} sent`,
        subtitle: target ? `Published to ${target}` : result.message
      });
      if (clearOnSend) {
        setValue('');
      }
      if (onSuccess) onSuccess(result);
    } catch (err) {
      suppressUntilRef.current = 0;
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

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !loading) {
      sendValue();
    }
  };

  return (
    <div className="control-text-input-container">
      <div className="text-input-label">{label}</div>
      <div className="text-input-row">
        <TextInput
          id={`control-text-${control.id}`}
          labelText=""
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          size="lg"
        />
        <Button
          kind="primary"
          size="lg"
          onClick={sendValue}
          disabled={loading || !value.trim()}
          renderIcon={Send}
        >
          {loading ? (
            <InlineLoading description="" />
          ) : (
            submitLabel
          )}
        </Button>
      </div>
      {lastReceived && (
        <div className="text-input-last-received">
          Last received: {lastReceived}
        </div>
      )}
    </div>
  );
}

ControlTextInput.propTypes = {
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

export default ControlTextInput;
