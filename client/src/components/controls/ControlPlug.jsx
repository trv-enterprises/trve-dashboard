// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { InlineLoading } from '@carbon/react';
import { Power } from '@carbon/icons-react';
import PropTypes from 'prop-types';
import { useControlState } from './useControlState';
import { useControlCommand } from './useControlCommand';
import { normalizeBoolean } from './controlUtils';
import { registerControl } from './controlRegistry';
import './controls.scss';

/**
 * ControlPlug Component
 *
 * HomeKit-style pill with a sliding thumb that moves up (ON) or down (OFF).
 * Subscribes to the device's MQTT state topic to stay in sync with external changes.
 */
function ControlPlug({ control, readOnly = false, onSuccess, onError }) {
  const uiConfig = control.control_config?.ui_config || {};
  const label = uiConfig.label || 'Plug';
  const onLabel = uiConfig.onLabel || 'On';
  const offLabel = uiConfig.offLabel || 'Off';

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

  const handleClick = async () => {
    if (loading || readOnly) return;
    const newValue = !toggled;
    setToggled(newValue);
    await execute(newValue, `${label} ${newValue ? 'ON' : 'OFF'}`);
  };

  return (
    <div className="control-plug-container">
      <div
        className={`plug-pill ${toggled ? 'plug-on' : 'plug-off'} ${loading ? 'plug-loading' : ''} ${readOnly ? 'plug-readonly' : ''}`}
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
  readOnly: PropTypes.bool,
  onSuccess: PropTypes.func,
  onError: PropTypes.func
};

registerControl('switch', ControlPlug);
registerControl('plug', ControlPlug); // Backward compatibility
export default ControlPlug;
