import { Dashboard, Edit, Settings } from '@carbon/icons-react';
import { Button } from '@carbon/react';
import { MODES } from '../../config/layoutConfig';
import './ModeToggle.scss';

/**
 * ModeToggle Component
 *
 * Horizontal icon-based tab system for switching between modes.
 * Uses Carbon Button components with icon-only style for integrated header appearance.
 */
function ModeToggle({ currentMode, onModeChange }) {
  const modes = [
    {
      id: MODES.VIEW,
      icon: Dashboard,
      label: 'View',
      description: 'View dashboards'
    },
    {
      id: MODES.DESIGN,
      icon: Edit,
      label: 'Design',
      description: 'Design mode'
    },
    {
      id: MODES.MANAGE,
      icon: Settings,
      label: 'Manage',
      description: 'Manage settings'
    }
  ];

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
