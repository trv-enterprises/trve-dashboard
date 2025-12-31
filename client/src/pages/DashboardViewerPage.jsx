import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Loading,
  IconButton,
  Tag,
  OverflowMenu,
  OverflowMenuItem
} from '@carbon/react';
import {
  ArrowLeft,
  Maximize,
  Minimize,
  Renew,
  Time,
  Edit,
  FitToScreen,
  CenterToFit
} from '@carbon/icons-react';
import html2canvas from 'html2canvas';
import DynamicComponentLoader from '../components/DynamicComponentLoader';
import ChartDataModal from '../components/ChartDataModal';
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
  const [reduceToFit, setReduceToFit] = useState(false);
  const [dataModalOpen, setDataModalOpen] = useState(false);
  const [selectedChart, setSelectedChart] = useState(null);
  const [configRefreshInterval, setConfigRefreshInterval] = useState(120); // Default 120s for dashboard/chart config refresh

  // Grid configuration - fixed 64x36px cells (16:9 aspect ratio)
  // Must match DashboardDetailPage.jsx
  const CELL_WIDTH = 64;
  const CELL_HEIGHT = 36;

  // Calculate actual columns and rows needed based on panel positions
  const maxGridCol = useMemo(() => {
    if (!dashboard?.panels || dashboard.panels.length === 0) return 30; // default
    return dashboard.panels.reduce((max, panel) => {
      return Math.max(max, panel.x + panel.w);
    }, 0);
  }, [dashboard?.panels]);

  const maxGridRow = useMemo(() => {
    if (!dashboard?.panels || dashboard.panels.length === 0) return 30; // default
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

  // Fetch system config on mount to get config_refresh_interval
  useEffect(() => {
    const fetchSystemConfig = async () => {
      try {
        const config = await apiClient.getSystemConfig();
        if (config?.config_refresh_interval > 0) {
          setConfigRefreshInterval(config.config_refresh_interval);
        }
      } catch (err) {
        console.warn('Failed to fetch system config, using default refresh interval:', err);
      }
    };
    fetchSystemConfig();
  }, []);

  // Initial load
  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Auto-refresh dashboard/chart config from database (configRefreshInterval from system config)
  // This is separate from data refresh which is controlled per-chart
  useEffect(() => {
    if (configRefreshInterval <= 0) {
      return;
    }

    // Convert seconds to milliseconds
    const intervalMs = configRefreshInterval * 1000;
    const interval = setInterval(() => {
      fetchDashboard();
    }, intervalMs);

    return () => clearInterval(interval);
  }, [configRefreshInterval, fetchDashboard]);

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

  // Handle double-click on chart panel to show data modal
  const handlePanelDoubleClick = (chart) => {
    if (chart && chart.datasource_id) {
      setSelectedChart(chart);
      setDataModalOpen(true);
    }
  };

  const handleCloseDataModal = () => {
    setDataModalOpen(false);
    setSelectedChart(null);
  };

  // Save thumbnail by capturing the dashboard grid
  const saveThumbnail = async () => {
    const gridContainer = document.querySelector('.dashboard-grid-container');
    if (!gridContainer) {
      console.error('Dashboard grid container not found');
      return;
    }

    try {
      const canvas = await html2canvas(gridContainer, {
        backgroundColor: '#161616',
        scale: 0.5, // Reduce size for thumbnail
        logging: false,
        useCORS: true
      });

      const thumbnailDataUrl = canvas.toDataURL('image/png');

      // Update dashboard with new thumbnail
      await apiClient.updateDashboard(id, {
        ...dashboard,
        thumbnail: thumbnailDataUrl
      });

      // Refresh dashboard to show updated data
      fetchDashboard();
    } catch (err) {
      console.error('Failed to save thumbnail:', err);
    }
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
          {!isFullscreen && (
            <IconButton
              kind="ghost"
              label="Back to dashboards"
              onClick={handleBack}
            >
              <ArrowLeft size={20} />
            </IconButton>
          )}
          <div className="dashboard-info">
            <h1>{dashboard?.name}</h1>
          </div>
        </div>

        <div className="toolbar-center">
          {dashboard?.settings?.refresh_interval > 0 && (
            <Tag type="green" size="sm">
              <Time size={12} />
              Data refresh: {dashboard.settings.refresh_interval}s
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
            align="bottom"
          >
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </IconButton>
          <IconButton
            kind="ghost"
            label={reduceToFit ? 'Actual size' : 'Fit to screen'}
            onClick={() => setReduceToFit(!reduceToFit)}
            align="bottom"
          >
            {reduceToFit ? <CenterToFit size={20} /> : <FitToScreen size={20} />}
          </IconButton>
          <OverflowMenu
            renderIcon={() => <Edit size={20} />}
            flipped
            direction="bottom"
            iconDescription="Dashboard actions"
          >
            <OverflowMenuItem
              itemText="Edit"
              onClick={() => navigate(`/design/dashboards/${id}`, { state: { from: `/view/dashboards/${id}` } })}
            />
            <OverflowMenuItem
              itemText="Save Thumbnail"
              onClick={saveThumbnail}
            />
          </OverflowMenu>
        </div>
      </div>

      {/* Dashboard grid */}
      {dashboard?.panels && dashboard.panels.length > 0 ? (
        <div className={`dashboard-grid-container ${reduceToFit ? 'reduce-to-fit' : ''}`}>
          <div
            className="dashboard-grid"
            style={{
              gridTemplateColumns: reduceToFit
                ? `repeat(${maxGridCol}, 1fr)`
                : `repeat(${maxGridCol}, ${CELL_WIDTH}px)`,
              gridTemplateRows: reduceToFit
                ? `repeat(${maxGridRow}, 1fr)`
                : `repeat(${maxGridRow}, ${CELL_HEIGHT}px)`
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
                    gridRow: `${panel.y + 1} / span ${panel.h}`,
                    cursor: hasChart ? 'pointer' : 'default'
                  }}
                  onDoubleClick={() => handlePanelDoubleClick(chart)}
                >
                  {hasChart ? (
                    <>
                      {/* Show header only for datatable type (no built-in title) */}
                      {chart.chart_type === 'datatable' && (
                        <div className="chart-header">
                          <span className="chart-name">{chart.name || 'Untitled Chart'}</span>
                        </div>
                      )}
                      <div className={`component-wrapper ${chart.chart_type === 'datatable' ? 'with-header' : ''}`}>
                        <DynamicComponentLoader
                          code={chart.component_code}
                          props={{}}
                          dataMapping={chart.data_mapping}
                          datasourceId={chart.datasource_id}
                          dataRefreshInterval={dashboard?.settings?.refresh_interval > 0 ? dashboard.settings.refresh_interval * 1000 : null}
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

      {/* Chart Data Modal - shows data table on double-click */}
      <ChartDataModal
        open={dataModalOpen}
        chart={selectedChart}
        onClose={handleCloseDataModal}
      />
    </div>
  );
}

export default DashboardViewerPage;
