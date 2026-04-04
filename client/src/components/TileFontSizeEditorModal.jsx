// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useState, useEffect } from 'react';
import {
  Modal,
  RadioButtonGroup,
  RadioButton
} from '@carbon/react';

const FONT_SIZE_OPTIONS = [
  { key: 'xs', label: 'Extra Small', size: '10px' },
  { key: 'sm', label: 'Small (default)', size: '12px' },
  { key: 'md', label: 'Medium', size: '14px' },
  { key: 'lg', label: 'Large', size: '16px' }
];

/**
 * TileFontSizeEditorModal Component
 *
 * Modal for selecting the font size used across all compact tile controls.
 * Shows radio buttons with live preview text at each size.
 */
function TileFontSizeEditorModal({ open, onClose, currentValue, onSave }) {
  const [selectedValue, setSelectedValue] = useState('sm');

  useEffect(() => {
    if (open) {
      setSelectedValue(currentValue || 'sm');
    }
  }, [open, currentValue]);

  const handleSave = () => {
    onSave(selectedValue);
  };

  return (
    <Modal
      open={open}
      onRequestClose={onClose}
      modalHeading="Tile Font Size"
      primaryButtonText="Save"
      secondaryButtonText="Cancel"
      onRequestSubmit={handleSave}
      size="sm"
    >
      <div style={{ padding: '0 0 1rem' }}>
        <p style={{ color: 'var(--cds-text-secondary)', marginBottom: '1rem' }}>
          Set the font size for all compact tile controls on dashboards.
        </p>

        <RadioButtonGroup
          legendText="Font Size"
          name="tile-font-size"
          orientation="vertical"
          valueSelected={selectedValue}
          onChange={(value) => setSelectedValue(value)}
        >
          {FONT_SIZE_OPTIONS.map((opt) => (
            <RadioButton
              key={opt.key}
              id={`tile-font-${opt.key}`}
              labelText={
                <span style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                  <strong>{opt.label}</strong>
                  <span style={{ fontSize: opt.size, color: 'var(--cds-text-secondary)' }}>
                    Sample Text — {opt.size}
                  </span>
                </span>
              }
              value={opt.key}
            />
          ))}
        </RadioButtonGroup>
      </div>
    </Modal>
  );
}

export default TileFontSizeEditorModal;
