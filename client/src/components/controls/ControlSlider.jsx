// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { Slider, Button, InlineLoading } from '@carbon/react';
import { Send } from '@carbon/icons-react';
import PropTypes from 'prop-types';
import { useControlState } from './useControlState';
import { useControlCommand } from './useControlCommand';
import { registerControl } from './controlRegistry';
import './controls.scss';

/**
 * ControlSlider Component
 *
 * A slider control that sends numeric values.
 * Subscribes to MQTT state topic for live external updates.
 */
function ControlSlider({ control, readOnly = false, onSuccess, onError }) {
  const uiConfig = control.control_config?.ui_config || {};
  const label = uiConfig.label || 'Value';
  const min = uiConfig.min ?? 0;
  const max = uiConfig.max ?? 100;
  const step = uiConfig.step ?? 1;
  const sendOnRelease = uiConfig.send_on_release !== false;

  const { value, setValue, suppress, clearSuppress } = useControlState({
    connectionId: control.connection_id,
    target: control.control_config?.target || '',
    stateField: uiConfig.state_field || 'value',
    transform: (raw) => typeof raw === 'number' ? raw : undefined,
    initialValue: min
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

  const sendValue = (v) => execute(v, `${label} set to ${v}`);

  const handleChange = ({ value: newValue }) => setValue(newValue);
  const handleRelease = () => { if (sendOnRelease && !readOnly) sendValue(value); };
  const handleSendClick = () => sendValue(value);

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
          disabled={loading || readOnly}
          hideTextInput
        />
        {!sendOnRelease && !readOnly && (
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
        {loading && <InlineLoading description="" className="slider-loading" />}
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
  readOnly: PropTypes.bool,
  onSuccess: PropTypes.func,
  onError: PropTypes.func
};

registerControl('slider', ControlSlider);
export default ControlSlider;
