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
  const modes = allModes.filter(mode => {
    if (!mode.requiresCapability) return true;
    return capabilities[mode.requiresCapability] === true;
  });

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
