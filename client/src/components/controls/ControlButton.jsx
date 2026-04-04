// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { Button, InlineLoading } from '@carbon/react';
import PropTypes from 'prop-types';
import { useControlCommand } from './useControlCommand';
import { registerControl } from './controlRegistry';
import './controls.scss';

/**
 * ControlButton Component
 *
 * A button control that executes a command when clicked.
 * Sends null as the value (buttons just trigger actions).
 * No state subscription — buttons are fire-and-forget.
 */
function ControlButton({ control, onSuccess, onError }) {
  const uiConfig = control.control_config?.ui_config || {};
  const label = uiConfig.label || 'Execute';
  const kind = uiConfig.kind || 'primary';

  const { execute, loading } = useControlCommand({
    controlId: control.id,
    label,
    target: control.control_config?.target || '',
    onSuccess,
    onError
  });

  const handleClick = () => execute(null, `${label} executed`);

  return (
    <div className="control-button-container">
      <Button
        kind={kind}
        onClick={handleClick}
        disabled={loading}
        size="lg"
      >
        {loading ? <InlineLoading description="Executing..." /> : label}
      </Button>
    </div>
  );
}

ControlButton.propTypes = {
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

registerControl('button', ControlButton);
export default ControlButton;
