// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import html2canvas from 'html2canvas';
import * as echarts from 'echarts';
import {
  Button,
  Loading,
  Modal,
  TextInput,
  Select,
  SelectItem,
  Checkbox,
  NumberInput,
  IconButton,
  Tooltip,
  Slider
} from '@carbon/react';
import {
  Save,
  Close,
  TrashCan,
  Edit,
  View,
  ChartBar,
  Information,
  ZoomIn,
  ZoomOut,
  ArrowLeft
} from '@carbon/icons-react';
import DynamicComponentLoader from '../components/DynamicComponentLoader';
import ChartEditorModal from '../components/ChartEditorModal';
import PanelEditMenu from '../components/PanelEditMenu';
import ComponentPickerModal from '../components/ComponentPickerModal';
import AIPreflightModal from '../components/AIPreflightModal';
import apiClient from '../api/client';
import { getComponentMinSize } from '../config/layoutConfig';
import './DashboardDetailPage.scss';

// Editor modes for the dashboard designer
const EDITOR_MODES = {
  DESIGN: 'design',      // Edit panel positions/sizes + charts in one view
  PREVIEW: 'preview'     // Live preview of charts
};

/**
 * DashboardDetailPage Component
 *
 * Create/Edit dashboard with two modes:
 * - Design Mode: Move/resize panels (header drag, corner resize) + edit charts (center button)
 * - Preview Mode: See rendered charts live
 */
function DashboardDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isCreateMode = id === 'new';

  // Determine where to go back to after save/cancel
  // If came from view mode (referrer contains /view/), go back to dashboard viewer
  const returnPath = location.state?.from || '/design/dashboards';
  const getReturnPath = () => {
    // For existing dashboards, check if we came from view mode
    if (!isCreateMode && location.state?.from?.startsWith('/view/')) {
      return `/view/dashboards/${id}`;
    }
    return returnPath;
  };

  // Dashboard state
  const [dashboard, setDashboard] = useState(null);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [description, setDescription] = useState('');
  const [panels, setPanels] = useState([]); // Panel positions/sizes with chart_id references
  const [chartsMap, setChartsMap] = useState({}); // Chart data keyed by chart_id (for rendering)
  const [theme, setTheme] = useState('dark');
  const [refreshInterval, setRefreshInterval] = useState(0);
  const [titleScale, setTitleScale] = useState(100); // Title font scale % (50-200)
  const [isPublic, setIsPublic] = useState(false);
  const [allowExport, setAllowExport] = useState(true);

  // Editor mode state
  const [editorMode, setEditorMode] = useState(EDITOR_MODES.DESIGN);

  // UI state
  const [loading, setLoading] = useState(!isCreateMode);
  const [error, setError] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Chart editor modal state
  const [chartEditorOpen, setChartEditorOpen] = useState(false);
  const [editingPanelId, setEditingPanelId] = useState(null);
  const [editingChart, setEditingChart] = useState(null);

  // Chart selector modal state (legacy - being replaced by component picker)
  const [chartSelectorOpen, setChartSelectorOpen] = useState(false);
  const [selectingPanelId, setSelectingPanelId] = useState(null);
  const [availableCharts, setAvailableCharts] = useState([]);

  // Component picker modal state (for selecting displays or controls)
  const [componentPickerOpen, setComponentPickerOpen] = useState(false);
  const [componentPickerCategory, setComponentPickerCategory] = useState('chart'); // 'chart' or 'control'
  const [componentPickerPanelId, setComponentPickerPanelId] = useState(null);

  // AI pre-flight modal state
  const [aiPreflightOpen, setAiPreflightOpen] = useState(false);
  const [aiPreflightPanelId, setAiPreflightPanelId] = useState(null);

  // Layout editing state
  const [draggingPanel, setDraggingPanel] = useState(null);
  const [resizingPanel, setResizingPanel] = useState(null);
  const [drawingPanel, setDrawingPanel] = useState(null);
  const gridRef = useRef(null);
  const thumbnailCaptureRef = useRef(null);

  // Layout dimension state
  const [dimensions, setDimensions] = useState([]);
  const [currentDimension, setCurrentDimension] = useState('');
  const [dimensionLoading, setDimensionLoading] = useState(true);

  // Zoom state
  const [zoom, setZoom] = useState(100);
  const zoomIn = () => setZoom(z => Math.min(z + 10, 100));
  const zoomOut = () => setZoom(z => Math.max(z - 10, 10));
  const zoomReset = () => setZoom(100);

  // Grid configuration - fixed 64x36px cells (16:9 aspect ratio)
  // Larger dimensions = more cells, not bigger cells
  const CELL_WIDTH = 64;
  const CELL_HEIGHT = 36;

  // Calculate grid dimensions based on selected dimension preset
  const currentDim = dimensions.find(d => d.name === currentDimension);
  const gridWidth = currentDim?.max_width || 1920;
  const gridHeight = currentDim?.max_height || 1080;
  const GRID_COLS = Math.floor(gridWidth / CELL_WIDTH);
  const GRID_ROWS = Math.floor(gridHeight / CELL_HEIGHT);
  const OVERFLOW_ROWS = 10; // Extra rows below visible area for drawing new panels

  // Get minimum panel size based on assigned component's subtype
  const getMinSizeForPanel = (panelId) => {
    const panel = panels.find(p => p.id === panelId);
    if (!panel?.chart_id) return getComponentMinSize('default');
    const chart = chartsMap[panel.chart_id];
    if (!chart) return getComponentMinSize('default');
    const subtype = chart.control_config?.control_type || chart.chart_type;
    return getComponentMinSize(subtype);
  };

  useEffect(() => {
    if (!isCreateMode) {
      fetchDashboard();
    }
  }, [id]);

  // Load layout dimensions on mount
  useEffect(() => {
    const loadDimensions = async () => {
      try {
        setDimensionLoading(true);
        const config = await apiClient.getSystemConfig();

        // Convert layout_dimensions object to array for dropdown
        const dimensionList = Object.entries(config.layout_dimensions || {}).map(([name, dim]) => ({
          name,
          max_width: dim.max_width,
          max_height: dim.max_height
        }));

        // Sort by width ascending
        dimensionList.sort((a, b) => a.max_width - b.max_width);

        setDimensions(dimensionList);

        // Set current dimension from system config
        const current = config.settings?.current_layout_dimension || config.default_dimension;
        setCurrentDimension(current);
      } catch (err) {
        console.error('Failed to load layout dimensions:', err);
      } finally {
        setDimensionLoading(false);
      }
    };

    loadDimensions();
  }, []);

  // Handle dimension change - auto-scale panels if new dimension is smaller
  const handleDimensionChange = async (newDimension) => {
    const newDim = dimensions.find(d => d.name === newDimension);
    if (!newDim) return;

    // Calculate grid columns/rows for old and new dimensions
    const oldCols = GRID_COLS;
    const oldRows = GRID_ROWS;
    const newCols = Math.floor(newDim.max_width / CELL_WIDTH);
    const newRows = Math.floor(newDim.max_height / CELL_HEIGHT);

    // Check if any panels need scaling (exceed new bounds)
    if (panels.length > 0) {
      // Find max extent of current panels
      let maxPanelRight = 0;
      let maxPanelBottom = 0;
      panels.forEach(panel => {
        maxPanelRight = Math.max(maxPanelRight, panel.x + panel.w);
        maxPanelBottom = Math.max(maxPanelBottom, panel.y + panel.h);
      });

      // Check if panels exceed new grid bounds
      const needsScaling = maxPanelRight > newCols || maxPanelBottom > newRows;

      if (needsScaling) {
        // Calculate scale factors based on panel extent vs new grid size
        const scaleX = maxPanelRight > newCols ? newCols / maxPanelRight : 1;
        const scaleY = maxPanelBottom > newRows ? newRows / maxPanelBottom : 1;

        console.log('Auto-scaling panels:', {
          oldCols, oldRows, newCols, newRows,
          maxPanelRight, maxPanelBottom,
          scaleX, scaleY
        });

        // Scale all panels proportionally
        const scaledPanels = panels.map(panel => {
          const minSize = getMinSizeForPanel(panel.id);
          return {
            ...panel,
            x: Math.floor(panel.x * scaleX),
            y: Math.floor(panel.y * scaleY),
            w: Math.max(minSize.w, Math.floor(panel.w * scaleX)),
            h: Math.max(minSize.h, Math.floor(panel.h * scaleY))
          };
        });

        setPanels(scaledPanels);
        setHasChanges(true);
      }
    }

    try {
      await apiClient.updateSystemConfig({ current_layout_dimension: newDimension });
      setCurrentDimension(newDimension);
    } catch (err) {
      console.error('Failed to set dimension:', err);
      setError('Failed to save dimension preference');
      setTimeout(() => setError(null), 5000);
    }
  };

  // Check for duplicate dashboard name on blur
  const checkDuplicateDashboardName = async (nameToCheck) => {
    if (!nameToCheck || !nameToCheck.trim()) {
      setNameError('');
      return;
    }
    try {
      const dashboards = await apiClient.getDashboards();
      const duplicate = dashboards.find(db =>
        db.name.toLowerCase() === nameToCheck.trim().toLowerCase() &&
        db.id !== id
      );
      if (duplicate) {
        setNameError('A dashboard with this name already exists');
      } else {
        setNameError('');
      }
    } catch (err) {
      console.error('Error checking dashboard name:', err);
      setNameError('');
    }
  };

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getDashboard(id);
      setDashboard(data);
      setName(data.name);
      setDescription(data.description || '');
      setTheme(data.settings?.theme || 'dark');
      setRefreshInterval(data.settings?.refresh_interval || 0);
      setTitleScale(data.settings?.title_scale || 100);
      setIsPublic(data.settings?.is_public || false);
      setAllowExport(data.settings?.allow_export !== false);

      // Restore the layout dimension the dashboard was created with
      if (data.settings?.layout_dimension) {
        setCurrentDimension(data.settings.layout_dimension);
      }

      // Load panels (now contain chart_id references)
      if (data.panels && data.panels.length > 0) {
        setPanels(data.panels);

        // Fetch all referenced charts
        const chartIds = [...new Set(data.panels.map(p => p.chart_id).filter(Boolean))];
        if (chartIds.length > 0) {
          const chartPromises = chartIds.map(chartId => apiClient.getChart(chartId).catch(() => null));
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
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Mark that panels have been modified
  const markPanelsModified = () => {
    setHasChanges(true);
  };

  // Panel operations for Layout Mode
  const addPanel = (panelData) => {
    const newPanel = {
      id: `panel-${Date.now()}`,
      ...panelData
    };
    setPanels(prev => [...prev, newPanel]);
    markPanelsModified();
  };

  const updatePanel = (panelId, updates) => {
    setPanels(prev => prev.map(p =>
      p.id === panelId ? { ...p, ...updates } : p
    ));
    markPanelsModified();
  };

  const deletePanel = (panelId) => {
    setPanels(prev => prev.filter(p => p.id !== panelId));
    // Note: We don't delete the chart from chartsMap since other panels might use it
    // The chart continues to exist as a standalone entity
    markPanelsModified();
  };

  // Expand a panel to fit the minimum size for a component, clamping to grid bounds
  const expandPanelToMinSize = (panelId, component) => {
    const subtype = component.control_config?.control_type || component.chart_type;
    const minSize = getComponentMinSize(subtype);
    setPanels(prev => prev.map(p => {
      if (p.id !== panelId) return p;
      const newW = Math.max(p.w, Math.min(minSize.w, GRID_COLS - p.x));
      const newH = Math.max(p.h, minSize.h);
      return (newW !== p.w || newH !== p.h) ? { ...p, w: newW, h: newH } : p;
    }));
  };

  // Chart operations
  const handleChartSave = async (chartData) => {
    const { panel_id, ...chartInfo } = chartData;

    // Add chart to chartsMap (keyed by chart_id)
    setChartsMap(prev => ({
      ...prev,
      [chartInfo.id]: chartInfo
    }));

    // Update panel to reference this chart_id and expand to minimum size
    const subtype = chartInfo.control_config?.control_type || chartInfo.chart_type;
    const minSize = getComponentMinSize(subtype);
    setPanels(prev => prev.map(p => {
      if (p.id !== panel_id) return p;
      const newW = Math.max(p.w, Math.min(minSize.w, GRID_COLS - p.x));
      const newH = Math.max(p.h, minSize.h);
      return { ...p, chart_id: chartInfo.id, w: newW, h: newH };
    }));

    setHasChanges(true);
  };

  // Open chart editor for creating/editing a chart
  // Pass chart=null explicitly when creating a new chart to avoid stale state issues
  const openChartEditor = (panelId, chart = undefined) => {
    setEditingPanelId(panelId);
    if (chart === undefined) {
      // Look up chart from panel (for editing existing)
      const panel = panels.find(p => p.id === panelId);
      setEditingChart(panel?.chart_id ? chartsMap[panel.chart_id] : null);
    } else {
      // Use explicitly passed chart (null for new chart)
      setEditingChart(chart);
    }
    setChartEditorOpen(true);
  };

  // Open AI editor for creating/editing a chart with AI
  const openAIEditor = (panelId) => {
    const panel = panels.find(p => p.id === panelId);
    const chartId = panel?.chart_id;
    // Pass the current dashboard URL as referrer so AI editor returns here
    const returnUrl = isCreateMode ? '/design/dashboards' : `/design/dashboards/${id}`;
    if (chartId) {
      navigate(`/design/charts/ai/${chartId}`, { state: { from: returnUrl, panelId } });
    } else {
      // Navigate to create new chart with AI
      navigate('/design/charts/ai/new', { state: { from: returnUrl, panelId } });
    }
  };

  const closeChartEditor = () => {
    setChartEditorOpen(false);
    setEditingPanelId(null);
    setEditingChart(null);
  };

  // Chart selector operations (legacy - replaced by ComponentPickerModal)
  // eslint-disable-next-line no-unused-vars
  const _openChartSelector = async (panelId) => {
    setSelectingPanelId(panelId);
    try {
      const response = await apiClient.getChartSummaries(100);
      setAvailableCharts(response.summaries || []);
    } catch (err) {
      console.error('Failed to fetch charts:', err);
      setAvailableCharts([]);
    }
    setChartSelectorOpen(true);
  };

  const closeChartSelector = () => {
    setChartSelectorOpen(false);
    setSelectingPanelId(null);
  };

  const handleChartSelect = async (chartId) => {
    if (!selectingPanelId) return;

    // Fetch full chart data if not already in chartsMap
    let chart = chartsMap[chartId];
    if (!chart) {
      try {
        chart = await apiClient.getChart(chartId);
        setChartsMap(prev => ({ ...prev, [chartId]: chart }));
      } catch (err) {
        console.error('Failed to fetch chart:', err);
        return;
      }
    }

    // Update panel to reference this chart_id
    setPanels(prev => prev.map(p =>
      p.id === selectingPanelId ? { ...p, chart_id: chartId } : p
    ));

    // Expand panel to component's minimum size
    expandPanelToMinSize(selectingPanelId, chart);

    setHasChanges(true);
    closeChartSelector();
  };

  // Component picker operations (unified for displays and controls)
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

    // Add component to chartsMap (both displays and controls use the same storage)
    if (!chartsMap[component.id]) {
      setChartsMap(prev => ({ ...prev, [component.id]: component }));
    }

    // Update panel to reference this component and expand to minimum size
    setPanels(prev => prev.map(p =>
      p.id === componentPickerPanelId ? { ...p, chart_id: component.id } : p
    ));
    expandPanelToMinSize(componentPickerPanelId, component);

    setHasChanges(true);
    closeComponentPicker();
  };

  // AI pre-flight modal operations
  const openAIPreflightModal = (panelId) => {
    // Clear the panel's chart_id first (creating a new component)
    updatePanel(panelId, { chart_id: null });
    setAiPreflightPanelId(panelId);
    setAiPreflightOpen(true);
  };

  const handleAIPreflightContinue = (context) => {
    setAiPreflightOpen(false);
    const returnUrl = isCreateMode ? '/design/dashboards' : `/design/dashboards/${id}`;
    navigate('/design/charts/ai/new', {
      state: {
        ...context,
        from: returnUrl,
        panelId: aiPreflightPanelId
      }
    });
    setAiPreflightPanelId(null);
  };

  // Grid mouse handlers for Layout Mode
  const getGridPosition = (e) => {
    if (!gridRef.current) return null;
    const rect = gridRef.current.getBoundingClientRect();
    // Account for zoom: the visual cell size is scaled, so divide mouse offset by zoom factor
    const scale = zoom / 100;
    const x = Math.floor((e.clientX - rect.left) / (CELL_WIDTH * scale));
    const y = Math.floor((e.clientY - rect.top) / (CELL_HEIGHT * scale));
    return { x: Math.max(0, Math.min(x, GRID_COLS - 1)), y: Math.max(0, y) };
  };

  const handleGridMouseDown = (e) => {
    if (editorMode !== EDITOR_MODES.DESIGN) return;

    // Check if clicking on empty space (not on a panel)
    if (e.target === gridRef.current || e.target.classList.contains('panel-grid')) {
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
    }
  };

  const handleGridMouseMove = (e) => {
    if (editorMode !== EDITOR_MODES.DESIGN) return;

    if (drawingPanel) {
      const pos = getGridPosition(e);
      if (pos) {
        const x = Math.min(drawingPanel.startX, pos.x);
        const y = Math.min(drawingPanel.startY, pos.y);
        const w = Math.abs(pos.x - drawingPanel.startX) + 1;
        const h = Math.abs(pos.y - drawingPanel.startY) + 1;
        setDrawingPanel(prev => ({
          ...prev,
          x,
          y,
          w: Math.min(w, GRID_COLS - x),
          h
        }));
      }
    }

    if (draggingPanel) {
      const pos = getGridPosition(e);
      if (pos) {
        const panel = panels.find(p => p.id === draggingPanel.id);
        if (panel) {
          const newX = Math.max(0, Math.min(pos.x - draggingPanel.offsetX, GRID_COLS - panel.w));
          const newY = Math.max(0, pos.y - draggingPanel.offsetY);
          updatePanel(draggingPanel.id, { x: newX, y: newY });
        }
      }
    }

    if (resizingPanel) {
      const pos = getGridPosition(e);
      if (pos) {
        const panel = panels.find(p => p.id === resizingPanel.id);
        if (panel) {
          const minSize = getMinSizeForPanel(resizingPanel.id);
          const newW = Math.max(minSize.w, Math.min(pos.x - panel.x + 1, GRID_COLS - panel.x));
          const newH = Math.max(minSize.h, pos.y - panel.y + 1);
          updatePanel(resizingPanel.id, { w: newW, h: newH });
        }
      }
    }
  };

  const handleGridMouseUp = () => {
    if (drawingPanel && drawingPanel.w >= 2 && drawingPanel.h >= 2) {
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

  const startDragging = (e, panel) => {
    if (editorMode !== EDITOR_MODES.DESIGN) return;
    e.stopPropagation();
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
    if (editorMode !== EDITOR_MODES.DESIGN) return;
    e.stopPropagation();
    setResizingPanel({ id: panel.id });
  };

  // Capture thumbnail of the dashboard grid (switches to preview mode temporarily)
  const captureThumbnail = async () => {
    if (!thumbnailCaptureRef.current || !gridRef.current) return null;
    if (panels.length === 0) return null;

    // Store current mode to restore after capture
    const previousMode = editorMode;

    console.log('=== THUMBNAIL CAPTURE DEBUG START ===');
    console.log('1. Dimension preset:', currentDimension);
    console.log('2. Current dimension object:', currentDim);
    console.log('3. Grid constants:', { CELL_WIDTH, CELL_HEIGHT, GRID_COLS, GRID_ROWS });

    try {
      // Switch to preview mode so charts are rendered
      setEditorMode(EDITOR_MODES.PREVIEW);

      // Apply thumbnail-capture class to container for styling
      thumbnailCaptureRef.current.classList.add('thumbnail-capture');

      // Calculate grid dimensions from constants (what the grid SHOULD be)
      const gridWidth = GRID_COLS * CELL_WIDTH;
      const gridHeight = GRID_ROWS * CELL_HEIGHT;

      console.log('4. Calculated grid dimensions:', { gridWidth, gridHeight });

      // Get actual DOM dimensions BEFORE style changes
      const containerRectBefore = thumbnailCaptureRef.current.getBoundingClientRect();
      const gridRectBefore = gridRef.current.getBoundingClientRect();
      console.log('5. Container rect BEFORE style change:', containerRectBefore);
      console.log('6. Grid rect BEFORE style change:', gridRectBefore);
      console.log('7. Grid element scrollWidth/scrollHeight BEFORE:', {
        scrollWidth: gridRef.current.scrollWidth,
        scrollHeight: gridRef.current.scrollHeight,
        offsetWidth: gridRef.current.offsetWidth,
        offsetHeight: gridRef.current.offsetHeight,
        clientWidth: gridRef.current.clientWidth,
        clientHeight: gridRef.current.clientHeight
      });

      // Calculate content extent FIRST (before setting container size)
      let maxPanelRightForContainer = 0;
      let maxPanelBottomForContainer = 0;
      panels.forEach(panel => {
        maxPanelRightForContainer = Math.max(maxPanelRightForContainer, (panel.x + panel.w) * CELL_WIDTH);
        maxPanelBottomForContainer = Math.max(maxPanelBottomForContainer, (panel.y + panel.h) * CELL_HEIGHT);
      });
      const containerWidth = Math.max(gridWidth, maxPanelRightForContainer);
      const containerHeight = Math.max(gridHeight, maxPanelBottomForContainer);

      // Temporarily set container to capture size (larger of grid or content)
      const originalContainerStyle = thumbnailCaptureRef.current.style.cssText;
      thumbnailCaptureRef.current.style.width = `${containerWidth}px`;
      thumbnailCaptureRef.current.style.height = `${containerHeight}px`;
      thumbnailCaptureRef.current.style.overflow = 'visible';
      thumbnailCaptureRef.current.style.maxHeight = 'none';

      console.log('4b. Container size set to:', { containerWidth, containerHeight });

      // Wait for React to re-render in preview mode
      await new Promise(resolve => setTimeout(resolve, 500));

      // NOW apply style overrides after React has rendered
      // Force the grid template to use fixed pixel sizes
      const originalGridStyle = gridRef.current.style.cssText;
      gridRef.current.style.width = `${gridWidth}px`;
      gridRef.current.style.height = `${gridHeight}px`;
      gridRef.current.style.maxWidth = `${gridWidth}px`;
      gridRef.current.style.overflow = 'hidden';
      gridRef.current.style.gridTemplateColumns = `repeat(${GRID_COLS}, ${CELL_WIDTH}px)`;
      gridRef.current.style.gridTemplateRows = `repeat(${GRID_ROWS}, ${CELL_HEIGHT}px)`;

      // Force each panel to its exact pixel dimensions
      const panelItems = gridRef.current.querySelectorAll('.panel-item');
      const originalPanelStyles = [];
      panelItems.forEach((panelEl, i) => {
        originalPanelStyles.push(panelEl.style.cssText);
        const panel = panels[i];
        if (panel) {
          const panelWidth = panel.w * CELL_WIDTH;
          const panelHeight = panel.h * CELL_HEIGHT;
          panelEl.style.width = `${panelWidth}px`;
          panelEl.style.height = `${panelHeight}px`;
          panelEl.style.maxWidth = `${panelWidth}px`;
          panelEl.style.maxHeight = `${panelHeight}px`;
          panelEl.style.overflow = 'hidden';
          console.log(`    Panel ${i}: forcing size to ${panelWidth}x${panelHeight}px`);
        }
      });

      // Wait for styles to apply
      await new Promise(resolve => setTimeout(resolve, 200));

      // Force ECharts instances to resize to their panel's exact dimensions
      // Use the imported echarts library directly
      const chartElements = gridRef.current.querySelectorAll('[_echarts_instance_]');
      console.log('4c. Found ECharts instances:', chartElements.length);
      console.log('4c. echarts library available:', !!echarts);

      chartElements.forEach((el, i) => {
        const instance = echarts.getInstanceByDom(el);
        console.log(`    ECharts instance ${i}: found=${!!instance}`);
        if (instance) {
          // Find the parent panel to get its dimensions
          const panelEl = el.closest('.panel-item');
          console.log(`    Panel element found: ${!!panelEl}`);
          if (panelEl) {
            const w = parseInt(panelEl.dataset.panelW, 10);
            const h = parseInt(panelEl.dataset.panelH, 10);
            const panelWidth = w * CELL_WIDTH;
            const panelHeight = h * CELL_HEIGHT - 32; // Subtract header height
            console.log(`    Resizing ECharts instance ${i} to ${panelWidth}x${panelHeight}px`);
            instance.resize({ width: panelWidth, height: panelHeight });
          } else {
            console.log(`    Resizing ECharts instance ${i} (no panel found)`);
            instance.resize();
          }
        }
      });

      // Also force-resize all canvas elements to fit their containers
      const canvasElements = gridRef.current.querySelectorAll('canvas');
      console.log('4d. Found canvas elements:', canvasElements.length);
      canvasElements.forEach((canvas, i) => {
        const panelEl = canvas.closest('.panel-item');
        if (panelEl) {
          const w = parseInt(panelEl.dataset.panelW, 10);
          const h = parseInt(panelEl.dataset.panelH, 10);
          if (w && h) {
            const panelWidth = w * CELL_WIDTH;
            const panelHeight = h * CELL_HEIGHT - 32;
            console.log(`    Canvas ${i}: setting max dimensions to ${panelWidth}x${panelHeight}px`);
            canvas.style.maxWidth = `${panelWidth}px`;
            canvas.style.maxHeight = `${panelHeight}px`;
          }
        }
      });

      // Wait for ECharts resize to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check scrollWidth after resize - if still larger than grid, that's our capture width
      const scrollWidthAfterResize = gridRef.current.scrollWidth;
      console.log('4e. scrollWidth after ECharts resize:', scrollWidthAfterResize);
      if (scrollWidthAfterResize > gridWidth) {
        console.log('4e. WARNING: Content still extends beyond grid. Overflow:', scrollWidthAfterResize - gridWidth, 'px');
      }

      // Get actual DOM dimensions AFTER style changes
      const containerRectAfter = thumbnailCaptureRef.current.getBoundingClientRect();
      const gridRectAfter = gridRef.current.getBoundingClientRect();
      console.log('8. Container rect AFTER style change:', containerRectAfter);
      console.log('9. Grid rect AFTER style change:', gridRectAfter);
      console.log('10. Grid element scrollWidth/scrollHeight AFTER:', {
        scrollWidth: gridRef.current.scrollWidth,
        scrollHeight: gridRef.current.scrollHeight,
        offsetWidth: gridRef.current.offsetWidth,
        offsetHeight: gridRef.current.offsetHeight,
        clientWidth: gridRef.current.clientWidth,
        clientHeight: gridRef.current.clientHeight
      });

      // Calculate the bounding box of actual content (panels only, not empty grid space)
      // Find the maximum extent of panels
      let maxPanelRight = 0;
      let maxPanelBottom = 0;
      console.log('11. Panel data:');
      panels.forEach((panel, i) => {
        const panelRight = (panel.x + panel.w) * CELL_WIDTH;
        const panelBottom = (panel.y + panel.h) * CELL_HEIGHT;
        maxPanelRight = Math.max(maxPanelRight, panelRight);
        maxPanelBottom = Math.max(maxPanelBottom, panelBottom);
        console.log(`    Panel ${i}: x=${panel.x}, y=${panel.y}, w=${panel.w}, h=${panel.h} => right=${panelRight}px, bottom=${panelBottom}px`);
      });

      // Capture dimensions: use grid size, unless panels extend beyond grid
      // Don't add margin - capture exactly what's needed
      const captureWidth = Math.max(gridWidth, maxPanelRight);
      const captureHeight = Math.max(gridHeight, maxPanelBottom);

      console.log('11b. Capture dimensions:', {
        gridWidth, gridHeight, maxPanelRight, maxPanelBottom, captureWidth, captureHeight
      });

      console.log('12. Content bounds:', { maxPanelRight, maxPanelBottom });
      console.log('13. Capture dimensions:', { captureWidth, captureHeight });

      const html2canvasOptions = {
        scale: 0.25, // Scale down for thumbnail size
        backgroundColor: '#161616',
        logging: true, // Enable html2canvas logging
        useCORS: true,
        allowTaint: true,
        scrollX: 0,
        scrollY: 0,
        windowScrollX: 0,
        windowScrollY: 0,
        windowWidth: captureWidth + 200,
        windowHeight: captureHeight + 200,
        width: captureWidth,
        height: captureHeight,
        // Modify cloned DOM before rendering to ensure proper clipping
        onclone: (clonedDoc) => {
          const clonedGrid = clonedDoc.querySelector('.panel-grid');
          if (clonedGrid) {
            clonedGrid.style.width = `${captureWidth}px`;
            clonedGrid.style.maxWidth = `${captureWidth}px`;
            clonedGrid.style.overflow = 'hidden';
            clonedGrid.style.clipPath = 'inset(0 0 0 0)';

            // Force all panels to their exact dimensions and clip
            const panels = clonedGrid.querySelectorAll('.panel-item');
            panels.forEach(panel => {
              const w = parseInt(panel.dataset.panelW, 10);
              const h = parseInt(panel.dataset.panelH, 10);
              if (w && h) {
                const panelWidth = w * CELL_WIDTH;
                const panelHeight = h * CELL_HEIGHT;
                panel.style.width = `${panelWidth}px`;
                panel.style.height = `${panelHeight}px`;
                panel.style.maxWidth = `${panelWidth}px`;
                panel.style.maxHeight = `${panelHeight}px`;
                panel.style.overflow = 'hidden';
                panel.style.clipPath = 'inset(0 0 0 0)';
              }
            });

            // Force all canvases to fit their panel dimensions via CSS only
            // DO NOT set canvas.width/height attributes - that clears the canvas content!
            const canvases = clonedGrid.querySelectorAll('canvas');
            canvases.forEach(canvas => {
              const panelEl = canvas.closest('.panel-item');
              if (panelEl) {
                const w = parseInt(panelEl.dataset.panelW, 10);
                const h = parseInt(panelEl.dataset.panelH, 10);
                if (w && h) {
                  const panelWidth = w * CELL_WIDTH;
                  const panelHeight = h * CELL_HEIGHT - 32;
                  // Only set CSS style dimensions, NOT canvas attributes
                  canvas.style.width = `${panelWidth}px`;
                  canvas.style.height = `${panelHeight}px`;
                  canvas.style.maxWidth = `${panelWidth}px`;
                  canvas.style.maxHeight = `${panelHeight}px`;
                  canvas.style.objectFit = 'contain';
                }
              }
            });
          }
          console.log('14b. onclone: Modified cloned DOM with explicit panel/canvas sizes');
        }
      };
      console.log('14. html2canvas options:', html2canvasOptions);

      // Capture the grid directly - crop to content area
      const canvas = await html2canvas(gridRef.current, html2canvasOptions);

      console.log('15. Resulting canvas dimensions:', { width: canvas.width, height: canvas.height });
      console.log('16. Expected canvas dimensions (with scale):', {
        width: captureWidth * 0.25,
        height: captureHeight * 0.25
      });

      // Restore container, grid, and panel styles
      thumbnailCaptureRef.current.style.cssText = originalContainerStyle;
      gridRef.current.style.cssText = originalGridStyle;

      // Restore panel styles
      const panelItemsToRestore = gridRef.current.querySelectorAll('.panel-item');
      panelItemsToRestore.forEach((panelEl, i) => {
        if (originalPanelStyles[i] !== undefined) {
          panelEl.style.cssText = originalPanelStyles[i];
        }
      });

      thumbnailCaptureRef.current.classList.remove('thumbnail-capture');

      // Restore previous mode
      setEditorMode(previousMode);

      const dataUrl = canvas.toDataURL('image/png', 0.8);
      console.log('17. Data URL length:', dataUrl.length);
      console.log('=== THUMBNAIL CAPTURE DEBUG END ===');
      return dataUrl;
    } catch (err) {
      console.error('Failed to capture thumbnail:', err);
      // Ensure we clean up even if there's an error
      if (thumbnailCaptureRef.current) {
        thumbnailCaptureRef.current.style.cssText = '';
        thumbnailCaptureRef.current.classList.remove('thumbnail-capture');
      }
      if (gridRef.current) {
        gridRef.current.style.cssText = '';
      }
      // Restore previous mode
      setEditorMode(previousMode);
      return null;
    }
  };

  // Save dashboard
  const handleSave = async () => {
    setSaving(true);
    try {
      // Capture thumbnail from the grid
      const thumbnail = await captureThumbnail();

      // Panels already contain chart_id references, no need to embed charts
      const payload = {
        name,
        description,
        panels, // Each panel has: id, x, y, w, h, chart_id (optional)
        thumbnail, // Base64 encoded thumbnail image
        settings: {
          theme,
          refresh_interval: refreshInterval,
          title_scale: titleScale,
          is_public: isPublic,
          allow_export: allowExport,
          layout_dimension: currentDimension // Save the dimension preset with the dashboard
        }
      };

      let data;
      if (isCreateMode) {
        data = await apiClient.createDashboard(payload);
      } else {
        data = await apiClient.updateDashboard(id, payload);
      }

      setHasChanges(false);
      setShowSaveModal(false);
      navigate(getReturnPath());
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      setShowCancelModal(true);
    } else {
      navigate(getReturnPath());
    }
  };

  const confirmCancel = () => {
    setShowCancelModal(false);
    navigate(getReturnPath());
  };

  if (loading) {
    return (
      <div className="dashboard-detail-page">
        <Loading description="Loading dashboard..." withOverlay={false} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-detail-page">
        <div className="error-message">Error: {error}</div>
        <Button onClick={() => navigate('/design/dashboards')}>Back to Dashboards</Button>
      </div>
    );
  }

  return (
    <div className="dashboard-detail-page">
      {/* Page header with title and actions */}
      <div className="page-header-bar">
        <div className="header-left">
          <Button
            kind="ghost"
            renderIcon={ArrowLeft}
            onClick={() => navigate(getReturnPath())}
            size="md"
          >
            Back
          </Button>
          <h1>Edit Dashboard</h1>
        </div>
        <div className="page-actions">
          <Button
            kind="secondary"
            renderIcon={Close}
            onClick={handleCancel}
            size="md"
          >
            Cancel
          </Button>
          <Button
            kind="primary"
            renderIcon={Save}
            onClick={() => setShowSaveModal(true)}
            disabled={!name || !hasChanges}
            size="md"
          >
            Save Dashboard
          </Button>
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="page-content">
        {/* Form content */}
        <div className="form-content">
        {/* Dashboard Name - full width */}
        <div className="form-row compact">
          <TextInput
            id="dashboard-name"
            labelText="Dashboard Name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setHasChanges(true);
              if (nameError) setNameError('');
            }}
            onBlur={(e) => checkDuplicateDashboardName(e.target.value)}
            placeholder="Enter dashboard name"
            invalid={!!nameError}
            invalidText={nameError}
          />
        </div>

        {/* Description - full width */}
        <div className="form-row compact">
          <TextInput
            id="dashboard-description"
            labelText="Description (optional)"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setHasChanges(true);
            }}
            placeholder="Enter dashboard description"
          />
        </div>

        {/* Two column row: Theme and Refresh */}
        <div className="form-row two-column">
          <div className="form-column">
            <Select
              id="dashboard-theme"
              labelText="Theme"
              value={theme}
              onChange={(e) => {
                setTheme(e.target.value);
                setHasChanges(true);
              }}
            >
              <SelectItem value="light" text="Light" />
              <SelectItem value="dark" text="Dark" />
              <SelectItem value="auto" text="Auto" />
            </Select>
          </div>
          <div className="form-column">
            <NumberInput
              id="dashboard-refresh"
              label="Auto Refresh (seconds)"
              value={refreshInterval}
              onChange={(e, { value }) => {
                setRefreshInterval(value);
                setHasChanges(true);
              }}
              min={0}
              max={3600}
              step={5}
              helperText="Set to 0 to disable auto refresh"
            />
          </div>
          <div className="form-column">
            <Slider
              id="title-scale"
              labelText="Title Scale (%)"
              value={titleScale}
              onChange={({ value }) => {
                setTitleScale(value);
                setHasChanges(true);
              }}
              min={50}
              max={200}
              step={10}
            />
          </div>
        </div>
      </div>

      {/* Editor mode toolbar */}
      <div className="editor-toolbar">
        <div className="editor-mode-selector">
          <Button
            kind={editorMode === EDITOR_MODES.DESIGN ? 'primary' : 'ghost'}
            size="sm"
            renderIcon={Edit}
            onClick={() => setEditorMode(EDITOR_MODES.DESIGN)}
          >
            Design
          </Button>
          <Button
            kind={editorMode === EDITOR_MODES.PREVIEW ? 'primary' : 'ghost'}
            size="sm"
            renderIcon={View}
            onClick={() => setEditorMode(EDITOR_MODES.PREVIEW)}
          >
            Preview
          </Button>
        </div>
        {editorMode === EDITOR_MODES.DESIGN && dimensions.length > 0 && (
          <div className="dimension-selector">
            <Select
              id="dimension-select"
              labelText=""
              hideLabel
              size="sm"
              value={currentDimension}
              onChange={(e) => handleDimensionChange(e.target.value)}
              disabled={dimensionLoading}
            >
              {dimensions.map((dim) => (
                <SelectItem
                  key={dim.name}
                  value={dim.name}
                  text={`${dim.name} (${dim.max_width}×${dim.max_height})`}
                />
              ))}
            </Select>
            <Tooltip
              align="bottom"
              label="Choose HD for simpler layouts that expand to fit, or 4K for precise positioning that reduces gracefully."
            >
              <button type="button" className="info-button">
                <Information size={16} />
              </button>
            </Tooltip>
          </div>
        )}
        <div className="editor-mode-help">
          {editorMode === EDITOR_MODES.DESIGN && (
            <span>Drag header to move • Drag corner to resize • Click center to edit chart • Draw on empty space to add panel</span>
          )}
          {editorMode === EDITOR_MODES.PREVIEW && (
            <span>Live preview of your dashboard</span>
          )}
        </div>
      </div>

      {/* Panel grid */}
      <div className="components-section">
        {/* Grid info with zoom controls */}
        <div className="grid-info">
          <div className="grid-info-stats">
            <span>Layout: {GRID_COLS * CELL_WIDTH}×{GRID_ROWS * CELL_HEIGHT}px</span>
            <span>Grid: {GRID_COLS} columns × {GRID_ROWS} rows</span>
            <span>Cell: {CELL_WIDTH}×{CELL_HEIGHT}px</span>
            <span>Panels: {panels.length}</span>
          </div>
          <div className="zoom-controls">
            <IconButton
              kind="ghost"
              size="sm"
              label="Zoom out"
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
              onClick={zoomIn}
              disabled={zoom >= 100}
            >
              <ZoomIn size={16} />
            </IconButton>
          </div>
        </div>

        {/* Visual grid layout */}
        <div className="panel-grid-container" ref={thumbnailCaptureRef}>
          <div
            ref={gridRef}
            className={`panel-grid mode-${editorMode}`}
            style={{
              width: `${GRID_COLS * CELL_WIDTH}px`,
              minHeight: `${(GRID_ROWS + OVERFLOW_ROWS) * CELL_HEIGHT}px`,
              gridTemplateColumns: `repeat(${GRID_COLS}, ${CELL_WIDTH}px)`,
              gridTemplateRows: `repeat(${GRID_ROWS + OVERFLOW_ROWS}, ${CELL_HEIGHT}px)`,
              '--cell-width': `${CELL_WIDTH}px`,
              '--grid-visible-width': `${GRID_COLS * CELL_WIDTH}px`,
              '--grid-visible-height': `${GRID_ROWS * CELL_HEIGHT}px`,
              '--title-scale': titleScale / 100,
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top left'
            }}
            onMouseDown={handleGridMouseDown}
            onMouseMove={handleGridMouseMove}
            onMouseUp={handleGridMouseUp}
            onMouseLeave={handleGridMouseUp}
          >
            {/* Existing panels */}
            {panels.map((panel) => {
              const chart = panel.chart_id ? chartsMap[panel.chart_id] : null;
              const hasChart = !!chart;
              const isDesignMode = editorMode === EDITOR_MODES.DESIGN;
              const isPreviewMode = editorMode === EDITOR_MODES.PREVIEW;

              return (
                <div
                  key={panel.id}
                  data-panel-id={panel.id}
                  data-panel-w={panel.w}
                  data-panel-h={panel.h}
                  className={`panel-item ${isPreviewMode && hasChart ? 'live-preview' : ''} ${isDesignMode ? 'design-mode' : ''}`}
                  style={{
                    gridColumn: `${panel.x + 1} / span ${panel.w}`,
                    gridRow: `${panel.y + 1} / span ${panel.h}`
                  }}
                >
                  {/* Panel header - draggable in design mode */}
                  <div
                    className="panel-header"
                    onMouseDown={(e) => {
                      if (isDesignMode) {
                        startDragging(e, panel);
                      }
                    }}
                    style={{ cursor: isDesignMode ? 'move' : 'default' }}
                  >
                    <span className="panel-id">{chart?.title || chart?.name || panel.id}</span>
                    <div className="panel-header-right">
                      <span className="panel-size">{panel.w}×{panel.h}</span>
                      {isDesignMode && (
                        <IconButton
                          kind="ghost"
                          size="sm"
                          label="Delete panel"
                          onClick={(e) => {
                            e.stopPropagation();
                            deletePanel(panel.id);
                          }}
                        >
                          <TrashCan size={16} />
                        </IconButton>
                      )}
                    </div>
                  </div>

                  {/* Panel body */}
                  <div className="panel-body">
                    {isPreviewMode && hasChart ? (
                      <div className="component-preview">
                        <DynamicComponentLoader
                          code={chart.component_code}
                          props={{}}
                          dataMapping={chart.data_mapping}
                          datasourceId={chart.datasource_id}
                          queryConfig={chart.query_config}
                        />
                      </div>
                    ) : isDesignMode ? (
                      <div className="design-body">
                        {hasChart ? (
                          <div className="chart-info">
                            <div className="chart-title">
                              <ChartBar size={20} />
                              <span className="chart-name">{chart.title || chart.name}</span>
                            </div>
                            <PanelEditMenu
                              buttonLabel="Edit"
                              hasExisting={true}
                              onEdit={() => openChartEditor(panel.id)}
                              onEditWithAI={() => openAIEditor(panel.id)}
                              onNew={() => {
                                updatePanel(panel.id, { chart_id: null });
                                openChartEditor(panel.id, null);
                              }}
                              onNewWithAI={() => openAIPreflightModal(panel.id)}
                              onSelectExisting={() => openComponentPicker(panel.id, 'chart')}
                            />
                          </div>
                        ) : (
                          <div className="empty-panel-actions">
                            <PanelEditMenu
                              buttonLabel="Add"
                              hasExisting={false}
                              onNew={() => openChartEditor(panel.id, null)}
                              onNewWithAI={() => openAIPreflightModal(panel.id)}
                              onSelectExisting={() => openComponentPicker(panel.id, 'chart')}
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="empty-panel">
                        <span>No chart</span>
                      </div>
                    )}
                  </div>

                  {/* Resize handle (Design mode only) */}
                  {isDesignMode && (
                    <div
                      className="resize-handle"
                      onMouseDown={(e) => startResizing(e, panel)}
                    />
                  )}
                </div>
              );
            })}

            {/* Drawing preview for new panel */}
            {drawingPanel && (
              <div
                className="panel-item drawing"
                style={{
                  gridColumn: `${drawingPanel.x + 1} / span ${drawingPanel.w}`,
                  gridRow: `${drawingPanel.y + 1} / span ${drawingPanel.h}`
                }}
              >
                <div className="panel-header">
                  <span className="panel-id">New Panel</span>
                  <span className="panel-size">{drawingPanel.w}×{drawingPanel.h}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Additional Settings */}
      <div className="additional-settings">
        <Checkbox
          id="dashboard-public"
          labelText="Make dashboard public"
          checked={isPublic}
          onChange={(e) => {
            setIsPublic(e.target.checked);
            setHasChanges(true);
          }}
        />
        <Checkbox
          id="dashboard-export"
          labelText="Allow export"
          checked={allowExport}
          onChange={(e) => {
            setAllowExport(e.target.checked);
            setHasChanges(true);
          }}
        />
      </div>
      </div>

      {/* Chart Editor Modal */}
      <ChartEditorModal
        open={chartEditorOpen}
        onClose={closeChartEditor}
        onSave={handleChartSave}
        chart={editingChart}
        panelId={editingPanelId}
      />

      {/* Chart Selector Modal */}
      {chartSelectorOpen && (
        <Modal
          open={true}
          onRequestClose={closeChartSelector}
          modalHeading="Select a Chart"
          modalLabel="Chart Library"
          primaryButtonText="Cancel"
          onRequestSubmit={closeChartSelector}
          size="lg"
          passiveModal
        >
          <div className="chart-selector-grid">
            {availableCharts.length > 0 ? (
              availableCharts.map((chartSummary) => (
                <div
                  key={chartSummary.id}
                  className="chart-card"
                  onClick={() => handleChartSelect(chartSummary.id)}
                >
                  <div className="chart-card-preview">
                    {chartSummary.thumbnail ? (
                      <img src={chartSummary.thumbnail} alt={chartSummary.name} />
                    ) : (
                      <ChartBar size={32} />
                    )}
                  </div>
                  <div className="chart-card-info">
                    <h4>{chartSummary.name}</h4>
                    <p className="chart-type">{chartSummary.chart_type}</p>
                    {chartSummary.description && (
                      <p className="chart-desc">{chartSummary.description}</p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="no-charts-message">
                <p>No charts available. Create a new chart first.</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Component Picker Modal (for selecting displays or controls) */}
      <ComponentPickerModal
        open={componentPickerOpen}
        onClose={closeComponentPicker}
        onSelect={handleComponentSelect}
        category={componentPickerCategory}
      />

      {/* AI Pre-flight Modal (for gathering context before AI session) */}
      <AIPreflightModal
        open={aiPreflightOpen}
        onClose={() => {
          setAiPreflightOpen(false);
          setAiPreflightPanelId(null);
        }}
        onContinue={handleAIPreflightContinue}
      />

      {/* Cancel confirmation modal */}
      {showCancelModal && (
        <Modal
          open={true}
          onRequestClose={() => setShowCancelModal(false)}
          onRequestSubmit={confirmCancel}
          modalHeading="Discard Changes?"
          primaryButtonText="Discard"
          secondaryButtonText="Keep Editing"
          danger
        >
          <p>You have unsaved changes. Are you sure you want to discard them?</p>
        </Modal>
      )}

      {/* Save confirmation modal */}
      {showSaveModal && (
        <Modal
          open={true}
          onRequestClose={() => setShowSaveModal(false)}
          onRequestSubmit={handleSave}
          modalHeading={isCreateMode ? "Create Dashboard" : "Save Changes"}
          primaryButtonText={saving ? "Saving..." : "Save"}
          secondaryButtonText="Cancel"
          primaryButtonDisabled={saving}
        >
          <p>
            {isCreateMode
              ? `Create dashboard "${name}" with ${panels.length} panels and ${panels.filter(p => p.chart_id).length} charts?`
              : `Save changes to dashboard "${name}"?`}
          </p>
        </Modal>
      )}
    </div>
  );
}

export default DashboardDetailPage;
