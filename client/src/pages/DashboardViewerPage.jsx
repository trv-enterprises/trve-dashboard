import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Loading,
  IconButton,
  Tag
} from '@carbon/react';
import {
  ArrowLeft,
  Maximize,
  Minimize,
  Renew,
  Settings,
  Time
} from '@carbon/icons-react';
import DynamicComponentLoader from '../components/DynamicComponentLoader';
import './DashboardViewerPage.scss';

/**
 * DashboardViewerPage Component
 *
 * Renders a dashboard in view mode with all components positioned
 * according to the layout grid. Supports:
 * - Auto-refresh based on dashboard settings
 * - Fullscreen mode
 * - Real-time component rendering
 */
function DashboardViewerPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [dashboard, setDashboard] = useState(null);
  const [layout, setLayout] = useState(null);
  const [components, setComponents] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Fetch dashboard data
  const fetchDashboard = useCallback(async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/dashboards/${id}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      setDashboard(data);

      // Fetch layout details
      if (data.layout_id) {
        const layoutResponse = await fetch(`http://localhost:3001/api/layouts/${data.layout_id}`);
        if (layoutResponse.ok) {
          const layoutData = await layoutResponse.json();
          setLayout(layoutData);
        }
      }

      // Fetch component details for each assigned component
      if (data.components && data.components.length > 0) {
        const componentPromises = data.components
          .filter(c => c.component_id)
          .map(async (placement) => {
            try {
              const compResponse = await fetch(`http://localhost:3001/api/components/${placement.component_id}`);
              if (compResponse.ok) {
                const compData = await compResponse.json();
                return { panelId: placement.panel_id, component: compData };
              }
            } catch (err) {
              console.error(`Failed to fetch component ${placement.component_id}:`, err);
            }
            return null;
          });

        const results = await Promise.all(componentPromises);
        const componentMap = {};
        results.filter(Boolean).forEach(({ panelId, component }) => {
          componentMap[panelId] = component;
        });
        setComponents(componentMap);
      }

      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Initial load
  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Auto-refresh based on dashboard settings (refresh_interval is in seconds)
  useEffect(() => {
    if (!dashboard?.settings?.refresh_interval || dashboard.settings.refresh_interval <= 0) {
      return;
    }

    // Convert seconds to milliseconds
    const intervalMs = dashboard.settings.refresh_interval * 1000;
    const interval = setInterval(() => {
      fetchDashboard();
    }, intervalMs);

    return () => clearInterval(interval);
  }, [dashboard?.settings?.refresh_interval, fetchDashboard]);

  // Fullscreen handling
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleManualRefresh = () => {
    setLoading(true);
    fetchDashboard();
  };

  const handleBack = () => {
    navigate('/view/dashboards');
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  if (loading && !dashboard) {
    return (
      <div className="dashboard-viewer-page">
        <Loading description="Loading dashboard..." withOverlay={false} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-viewer-page">
        <div className="error-container">
          <div className="error-message">Error: {error}</div>
          <Button onClick={handleBack}>Back to Dashboards</Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`dashboard-viewer-page ${isFullscreen ? 'fullscreen' : ''}`}>
      {/* Header toolbar */}
      <div className="viewer-toolbar">
        <div className="toolbar-left">
          <IconButton
            kind="ghost"
            label="Back to dashboards"
            onClick={handleBack}
          >
            <ArrowLeft size={20} />
          </IconButton>
          <div className="dashboard-info">
            <h1>{dashboard?.name}</h1>
            {dashboard?.description && (
              <p>{dashboard.description}</p>
            )}
          </div>
        </div>

        <div className="toolbar-center">
          {dashboard?.settings?.refresh_interval > 0 && (
            <Tag type="green" size="sm">
              <Time size={12} />
              Auto-refresh: {dashboard.settings.refresh_interval}s
            </Tag>
          )}
        </div>

        <div className="toolbar-right">
          <span className="last-refresh">
            Last refresh: {formatTime(lastRefresh)}
          </span>
          <IconButton
            kind="ghost"
            label="Refresh"
            onClick={handleManualRefresh}
            disabled={loading}
          >
            <Renew size={20} className={loading ? 'spinning' : ''} />
          </IconButton>
          <IconButton
            kind="ghost"
            label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </IconButton>
          <IconButton
            kind="ghost"
            label="Dashboard settings"
            onClick={() => navigate(`/design/dashboards/${id}`)}
          >
            <Settings size={20} />
          </IconButton>
        </div>
      </div>

      {/* Dashboard grid */}
      {layout ? (
        <div className="dashboard-grid-container">
          <div
            className="dashboard-grid"
            style={{
              gridTemplateColumns: 'repeat(12, 1fr)',
              gridTemplateRows: `repeat(${layout.rows || 50}, 32px)`,
              minHeight: `${(layout.rows || 50) * 32}px`
            }}
          >
            {layout.panels?.map((panel) => {
              const component = components[panel.id];

              // Only render panels that have components assigned
              if (!component) return null;

              return (
                <div
                  key={panel.id}
                  className="panel-container has-component"
                  style={{
                    gridColumn: `${panel.x + 1} / span ${panel.w}`,
                    gridRow: `${panel.y + 1} / span ${panel.h}`
                  }}
                >
                  <div className="component-wrapper">
                    <DynamicComponentLoader
                      code={component.component_code}
                      props={component.props || {}}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="no-layout">
          <p>No layout assigned to this dashboard.</p>
          <Button onClick={() => navigate(`/design/dashboards/${id}`)}>
            Configure Dashboard
          </Button>
        </div>
      )}
    </div>
  );
}

export default DashboardViewerPage;
