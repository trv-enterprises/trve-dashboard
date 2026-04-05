// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Loading,
  IconButton,
  Tag,
  OverflowMenu,
  OverflowMenuItem,
  Modal,
  Select,
  SelectItem
} from '@carbon/react';
import {
  ArrowLeft,
  Maximize,
  Minimize,
  Renew,
  Time,
  OverflowMenuVertical,
  FitToScreen,
  CenterToFit,
  StarFilled,
  Edit,
  Save,
  Close,
  Move,
  Draggable
} from '@carbon/icons-react';
import html2canvas from 'html2canvas';
import DynamicComponentLoader from '../components/DynamicComponentLoader';
import ChartDataModal from '../components/ChartDataModal';
import { ControlRenderer } from '../components/controls';
import FrigateCameraViewer from '../components/frigate/FrigateCameraViewer';
import WeatherDisplay from '../components/weather/WeatherDisplay';
import PanelEditMenu from '../components/PanelEditMenu';
import ChartEditorModal from '../components/ChartEditorModal';
import ComponentPickerModal from '../components/ComponentPickerModal';
import AIPreflightModal from '../components/AIPreflightModal';
import apiClient from '../api/client';
import { getComponentMinSize } from '../config/layoutConfig';
import './DashboardViewerPage.scss';

/**
 * DashboardViewerPage Component
 *
 * Renders a dashboard in view mode with all components positioned
 * according to the layout grid. Supports:
 * - Auto-refresh based on dashboard settings
 * - Fullscreen mode
 * - Real-time component rendering
 * - Edit mode: drag/resize panels over live components
 */
