// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useState } from 'react';
import { TextInput, Button, InlineLoading } from '@carbon/react';
import { Send } from '@carbon/icons-react';
import PropTypes from 'prop-types';
import { useControlState } from './useControlState';
import { useControlCommand } from './useControlCommand';
import { registerControl } from './controlRegistry';
import './controls.scss';

/**
 * ControlTextInput Component
 *
 * A text input control that sends string values.
 * Subscribes to MQTT state topic for live external updates.
 */
function ControlTextInput({ control, readOnly = false, onSuccess, onError }) {
  const [inputValue, setInputValue] = useState('');

  const uiConfig = control.control_config?.ui_config || {};
  const label = uiConfig.label || 'Command';
  const placeholder = uiConfig.placeholder || 'Enter value...';
  const submitLabel = uiConfig.submitLabel || 'Send';
  const clearOnSend = uiConfig.clear_on_send !== false;

  const { value: lastReceived, suppress, clearSuppress } = useControlState({
    connectionId: control.connection_id,
    target: control.control_config?.target || '',
    stateField: uiConfig.state_field || 'value',
    transform: (raw) => String(raw),
    initialValue: ''
  });

  const { execute, loading } = useControlCommand({
    controlId: control.id,
    label,
    target: control.control_config?.target || '',
    onSuppress: suppress,
    onClearSuppress: clearSuppress,
    onSuccess,
    onError
  });

  const sendValue = async () => {
    if (!inputValue.trim()) return;
    await execute(inputValue, `${label} sent`);
    if (clearOnSend) setInputValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !loading && !readOnly) sendValue();
  };

  return (
    <div className="control-text-input-container">
      <div className="text-input-label">{label}</div>
      <div className="text-input-row">
        <TextInput
          id={`control-text-${control.id}`}
          labelText=""
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading || readOnly}
          size="lg"
        />
        {!readOnly && (
          <Button
            kind="primary"
            size="lg"
            onClick={sendValue}
            disabled={loading || !inputValue.trim()}
            renderIcon={Send}
          >
            {loading ? <InlineLoading description="" /> : submitLabel}
          </Button>
        )}
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
  readOnly: PropTypes.bool,
  onSuccess: PropTypes.func,
  onError: PropTypes.func
};

registerControl('text_input', ControlTextInput);
export default ControlTextInput;
