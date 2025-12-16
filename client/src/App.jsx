import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  Header,
  HeaderContainer,
  HeaderName,
  HeaderGlobalBar,
  HeaderGlobalAction,
  SideNav,
  Content
} from '@carbon/react';
import {
  Help,
  Switcher,
  Notification,
  UserAvatar,
  ChartMultitype,
  Menu,
  Close
} from '@carbon/icons-react';
import { API_BASE } from './api/client';
import DatasourcesPage from './pages/DatasourcesPage';
import DatasourceDetailPage from './pages/DatasourceDetailPage';
import ChartsListPage from './pages/ChartsListPage';
import ChartDetailPage from './pages/ChartDetailPage';
import AIBuilderPage from './pages/AIBuilderPage';
import DashboardsListPage from './pages/DashboardsListPage';
import DashboardDetailPage from './pages/DashboardDetailPage';
import DashboardViewerPage from './pages/DashboardViewerPage';
import DashboardTileViewPage from './pages/DashboardTileViewPage';
import ModeToggle from './components/mode/ModeToggle';
import DesignModeNav from './components/navigation/DesignModeNav';
import ViewModeNav from './components/navigation/ViewModeNav';
import ManageModeNav from './components/navigation/ManageModeNav';
import { MODES } from './config/layoutConfig';
import buildInfo from '../build.json';
import './App.scss';

function AppContent() {
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
      navigate('/design/dashboards');
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

  // Fetch first dashboard for default redirect
  useEffect(() => {
    const fetchFirstDashboard = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/dashboards?page=1&page_size=1`);
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
            <button
              className="nav-toggle-button"
              aria-label={isSideNavExpanded ? 'Close menu' : 'Open menu'}
              onClick={() => setIsSideNavExpanded(!isSideNavExpanded)}
              type="button"
            >
              {isSideNavExpanded ? <Close size={20} /> : <Menu size={20} />}
            </button>
            <HeaderName href="/" prefix="">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
                <ChartMultitype size={20} />
                <span>GiVi Dashboards (Build {buildInfo.buildNumber})</span>
              </div>
            </HeaderName>
            <div className="header-mode-group">
              <ModeToggle
                currentMode={currentMode}
                onModeChange={handleModeChange}
              />
            </div>
            <HeaderGlobalBar>
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

      {/* Hide sidebar in View mode - uses tile view instead */}
      {currentMode !== MODES.VIEW && (
        <SideNav
          aria-label="Side navigation"
          expanded={isSideNavExpanded}
          isPersistent={true}
          onOverlayClick={() => setIsSideNavExpanded(false)}
        >
          {renderNavigation()}
        </SideNav>
      )}

      <Content className={`app-content ${currentMode === MODES.VIEW ? 'app-content--no-nav' : (isSideNavExpanded ? '' : 'app-content--nav-collapsed')}`}>
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
          <Route path="/design/datasources" element={<DatasourcesPage />} />
          <Route path="/design/datasources/:id" element={<DatasourceDetailPage />} />
          <Route path="/design/charts" element={<ChartsListPage />} />
          <Route path="/design/charts/ai/:chartId" element={<AIBuilderPage />} />
          <Route path="/design/charts/:id" element={<ChartDetailPage />} />
          <Route path="/design/dashboards" element={<DashboardsListPage />} />
          <Route path="/design/dashboards/:id" element={<DashboardDetailPage />} />

          {/* View Mode Routes */}
          <Route path="/view/dashboards" element={<DashboardTileViewPage />} />
          <Route path="/view/dashboards/:id" element={<DashboardViewerPage />} />

          {/* Manage Mode Routes */}
          <Route path="/manage" element={<div>Manage Settings (Coming in Phase 8)</div>} />

          {/* Legacy routes for backwards compatibility - redirect to design mode */}
          <Route path="/dashboard" element={<Navigate to="/design/dashboards" replace />} />
          <Route path="/design/layouts" element={<Navigate to="/design/dashboards" replace />} />
          <Route path="/design/layouts/:id" element={<Navigate to="/design/dashboards" replace />} />
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
