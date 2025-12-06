import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import html2canvas from 'html2canvas';
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
  OverflowMenu,
  OverflowMenuItem
} from '@carbon/react';
import {
  Save,
  Close,
  Add,
  TrashCan,
  Edit,
  View,
  ChartBar,
  Catalog,
  WatsonxAi
} from '@carbon/icons-react';
import DynamicComponentLoader from '../components/DynamicComponentLoader';
import ChartEditorModal from '../components/ChartEditorModal';
import apiClient from '../api/client';
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

  // Chart selector modal state
  const [chartSelectorOpen, setChartSelectorOpen] = useState(false);
  const [selectingPanelId, setSelectingPanelId] = useState(null);
  const [availableCharts, setAvailableCharts] = useState([]);

  // Layout editing state
  const [draggingPanel, setDraggingPanel] = useState(null);
  const [resizingPanel, setResizingPanel] = useState(null);
  const [drawingPanel, setDrawingPanel] = useState(null);
  const gridRef = useRef(null);
  const thumbnailCaptureRef = useRef(null);

  // Grid configuration
  const GRID_COLS = 12;
  const GRID_ROW_HEIGHT = 32;
  const GRID_ROWS = 50;

  useEffect(() => {
    if (!isCreateMode) {
      fetchDashboard();
    }
  }, [id]);

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
      console.log('Dashboard response:', data);

      setDashboard(data);
      setName(data.name);
      setDescription(data.description || '');
      setTheme(data.settings?.theme || 'dark');
      setRefreshInterval(data.settings?.refresh_interval || 0);
      setIsPublic(data.settings?.is_public || false);
      setAllowExport(data.settings?.allow_export !== false);

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

  // Chart operations
  const handleChartSave = async (chartData) => {
    const { panel_id, ...chartInfo } = chartData;

    // Add chart to chartsMap (keyed by chart_id)
    setChartsMap(prev => ({
      ...prev,
      [chartInfo.id]: chartInfo
    }));

    // Update panel to reference this chart_id
    setPanels(prev => prev.map(p =>
      p.id === panel_id ? { ...p, chart_id: chartInfo.id } : p
    ));

    setHasChanges(true);
  };

  // Open chart editor for creating/editing a chart
  const openChartEditor = (panelId) => {
    const panel = panels.find(p => p.id === panelId);
    const chart = panel?.chart_id ? chartsMap[panel.chart_id] : null;
    setEditingPanelId(panelId);
    setEditingChart(chart);
    setChartEditorOpen(true);
  };

  // Open AI editor for creating/editing a chart with AI
  const openAIEditor = (panelId) => {
    const panel = panels.find(p => p.id === panelId);
    const chartId = panel?.chart_id;
    if (chartId) {
      navigate(`/design/charts/ai/${chartId}`);
    } else {
      // Navigate to create new chart with AI
      navigate('/design/charts/ai/new');
    }
  };

  const closeChartEditor = () => {
    setChartEditorOpen(false);
    setEditingPanelId(null);
    setEditingChart(null);
  };

  // Chart selector operations
  const openChartSelector = async (panelId) => {
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
    if (!chartsMap[chartId]) {
      try {
        const chart = await apiClient.getChart(chartId);
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

    setHasChanges(true);
    closeChartSelector();
  };

  // Grid mouse handlers for Layout Mode
  const getGridPosition = (e) => {
    if (!gridRef.current) return null;
    const rect = gridRef.current.getBoundingClientRect();
    const cellWidth = rect.width / GRID_COLS;
    const x = Math.floor((e.clientX - rect.left) / cellWidth);
    const y = Math.floor((e.clientY - rect.top) / GRID_ROW_HEIGHT);
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
          const newW = Math.max(1, Math.min(pos.x - panel.x + 1, GRID_COLS - panel.x));
          const newH = Math.max(1, pos.y - panel.y + 1);
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

  // Capture thumbnail of the dashboard grid (in preview style, not design mode)
  const captureThumbnail = async () => {
    if (!thumbnailCaptureRef.current) return null;

    try {
      // Add thumbnail-capture class to hide design mode elements
      thumbnailCaptureRef.current.classList.add('thumbnail-capture');

      // Wait for CSS to apply
      await new Promise(resolve => setTimeout(resolve, 50));

      const canvas = await html2canvas(thumbnailCaptureRef.current, {
        scale: 0.5,
        backgroundColor: '#161616',
        logging: false,
        useCORS: true,
        allowTaint: true
      });

      // Remove the class
      thumbnailCaptureRef.current.classList.remove('thumbnail-capture');

      const dataUrl = canvas.toDataURL('image/png', 0.8);
      return dataUrl;
    } catch (err) {
      console.error('Failed to capture thumbnail:', err);
      // Ensure we remove the class even if there's an error
      if (thumbnailCaptureRef.current) {
        thumbnailCaptureRef.current.classList.remove('thumbnail-capture');
      }
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
          is_public: isPublic,
          allow_export: allowExport
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
        <h1>Edit Dashboard</h1>
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
            disabled={!name}
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
        <div className="form-row">
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
        <div className="form-row">
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
        {/* Grid info */}
        <div className="grid-info">
          <span>Grid: {GRID_COLS} columns × {GRID_ROWS} rows</span>
          <span>Cell height: {GRID_ROW_HEIGHT}px</span>
          <span>Panels: {panels.length}</span>
        </div>

        {/* Visual grid layout */}
        <div className="panel-grid-container" ref={thumbnailCaptureRef}>
          <div
            ref={gridRef}
            className={`panel-grid mode-${editorMode}`}
            style={{
              gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
              gridTemplateRows: `repeat(${GRID_ROWS}, ${GRID_ROW_HEIGHT}px)`
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
                    <span className="panel-id">{chart?.name || panel.id}</span>
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
                        />
                      </div>
                    ) : isDesignMode ? (
                      <div className="design-body">
                        {hasChart ? (
                          <div className="chart-info">
                            <ChartBar size={24} />
                            <span className="chart-name">{chart.name}</span>
                            <OverflowMenu
                              size="sm"
                              flipped
                              iconDescription="Edit chart"
                              className="chart-edit-menu"
                            >
                              <OverflowMenuItem
                                itemText="Edit"
                                onClick={() => openChartEditor(panel.id)}
                              />
                              <OverflowMenuItem
                                itemText="Edit with AI"
                                onClick={() => openAIEditor(panel.id)}
                              />
                            </OverflowMenu>
                          </div>
                        ) : (
                          <div className="empty-panel-actions">
                            <Button
                              kind="tertiary"
                              size="sm"
                              renderIcon={Add}
                              onClick={() => openChartEditor(panel.id)}
                            >
                              New Chart
                            </Button>
                            <Button
                              kind="ghost"
                              size="sm"
                              renderIcon={Catalog}
                              onClick={() => openChartSelector(panel.id)}
                            >
                              Select Existing
                            </Button>
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