function DashboardViewerPage({ canDesign = false }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const [dashboard, setDashboard] = useState(null);
  const [chartsMap, setChartsMap] = useState({}); // Chart data keyed by chart_id
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [reduceToFit, setReduceToFit] = useState(() => {
    const stored = localStorage.getItem('dashboard_reduceToFit');
    return stored !== null ? stored === 'true' : true;
  });
  const [dataModalOpen, setDataModalOpen] = useState(false);
  const [selectedChart, setSelectedChart] = useState(null);
  const [configRefreshInterval, setConfigRefreshInterval] = useState(120);
  const [isDefaultDashboard, setIsDefaultDashboard] = useState(false);

  // Dashboard switching state
  const [dashboardList, setDashboardList] = useState([]);
  const [switchIndicator, setSwitchIndicator] = useState(null);
  const switchTimerRef = useRef(null);

  // ── Edit mode state ──────────────────────────────────────────────
  // editSubMode: 'standard' = drag handle header + click overlay (default)
  //              'compact'  = no header, full panel is drag target, components at full size
  const [isEditMode, setIsEditMode] = useState(false);
  const [editSubMode, setEditSubMode] = useState('standard');
  const [editablePanels, setEditablePanels] = useState([]);
  const [originalPanels, setOriginalPanels] = useState([]);
  const [editHasChanges, setEditHasChanges] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  // Drag/resize state
  const [draggingPanel, setDraggingPanel] = useState(null);
  const [resizingPanel, setResizingPanel] = useState(null);
  const gridRef = useRef(null);
  const didDragRef = useRef(false); // Distinguishes click from drag in compact mode

  // Panel edit menu state (which panel's menu is open)
  const [menuPanelId, setMenuPanelId] = useState(null);

  // Chart editor modal state
  const [chartEditorOpen, setChartEditorOpen] = useState(false);
  const [editingPanelId, setEditingPanelId] = useState(null);
  const [editingChart, setEditingChart] = useState(null);

  // Component picker modal state
  const [componentPickerOpen, setComponentPickerOpen] = useState(false);
  const [componentPickerCategory, setComponentPickerCategory] = useState('all');
  const [componentPickerPanelId, setComponentPickerPanelId] = useState(null);

  // AI pre-flight modal state
  const [aiPreflightOpen, setAiPreflightOpen] = useState(false);
  const [aiPreflightPanelId, setAiPreflightPanelId] = useState(null);

  // Grid configuration - fixed 64x36px cells (16:9 aspect ratio)
  const CELL_WIDTH = 64;
  const CELL_HEIGHT = 36;

  // Layout dimension presets — defines the hard grid boundary
  const [dimensions, setDimensions] = useState([]);
  const [currentDimension, setCurrentDimension] = useState('');

  // Fetch all dimension presets and resolve the dashboard's current one
  useEffect(() => {
    if (!isEditMode || !dashboard) return;

    apiClient.getSystemConfig()
      .then(config => {
        const dims = config.layout_dimensions || {};
        const list = Object.entries(dims).map(([name, dim]) => ({
          name, max_width: dim.max_width, max_height: dim.max_height
        }));
        list.sort((a, b) => a.max_width - b.max_width);
        setDimensions(list);

        const saved = dashboard.settings?.layout_dimension;
        if (saved && dims[saved]) {
          setCurrentDimension(saved);
        } else if (list.length > 0) {
          setCurrentDimension(list[0].name);
        }
      })
      .catch(() => {});
  }, [isEditMode, dashboard]);

  // Resolved current dimension object
  const layoutDimension = useMemo(() => {
    return dimensions.find(d => d.name === currentDimension) || null;
  }, [dimensions, currentDimension]);

  // Grid bounds from layout dimension (matches DashboardDetailPage formula)
  const VIEWER_CHROME_V = 113; // 48px app header + 57px toolbar + 8px padding
  const VIEWER_CHROME_H = 8;
  const VIEWER_GAP = 8;

  const gridCols = useMemo(() => {
    if (!layoutDimension) return null;
    const availableWidth = layoutDimension.max_width - VIEWER_CHROME_H;
    return Math.floor((availableWidth + VIEWER_GAP) / (CELL_WIDTH + VIEWER_GAP));
  }, [layoutDimension]);

  const gridRows = useMemo(() => {
    if (!layoutDimension) return null;
    const availableHeight = layoutDimension.max_height - VIEWER_CHROME_V;
    return Math.floor((availableHeight + VIEWER_GAP) / (CELL_HEIGHT + VIEWER_GAP));
  }, [layoutDimension]);

  // Load user preference for reduceToFit from server
  useEffect(() => {
    const userGuid = apiClient.getCurrentUserGuid();
    if (!userGuid) return;
    apiClient.getUserConfig(userGuid)
      .then(res => {
        const pref = res?.settings?.dashboard_reduceToFit;
        if (pref !== undefined) {
          setReduceToFit(pref);
          localStorage.setItem('dashboard_reduceToFit', String(pref));
        }
      })
      .catch(() => {});
  }, []);

  // Save reduceToFit preference
  const toggleReduceToFit = useCallback(() => {
    setReduceToFit(prev => {
      const next = !prev;
      localStorage.setItem('dashboard_reduceToFit', String(next));
      const userGuid = apiClient.getCurrentUserGuid();
      if (userGuid) {
        apiClient.updateUserConfig(userGuid, { dashboard_reduceToFit: next }).catch(() => {});
      }
      return next;
    });
  }, []);

  // Calculate grid dimensions
  // In edit mode: use layout dimension preset for bounds (allows dragging into empty space)
  // In view mode: use panel extent (tight fit)
  const panels = isEditMode ? editablePanels : (dashboard?.panels || []);

  const panelExtentCol = useMemo(() => {
    if (!panels || panels.length === 0) return 0;
    return panels.reduce((max, panel) => Math.max(max, panel.x + panel.w), 0);
  }, [panels]);

  const panelExtentRow = useMemo(() => {
    if (!panels || panels.length === 0) return 0;
    return panels.reduce((max, panel) => Math.max(max, panel.y + panel.h), 0);
  }, [panels]);

  // In edit mode, grid extends to the layout dimension boundary (or panel extent if larger)
  // In view mode, grid fits tightly around panels
  const maxGridCol = isEditMode && gridCols
    ? Math.max(gridCols, panelExtentCol)
    : (panelExtentCol || 30);

  const maxGridRow = isEditMode && gridRows
    ? Math.max(gridRows, panelExtentRow)
    : (panelExtentRow || 30);

  // Fetch dashboard data and referenced charts
  const fetchDashboard = useCallback(async () => {
    try {
      const data = await apiClient.getDashboard(id);
      setDashboard(data);

      if (data.panels && data.panels.length > 0) {
        const chartIds = [...new Set(data.panels.map(p => p.chart_id).filter(Boolean))];
        if (chartIds.length > 0) {
          const chartPromises = chartIds.map(chartId =>
            apiClient.getChart(chartId).catch(() => null)
          );
          const charts = await Promise.all(chartPromises);
          const newChartsMap = {};
          charts.forEach(chart => {
            if (chart) newChartsMap[chart.id] = chart;
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

  // Fetch system config on mount
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

  // Fetch dashboard list for keyboard switching
  useEffect(() => {
    const fetchDashboardList = async () => {
      try {
        const data = await apiClient.getDashboards();
        const dashboards = data.dashboards || [];
        dashboards.sort((a, b) => a.name.localeCompare(b.name));
        setDashboardList(dashboards);
      } catch (err) {
        console.warn('Failed to fetch dashboard list:', err);
      }
    };
    fetchDashboardList();
  }, []);

  // Show switch indicator briefly
  const showSwitchIndicator = useCallback((name, index, total) => {
    setSwitchIndicator({ name, index, total });
    if (switchTimerRef.current) clearTimeout(switchTimerRef.current);
    switchTimerRef.current = setTimeout(() => setSwitchIndicator(null), 2000);
  }, []);

  // Keyboard navigation: Alt+Left/Right to switch dashboards (disabled in edit mode)
  useEffect(() => {
    if (dashboardList.length < 2 || isEditMode) return;

    const handleKeyDown = (e) => {
      if (!e.altKey) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

      e.preventDefault();
      const currentIndex = dashboardList.findIndex(d => d.id === id);
      if (currentIndex === -1) return;

      let nextIndex;
      if (e.key === 'ArrowRight') {
        nextIndex = (currentIndex + 1) % dashboardList.length;
      } else {
        nextIndex = (currentIndex - 1 + dashboardList.length) % dashboardList.length;
      }

      const next = dashboardList[nextIndex];
      showSwitchIndicator(next.name, nextIndex + 1, dashboardList.length);
      navigate(`/view/dashboards/${next.id}`);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (switchTimerRef.current) clearTimeout(switchTimerRef.current);
    };
  }, [dashboardList, id, navigate, showSwitchIndicator, isEditMode]);

  // Initial load
  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Check if this dashboard is the user's default
  useEffect(() => {
    const checkIfDefault = async () => {
      const userGuid = apiClient.getCurrentUserGuid();
      if (!userGuid || !id) return;
      try {
        const config = await apiClient.getUserConfig(userGuid);
        setIsDefaultDashboard(config.settings?.default_dashboard_id === id);
      } catch {
        // User may not have config yet
      }
    };
    checkIfDefault();
  }, [id]);

  const handleSetAsDefault = async () => {
    const userGuid = apiClient.getCurrentUserGuid();
    if (!userGuid) return;
    try {
      await apiClient.updateUserConfig(userGuid, { default_dashboard_id: id });
      setIsDefaultDashboard(true);
    } catch (err) {
      console.error('Failed to set default dashboard:', err);
    }
  };

  // Auto-refresh (paused in edit mode)
  useEffect(() => {
    if (configRefreshInterval <= 0 || isEditMode) return;
    const intervalMs = configRefreshInterval * 1000;
    const interval = setInterval(() => fetchDashboard(), intervalMs);
    return () => clearInterval(interval);
  }, [configRefreshInterval, fetchDashboard, isEditMode]);

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
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleManualRefresh = () => {
    setLoading(true);
    fetchDashboard();
  };

  const handleBack = () => navigate('/view/dashboards');

  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Handle double-click on chart panel to show data modal (view mode only)
  const handlePanelDoubleClick = (chart) => {
    if (isEditMode) return;
    if (chart && chart.connection_id) {
      setSelectedChart(chart);
      setDataModalOpen(true);
    }
  };

  const handleCloseDataModal = () => {
    setDataModalOpen(false);
    setSelectedChart(null);
  };

  // Save thumbnail
  const [savingThumbnail, setSavingThumbnail] = useState(false);
  const saveThumbnail = async () => {
    const gridContainer = document.querySelector('.dashboard-grid-container');
    if (!gridContainer) return;

    setSavingThumbnail(true);
    try {
      const canvas = await html2canvas(gridContainer, {
        backgroundColor: '#161616',
        scale: 0.5,
        logging: true,
        useCORS: true,
        allowTaint: true
      });
      const thumbnailDataUrl = canvas.toDataURL('image/png');
      await apiClient.updateDashboard(id, { ...dashboard, thumbnail: thumbnailDataUrl });
      fetchDashboard();
    } catch (err) {
      console.error('Failed to save thumbnail:', err);
    } finally {
      setSavingThumbnail(false);
    }
  };

  // ── Edit mode logic ──────────────────────────────────────────────

  const enterEditMode = () => {
    const panelsCopy = (dashboard?.panels || []).map(p => ({ ...p }));
    setEditablePanels(panelsCopy);
    setOriginalPanels(panelsCopy.map(p => ({ ...p })));
    setEditHasChanges(false);
    setIsEditMode(true);
    setMenuPanelId(null);
  };

  const exitEditMode = () => {
    if (editHasChanges) {
      setShowDiscardModal(true);
    } else {
      setIsEditMode(false);
      setMenuPanelId(null);
    }
  };

  const confirmDiscard = () => {
    setShowDiscardModal(false);
    setIsEditMode(false);
    setEditablePanels([]);
    setOriginalPanels([]);
    setEditHasChanges(false);
    setMenuPanelId(null);
  };

  const handleDimensionChange = (newDimension) => {
    setCurrentDimension(newDimension);
    setEditHasChanges(true);
  };

  const saveEditMode = async () => {
    setEditSaving(true);
    try {
      const updatedSettings = { ...dashboard.settings, layout_dimension: currentDimension };
      await apiClient.updateDashboard(id, { ...dashboard, panels: editablePanels, settings: updatedSettings });
      setIsEditMode(false);
      setEditHasChanges(false);
      setMenuPanelId(null);
      fetchDashboard();
    } catch (err) {
      console.error('Failed to save dashboard:', err);
    } finally {
      setEditSaving(false);
    }
  };

  // Update a single panel's properties
  const updateEditablePanel = (panelId, updates) => {
    setEditablePanels(prev => prev.map(p =>
      p.id === panelId ? { ...p, ...updates } : p
    ));
    setEditHasChanges(true);
  };

  // Get minimum panel size based on assigned component
  const getMinSizeForPanel = (panelId) => {
    const panel = editablePanels.find(p => p.id === panelId);
    if (!panel?.chart_id) return getComponentMinSize('default');
    const chart = chartsMap[panel.chart_id];
    if (!chart) return getComponentMinSize('default');
    const subtype = chart.control_config?.control_type || chart.chart_type;
    return getComponentMinSize(subtype);
  };

  // ── Drag/resize logic ────────────────────────────────────────────

  const getGridPosition = useCallback((e) => {
    if (!gridRef.current) return null;
    const rect = gridRef.current.getBoundingClientRect();

    if (reduceToFit) {
      const cellW = rect.width / maxGridCol;
      const cellH = rect.height / maxGridRow;
      const x = Math.floor((e.clientX - rect.left) / cellW);
      const y = Math.floor((e.clientY - rect.top) / cellH);
      return { x: Math.max(0, Math.min(x, maxGridCol - 1)), y: Math.max(0, y) };
    }

    const x = Math.floor((e.clientX - rect.left) / CELL_WIDTH);
    const y = Math.floor((e.clientY - rect.top) / CELL_HEIGHT);
    return { x: Math.max(0, Math.min(x, maxGridCol - 1)), y: Math.max(0, y) };
  }, [reduceToFit, maxGridCol, maxGridRow, CELL_WIDTH, CELL_HEIGHT]);

  const startDragging = (e, panel) => {
    e.stopPropagation();
    e.preventDefault();
    didDragRef.current = false;
    const pos = getGridPosition(e);
    if (pos) {
      setDraggingPanel({
        id: panel.id,
        offsetX: pos.x - panel.x,
        offsetY: pos.y - panel.y
      });
    }
  };

  const startResizing = (e, panel) => {
    e.stopPropagation();
    e.preventDefault();
    setResizingPanel({ id: panel.id });
  };

  useEffect(() => {
    if (!isEditMode || (!draggingPanel && !resizingPanel)) return;

    const handleMouseMove = (e) => {
      const pos = getGridPosition(e);
      if (!pos) return;

      // Use layout dimension boundary for hard limits (fall back to grid extent)
      const boundCols = gridCols || maxGridCol;
      const boundRows = gridRows || maxGridRow;

      if (draggingPanel) {
        const panel = editablePanels.find(p => p.id === draggingPanel.id);
        if (panel) {
          const newX = Math.max(0, Math.min(pos.x - draggingPanel.offsetX, boundCols - panel.w));
          const newY = Math.max(0, Math.min(pos.y - draggingPanel.offsetY, boundRows - panel.h));
          if (newX !== panel.x || newY !== panel.y) {
            didDragRef.current = true;
            updateEditablePanel(draggingPanel.id, { x: newX, y: newY });
          }
        }
      }

      if (resizingPanel) {
        const panel = editablePanels.find(p => p.id === resizingPanel.id);
        if (panel) {
          const minSize = getMinSizeForPanel(resizingPanel.id);
          const newW = Math.max(minSize.w, Math.min(pos.x - panel.x + 1, boundCols - panel.x));
          const newH = Math.max(minSize.h, Math.min(pos.y - panel.y + 1, boundRows - panel.y));
          if (newW !== panel.w || newH !== panel.h) {
            updateEditablePanel(resizingPanel.id, { w: newW, h: newH });
          }
        }
      }
    };

    const handleMouseUp = () => {
      setDraggingPanel(null);
      setResizingPanel(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isEditMode, draggingPanel, resizingPanel, editablePanels, maxGridCol, maxGridRow, gridCols, gridRows, getGridPosition]);

  // ── Panel click → open edit menu ─────────────────────────────────

  const handlePanelClick = (e, panel) => {
    e.stopPropagation();
    setMenuPanelId(prev => prev === panel.id ? null : panel.id);
  };

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuPanelId) return;
    const handleClick = (e) => {
      if (e.target.closest('.panel-edit-menu-dropdown')) return;
      if (e.target.closest('.edit-click-overlay')) return;
      setMenuPanelId(null);
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [menuPanelId]);

  // ── Chart editor / component picker / AI preflight ───────────────

  const openChartEditor = (panelId, chart = undefined) => {
    setEditingPanelId(panelId);
    if (chart === undefined) {
      const panel = editablePanels.find(p => p.id === panelId);
      setEditingChart(panel?.chart_id ? chartsMap[panel.chart_id] : null);
    } else {
      setEditingChart(chart);
    }
    setChartEditorOpen(true);
    setMenuPanelId(null);
  };

  const closeChartEditor = () => {
    setChartEditorOpen(false);
    setEditingPanelId(null);
    setEditingChart(null);
  };

  const handleChartSave = async (chartData) => {
    const { panel_id, ...chartInfo } = chartData;
    setChartsMap(prev => ({ ...prev, [chartInfo.id]: chartInfo }));

    const subtype = chartInfo.control_config?.control_type || chartInfo.chart_type;
    const minSize = getComponentMinSize(subtype);
    setEditablePanels(prev => prev.map(p => {
      if (p.id !== panel_id) return p;
      const newW = Math.max(p.w, Math.min(minSize.w, maxGridCol - p.x));
      const newH = Math.max(p.h, minSize.h);
      return { ...p, chart_id: chartInfo.id, w: newW, h: newH };
    }));
    setEditHasChanges(true);
  };

  const openAIEditor = (panelId) => {
    const panel = editablePanels.find(p => p.id === panelId);
    const chartId = panel?.chart_id;
    if (chartId) {
      navigate(`/design/charts/ai/${chartId}`, {
        state: { from: `/view/dashboards/${id}`, dashboardId: id, panelId }
      });
    }
    setMenuPanelId(null);
  };

  const openComponentPicker = (panelId, category) => {
    setComponentPickerPanelId(panelId);
    setComponentPickerCategory(category);
    setComponentPickerOpen(true);
    setMenuPanelId(null);
  };

  const closeComponentPicker = () => {
    setComponentPickerOpen(false);
    setComponentPickerPanelId(null);
  };

  const handleComponentSelect = async (component) => {
    if (!componentPickerPanelId) return;
    if (!chartsMap[component.id]) {
      setChartsMap(prev => ({ ...prev, [component.id]: component }));
    }

    const subtype = component.control_config?.control_type || component.chart_type;
    const minSize = getComponentMinSize(subtype);
    setEditablePanels(prev => prev.map(p => {
      if (p.id !== componentPickerPanelId) return p;
      const newW = Math.max(p.w, Math.min(minSize.w, maxGridCol - p.x));
      const newH = Math.max(p.h, minSize.h);
      return { ...p, chart_id: component.id, w: newW, h: newH };
    }));
    setEditHasChanges(true);
    closeComponentPicker();
  };

  const openAIPreflightModal = (panelId) => {
    updateEditablePanel(panelId, { chart_id: null });
    setAiPreflightPanelId(panelId);
    setAiPreflightOpen(true);
    setMenuPanelId(null);
  };

  const handleAIPreflightContinue = async (context) => {
    setAiPreflightOpen(false);
    const panelId = aiPreflightPanelId;
    setAiPreflightPanelId(null);

    // Save dashboard first so panel persists, then navigate to AI builder
    try {
      await apiClient.updateDashboard(id, { ...dashboard, panels: editablePanels });
    } catch (err) {
      console.error('Failed to save before AI navigation:', err);
    }

    navigate('/design/charts/ai/new', {
      state: {
        from: `/view/dashboards/${id}`,
        dashboardId: id,
        panelId,
        preflight: context
      }
    });
  };

  // ── Render ───────────────────────────────────────────────────────

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
    <div className={`dashboard-viewer-page ${isFullscreen ? 'fullscreen' : ''} ${isEditMode ? 'edit-mode-active' : ''}`}>
      {/* Dashboard switch indicator */}
      {switchIndicator && (
        <div className="dashboard-switch-indicator">
          <span className="switch-name">{switchIndicator.name}</span>
          <span className="switch-position">{switchIndicator.index} of {switchIndicator.total}</span>
        </div>
      )}

      {/* Header toolbar */}
      <div className="viewer-toolbar">
        <div className="toolbar-left">
          {!isFullscreen && !isEditMode && (
            <IconButton
              kind="ghost"
              label="Back to dashboards"
              onClick={handleBack}
            >
              <ArrowLeft size={20} />
            </IconButton>
          )}
          <div className="dashboard-info">
            <h1>{dashboard?.name}{isEditMode && <span className="editing-indicator"> — Editing</span>}</h1>
          </div>
          {isEditMode && dimensions.length > 0 && (
            <div className="dimension-selector">
              <Select
                id="viewer-dimension-select"
                labelText=""
                hideLabel
                size="sm"
                value={currentDimension}
                onChange={(e) => handleDimensionChange(e.target.value)}
              >
                {dimensions.map((dim) => (
                  <SelectItem
                    key={dim.name}
                    value={dim.name}
                    text={`${dim.name} (${dim.max_width}×${dim.max_height})`}
                  />
                ))}
              </Select>
            </div>
          )}
        </div>

        <div className="toolbar-center">
          {!isEditMode && dashboard?.settings?.refresh_interval > 0 && (
            <Tag type="green" size="sm">
              <Time size={12} />
              Data refresh: {dashboard.settings.refresh_interval}s
            </Tag>
          )}
          {isEditMode && editHasChanges && (
            <Tag type="blue" size="sm">Unsaved changes</Tag>
          )}
        </div>

        <div className="toolbar-right">
          {isEditMode ? (
            <>
              <Button
                kind="ghost"
                size="sm"
                onClick={exitEditMode}
                renderIcon={Close}
              >
                Cancel
              </Button>
              <IconButton
                kind="ghost"
                size="sm"
                label={editSubMode === 'standard' ? 'Compact mode' : 'Standard mode'}
                onClick={() => setEditSubMode(prev => prev === 'standard' ? 'compact' : 'standard')}
                className={editSubMode === 'compact' ? 'submode-active' : ''}
              >
                {editSubMode === 'standard' ? <Move size={20} /> : <Draggable size={20} />}
              </IconButton>
              <Button
                kind="primary"
                size="sm"
                onClick={saveEditMode}
                disabled={!editHasChanges || editSaving}
                renderIcon={Save}
              >
                {editSaving ? 'Saving...' : 'Save'}
              </Button>
            </>
          ) : (
            <>
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
                onClick={toggleReduceToFit}
                align="bottom"
              >
                {reduceToFit ? <CenterToFit size={20} /> : <FitToScreen size={20} />}
              </IconButton>
              {canDesign && (
                <IconButton
                  kind="ghost"
                  label="Edit layout"
                  onClick={enterEditMode}
                >
                  <Edit size={20} />
                </IconButton>
              )}
              <OverflowMenu
                renderIcon={() => <OverflowMenuVertical size={20} />}
                flipped
                direction="bottom"
                iconDescription="Dashboard actions"
              >
                {canDesign && (
                  <OverflowMenuItem
                    itemText="Edit in Designer"
                    onClick={() => navigate(`/design/dashboards/${id}`, { state: { from: `/view/dashboards/${id}` } })}
                  />
                )}
                {canDesign && (
                  <OverflowMenuItem
                    itemText={savingThumbnail ? "Saving..." : "Save Thumbnail"}
                    onClick={saveThumbnail}
                    disabled={savingThumbnail}
                  />
                )}
                <OverflowMenuItem
                  itemText={isDefaultDashboard ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <StarFilled size={16} style={{ color: '#f1c21b' }} />
                      Default Dashboard
                    </span>
                  ) : 'Set as Default'}
                  disabled={isDefaultDashboard}
                  onClick={handleSetAsDefault}
                />
              </OverflowMenu>
            </>
          )}
        </div>
      </div>

      {/* Dashboard grid */}
      {panels && panels.length > 0 ? (
        <div className={`dashboard-grid-container ${reduceToFit ? 'reduce-to-fit' : ''}`}>
          <div
            ref={gridRef}
            className={`dashboard-grid ${isEditMode && gridCols && !reduceToFit ? 'edit-mode-grid' : ''}`}
            style={{
              gridTemplateColumns: reduceToFit
                ? `repeat(${maxGridCol}, 1fr)`
                : `repeat(${maxGridCol}, ${CELL_WIDTH}px)`,
              gridTemplateRows: reduceToFit
                ? `repeat(${maxGridRow}, 1fr)`
                : `repeat(${maxGridRow}, ${CELL_HEIGHT}px)`,
              '--title-scale': (dashboard?.settings?.title_scale || 100) / 100,
              ...(isEditMode && gridCols && !reduceToFit ? {
                '--grid-boundary-x': `${gridCols * CELL_WIDTH + (gridCols - 1) * VIEWER_GAP}px`,
                '--grid-boundary-y': `${gridRows * CELL_HEIGHT + (gridRows - 1) * VIEWER_GAP}px`
              } : {})
            }}
          >
            {panels.map((panel) => {
              const chart = panel.chart_id ? chartsMap[panel.chart_id] : null;
              const hasChart = !!chart?.component_code || chart?.component_type === 'control' || chart?.component_type === 'display';
              const isMenuOpen = isEditMode && menuPanelId === panel.id;

              const isCompact = isEditMode && editSubMode === 'compact';
              const isStandard = isEditMode && editSubMode === 'standard';

              return (
                <div
                  key={panel.id}
                  className={`panel-container ${hasChart ? 'has-component' : 'empty-panel'} ${chart?.control_config?.control_type === 'text_label' ? 'text-label-panel' : ''} ${isEditMode ? 'edit-mode' : ''} ${isCompact ? 'edit-compact' : ''} ${draggingPanel?.id === panel.id ? 'dragging' : ''} ${resizingPanel?.id === panel.id ? 'resizing' : ''}`}
                  style={{
                    gridColumn: `${panel.x + 1} / span ${panel.w}`,
                    gridRow: `${panel.y + 1} / span ${panel.h}`,
                    cursor: isEditMode ? 'default' : (hasChart ? 'pointer' : 'default')
                  }}
                  onDoubleClick={() => handlePanelDoubleClick(chart)}
                >
                  {/* Standard edit mode: drag handle with read-only title */}
                  {isStandard && (
                    <div
                      className="edit-drag-handle"
                      onMouseDown={(e) => startDragging(e, panel)}
                    >
                      <span className="panel-title-label">
                        {chart?.title || chart?.name || 'Empty'}
                      </span>
                      <span className="panel-size-label">{panel.w}×{panel.h}</span>
                    </div>
                  )}

                  {/* Panel content */}
                  {hasChart ? (
                    <>
                      {chart.component_type === 'control' ? (
                        <div className="component-wrapper control-wrapper" onDoubleClick={(e) => e.stopPropagation()}>
                          <ControlRenderer control={chart} />
                        </div>
                      ) : chart.component_type === 'display' ? (
                        <div className="component-wrapper display-wrapper">
                          {chart.display_config?.display_type === 'weather' ? (
                            <WeatherDisplay config={chart.display_config} />
                          ) : chart.display_config?.display_type === 'frigate_camera' ? (
                            <FrigateCameraViewer config={chart.display_config} />
                          ) : (
                            <div className="display-empty">Unknown display type</div>
                          )}
                        </div>
                      ) : (
                        <>
                          {chart.chart_type === 'datatable' && (
                            <div className="chart-header">
                              <span className="chart-name">{chart.title || chart.name || 'Untitled Chart'}</span>
                            </div>
                          )}
                          <div className={`component-wrapper ${chart.chart_type === 'datatable' ? 'with-header' : ''}`}>
                            <DynamicComponentLoader
                              code={chart.component_code}
                              props={{}}
                              dataMapping={chart.data_mapping}
                              datasourceId={chart.connection_id}
                              queryConfig={chart.query_config}
                              dataRefreshInterval={!isEditMode && dashboard?.settings?.refresh_interval > 0 ? dashboard.settings.refresh_interval * 1000 : null}
                            />
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <div className="empty-panel-placeholder">
                      <span>No chart</span>
                    </div>
                  )}

                  {/* Standard mode: click overlay below header → opens PanelEditMenu */}
                  {isStandard && (
                    <div
                      className="edit-click-overlay"
                      onClick={(e) => handlePanelClick(e, panel)}
                    />
                  )}

                  {/* Compact mode: full-panel overlay for drag + click */}
                  {isCompact && (
                    <div
                      className="edit-compact-overlay"
                      onMouseDown={(e) => startDragging(e, panel)}
                      onMouseUp={(e) => {
                        if (!didDragRef.current) {
                          handlePanelClick(e, panel);
                        }
                      }}
                    />
                  )}

                  {/* Edit mode: PanelEditMenu (shown when this panel's menu is open) */}
                  {isMenuOpen && (
                    <div className="edit-panel-menu-anchor">
                      <PanelEditMenu
                        buttonLabel={hasChart ? 'Edit' : 'Add'}
                        hasExisting={hasChart}
                        onEdit={hasChart ? () => openChartEditor(panel.id) : undefined}
                        onEditWithAI={hasChart ? () => openAIEditor(panel.id) : undefined}
                        onNew={() => {
                          if (hasChart) updateEditablePanel(panel.id, { chart_id: null });
                          openChartEditor(panel.id, null);
                        }}
                        onNewWithAI={() => openAIPreflightModal(panel.id)}
                        onSelectExisting={() => openComponentPicker(panel.id, 'all')}
                      />
                    </div>
                  )}

                  {/* Edit mode: resize handle */}
                  {isEditMode && (
                    <div
                      className="edit-resize-handle"
                      onMouseDown={(e) => startResizing(e, panel)}
                    />
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

      {/* Chart Editor Modal (edit mode) */}
      <ChartEditorModal
        open={chartEditorOpen}
        onClose={closeChartEditor}
        onSave={handleChartSave}
        chart={editingChart}
        panelId={editingPanelId}
      />

      {/* Component Picker Modal (edit mode) */}
      <ComponentPickerModal
        open={componentPickerOpen}
        onClose={closeComponentPicker}
        onSelect={handleComponentSelect}
        category={componentPickerCategory}
      />

      {/* AI Pre-flight Modal (edit mode) */}
      <AIPreflightModal
        open={aiPreflightOpen}
        onClose={() => {
          setAiPreflightOpen(false);
          setAiPreflightPanelId(null);
        }}
        onContinue={handleAIPreflightContinue}
      />

      {/* Discard changes confirmation */}
      {showDiscardModal && (
        <Modal
          open={true}
          onRequestClose={() => setShowDiscardModal(false)}
          onRequestSubmit={confirmDiscard}
          modalHeading="Discard Changes?"
          primaryButtonText="Discard"
          secondaryButtonText="Keep Editing"
          danger
        >
          <p>You have unsaved layout changes. Are you sure you want to discard them?</p>
        </Modal>
      )}
    </div>
  );
}

export default DashboardViewerPage;
