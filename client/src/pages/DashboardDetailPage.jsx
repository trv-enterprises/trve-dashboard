import { useState, useEffect } from 'react';
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
  OverflowMenu,
  OverflowMenuItem
} from '@carbon/react';
import { Save, Close, Add, TrashCan, Settings } from '@carbon/icons-react';
import './DashboardDetailPage.scss';

/**
 * DashboardDetailPage Component
 *
 * Create/Edit dashboard by selecting a layout and assigning components to panels.
 */
function DashboardDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isCreateMode = id === 'new';

  const [dashboard, setDashboard] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [layoutId, setLayoutId] = useState('');
  const [components, setComponents] = useState([]);
  const [theme, setTheme] = useState('dark');
  const [refreshInterval, setRefreshInterval] = useState(0);
  const [isPublic, setIsPublic] = useState(false);
  const [allowExport, setAllowExport] = useState(true);

  const [layouts, setLayouts] = useState([]);
  const [availableComponents, setAvailableComponents] = useState([]);
  const [selectedLayout, setSelectedLayout] = useState(null);

  const [loading, setLoading] = useState(!isCreateMode);
  const [error, setError] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showComponentSelector, setShowComponentSelector] = useState(null); // Track which panel's selector is open

  useEffect(() => {
    fetchLayouts();
    fetchComponents();
    if (!isCreateMode) {
      fetchDashboard();
    }
  }, [id]);

  useEffect(() => {
    if (layoutId) {
      fetchLayoutDetails(layoutId);
    }
  }, [layoutId]);

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

  const fetchComponents = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/components?page=1&page_size=100');
      const data = await response.json();
      if (data.components) {
        setAvailableComponents(data.components);
      }
    } catch (err) {
      console.error('Failed to fetch components:', err);
    }
  };

  const fetchLayoutDetails = async (id) => {
    try {
      const response = await fetch(`http://localhost:3001/api/layouts/${id}`);
      const data = await response.json();
      setSelectedLayout(data);

      // Initialize components array with empty placeholders for each panel
      if (isCreateMode && data.panels) {
        setComponents(data.panels.map(panel => ({
          id: `placement-${Date.now()}-${panel.id}`,
          component_id: '',
          panel_id: panel.id,
          config: {},
          props: {}
        })));
      }
    } catch (err) {
      console.error('Failed to fetch layout details:', err);
    }
  };

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:3001/api/dashboards/${id}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Dashboard response:', data);

      setDashboard(data);
      setName(data.name);
      setDescription(data.description || '');
      setLayoutId(data.layout_id);
      setComponents(data.components || []);
      setTheme(data.settings?.theme || 'dark');
      setRefreshInterval(data.settings?.refresh_interval || 0);
      setIsPublic(data.settings?.is_public || false);
      setAllowExport(data.settings?.allow_export || true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLayoutChange = (e) => {
    const newLayoutId = e.target.value;
    setLayoutId(newLayoutId);
    setHasChanges(true);
  };

  const handleComponentChange = (panelId, componentId) => {
    setComponents(prevComponents => {
      return prevComponents.map(comp => {
        if (comp.panel_id === panelId) {
          return {
            ...comp,
            component_id: componentId
          };
        }
        return comp;
      });
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Filter out components with no component_id selected
      const validComponents = components.filter(c => c.component_id);

      const payload = {
        name,
        description,
        layout_id: layoutId,
        components: validComponents,
        settings: {
          theme,
          refresh_interval: refreshInterval,
          is_public: isPublic,
          allow_export: allowExport
        }
      };

      let response;
      if (isCreateMode) {
        response = await fetch('http://localhost:3001/api/dashboards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        response = await fetch(`http://localhost:3001/api/dashboards/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      const data = await response.json();

      if (response.ok) {
        setHasChanges(false);
        setShowSaveModal(false);
        navigate('/design/dashboards');
      } else {
        alert(`Failed to save: ${data.error || 'Unknown error'}`);
      }
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
          disabled={!name || !layoutId}
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

      {/* Settings row - Theme and Refresh */}
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
      </div>

      {/* Layout selector row */}
      <div className="layout-row">
        <Select
          id="dashboard-layout"
          labelText="Layout"
          value={layoutId}
          onChange={handleLayoutChange}
        >
          <SelectItem value="" text="Select a layout" />
          {layouts.map((layout) => (
            <SelectItem
              key={layout.id}
              value={layout.id}
              text={`${layout.name} (${layout.panels?.length || 0} panels)`}
            />
          ))}
        </Select>
      </div>

      {/* Component assignments - Visual Grid Layout */}
      {selectedLayout && (
        <div className="components-section">
          <h3>Assign Components to Panels</h3>
          <p className="section-help">
            Click the settings icon in each panel to assign a component.
          </p>

          {/* Grid info */}
          <div className="grid-info">
            <span>Grid: 12 columns × {selectedLayout.rows || 50} rows</span>
            <span>Cell size: 32px</span>
          </div>

          {/* Visual grid layout */}
          <div className="panel-grid-container">
            <div
              className="panel-grid"
              style={{
                gridTemplateColumns: 'repeat(12, 1fr)',
                gridTemplateRows: `repeat(${selectedLayout.rows || 50}, 32px)`
              }}
            >
              {selectedLayout.panels?.map((panel) => {
                const assignment = components.find(c => c.panel_id === panel.id);
                const assignedComponent = assignment?.component_id
                  ? availableComponents.find(c => c.id === assignment.component_id)
                  : null;

                return (
                  <div
                    key={panel.id}
                    className="panel-item"
                    style={{
                      gridColumn: `${panel.x + 1} / span ${panel.w}`,
                      gridRow: `${panel.y + 1} / span ${panel.h}`
                    }}
                  >
                    <div className="panel-header">
                      <span className="panel-id">{panel.id}</span>
                      <span className="panel-size">{panel.w} × {panel.h}</span>
                    </div>

                    <div className="panel-body">
                      {assignedComponent && (
                        <div className="assigned-component">
                          <span className="component-name">{assignedComponent.name}</span>
                          <span className="component-source">
                            {assignedComponent.system}/{assignedComponent.source}
                          </span>
                        </div>
                      )}

                      <div className="panel-selector">
                        <OverflowMenu
                          renderIcon={Settings}
                          iconDescription="Assign component"
                          flipped
                          size="lg"
                        >
                          <OverflowMenuItem
                            itemText="No component"
                            onClick={() => handleComponentChange(panel.id, '')}
                          />
                          {availableComponents.map((comp) => (
                            <OverflowMenuItem
                              key={comp.id}
                              itemText={`${comp.name} (${comp.system}/${comp.source})`}
                              onClick={() => handleComponentChange(panel.id, comp.id)}
                            />
                          ))}
                        </OverflowMenu>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

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
              ? `Create dashboard "${name}" with ${components.filter(c => c.component_id).length} components?`
              : `Save changes to dashboard "${name}"?`}
          </p>
        </Modal>
      )}
    </div>
  );
}

export default DashboardDetailPage;
