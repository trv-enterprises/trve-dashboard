// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useState, useCallback } from 'react';
import { Slider, Button, InlineLoading } from '@carbon/react';
import { Send } from '@carbon/icons-react';
import PropTypes from 'prop-types';
import apiClient from '../../api/client';
import './controls.scss';

/**
 * ControlSlider Component
 *
 * A slider control that sends numeric values.
 * Value is sent when the user releases the slider or clicks the send button.
 */
function ControlSlider({ control, onSuccess, onError }) {
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const uiConfig = control.control_config?.ui_config || {};
  const label = uiConfig.label || 'Value';
  const min = uiConfig.min ?? 0;
  const max = uiConfig.max ?? 100;
  const step = uiConfig.step ?? 1;
  const sendOnRelease = uiConfig.send_on_release !== false; // Default true

  const [value, setValue] = useState(min);
  const [pendingValue, setPendingValue] = useState(null);

  const sendValue = useCallback(async (valueToSend) => {
    setLoading(true);
    setLastResult(null);

    try {
      const result = await apiClient.executeControlCommand(control.id, valueToSend);
      setLastResult({ success: true, message: result.message });
      setPendingValue(null);
      if (onSuccess) onSuccess(result);
    } catch (err) {
      setLastResult({ success: false, message: err.message });
      if (onError) onError(err);
    } finally {
      setLoading(false);
    }
  }, [control.id, onSuccess, onError]);

  const handleChange = ({ value: newValue }) => {
    setValue(newValue);
    if (!sendOnRelease) {
      setPendingValue(newValue);
    }
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
      {lastResult && (
        <div className={`control-result ${lastResult.success ? 'success' : 'error'}`}>
          {lastResult.message || (lastResult.success ? 'Success' : 'Failed')}
        </div>
      )}
    </div>
  );
}

ControlSlider.propTypes = {
  control: PropTypes.shape({
    id: PropTypes.string.isRequired,
    control_config: PropTypes.shape({
      ui_config: PropTypes.object
    })
  }).isRequired,
  onSuccess: PropTypes.func,
  onError: PropTypes.func
};

export default ControlSlider;
