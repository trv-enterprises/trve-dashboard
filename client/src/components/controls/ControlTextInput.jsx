// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useState } from 'react';
import { TextInput, Button, InlineLoading } from '@carbon/react';
import { Send } from '@carbon/icons-react';
import PropTypes from 'prop-types';
import apiClient from '../../api/client';
import './controls.scss';

/**
 * ControlTextInput Component
 *
 * A text input control that sends string values.
 * Value is sent when the user clicks send or presses Enter.
 */
function ControlTextInput({ control, onSuccess, onError }) {
  const [loading, setLoading] = useState(false);
  const [value, setValue] = useState('');
  const [lastResult, setLastResult] = useState(null);

  const uiConfig = control.control_config?.ui_config || {};
  const label = uiConfig.label || 'Command';
  const placeholder = uiConfig.placeholder || 'Enter value...';
  const submitLabel = uiConfig.submitLabel || 'Send';
  const clearOnSend = uiConfig.clear_on_send !== false; // Default true

  const sendValue = async () => {
    if (!value.trim()) return;

    setLoading(true);
    setLastResult(null);

    try {
      const result = await apiClient.executeControlCommand(control.id, value);
      setLastResult({ success: true, message: result.message });
      if (clearOnSend) {
        setValue('');
      }
      if (onSuccess) onSuccess(result);
    } catch (err) {
      setLastResult({ success: false, message: err.message });
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
      {lastResult && (
        <div className={`control-result ${lastResult.success ? 'success' : 'error'}`}>
          {lastResult.message || (lastResult.success ? 'Success' : 'Failed')}
        </div>
      )}
    </div>
  );
}

ControlTextInput.propTypes = {
  control: PropTypes.shape({
    id: PropTypes.string.isRequired,
    control_config: PropTypes.shape({
      ui_config: PropTypes.object
    })
  }).isRequired,
  onSuccess: PropTypes.func,
  onError: PropTypes.func
};

export default ControlTextInput;
