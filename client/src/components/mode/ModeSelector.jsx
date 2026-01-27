// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { Dropdown } from '@carbon/react';
import { MODES } from '../../config/layoutConfig';
import './ModeSelector.scss';

/**
 * ModeSelector Component
 *
 * Dropdown for switching between Design, View, and Manage modes.
 * Mode selection persists in localStorage.
 */
function ModeSelector({ currentMode, onModeChange }) {
  const modeOptions = [
    {
      id: MODES.DESIGN,
      label: 'Design Mode',
      description: 'Create and configure layouts, datasources, charts, and dashboards'
    },
    {
      id: MODES.VIEW,
      label: 'View Mode',
      description: 'View live dashboards with real-time data'
    },
    {
      id: MODES.MANAGE,
      label: 'Manage Mode',
      description: 'System administration and monitoring'
    }
  ];

  const handleChange = ({ selectedItem }) => {
    if (selectedItem && selectedItem.id !== currentMode) {
      onModeChange(selectedItem.id);
    }
  };

  const selectedItem = modeOptions.find(mode => mode.id === currentMode);

  return (
    <div className="mode-selector">
      <Dropdown
        id="mode-dropdown"
        label={selectedItem?.label || 'Select Mode'}
        items={modeOptions}
        itemToString={(item) => item?.label || ''}
        selectedItem={selectedItem}
        onChange={handleChange}
        size="md"
        titleText="Mode"
        helperText={selectedItem?.description || ''}
      />
    </div>
  );
}

export default ModeSelector;
