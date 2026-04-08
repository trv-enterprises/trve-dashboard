// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Button,
  Loading,
  IconButton,
  Tag,
  OverflowMenu,
  OverflowMenuItem,
  Modal,
  Select,
  SelectItem,
  TextInput,
  NumberInput,
  Slider,
  Checkbox
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
  TrashCan,
  Add,
  ZoomIn,
  ZoomOut,
  Settings
} from '@carbon/icons-react';
import html2canvas from 'html2canvas';
import DynamicComponentLoader from '../components/DynamicComponentLoader';
import ChartDataModal from '../components/ChartDataModal';
import { ControlRenderer } from '../components/controls';
import FrigateCameraViewer from '../components/frigate/FrigateCameraViewer';
import WeatherDisplay from '../components/weather/WeatherDisplay';
import PanelEditMenu from '../components/PanelEditMenu';
import PanelText from '../components/PanelText';
import PanelTextEditor from '../components/PanelTextEditor';
import ChartEditorModal from '../components/ChartEditorModal';
import ComponentPickerModal from '../components/ComponentPickerModal';
import AIPreflightModal from '../components/AIPreflightModal';
import apiClient from '../api/client';
import StreamConnectionManager from '../utils/streamConnectionManager';
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
  const location = useLocation();
  const isNewDashboard = id === 'new';

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
  const [isEditMode, setIsEditMode] = useState(false);
  const [editablePanels, setEditablePanels] = useState([]);
  const [originalPanels, setOriginalPanels] = useState([]);
  const [editHasChanges, setEditHasChanges] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editableName, setEditableName] = useState('');

  // Dashboard settings (editable in settings modal)
  const [editableDescription, setEditableDescription] = useState('');
  const [editableTheme, setEditableTheme] = useState('dark');
  const [editableRefreshInterval, setEditableRefreshInterval] = useState(0);
  const [editableTitleScale, setEditableTitleScale] = useState(100);
  const [editableIsPublic, setEditableIsPublic] = useState(false);
  const [editableAllowExport, setEditableAllowExport] = useState(true);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Zoom state (edit mode only)
  const [zoom, setZoom] = useState(100);
  const zoomIn = () => setZoom(z => Math.min(z + 10, 100));
  const zoomOut = () => setZoom(z => Math.max(z - 10, 10));
  const zoomReset = () => setZoom(100);

  // Fit-to-screen scale calculation
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Drag/resize/draw state
  const [draggingPanel, setDraggingPanel] = useState(null);
  const [resizingPanel, setResizingPanel] = useState(null);
  const [drawingPanel, setDrawingPanel] = useState(null);
  const gridRef = useRef(null);
  const didDragRef = useRef(false); // Distinguishes click from drag in compact mode


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

  // Text panel editor state
  const [textEditorPanelId, setTextEditorPanelId] = useState(null);
  const [textEditorAnchorRect, setTextEditorAnchorRect] = useState(null);

  // Close all SSE connections when leaving the dashboard viewer
  // (frees browser connection slots so other pages load instantly)
  useEffect(() => {
    return () => StreamConnectionManager.getInstance().closeAll();
  }, []);

  // Grid configuration - 32x32px cells
  const CELL_WIDTH = 32;
  const CELL_HEIGHT = 32;

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
        } else if (config.default_dimension && dims[config.default_dimension]) {
          setCurrentDimension(config.default_dimension);
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
  const VIEWER_CHROME_V = 109; // 48px app header + 57px toolbar + 4px padding
  const VIEWER_CHROME_H = 4;
  const VIEWER_GAP = 4;

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
    : (isEditMode ? Math.max(panelExtentCol, 40) : (panelExtentCol || 60));

  const maxGridRow = isEditMode && gridRows
    ? Math.max(gridRows, panelExtentRow)
    : (isEditMode ? Math.max(panelExtentRow, 24) : (panelExtentRow || 60));

  // Track container size for fit-to-screen scale calculation
  const hasPanels = panels && panels.length > 0;
  useEffect(() => {
    if (!hasPanels) return;
    const measure = () => {
      const el = containerRef.current;
      if (el) {
        setContainerSize({ width: el.clientWidth, height: el.clientHeight });
      }
    };
    // Double rAF ensures CSS class changes (overflow: hidden) have been painted
    // before we measure the container dimensions
    let raf1, raf2;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(measure);
    });
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.removeEventListener('resize', measure);
    };
  }, [hasPanels, isFullscreen, reduceToFit]);

  // Calculate fit-to-screen scale factor
  const GAP = 4; // spacing.$spacing-02
  // The container has 8px padding on all sides. The grid starts inside the padding
  // (top-left offset), but clientWidth/clientHeight include padding on both sides.
  // Subtract the right/bottom padding so the scaled grid doesn't overflow into it.
  const CONTAINER_PADDING = 4;
  const fitScaleX = useMemo(() => {
    if (!reduceToFit || !containerSize.width) return 1;
    const gridNativeW = maxGridCol * CELL_WIDTH + (maxGridCol - 1) * GAP;
    return (containerSize.width - 2 * CONTAINER_PADDING) / gridNativeW;
  }, [reduceToFit, containerSize.width, maxGridCol, CELL_WIDTH]);

  const fitScaleY = useMemo(() => {
    if (!reduceToFit || !containerSize.height) return 1;
    const gridNativeH = maxGridRow * CELL_HEIGHT + (maxGridRow - 1) * GAP;
    return (containerSize.height - 2 * CONTAINER_PADDING) / gridNativeH;
  }, [reduceToFit, containerSize.height, maxGridRow, CELL_HEIGHT]);

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
    if (isNewDashboard) {
      // New dashboard — skip fetch, initialize empty client-side state
      const emptyDashboard = {
        name: 'Untitled Dashboard',
        description: '',
        panels: [],
        settings: { theme: 'dark', refresh_interval: 0, title_scale: 100, is_public: false, allow_export: true }
      };
      setDashboard(emptyDashboard);
      setLoading(false);
    } else {
      fetchDashboard();
    }
  }, [fetchDashboard, isNewDashboard]);

  // Auto-enter edit mode when navigated from design mode (or new dashboard)
  const autoEditTriggered = useRef(false);
  useEffect(() => {
    if (dashboard && !autoEditTriggered.current && (location.state?.autoEdit || isNewDashboard) && canDesign) {
      autoEditTriggered.current = true;
      enterEditMode();
    }
  }, [dashboard, location.state, isNewDashboard]);

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

  // Save thumbnail — captures the live grid at native resolution
  const [savingThumbnail, setSavingThumbnail] = useState(false);
  const saveThumbnail = async () => {
    const grid = gridRef.current;
    const container = containerRef.current;
    if (!grid || !container) return;

    setSavingThumbnail(true);
    try {
      // Save original styles
      const origGridTransform = grid.style.transform;
      const origGridOrigin = grid.style.transformOrigin;
      const origContainerOverflow = container.style.overflow;

      // Remove transform and allow overflow so html2canvas can see the full grid
      grid.style.transform = 'none';
      grid.style.transformOrigin = '';
      container.style.overflow = 'visible';

      // Wait for paint
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      // Calculate the native grid size from panel extent
      const gridNativeW = maxGridCol * CELL_WIDTH + (maxGridCol - 1) * GAP;
      const gridNativeH = maxGridRow * CELL_HEIGHT + (maxGridRow - 1) * GAP;

      const canvas = await html2canvas(grid, {
        backgroundColor: '#161616',
        scale: 0.25,
        useCORS: true,
        allowTaint: true,
        width: gridNativeW,
        height: gridNativeH,
        scrollX: 0,
        scrollY: 0,
        windowScrollX: 0,
        windowScrollY: 0,
        onclone: (clonedDoc) => {
          const clonedGrid = clonedDoc.querySelector('.dashboard-grid');
          if (clonedGrid) {
            // Remove all edit mode classes and elements
            clonedGrid.classList.remove('edit-active');
            clonedGrid.querySelectorAll('.edit-hover-header, .edit-drag-overlay, .edit-resize-handle, .edit-panel-menu-anchor').forEach(el => el.remove());
            clonedGrid.querySelectorAll('.panel-container.edit-mode').forEach(el => {
              el.classList.remove('edit-mode', 'dragging', 'resizing');
            });
          }
          // Remove ALL CSS gradient backgrounds that crash html2canvas
          // html2canvas can't parse certain gradient stop values
          clonedDoc.querySelectorAll('*').forEach(el => {
            const bg = getComputedStyle(el).backgroundImage;
            if (bg && bg.includes('gradient')) {
              el.style.backgroundImage = 'none';
            }
          });
        }
      });

      // Restore styles
      grid.style.transform = origGridTransform;
      grid.style.transformOrigin = origGridOrigin;
      container.style.overflow = origContainerOverflow;

      const thumbnailDataUrl = canvas.toDataURL('image/png');
      await apiClient.updateDashboard(id, { ...dashboard, thumbnail: thumbnailDataUrl });
      fetchDashboard();
    } catch (err) {
      console.error('Failed to save thumbnail:', err);
      // Restore styles on error
      if (grid) {
        grid.style.transform = '';
        grid.style.transformOrigin = '';
      }
      if (container) {
        container.style.overflow = '';
      }
    } finally {
      setSavingThumbnail(false);
    }
  };

  // ── Edit mode logic ──────────────────────────────────────────────

  const enterEditMode = () => {
    const panelsCopy = (dashboard?.panels || []).map(p => ({ ...p }));
    setEditablePanels(panelsCopy);
    setOriginalPanels(panelsCopy.map(p => ({ ...p })));
    setEditableName(dashboard?.name || '');
    setEditableDescription(dashboard?.description || '');
    setEditableTheme(dashboard?.settings?.theme || 'dark');
    setEditableRefreshInterval(dashboard?.settings?.refresh_interval || 0);
    setEditableTitleScale(dashboard?.settings?.title_scale || 100);
    setEditableIsPublic(dashboard?.settings?.is_public || false);
    setEditableAllowExport(dashboard?.settings?.allow_export ?? true);
    setEditHasChanges(false);
    setZoom(100);
    setIsEditMode(true);
  };

  const exitEditMode = () => {
    if (isNewDashboard) {
      if (editHasChanges) {
        setShowDiscardModal(true);
      } else {
        navigate('/design/dashboards', { replace: true });
      }
      return;
    }
    if (editHasChanges) {
      setShowDiscardModal(true);
    } else {
      setIsEditMode(false);
    }
  };

  const confirmDiscard = () => {
    setShowDiscardModal(false);
    if (isNewDashboard) {
      navigate('/design/dashboards', { replace: true });
      return;
    }
    setIsEditMode(false);
    setEditablePanels([]);
    setOriginalPanels([]);
    setEditHasChanges(false);
  };

  const handleDimensionChange = (newDimension) => {
    setCurrentDimension(newDimension);
    setEditHasChanges(true);
  };

  const saveEditMode = async () => {
    setEditSaving(true);
    try {
      const updatedSettings = {
        ...dashboard.settings,
        layout_dimension: currentDimension,
        theme: editableTheme,
        refresh_interval: editableRefreshInterval,
        title_scale: editableTitleScale,
        is_public: editableIsPublic,
        allow_export: editableAllowExport
      };
      const payload = {
        name: editableName,
        description: editableDescription,
        panels: editablePanels,
        settings: updatedSettings
      };

      if (isNewDashboard) {
        const created = await apiClient.createDashboard(payload);
        navigate(`/view/dashboards/${created.id}`, { replace: true });
      } else {
        await apiClient.updateDashboard(id, { ...dashboard, ...payload });
        setIsEditMode(false);
        setEditHasChanges(false);
        fetchDashboard();
      }
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

  // Add a new empty panel
  const addPanel = (panelData) => {
    const newPanel = {
      id: `panel-${Date.now()}`,
      chart_id: null,
      ...panelData
    };
    setEditablePanels(prev => [...prev, newPanel]);
    setEditHasChanges(true);
  };

  // Delete a panel
  const deletePanel = (panelId) => {
    setEditablePanels(prev => prev.filter(p => p.id !== panelId));
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
    const cellW = rect.width / maxGridCol;
    const cellH = rect.height / maxGridRow;
    const x = Math.floor((e.clientX - rect.left) / cellW);
    const y = Math.floor((e.clientY - rect.top) / cellH);
    return { x: Math.max(0, Math.min(x, maxGridCol - 1)), y: Math.max(0, y) };
  }, [maxGridCol, maxGridRow]);

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
    // Capture offset from the panel's bottom-right corner so the first
    // mouse movement doesn't immediately snap to the next grid cell.
    if (gridRef.current) {
      const rect = gridRef.current.getBoundingClientRect();
      const cellW = rect.width / maxGridCol;
      const cellH = rect.height / maxGridRow;
      const edgePixelX = rect.left + (panel.x + panel.w) * cellW;
      const edgePixelY = rect.top + (panel.y + panel.h) * cellH;
      // How far inside the current cell the mouse started
      const offsetX = e.clientX - edgePixelX;
      const offsetY = e.clientY - edgePixelY;
      setResizingPanel({ id: panel.id, offsetX, offsetY });
    } else {
      setResizingPanel({ id: panel.id, offsetX: 0, offsetY: 0 });
    }
  };

  // Start drawing a new panel by clicking empty grid space
  const handleGridMouseDown = (e) => {
    if (!isEditMode) return;
    // Only trigger on clicks directly on the grid (not on panels)
    if (e.target !== gridRef.current) return;
    const pos = getGridPosition(e);
    if (pos) {
      setDrawingPanel({
        startX: pos.x,
        startY: pos.y,
        x: pos.x,
        y: pos.y,
        w: 1,
        h: 1
      });
    }
  };

  useEffect(() => {
    if (!isEditMode || (!draggingPanel && !resizingPanel && !drawingPanel)) return;

    const boundCols = gridCols || maxGridCol;
    const boundRows = gridRows || maxGridRow;

    const handleMouseMove = (e) => {
      const pos = getGridPosition(e);
      if (!pos) return;

      if (drawingPanel) {
        const x = Math.min(drawingPanel.startX, pos.x);
        const y = Math.min(drawingPanel.startY, pos.y);
        const w = Math.abs(pos.x - drawingPanel.startX) + 1;
        const h = Math.abs(pos.y - drawingPanel.startY) + 1;
        setDrawingPanel(prev => ({
          ...prev,
          x,
          y,
          w: Math.min(w, boundCols - x),
          h: Math.min(h, boundRows - y)
        }));
      }

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
        if (panel && gridRef.current) {
          const minSize = getMinSizeForPanel(resizingPanel.id);
          // Use raw pixel position adjusted by initial offset for smooth resizing
          const rect = gridRef.current.getBoundingClientRect();
          const adjustedX = e.clientX - (resizingPanel.offsetX || 0);
          const adjustedY = e.clientY - (resizingPanel.offsetY || 0);
          const cellW = rect.width / maxGridCol;
          const cellH = rect.height / maxGridRow;
          const gridX = Math.floor((adjustedX - rect.left) / cellW);
          const gridY = Math.floor((adjustedY - rect.top) / cellH);
          const newW = Math.max(minSize.w, Math.min(gridX - panel.x + 1, boundCols - panel.x));
          const newH = Math.max(minSize.h, Math.min(gridY - panel.y + 1, boundRows - panel.y));
          if (newW !== panel.w || newH !== panel.h) {
            updateEditablePanel(resizingPanel.id, { w: newW, h: newH });
          }
        }
      }
    };

    const handleMouseUp = () => {
      if (drawingPanel && drawingPanel.w >= 2 && drawingPanel.h >= 1) {
        addPanel({
          x: drawingPanel.x,
          y: drawingPanel.y,
          w: drawingPanel.w,
          h: drawingPanel.h
        });
      }
      setDrawingPanel(null);
      setDraggingPanel(null);
      setResizingPanel(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isEditMode, draggingPanel, resizingPanel, drawingPanel, editablePanels, maxGridCol, maxGridRow, gridCols, gridRows, getGridPosition]);

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

  };

  // ── Text panel helpers ────────────────────────────────────────────
  const getPanelRect = (panelId) => {
    if (!gridRef.current) return null;
    const panelEl = gridRef.current.querySelector(`[data-panel-id="${panelId}"]`);
    return panelEl ? panelEl.getBoundingClientRect() : null;
  };

  const setTextPanel = (panelId) => {
    // Set default text config and clear chart_id
    updateEditablePanel(panelId, {
      chart_id: null,
      text_config: { content: '', display_content: 'title', size: 20, align: 'center' }
    });
    // Open the text editor anchored to the panel
    // Use requestAnimationFrame to ensure the panel has re-rendered with text_config
    requestAnimationFrame(() => {
      setTextEditorAnchorRect(getPanelRect(panelId));
      setTextEditorPanelId(panelId);
    });
  };

  const openTextEditor = (panelId) => {
    setTextEditorAnchorRect(getPanelRect(panelId));
    setTextEditorPanelId(panelId);
  };

  const handleTextConfigUpdate = (panelId, textConfig) => {
    updateEditablePanel(panelId, { text_config: textConfig });
  };

  const closeTextEditor = () => {
    setTextEditorPanelId(null);
    setTextEditorAnchorRect(null);
  };

  const openComponentPicker = (panelId, category) => {
    setComponentPickerPanelId(panelId);
    setComponentPickerCategory(category);
    setComponentPickerOpen(true);

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
              align="bottom"
              onClick={handleBack}
            >
              <ArrowLeft size={20} />
            </IconButton>
          )}
          <div className="dashboard-info">
            {isEditMode ? (
              <input
                className="dashboard-name-input"
                type="text"
                value={editableName}
                onChange={(e) => {
                  setEditableName(e.target.value);
                  setEditHasChanges(true);
                }}
              />
            ) : (
              <h1>{dashboard?.name}</h1>
            )}
          </div>
        </div>

        <div className="toolbar-center">
          {!isEditMode && dashboard?.settings?.refresh_interval > 0 && (
            <Tag type="green" size="sm">
              <Time size={12} />
              Data refresh: {dashboard.settings.refresh_interval}s
            </Tag>
          )}
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
          {isEditMode && (
            <div className="zoom-controls">
              <IconButton
                kind="ghost"
                size="sm"
                label="Zoom out"
                align="bottom"
                onClick={zoomOut}
                disabled={zoom <= 10}
              >
                <ZoomOut size={16} />
              </IconButton>
              <button
                type="button"
                className="zoom-reset"
                onClick={zoomReset}
                title="Reset to 100%"
              >
                {zoom}%
              </button>
              <IconButton
                kind="ghost"
                size="sm"
                label="Zoom in"
                align="bottom"
                onClick={zoomIn}
                disabled={zoom >= 100}
              >
                <ZoomIn size={16} />
              </IconButton>
            </div>
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
                label="Dashboard settings"
                align="bottom"
                onClick={() => setSettingsModalOpen(true)}
              >
                <Settings size={20} />
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
                align="bottom"
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
                  label="Edit dashboard"
                  align="bottom"
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
      {(panels && panels.length > 0) || isEditMode ? (
        <div
          ref={containerRef}
          className={`dashboard-grid-container ${reduceToFit ? 'fit-to-screen' : ''}`}
        >
          <div
            ref={gridRef}
            className={`dashboard-grid ${isEditMode ? 'edit-active' : ''}`}
            onMouseDown={handleGridMouseDown}
            style={{
              gridTemplateColumns: `repeat(${maxGridCol}, ${CELL_WIDTH}px)`,
              gridTemplateRows: `repeat(${maxGridRow}, ${CELL_HEIGHT}px)`,
              '--title-scale': (isEditMode ? editableTitleScale : (dashboard?.settings?.title_scale || 100)) / 100,
              // Fit-to-screen: scale the grid to fit the viewport
              ...(reduceToFit && !isEditMode ? {
                transform: `scale(${fitScaleX}, ${fitScaleY})`,
                transformOrigin: 'top left'
              } : {}),
              // Edit mode: manual zoom
              ...(isEditMode && zoom !== 100 ? {
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top left'
              } : {})
            }}
          >
            {panels.map((panel) => {
              const chart = panel.chart_id ? chartsMap[panel.chart_id] : null;
              const hasText = !!panel.text_config;
              const hasChart = !hasText && (!!chart?.component_code || chart?.component_type === 'control' || chart?.component_type === 'display');
              const hasContent = hasText || hasChart;

              return (
                <div
                  key={panel.id}
                  data-panel-id={panel.id}
                  className={`panel-container ${hasContent ? 'has-component' : 'empty-panel'} ${hasText ? 'text-panel' : ''} ${chart?.control_config?.control_type === 'text_label' ? 'text-label-panel' : ''} ${isEditMode ? 'edit-mode' : ''} ${draggingPanel?.id === panel.id ? 'dragging' : ''} ${resizingPanel?.id === panel.id ? 'resizing' : ''}`}
                  style={{
                    gridColumn: `${panel.x + 1} / span ${panel.w}`,
                    gridRow: `${panel.y + 1} / span ${panel.h}`,
                    cursor: isEditMode ? 'default' : (hasChart ? 'pointer' : 'default')
                  }}
                  onDoubleClick={() => handlePanelDoubleClick(chart)}
                >
                  {/* Edit mode: hover header overlay with title, actions, and delete */}
                  {isEditMode && (
                    <div className="edit-hover-header"
                      onMouseDown={(e) => startDragging(e, panel)}
                    >
                      <span className="panel-title-label">
                        {hasText ? (panel.text_config.content || 'Text') : (chart?.title || chart?.name || 'Empty')}
                      </span>
                      <div className="panel-header-right" style={{ pointerEvents: (draggingPanel || resizingPanel) ? 'none' : 'auto' }}>
                        <span className="panel-size-label">{panel.w}×{panel.h}</span>
                        <div className="panel-header-edit-menu" onMouseDown={(e) => e.stopPropagation()}>
                          {hasText ? (
                            <IconButton
                              kind="ghost"
                              size="sm"
                              label="Edit text"
                              className="panel-text-edit-btn"
                              onClick={(e) => { e.stopPropagation(); textEditorPanelId === panel.id ? closeTextEditor() : openTextEditor(panel.id); }}
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              <Edit size={14} />
                            </IconButton>
                          ) : (
                            <PanelEditMenu
                              minimal
                              minimalIcon={hasChart ? <Edit size={14} /> : <Add size={14} />}
                              hasExisting={hasChart}
                              onEdit={hasChart ? () => openChartEditor(panel.id) : undefined}
                              onEditWithAI={hasChart ? () => openAIEditor(panel.id) : undefined}
                              onNew={() => {
                                if (hasChart) updateEditablePanel(panel.id, { chart_id: null, text_config: null });
                                openChartEditor(panel.id, null);
                              }}
                              onNewWithAI={() => openAIPreflightModal(panel.id)}
                              onSelectExisting={() => openComponentPicker(panel.id, 'all')}
                              onText={() => setTextPanel(panel.id)}
                            />
                          )}
                        </div>
                        <IconButton
                          kind="ghost"
                          size="sm"
                          label="Delete panel"
                          className="panel-delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            deletePanel(panel.id);
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <TrashCan size={14} />
                        </IconButton>
                      </div>
                    </div>
                  )}

                  {/* Panel content */}
                  {hasText ? (
                    <div className="component-wrapper text-wrapper">
                      <PanelText config={panel.text_config} />
                    </div>
                  ) : hasChart ? (
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

                  {/* Edit mode: full-panel drag overlay */}
                  {isEditMode && (
                    <div
                      className="edit-drag-overlay"
                      onMouseDown={(e) => startDragging(e, panel)}
                    />
                  )}

                  {/* Edit mode: Add button for empty panels */}
                  {isEditMode && !hasContent && (
                    <div className="edit-panel-menu-anchor" style={{ pointerEvents: (draggingPanel || resizingPanel) ? 'none' : 'auto' }}>
                      <PanelEditMenu
                        buttonLabel="Add"
                        hasExisting={false}
                        onNew={() => openChartEditor(panel.id, null)}
                        onNewWithAI={() => openAIPreflightModal(panel.id)}
                        onSelectExisting={() => openComponentPicker(panel.id, 'all')}
                        onText={() => setTextPanel(panel.id)}
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

            {/* Drawing preview — shown while dragging to create a new panel */}
            {drawingPanel && (
              <div
                className="drawing-panel-preview"
                style={{
                  gridColumn: `${drawingPanel.x + 1} / span ${drawingPanel.w}`,
                  gridRow: `${drawingPanel.y + 1} / span ${drawingPanel.h}`
                }}
              >
                <span>{drawingPanel.w}×{drawingPanel.h}</span>
              </div>
            )}

            {/* Dimension boundary lines — rendered as real elements to paint above grid items */}
            {isEditMode && gridCols && (
              <>
                <div
                  className="grid-boundary-right"
                  style={{
                    left: gridCols * CELL_WIDTH + (gridCols - 1) * VIEWER_GAP,
                    height: gridRows * CELL_HEIGHT + (gridRows - 1) * VIEWER_GAP
                  }}
                />
                <div
                  className="grid-boundary-bottom"
                  style={{
                    top: gridRows * CELL_HEIGHT + (gridRows - 1) * VIEWER_GAP,
                    width: gridCols * CELL_WIDTH + (gridCols - 1) * VIEWER_GAP
                  }}
                />
              </>
            )}
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

      {/* Text panel editor */}
      {textEditorPanelId && (
        <PanelTextEditor
          config={editablePanels.find(p => p.id === textEditorPanelId)?.text_config}
          onUpdate={(config) => handleTextConfigUpdate(textEditorPanelId, config)}
          onClose={closeTextEditor}
          anchorRect={textEditorAnchorRect}
        />
      )}

      {/* Dashboard settings modal */}
      <Modal
        open={settingsModalOpen}
        onRequestClose={() => setSettingsModalOpen(false)}
        onRequestSubmit={() => {
          setEditHasChanges(true);
          setSettingsModalOpen(false);
        }}
        modalHeading="Dashboard Settings"
        primaryButtonText="Apply"
        secondaryButtonText="Cancel"
        size="sm"
      >
        <div className="dashboard-settings-form">
          <TextInput
            id="settings-description"
            labelText="Description"
            value={editableDescription}
            onChange={(e) => setEditableDescription(e.target.value)}
            placeholder="Enter dashboard description"
          />
          <Select
            id="settings-theme"
            labelText="Theme"
            value={editableTheme}
            onChange={(e) => setEditableTheme(e.target.value)}
          >
            <SelectItem value="light" text="Light" />
            <SelectItem value="dark" text="Dark" />
            <SelectItem value="auto" text="Auto" />
          </Select>
          <NumberInput
            id="settings-refresh"
            label="Auto Refresh (seconds)"
            value={editableRefreshInterval}
            onChange={(e, { value }) => setEditableRefreshInterval(value)}
            min={0}
            max={3600}
            step={5}
            helperText="Set to 0 to disable auto refresh"
          />
          <Slider
            id="settings-title-scale"
            labelText="Title Scale (%)"
            value={editableTitleScale}
            onChange={({ value }) => setEditableTitleScale(value)}
            min={50}
            max={200}
            step={10}
          />
          <Checkbox
            id="settings-public"
            labelText="Make dashboard public"
            checked={editableIsPublic}
            onChange={(_, { checked }) => setEditableIsPublic(checked)}
          />
          <Checkbox
            id="settings-export"
            labelText="Allow export"
            checked={editableAllowExport}
            onChange={(_, { checked }) => setEditableAllowExport(checked)}
          />
        </div>
      </Modal>

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
