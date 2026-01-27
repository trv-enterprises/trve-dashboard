// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useState, useEffect } from 'react';
import {
  Modal,
  RadioButtonGroup,
  RadioButton
} from '@carbon/react';
import './DefaultLayoutDimensionEditorModal.scss';

/**
 * DefaultLayoutDimensionEditorModal Component
 *
 * Modal for selecting the default layout dimension from the available presets.
 * Shows a radio button group with all available dimensions.
 */
function DefaultLayoutDimensionEditorModal({ open, onClose, currentValue, availableDimensions, onSave }) {
  const [selectedValue, setSelectedValue] = useState('');

  // Initialize local state when modal opens
  useEffect(() => {
    if (open) {
      setSelectedValue(currentValue || '');
    }
  }, [open, currentValue]);

  const handleSave = () => {
    onSave(selectedValue);
  };

  return (
    <Modal
      open={open}
      onRequestClose={onClose}
      modalHeading="Select Default Layout Dimension"
      primaryButtonText="Save"
      secondaryButtonText="Cancel"
      onRequestSubmit={handleSave}
      size="md"
      className="default-layout-dimension-modal"
    >
      <div className="default-layout-dimension-editor">
        <p className="modal-description">
          Select the default layout dimension that will be used when creating new dashboards.
        </p>

        {availableDimensions.length === 0 ? (
          <p className="no-dimensions">
            No layout dimensions available. Please configure layout dimensions first.
          </p>
        ) : (
          <RadioButtonGroup
            legendText="Available Dimensions"
            name="default-dimension"
            orientation="vertical"
            valueSelected={selectedValue}
            onChange={(value) => setSelectedValue(value)}
          >
            {availableDimensions.map((dim) => (
              <RadioButton
                key={dim.name}
                id={`dim-${dim.name}`}
                labelText={
                  <span className="dimension-label">
                    <strong>{dim.name}</strong>
                    <span className="dimension-size">
                      {dim.max_width} × {dim.max_height}px
                    </span>
                  </span>
                }
                value={dim.name}
              />
            ))}
          </RadioButtonGroup>
        )}
      </div>
    </Modal>
  );
}

export default DefaultLayoutDimensionEditorModal;
