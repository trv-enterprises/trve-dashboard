import { useState, useEffect, useCallback, useMemo } from 'react';
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
  Edit,
  Time
} from '@carbon/icons-react';
import DynamicComponentLoader from '../components/DynamicComponentLoader';
import apiClient from '../api/client';
import './DashboardViewerPage.scss';

/**
 * DashboardViewerPage Component
 *
 * Renders a dashboard in view mode with all components positioned
 * according to the layout grid. Supports:
 * - Auto-refresh based on dashboard settings
 * - Fullscreen mode
 * - Real-time component rendering
 *
 * Dashboard structure:
 * - panels: Array of {id, x, y, w, h, chart_id} - panel positions with chart references
 * - Charts are fetched separately by chart_id
 */
function DashboardViewerPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [dashboard, setDashboard] = useState(null);
  const [chartsMap, setChartsMap] = useState({}); // Chart data keyed by chart_id
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Grid configuration
  const GRID_ROW_HEIGHT = 32;

  // Calculate actual rows needed based on panel positions
  const maxGridRow = useMemo(() => {
    if (!dashboard?.panels || dashboard.panels.length === 0) return 0;
    return dashboard.panels.reduce((max, panel) => {
      return Math.max(max, panel.y + panel.h);
    }, 0);
  }, [dashboard?.panels]);

  // Fetch dashboard data and referenced charts
  const fetchDashboard = useCallback(async () => {
    try {
      const data = await apiClient.getDashboard(id);
      setDashboard(data);

      // Fetch all referenced charts
      if (data.panels && data.panels.length > 0) {
        const chartIds = [...new Set(data.panels.map(p => p.chart_id).filter(Boolean))];
        if (chartIds.length > 0) {
          const chartPromises = chartIds.map(chartId =>
            apiClient.getChart(chartId).catch(() => null)
          );
          const charts = await Promise.all(chartPromises);
          const newChartsMap = {};
          charts.forEach(chart => {
            if (chart) {
              newChartsMap[chart.id] = chart;
            }
          });
          setChartsMap(newChartsMap);
        }
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
            label="Edit dashboard"
            onClick={() => navigate(`/design/dashboards/${id}`, { state: { from: `/view/dashboards/${id}` } })}
          >
            <Edit size={20} />
          </IconButton>
        </div>
      </div>

      {/* Dashboard grid */}
      {dashboard?.panels && dashboard.panels.length > 0 ? (
        <div className="dashboard-grid-container">
          <div
            className="dashboard-grid"
            style={{
              gridTemplateColumns: 'repeat(12, 1fr)',
              gridTemplateRows: `repeat(${maxGridRow}, ${GRID_ROW_HEIGHT}px)`
            }}
          >
            {dashboard.panels.map((panel) => {
              const chart = panel.chart_id ? chartsMap[panel.chart_id] : null;
              const hasChart = !!chart?.component_code;

              return (
                <div
                  key={panel.id}
                  className={`panel-container ${hasChart ? 'has-component' : 'empty-panel'}`}
                  style={{
                    gridColumn: `${panel.x + 1} / span ${panel.w}`,
                    gridRow: `${panel.y + 1} / span ${panel.h}`
                  }}
                >
                  {hasChart ? (
                    <>
                      <div className="chart-header">
                        <span className="chart-name">{chart.name || 'Untitled Chart'}</span>
                      </div>
                      <div className="component-wrapper">
                        <DynamicComponentLoader
                          code={chart.component_code}
                          props={{}}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="empty-panel-placeholder">
                      <span>No chart</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="no-layout">
          <p>No panels configured for this dashboard.</p>
          <Button onClick={() => navigate(`/design/dashboards/${id}`)}>
            Configure Dashboard
          </Button>
        </div>
      )}
    </div>
  );
}

export default DashboardViewerPage;
