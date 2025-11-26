import { SideNavItems, SideNavLink } from '@carbon/react';
import {
  Grid,
  DataBase,
  ChartLineSmooth,
  Dashboard
} from '@carbon/icons-react';

/**
 * DesignModeNav Component
 *
 * Navigation for Design Mode with 4 sections:
 * - Layouts: Create and manage panel layouts
 * - Datasources: Configure data connections
 * - Charts: Create and edit chart components
 * - Dashboards: Combine layouts + charts + datasources
 */
function DesignModeNav({ location, navigate }) {
  const designNavItems = [
    {
      path: '/design/layouts',
      icon: Grid,
      label: 'Layouts',
      description: 'Create and manage panel layouts'
    },
    {
      path: '/design/datasources',
      icon: DataBase,
      label: 'Datasources',
      description: 'Configure data connections'
    },
    {
      path: '/design/charts',
      icon: ChartLineSmooth,
      label: 'Charts',
      description: 'Create and edit chart components'
    },
    {
      path: '/design/dashboards',
      icon: Dashboard,
      label: 'Dashboards',
      description: 'Combine layouts, charts, and datasources'
    }
  ];

  return (
    <SideNavItems>
      {designNavItems.map((item) => {
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

export default DesignModeNav;
