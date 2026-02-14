// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  Header,
  HeaderContainer,
  HeaderName,
  HeaderGlobalBar,
  HeaderGlobalAction,
  SideNav,
  Content,
  OverflowMenu,
  OverflowMenuItem
} from '@carbon/react';
import {
  Help,
  Switcher,
  Notification,
  UserAvatar,
  ChartMultitype,
  Menu,
  Close,
  Checkmark
} from '@carbon/icons-react';
import apiClient, { API_BASE } from './api/client';
import ConnectionsPage from './pages/ConnectionsPage';
import ConnectionDetailPage from './pages/ConnectionDetailPage';
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
import UsersListPage from './pages/UsersListPage';
import UserDetailPage from './pages/UserDetailPage';
import SettingsPage from './pages/SettingsPage';
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
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [userCapabilities, setUserCapabilities] = useState({ can_design: false, can_manage: false });
  const location = useLocation();
  const navigate = useNavigate();

  // Fetch users list on mount
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await apiClient.getUsers();
        if (response.users) {
          setUsers(response.users);
          // If no current user set, use the saved one from localStorage or default to first user
          const savedGuid = apiClient.getCurrentUserGuid();
          const savedUser = savedGuid ? response.users.find(u => u.guid === savedGuid) : null;
          if (savedUser) {
            setCurrentUser(savedUser);
            // Sync the API client with the restored user
            apiClient.setCurrentUser(savedUser.guid);
          } else if (response.users.length > 0) {
            // Default to first user (Admin)
            handleUserChange(response.users[0]);
          }
        }
      } catch (err) {
        console.error('Failed to fetch users:', err);
      }
    };
    fetchUsers();
  }, []);

  // Fetch current user capabilities when user changes
  const fetchCapabilities = useCallback(async () => {
    if (!currentUser) return;
    try {
      const capabilities = await apiClient.getCurrentUser();
      setUserCapabilities(capabilities);
      // If current mode is not allowed for this user, switch to VIEW
      if (currentMode === MODES.DESIGN && !capabilities.can_design) {
        handleModeChange(MODES.VIEW);
      } else if (currentMode === MODES.MANAGE && !capabilities.can_manage) {
        handleModeChange(MODES.VIEW);
      }
    } catch (err) {
      console.error('Failed to fetch capabilities:', err);
      // Default to VIEW-only if we can't fetch capabilities
      setUserCapabilities({ can_design: false, can_manage: false });
    }
  }, [currentUser, currentMode]);

  useEffect(() => {
    fetchCapabilities();
  }, [fetchCapabilities]);

  // Handle user selection change
  const handleUserChange = (user) => {
    setCurrentUser(user);
    apiClient.setCurrentUser(user.guid);
  };

  // Fetch default dashboard (user preference or first alphabetically)
  const fetchDefaultDashboard = async () => {
    try {
      // First check if user has a configured default dashboard
      const userGuid = apiClient.getCurrentUserGuid();
      if (userGuid) {
        try {
          const userConfig = await apiClient.getUserConfig(userGuid);
          if (userConfig.settings?.default_dashboard_id) {
            return userConfig.settings.default_dashboard_id;
          }
        } catch {
          // Ignore errors - user may not have config yet
        }
      }

      // Fall back to first dashboard alphabetically
      const response = await fetch(`${API_BASE}/api/dashboards?page=1&page_size=1`);
      if (response.ok) {
        const data = await response.json();
        if (data.dashboards && data.dashboards.length > 0) {
          return data.dashboards[0].id;
        }
      }
    } catch (err) {
      console.error('Failed to fetch default dashboard:', err);
    }
    return null;
  };

  // Handle mode change and persist to localStorage
  const handleModeChange = async (newMode) => {
    setCurrentMode(newMode);
    localStorage.setItem('dashboardMode', newMode);
    // Navigate to appropriate default route for the mode
    if (newMode === MODES.DESIGN) {
      navigate('/design/dashboards');
    } else if (newMode === MODES.VIEW) {
      // Fetch fresh default dashboard when switching to View mode
      const defaultId = await fetchDefaultDashboard();
      if (defaultId) {
        navigate(`/view/dashboards/${defaultId}`);
      } else {
        navigate('/view/dashboards');
      }
    } else if (newMode === MODES.MANAGE) {
      navigate('/manage');
    }
  };

  // Initial fetch of default dashboard for app load redirect
  useEffect(() => {
    const loadDefaultDashboard = async () => {
      const defaultId = await fetchDefaultDashboard();
      setFirstDashboardId(defaultId);
      setDashboardsLoaded(true);
    };
    loadDefaultDashboard();
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
            {/* Only show nav toggle in Design/Manage modes (View mode has no sidebar) */}
            {currentMode !== MODES.VIEW && (
              <button
                className="nav-toggle-button"
                aria-label={isSideNavExpanded ? 'Close menu' : 'Open menu'}
                onClick={() => setIsSideNavExpanded(!isSideNavExpanded)}
                type="button"
              >
                {isSideNavExpanded ? <Close size={20} /> : <Menu size={20} />}
              </button>
            )}
            <HeaderName href="/" prefix="" className={currentMode === MODES.VIEW ? 'header-name--no-toggle' : ''}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
                <ChartMultitype size={20} />
                <span>TRVE Dashboards</span>
              </div>
            </HeaderName>
            <div className="header-mode-group">
              <ModeToggle
                currentMode={currentMode}
                onModeChange={handleModeChange}
                capabilities={userCapabilities}
              />
            </div>
            <HeaderGlobalBar>
              <HeaderGlobalAction aria-label={`Help - Build ${buildInfo.buildNumber}`} tooltipAlignment="end">
                <Help size={20} />
              </HeaderGlobalAction>
              <HeaderGlobalAction aria-label="App Switcher">
                <Switcher size={20} />
              </HeaderGlobalAction>
              <HeaderGlobalAction aria-label="Notifications">
                <Notification size={20} />
              </HeaderGlobalAction>
              <OverflowMenu
                aria-label="User Account"
                renderIcon={() => <UserAvatar size={20} />}
                flipped
                menuOptionsClass="user-menu-options"
              >
                {users.map((user) => (
                  <OverflowMenuItem
                    key={user.guid}
                    itemText={
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {currentUser?.guid === user.guid && <Checkmark size={16} />}
                        <span style={{ marginLeft: currentUser?.guid === user.guid ? 0 : '1.5rem' }}>
                          {user.name}
                        </span>
                      </span>
                    }
                    onClick={() => handleUserChange(user)}
                  />
                ))}
              </OverflowMenu>
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
          <Route path="/design/connections" element={<ConnectionsPage />} />
          <Route path="/design/connections/:id" element={<ConnectionDetailPage />} />
          {/* Legacy datasources routes - redirect to connections */}
          <Route path="/design/datasources" element={<Navigate to="/design/connections" replace />} />
          <Route path="/design/datasources/:id" element={<Navigate to="/design/connections" replace />} />
          <Route path="/design/charts" element={<ChartsListPage />} />
          <Route path="/design/charts/ai/:chartId" element={<AIBuilderPage />} />
          <Route path="/design/charts/:id" element={<ChartDetailPage />} />
          <Route path="/design/dashboards" element={<DashboardsListPage />} />
          <Route path="/design/dashboards/:id" element={<DashboardDetailPage />} />

          {/* View Mode Routes */}
          <Route path="/view/dashboards" element={<DashboardTileViewPage />} />
          <Route path="/view/dashboards/:id" element={<DashboardViewerPage canDesign={userCapabilities.can_design} />} />

          {/* Manage Mode Routes */}
          <Route path="/manage" element={<Navigate to="/manage/users" replace />} />
          <Route path="/manage/users" element={<UsersListPage />} />
          <Route path="/manage/users/:id" element={<UserDetailPage />} />
          <Route path="/manage/settings" element={<SettingsPage />} />

          {/* Legacy routes for backwards compatibility - redirect to design mode */}
          <Route path="/dashboard" element={<Navigate to="/design/dashboards" replace />} />
          <Route path="/design/layouts" element={<Navigate to="/design/dashboards" replace />} />
          <Route path="/design/layouts/:id" element={<Navigate to="/design/dashboards" replace />} />
          <Route path="/nodes" element={<Navigate to="/design/connections" replace />} />
          <Route path="/queries" element={<Navigate to="/design/connections" replace />} />
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
