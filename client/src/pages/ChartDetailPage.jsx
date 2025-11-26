import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Loading,
  Modal,
  TextInput,
  TextArea,
  Tag,
  TagSkeleton
} from '@carbon/react';
import { Save, Close } from '@carbon/icons-react';
import './ChartDetailPage.scss';

/**
 * ChartDetailPage Component
 *
 * Create/Edit component/chart with code editor.
 * Supports: Name, System, Source, Description, Component Code, Metadata
 */
function ChartDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isCreateMode = id === 'new';

  const [component, setComponent] = useState(null);
  const [name, setName] = useState('');
  const [system, setSystem] = useState('');
  const [source, setSource] = useState('');
  const [description, setDescription] = useState('');
  const [componentCode, setComponentCode] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(!isCreateMode);
  const [error, setError] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isCreateMode) {
      fetchComponent();
    } else {
      // Initialize with default component template
      setComponentCode(`const Component = () => {
  const [count, setCount] = useState(0);

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h2>My Component</h2>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </div>
  );
};`);
    }
  }, [id]);

  const fetchComponent = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:3001/api/components/${id}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Component response:', data);

      setComponent(data);
      setName(data.name);
      setSystem(data.system);
      setSource(data.source);
      setDescription(data.description || '');
      setComponentCode(data.component_code || '');
      setCategory(data.metadata?.category || '');
      setTags(data.metadata?.tags || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
      setHasChanges(true);
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter(t => t !== tagToRemove));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        name,
        system,
        source,
        description,
        component_code: componentCode,
        metadata: {
          category,
          tags
        }
      };

      let response;
      if (isCreateMode) {
        response = await fetch('http://localhost:3001/api/components', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        response = await fetch(`http://localhost:3001/api/components/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description,
            component_code: componentCode,
            metadata: {
              category,
              tags
            }
          })
        });
      }

      const data = await response.json();

      if (response.ok) {
        setHasChanges(false);
        setShowSaveModal(false);
        navigate('/design/charts');
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
      navigate('/design/charts');
    }
  };

  const confirmCancel = () => {
    setShowCancelModal(false);
    navigate('/design/charts');
  };

  if (loading) {
    return (
      <div className="chart-detail-page">
        <Loading description="Loading component..." withOverlay={false} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="chart-detail-page">
        <div className="error-message">Error: {error}</div>
        <Button onClick={() => navigate('/design/charts')}>Back to Charts</Button>
      </div>
    );
  }

  return (
    <div className="chart-detail-page">
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
          disabled={!name || !system || !source || !componentCode}
          size="md"
        >
          Save Component
        </Button>
      </div>

      {/* Header with name */}
      <div className="page-header">
        <TextInput
          id="component-name"
          labelText="Component Name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setHasChanges(true);
          }}
          placeholder="Enter component name"
          size="lg"
          disabled={!isCreateMode}
        />
      </div>

      {/* System and Source row */}
      <div className="system-source-row">
        <TextInput
          id="component-system"
          labelText="System"
          value={system}
          onChange={(e) => {
            setSystem(e.target.value);
            setHasChanges(true);
          }}
          placeholder="e.g., visualization"
          disabled={!isCreateMode}
        />
        <TextInput
          id="component-source"
          labelText="Source"
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            setHasChanges(true);
          }}
          placeholder="e.g., charts"
          disabled={!isCreateMode}
        />
      </div>

      {/* Description row */}
      <div className="description-row">
        <TextInput
          id="component-description"
          labelText="Description (optional)"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setHasChanges(true);
          }}
          placeholder="Enter component description"
          size="md"
        />
      </div>

      {/* Category and Tags */}
      <div className="metadata-row">
        <TextInput
          id="component-category"
          labelText="Category (optional)"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setHasChanges(true);
          }}
          placeholder="e.g., demo, widget"
        />
        <div className="tags-input">
          <label className="cds--label">Tags</label>
          <div className="tags-container">
            {tags.map((tag) => (
              <Tag
                key={tag}
                type="blue"
                size="md"
                onClose={() => handleRemoveTag(tag)}
              >
                {tag}
              </Tag>
            ))}
            <TextInput
              id="tag-input"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              placeholder="Add tag (press Enter)"
              size="sm"
              labelText=""
            />
          </div>
        </div>
      </div>

      {/* Code editor */}
      <div className="code-editor-section">
        <h3>Component Code</h3>
        <p className="code-help">
          Write your React component code. Must export a `Component` or `Widget` variable.
          Available: useState, useEffect, useMemo, useCallback, useRef, useContext, echarts, ReactECharts
        </p>
        <TextArea
          id="component-code"
          labelText=""
          value={componentCode}
          onChange={(e) => {
            setComponentCode(e.target.value);
            setHasChanges(true);
          }}
          placeholder="const Component = () => { ... };"
          rows={20}
          className="code-textarea"
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
          modalHeading={isCreateMode ? "Create Component" : "Save Changes"}
          primaryButtonText={saving ? "Saving..." : "Save"}
          secondaryButtonText="Cancel"
          primaryButtonDisabled={saving}
        >
          <p>
            {isCreateMode
              ? `Create component "${name}" in ${system}/${source}?`
              : `Save changes to component "${name}"?`}
          </p>
        </Modal>
      )}
    </div>
  );
}

export default ChartDetailPage;
