import { SideNavItems, SideNavLink } from '@carbon/react';
import {
  Edit,
  DataBase,
  ChartLineSmooth,
  Dashboard
} from '@carbon/icons-react';
import './DesignModeNav.scss';

/**
 * DesignModeNav Component
 *
 * Navigation for Design Mode with 3 sections:
 * - Data Sources: Configure data connections
 * - Charts: Create and edit chart components
 * - Dashboards: Combine charts + data sources with embedded layouts
 */
function DesignModeNav({ location, navigate }) {
  const designNavItems = [
    {
      path: '/design/datasources',
      icon: DataBase,
      label: 'Data Sources',
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
      description: 'Combine charts and data sources'
    }
  ];

  return (
    <SideNavItems>
      <div className="design-mode-nav">
        <div className="nav-header">
          <Edit size={16} />
          <span>Resources</span>
        </div>

        <div className="nav-links">
          {designNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <SideNavLink
                key={item.path}
                renderIcon={Icon}
                href={item.path}
                isActive={location.pathname.startsWith(item.path)}
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

export default DesignModeNav;
