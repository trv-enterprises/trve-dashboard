import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Responsive, WidthProvider } from 'react-grid-layout';
import {
  Button,
  Loading,
  Modal,
  TextInput,
  TextArea
} from '@carbon/react';
import { Save, Close, Add, TrashCan } from '@carbon/icons-react';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import './LayoutDetailPage.scss';

const ResponsiveGridLayout = WidthProvider(Responsive);

/**
 * LayoutDetailPage Component
 *
 * Visual layout editor with drag-and-drop panel management.
 * - 12-column grid system based on Carbon $spacing-08 (32px)
 * - Drag panels to reposition
 * - Resize panels by dragging corner
 * - Add/delete panels
 * - Save/Cancel with confirmation
 */
function LayoutDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isCreateMode = id === 'new';

  const [layout, setLayout] = useState(null);
  const [panels, setPanels] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(!isCreateMode);
  const [error, setError] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Grid configuration (matches backend)
  const gridConfig = {
    columns: 12,
    rowHeight: 32, // $spacing-08
    maxRows: 50
  };

  useEffect(() => {
    if (!isCreateMode) {
      fetchLayout();
    } else {
      // Initialize empty layout for create mode
      setName('');
      setDescription('');
      setPanels([]);
    }
  }, [id]);

  const fetchLayout = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:3001/api/layouts/${id}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Layout response:', data);

      setLayout(data);
      setName(data.name);
      setDescription(data.description || '');

      // Convert panels to react-grid-layout format
      const gridPanels = data.panels.map(panel => ({
        i: panel.id,
        x: panel.x,
        y: panel.y,
        w: panel.w,
        h: panel.h,
        minW: 2,
        minH: 2
      }));
      setPanels(gridPanels);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLayoutChange = (newLayout) => {
    // Update panels state when grid layout changes (drag/resize)
    setPanels(newLayout);
    setHasChanges(true);
  };

  const handleAddPanel = () => {
    // Find first available position in top-left area
    const newPanelId = `panel-${Date.now()}`;
    const defaultWidth = 3;
    const defaultHeight = 3;

    // Simple placement: find first spot in grid that fits
    let x = 0;
    let y = 0;

    // Check if position is occupied
    const isOccupied = (testX, testY) => {
      return panels.some(panel =>
        testX < panel.x + panel.w &&
        testX + defaultWidth > panel.x &&
        testY < panel.y + panel.h &&
        testY + defaultHeight > panel.y
      );
    };

    // Find first available spot
    for (let testY = 0; testY < gridConfig.maxRows; testY++) {
      for (let testX = 0; testX <= gridConfig.columns - defaultWidth; testX++) {
        if (!isOccupied(testX, testY)) {
          x = testX;
          y = testY;
          testY = gridConfig.maxRows; // Break outer loop
          break;
        }
      }
    }

    const newPanel = {
      i: newPanelId,
      x,
      y,
      w: defaultWidth,
      h: defaultHeight,
      minW: 2,
      minH: 2
    };

    setPanels([...panels, newPanel]);
    setHasChanges(true);
  };

  const handleDeletePanel = (panelId) => {
    setPanels(panels.filter(p => p.i !== panelId));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Convert panels back to backend format
      const backendPanels = panels.map(panel => ({
        id: panel.i,
        x: panel.x,
        y: panel.y,
        w: panel.w,
        h: panel.h,
        content: { type: '' }
      }));

      const payload = {
        name,
        description,
        grid: {
          columns: gridConfig.columns,
          row_height: gridConfig.rowHeight,
          max_rows: gridConfig.maxRows,
          grid_unit: gridConfig.rowHeight,
          compact_type: 'vertical'
        },
        panels: backendPanels
      };

      let response;
      if (isCreateMode) {
        response = await fetch('http://localhost:3001/api/layouts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        response = await fetch(`http://localhost:3001/api/layouts/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      const data = await response.json();

      if (response.ok) {
        setHasChanges(false);
        setShowSaveModal(false);
        navigate('/design/layouts');
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
      navigate('/design/layouts');
    }
  };

  const confirmCancel = () => {
    setShowCancelModal(false);
    navigate('/design/layouts');
  };

  if (loading) {
    return (
      <div className="layout-detail-page">
        <Loading description="Loading layout..." withOverlay={false} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="layout-detail-page">
        <div className="error-message">Error: {error}</div>
        <Button onClick={() => navigate('/design/layouts')}>Back to Layouts</Button>
      </div>
    );
  }

  return (
    <div className="layout-detail-page">
      {/* Action buttons in top right */}
      <div className="page-actions">
        <Button
          kind="secondary"
          renderIcon={Add}
          onClick={handleAddPanel}
          size="md"
        >
          Add Panel
        </Button>
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
          disabled={!name || panels.length === 0}
          size="md"
        >
          Save Layout
        </Button>
      </div>

      {/* Header with name */}
      <div className="page-header">
        <TextInput
          id="layout-name"
          labelText="Layout Name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setHasChanges(true);
          }}
          placeholder="Enter layout name"
          size="lg"
        />
      </div>

      {/* Description row */}
      <div className="description-row">
        <TextInput
          id="layout-description"
          labelText="Description (optional)"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setHasChanges(true);
          }}
          placeholder="Enter layout description"
          size="md"
        />
      </div>

      {/* Grid stats */}
      <div className="grid-info">
        <span>Grid: {gridConfig.columns} columns × {gridConfig.maxRows} rows</span>
        <span>•</span>
        <span>Panels: {panels.length}</span>
        <span>•</span>
        <span>Unit: {gridConfig.rowHeight}px ($spacing-08)</span>
      </div>

      {/* Grid layout editor */}
      <div className="grid-editor">
        <ResponsiveGridLayout
          className="layout"
          layouts={{ lg: panels }}
          breakpoints={{ lg: 1200 }}
          cols={{ lg: gridConfig.columns }}
          rowHeight={gridConfig.rowHeight}
          maxRows={gridConfig.maxRows}
          onLayoutChange={handleLayoutChange}
          draggableHandle=".panel-drag-handle"
          compactType="vertical"
        >
          {panels.map((panel) => (
            <div key={panel.i} className="grid-panel">
              <div className="panel-header panel-drag-handle">
                <span className="panel-id">{panel.i}</span>
                <button
                  className="panel-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeletePanel(panel.i);
                  }}
                  title="Delete panel"
                >
                  <TrashCan size={16} />
                </button>
              </div>
              <div className="panel-content">
                <div className="panel-dimensions">
                  {panel.w} × {panel.h}
                </div>
              </div>
              <div className="resize-handle" />
            </div>
          ))}
        </ResponsiveGridLayout>
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
          modalHeading={isCreateMode ? "Create Layout" : "Save Changes"}
          primaryButtonText={saving ? "Saving..." : "Save"}
          secondaryButtonText="Cancel"
          primaryButtonDisabled={saving}
        >
          <p>
            {isCreateMode
              ? `Create layout "${name}" with ${panels.length} panels?`
              : `Save changes to layout "${name}"?`}
          </p>
        </Modal>
      )}
    </div>
  );
}

export default LayoutDetailPage;
