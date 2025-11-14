import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  Header,
  HeaderContainer,
  HeaderName,
  HeaderGlobalBar,
  HeaderGlobalAction,
  SideNav,
  SideNavItems,
  SideNavLink,
  Tag,
  Content
} from '@carbon/react';
import {
  Dashboard,
  DataBase,
  Search,
  ChartLineSmooth,
  Add,
  Checkmark,
  WarningAlt
} from '@carbon/icons-react';
import DashboardPage from './pages/DashboardPage';
import NodesPage from './pages/NodesPage';
import QueriesPage from './pages/QueriesPage';
import ChartDesignPage from './pages/ChartDesignPage';
import apiClient from './api/client';
import './App.scss';

function AppContent() {
  const [serverStatus, setServerStatus] = useState('checking');
  const [isSideNavExpanded, setIsSideNavExpanded] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  // Check server health on mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        await apiClient.health();
        setServerStatus('connected');
      } catch (err) {
        setServerStatus('disconnected');
      }
    };
    checkHealth();
  }, []);

  const handleCreateNew = () => {
    navigate('/chart-design');
    // Add a small delay to ensure navigation completes before triggering create mode
    setTimeout(() => {
      // This will be handled by the ChartDesignPage component
      const event = new CustomEvent('create-component');
      window.dispatchEvent(event);
    }, 100);
  };

  const navItems = [
    { path: '/dashboard', icon: Dashboard, label: 'Dashboard' },
    { path: '/nodes', icon: DataBase, label: 'Nodes' },
    { path: '/queries', icon: Search, label: 'Queries' },
    { path: '/chart-design', icon: ChartLineSmooth, label: 'Chart Design' }
  ];

  return (
    <>
      <HeaderContainer
        render={() => (
          <Header aria-label="Monitoring Dashboard">
            <HeaderName prefix="">
              data source Monitor
            </HeaderName>
            <div className="header-subtitle">
              Distributed Database Cluster Monitoring
            </div>
            <HeaderGlobalBar>
              <div className="header-status">
                <Tag
                  type={serverStatus === 'connected' ? 'green' : 'red'}
                  size="md"
                >
                  {serverStatus === 'connected' ? (
                    <>
                      <Checkmark size={16} />
                      <span>Connected</span>
                    </>
                  ) : (
                    <>
                      <WarningAlt size={16} />
                      <span>Offline</span>
                    </>
                  )}
                </Tag>
              </div>
              <HeaderGlobalAction
                aria-label="Create new component"
                onClick={handleCreateNew}
                isActive={location.pathname === '/chart-design'}
                disabled={serverStatus !== 'connected'}
              >
                <Add size={20} />
              </HeaderGlobalAction>
            </HeaderGlobalBar>
          </Header>
        )}
      />

      <SideNav
        aria-label="Side navigation"
        expanded={isSideNavExpanded}
        isPersistent={true}
        onOverlayClick={() => setIsSideNavExpanded(false)}
      >
        <SideNavItems>
          {navItems.map((item) => {
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
      </SideNav>

      <Content className="app-content">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/nodes" element={<NodesPage />} />
          <Route path="/queries" element={<QueriesPage />} />
          <Route path="/chart-design" element={<ChartDesignPage />} />
        </Routes>
      </Content>
    </>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
