import { SideNavItems, SideNavLink } from '@carbon/react';
import { Settings } from '@carbon/icons-react';

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
      icon: Settings,
      label: 'Settings',
      description: 'System administration'
    }
  ];

  return (
    <SideNavItems>
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
    </SideNavItems>
  );
}

export default ManageModeNav;
