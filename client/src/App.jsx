import { useState, useEffect, useCallback } from 'react';
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
  Add,
  Checkmark,
  WarningAlt,
  Help,
  Switcher,
  Notification,
  UserAvatar,
  ChartMultitype
} from '@carbon/icons-react';
import DashboardPage from './pages/DashboardPage';
import NodesPage from './pages/NodesPage';
import QueriesPage from './pages/QueriesPage';
import ChartDesignPage from './pages/ChartDesignPage';
import LayoutsPage from './pages/LayoutsPage';
import LayoutDetailPage from './pages/LayoutDetailPage';
import DatasourcesPage from './pages/DatasourcesPage';
import DatasourceDetailPage from './pages/DatasourceDetailPage';
import ChartsListPage from './pages/ChartsListPage';
import ChartDetailPage from './pages/ChartDetailPage';
import DashboardsListPage from './pages/DashboardsListPage';
import DashboardDetailPage from './pages/DashboardDetailPage';
import DashboardViewerPage from './pages/DashboardViewerPage';
import ModeToggle from './components/mode/ModeToggle';
import DesignModeNav from './components/navigation/DesignModeNav';
import ViewModeNav from './components/navigation/ViewModeNav';
import ManageModeNav from './components/navigation/ManageModeNav';
import { MODES } from './config/layoutConfig';
import apiClient from './api/client';
import buildInfo from '../build.json';
import './App.scss';

function AppContent() {
  const [serverStatus, setServerStatus] = useState('checking');
  const [isSideNavExpanded, setIsSideNavExpanded] = useState(true);
  const [currentMode, setCurrentMode] = useState(() => {
    // Load mode from localStorage or default to VIEW
    const savedMode = localStorage.getItem('dashboardMode');
    return savedMode || MODES.VIEW;
  });
  const [firstDashboardId, setFirstDashboardId] = useState(null);
  const [dashboardsLoaded, setDashboardsLoaded] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Handle mode change and persist to localStorage
  const handleModeChange = (newMode) => {
    setCurrentMode(newMode);
    localStorage.setItem('dashboardMode', newMode);
    // Navigate to appropriate default route for the mode
    if (newMode === MODES.DESIGN) {
      navigate('/design/layouts');
    } else if (newMode === MODES.VIEW) {
      // Navigate to first dashboard if available, otherwise to dashboard list
      if (firstDashboardId) {
        navigate(`/view/dashboards/${firstDashboardId}`);
      } else {
        navigate('/view/dashboards');
      }
    } else if (newMode === MODES.MANAGE) {
      navigate('/manage');
    }
  };

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

  // Fetch first dashboard for default redirect
  useEffect(() => {
    const fetchFirstDashboard = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/dashboards?page=1&page_size=1');
        if (response.ok) {
          const data = await response.json();
          if (data.dashboards && data.dashboards.length > 0) {
            setFirstDashboardId(data.dashboards[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch first dashboard:', err);
      } finally {
        setDashboardsLoaded(true);
      }
    };
    fetchFirstDashboard();
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

  // Render navigation based on current mode
  const renderNavigation = () => {
    switch (currentMode) {
      case MODES.DESIGN:
        return <DesignModeNav location={location} navigate={navigate} />;
      case MODES.VIEW:
        return <ViewModeNav location={location} navigate={navigate} />;
      case MODES.MANAGE:
        return <ManageModeNav location={location} navigate={navigate} />;
      default:
        return <DesignModeNav location={location} navigate={navigate} />;
    }
  };

  return (
    <>
      <HeaderContainer
        render={() => (
          <Header aria-label="My Dashboard">
            <HeaderName href="/" prefix="">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ChartMultitype size={20} />
                <span>GiVi-Solutions (Build {buildInfo.buildNumber})</span>
              </div>
            </HeaderName>
            <HeaderGlobalBar>
              <div className="header-mode-group">
                <ModeToggle
                  currentMode={currentMode}
                  onModeChange={handleModeChange}
                />
              </div>
              <div className="header-title">
                <h2>My Dashboard</h2>
              </div>
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
              <HeaderGlobalAction aria-label="Help">
                <Help size={20} />
              </HeaderGlobalAction>
              <HeaderGlobalAction aria-label="App Switcher">
                <Switcher size={20} />
              </HeaderGlobalAction>
              <HeaderGlobalAction aria-label="Notifications">
                <Notification size={20} />
              </HeaderGlobalAction>
              <HeaderGlobalAction aria-label="User Account">
                <UserAvatar size={20} />
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
        {renderNavigation()}
      </SideNav>

      <Content className="app-content">
        <Routes>
          {/* Default route redirects to View mode - first dashboard or fallback */}
          <Route path="/" element={
            dashboardsLoaded ? (
              firstDashboardId ? (
                <Navigate to={`/view/dashboards/${firstDashboardId}`} replace />
              ) : (
                <Navigate to="/view/dashboards" replace />
              )
            ) : null
          } />

          {/* Design Mode Routes */}
          <Route path="/design/layouts" element={<LayoutsPage />} />
          <Route path="/design/layouts/:id" element={<LayoutDetailPage />} />
          <Route path="/design/datasources" element={<DatasourcesPage />} />
          <Route path="/design/datasources/:id" element={<DatasourceDetailPage />} />
          <Route path="/design/charts" element={<ChartsListPage />} />
          <Route path="/design/charts/:id" element={<ChartDetailPage />} />
          <Route path="/design/dashboards" element={<DashboardsListPage />} />
          <Route path="/design/dashboards/:id" element={<DashboardDetailPage />} />

          {/* View Mode Routes */}
          <Route path="/view/dashboards" element={
            <div className="view-welcome">
              <h2>Select a Dashboard</h2>
              <p>Choose a dashboard from the sidebar to view it.</p>
            </div>
          } />
          <Route path="/view/dashboards/:id" element={<DashboardViewerPage />} />

          {/* Manage Mode Routes */}
          <Route path="/manage" element={<div>Manage Settings (Coming in Phase 8)</div>} />

          {/* Legacy routes for backwards compatibility - redirect to design mode */}
          <Route path="/dashboard" element={<Navigate to="/design/layouts" replace />} />
          <Route path="/nodes" element={<Navigate to="/design/datasources" replace />} />
          <Route path="/queries" element={<Navigate to="/design/datasources" replace />} />
          <Route path="/chart-design" element={<Navigate to="/design/charts" replace />} />
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
