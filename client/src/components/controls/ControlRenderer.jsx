// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import PropTypes from 'prop-types';
import ControlButton from './ControlButton';
import ControlToggle from './ControlToggle';
import ControlSlider from './ControlSlider';
import ControlTextInput from './ControlTextInput';
import { CONTROL_TYPES } from './index';
import './controls.scss';

/**
 * ControlRenderer Component
 *
 * Dispatcher component that renders the appropriate control type
 * based on the control_config.control_type field.
 */
function ControlRenderer({ control, onSuccess, onError }) {
  const controlType = control.control_config?.control_type;

  if (!controlType) {
    return (
      <div className="control-error">
        Control type not configured
      </div>
    );
  }

  const title = control.title || control.name;

  const renderControl = () => {
    switch (controlType) {
      case CONTROL_TYPES.BUTTON:
        return <ControlButton control={control} onSuccess={onSuccess} onError={onError} />;
      case CONTROL_TYPES.TOGGLE:
        return <ControlToggle control={control} onSuccess={onSuccess} onError={onError} />;
      case CONTROL_TYPES.SLIDER:
        return <ControlSlider control={control} onSuccess={onSuccess} onError={onError} />;
      case CONTROL_TYPES.TEXT_INPUT:
        return <ControlTextInput control={control} onSuccess={onSuccess} onError={onError} />;
      default:
        return (
          <div className="control-error">
            Unknown control type: {controlType}
          </div>
        );
    }
  };

  return (
    <div className="control-renderer">
      {title && <div className="control-title">{title}</div>}
      <div className="control-body">
        {renderControl()}
      </div>
    </div>
  );
}

ControlRenderer.propTypes = {
  control: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string,
    title: PropTypes.string,
    control_config: PropTypes.shape({
      control_type: PropTypes.string,
      ui_config: PropTypes.object
    })
  }).isRequired,
  onSuccess: PropTypes.func,
  onError: PropTypes.func
};

export default ControlRenderer;
