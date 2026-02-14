// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useState } from 'react';
import { Button, InlineLoading } from '@carbon/react';
import PropTypes from 'prop-types';
import apiClient from '../../api/client';
import './controls.scss';

/**
 * ControlButton Component
 *
 * A button control that executes a command when clicked.
 * Sends null as the value (buttons just trigger actions).
 */
function ControlButton({ control, onSuccess, onError }) {
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const uiConfig = control.control_config?.ui_config || {};
  const label = uiConfig.label || 'Execute';
  const kind = uiConfig.kind || 'primary';

  const handleClick = async () => {
    setLoading(true);
    setLastResult(null);

    try {
      const result = await apiClient.executeControlCommand(control.id, null);
      setLastResult({ success: true, message: result.message });
      if (onSuccess) onSuccess(result);
    } catch (err) {
      setLastResult({ success: false, message: err.message });
      if (onError) onError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="control-button-container">
      <Button
        kind={kind}
        onClick={handleClick}
        disabled={loading}
        size="lg"
      >
        {loading ? (
          <InlineLoading description="Executing..." />
        ) : (
          label
        )}
      </Button>
      {lastResult && (
        <div className={`control-result ${lastResult.success ? 'success' : 'error'}`}>
          {lastResult.message || (lastResult.success ? 'Success' : 'Failed')}
        </div>
      )}
    </div>
  );
}

ControlButton.propTypes = {
  control: PropTypes.shape({
    id: PropTypes.string.isRequired,
    control_config: PropTypes.shape({
      ui_config: PropTypes.object
    })
  }).isRequired,
  onSuccess: PropTypes.func,
  onError: PropTypes.func
};

export default ControlButton;
