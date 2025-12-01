import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Loading,
  Modal,
  TextInput,
  Select,
  SelectItem,
  Checkbox,
  NumberInput,
  IconButton
} from '@carbon/react';
import {
  Save,
  Close,
  Add,
  TrashCan,
  Edit,
  View,
  ChartBar,
  Catalog
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
  const isCreateMode = id === 'new';

  // Dashboard state
  const [dashboard, setDashboard] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [panels, setPanels] = useState([]); // Panel positions/sizes with chart_id references
  const [chartsMap, setChartsMap] = useState({}); // Chart data keyed by chart_id (for rendering)
  const [theme, setTheme] = useState('dark');
  const [refreshInterval, setRefreshInterval] = useState(0);
  const [isPublic, setIsPublic] = useState(false);
  const [allowExport, setAllowExport] = useState(true);

  // Layout templates for starting point
  const [layouts, setLayouts] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateApplied, setTemplateApplied] = useState(false); // True once panels exist

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

  // Grid configuration
  const GRID_COLS = 12;
  const GRID_ROW_HEIGHT = 32;
  const GRID_ROWS = 50;

  useEffect(() => {
    fetchLayouts();
    if (!isCreateMode) {
      fetchDashboard();
    }
  }, [id]);

  // When template is selected (in create mode), copy panels from template
  useEffect(() => {
    if (selectedTemplateId && !templateApplied) {
      applyLayoutTemplate(selectedTemplateId);
    }
  }, [selectedTemplateId]);

  const fetchLayouts = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/layouts?page=1&page_size=100');
      const data = await response.json();
      if (data.layouts) {
        setLayouts(data.layouts);
      }
    } catch (err) {
      console.error('Failed to fetch layouts:', err);
    }
  };

  // Apply a layout template - copies panels into dashboard
  const applyLayoutTemplate = async (templateId) => {
    try {
      const response = await fetch(`http://localhost:3001/api/layouts/${templateId}`);
      const data = await response.json();

      if (data.panels) {
        // Copy panels from template (using w for width, h for height)
        setPanels(data.panels.map(panel => ({
          id: panel.id,
          x: panel.x,
          y: panel.y,
          w: panel.w,
          h: panel.h
        })));
        setTemplateApplied(true);
        setHasChanges(true);
      }
    } catch (err) {
      console.error('Failed to apply layout template:', err);
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
        setTemplateApplied(true);

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

  const handleTemplateChange = (e) => {
    const templateId = e.target.value;
    if (templateId) {
      setSelectedTemplateId(templateId);
      // Don't need to clear chartsMap since it's keyed by chart_id, not panel_id
    }
  };

  // Mark that panels have been modified
  const markPanelsModified = () => {
    setTemplateApplied(true);
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

  // Save dashboard
  const handleSave = async () => {
    setSaving(true);
    try {
      // Panels already contain chart_id references, no need to embed charts
      const payload = {
        name,
        description,
        panels, // Each panel has: id, x, y, w, h, chart_id (optional)
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
      navigate('/design/dashboards');
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
      navigate('/design/dashboards');
    }
  };

  const confirmCancel = () => {
    setShowCancelModal(false);
    navigate('/design/dashboards');
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
      {/* Action buttons in top right */}
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

      {/* Header with name */}
      <div className="page-header">
        <TextInput
          id="dashboard-name"
          labelText="Dashboard Name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setHasChanges(true);
          }}
          placeholder="Enter dashboard name"
          size="lg"
        />
      </div>

      {/* Description row */}
      <div className="description-row">
        <TextInput
          id="dashboard-description"
          labelText="Description (optional)"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setHasChanges(true);
          }}
          placeholder="Enter dashboard description"
          size="md"
        />
      </div>

      {/* Settings row - Theme, Refresh, and Layout */}
      <div className="settings-row">
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

        <NumberInput
          id="dashboard-refresh"
          label="Refresh (sec)"
          value={refreshInterval}
          onChange={(e, { value }) => {
            setRefreshInterval(value);
            setHasChanges(true);
          }}
          min={0}
          max={3600}
          step={5}
        />

        <Select
          id="dashboard-template"
          labelText="Layout Template"
          value={selectedTemplateId}
          onChange={handleTemplateChange}
          disabled={templateApplied}
          className={templateApplied ? 'layout-disabled' : ''}
        >
          <SelectItem value="" text={templateApplied ? "Template applied" : "Select a template (optional)"} />
          {layouts.map((layout) => (
            <SelectItem
              key={layout.id}
              value={layout.id}
              text={`${layout.name} (${layout.panels?.length || 0} panels)`}
            />
          ))}
        </Select>
        {templateApplied && panels.length > 0 && (
          <span className="custom-layout-badge">{panels.length} panels</span>
        )}
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
        <div className="panel-grid-container">
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
                          <div className="chart-info" onClick={() => openChartEditor(panel.id)}>
                            <ChartBar size={24} />
                            <span className="chart-name">{chart.name}</span>
                            <span className="edit-hint">Click to edit</span>
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
