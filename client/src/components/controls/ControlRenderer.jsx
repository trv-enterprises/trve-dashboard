// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import PropTypes from 'prop-types';
import { getControlComponent } from './controlRegistry';
import { CONTROL_TYPE_INFO } from './controlTypes';
import { formatTitle } from './controlUtils';
import './controls.scss';

/**
 * ControlRenderer Component
 *
 * Dispatcher component that renders the appropriate control type
 * based on the control_config.control_type field.
 * Components self-register via controlRegistry — no manual wiring needed.
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

  const Component = getControlComponent(controlType);
  if (!Component) {
    return (
      <div className="control-error">
        Unknown control type: {controlType}
      </div>
    );
  }

  const title = control.title || control.name;
  const typeInfo = CONTROL_TYPE_INFO[controlType];
  const readOnly = typeInfo && !typeInfo.canWrite;
  const isTile = controlType.startsWith('tile_');

  return (
    <div className={`control-renderer ${isTile ? 'control-renderer--tile' : ''} ${controlType === 'text_label' ? 'control-renderer--text-label' : ''}`}>
      {title && !isTile && controlType !== 'text_label' && <div className="control-title">{formatTitle(title)}</div>}
      <div className="control-body">
        <Component
          control={control}
          readOnly={readOnly}
          onSuccess={onSuccess}
          onError={onError}
        />
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
