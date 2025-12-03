import { SideNavItems, SideNavLink } from '@carbon/react';
import { Settings, SettingsAdjust } from '@carbon/icons-react';
import './ManageModeNav.scss';

/**
 * ManageModeNav Component
 *
 * Navigation for Manage Mode - system administration and monitoring.
 * This is a placeholder that will be expanded in Phase 8.
 */
function ManageModeNav({ location, navigate }) {
  const manageNavItems = [
    {
      path: '/manage',
      icon: SettingsAdjust,
      label: 'Settings',
      description: 'System administration'
    }
  ];

  return (
    <SideNavItems>
      <div className="manage-mode-nav">
        <div className="nav-header">
          <Settings size={16} />
          <span>Configuration</span>
        </div>

        <div className="nav-links">
          {manageNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <SideNavLink
                key={item.path}
                renderIcon={Icon}
                href={item.path}
                isActive={location.pathname === item.path}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(item.path);
                }}
              >
                {item.label}
              </SideNavLink>
            );
          })}
        </div>
      </div>
    </SideNavItems>
  );
}

export default ManageModeNav;
