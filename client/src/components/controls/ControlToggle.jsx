// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useState } from 'react';
import { Toggle, InlineLoading } from '@carbon/react';
import PropTypes from 'prop-types';
import apiClient from '../../api/client';
import './controls.scss';

/**
 * ControlToggle Component
 *
 * A toggle switch that sends true/false values.
 */
function ControlToggle({ control, onSuccess, onError }) {
  const [loading, setLoading] = useState(false);
  const [toggled, setToggled] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const uiConfig = control.control_config?.ui_config || {};
  const label = uiConfig.label || 'Enable';
  const offLabel = uiConfig.offLabel || 'Disable';

  const handleToggle = async (checked) => {
    setLoading(true);
    setLastResult(null);

    try {
      const result = await apiClient.executeControlCommand(control.id, checked);
      setToggled(checked);
      setLastResult({ success: true, message: result.message });
      if (onSuccess) onSuccess(result);
    } catch (err) {
      // Revert toggle on error
      setLastResult({ success: false, message: err.message });
      if (onError) onError(err);
    } finally {
      setLoading(false);
    }
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
          onToggle={handleToggle}
          disabled={loading}
          size="md"
        />
        {loading && (
          <InlineLoading description="" className="toggle-loading" />
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

ControlToggle.propTypes = {
  control: PropTypes.shape({
    id: PropTypes.string.isRequired,
    control_config: PropTypes.shape({
      ui_config: PropTypes.object
    })
  }).isRequired,
  onSuccess: PropTypes.func,
  onError: PropTypes.func
};

export default ControlToggle;
