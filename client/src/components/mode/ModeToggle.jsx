// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { Dashboard, Edit, Settings } from '@carbon/icons-react';
import { Button } from '@carbon/react';
import { MODES } from '../../config/layoutConfig';
import './ModeToggle.scss';

/**
 * ModeToggle Component
 *
 * Horizontal icon-based tab system for switching between modes.
 * Uses Carbon Button components with icon-only style for integrated header appearance.
 *
 * @param {string} currentMode - Currently active mode
 * @param {function} onModeChange - Callback when mode changes
 * @param {object} capabilities - User capabilities { can_design, can_manage }
 */
function ModeToggle({ currentMode, onModeChange, capabilities = {} }) {
  // Check if user has any capabilities beyond view-only
  const hasDesignOrManage = capabilities.can_design || capabilities.can_manage;

  const allModes = [
    {
      id: MODES.VIEW,
      icon: Dashboard,
      label: 'View',
      description: 'View dashboards',
      requiresCapability: null // Everyone can view
    },
    {
      id: MODES.DESIGN,
      icon: Edit,
      label: 'Design',
      description: 'Design mode',
      requiresCapability: 'can_design'
    },
    {
      id: MODES.MANAGE,
      icon: Settings,
      label: 'Manage',
      description: 'Manage settings',
      requiresCapability: 'can_manage'
    }
  ];

  // Filter modes based on user capabilities
  // Hide View button if user only has view access (no mode switching needed)
  const modes = allModes.filter(mode => {
    // If user only has view access, don't show the View button (they're always in view mode)
    if (mode.id === MODES.VIEW && !hasDesignOrManage) return false;
    if (!mode.requiresCapability) return true;
    return capabilities[mode.requiresCapability] === true;
  });

  // If no modes to show (view-only user), don't render anything
  if (modes.length === 0) return null;

  return (
    <div className="mode-selector">
      {modes.map((mode) => {
        const isActive = currentMode === mode.id;
        const Icon = mode.icon;

        return (
          <Button
            key={mode.id}
            kind={isActive ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => onModeChange(mode.id)}
          >
            <Icon size={16} />
            <span>{mode.label}</span>
          </Button>
        );
      })}
    </div>
  );
}

export default ModeToggle;
