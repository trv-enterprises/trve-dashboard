// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { Toggle, InlineLoading } from '@carbon/react';
import PropTypes from 'prop-types';
import { useControlState } from './useControlState';
import { useControlCommand } from './useControlCommand';
import { normalizeBoolean } from './controlUtils';
import { registerControl } from './controlRegistry';
import './controls.scss';

/**
 * ControlToggle Component
 *
 * A toggle switch that sends true/false values.
 * Subscribes to MQTT state topic for live external updates.
 */
function ControlToggle({ control, readOnly = false, onSuccess, onError }) {
  const uiConfig = control.control_config?.ui_config || {};
  const label = uiConfig.label || 'Enable';
  const offLabel = uiConfig.offLabel || 'Disable';

  const { value: toggled, setValue: setToggled, suppress, clearSuppress } = useControlState({
    connectionId: control.connection_id,
    target: control.control_config?.target || '',
    stateField: uiConfig.state_field || 'state',
    transform: normalizeBoolean,
    initialValue: false
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

  const handleToggle = async (checked) => {
    setToggled(checked);
    await execute(checked, `${label} ${checked ? 'ON' : 'OFF'}`);
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
          onToggle={readOnly ? undefined : handleToggle}
          disabled={loading || readOnly}
          size="md"
          readOnly={readOnly}
        />
        {loading && <InlineLoading description="" className="toggle-loading" />}
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
  readOnly: PropTypes.bool,
  onSuccess: PropTypes.func,
  onError: PropTypes.func
};

registerControl('toggle', ControlToggle);
export default ControlToggle;
