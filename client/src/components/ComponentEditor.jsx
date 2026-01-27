// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useState, useEffect } from 'react';
import {
  Form,
  TextInput,
  TextArea,
  Button,
  Toggle,
  InlineNotification,
  Tile,
  Stack
} from '@carbon/react';
import { Save, Close } from '@carbon/icons-react';
import { useComponentActions } from '../hooks/useComponents';
import DynamicComponentLoader from './DynamicComponentLoader';
import './ComponentEditor.scss';

/**
 * Component Editor
 * Create and edit dashboard components
 */
export default function ComponentEditor({ component, onSave, onCancel }) {
  const isEditing = !!component;
  const [formData, setFormData] = useState({
    system: '',
    source: '',
    name: '',
    description: '',
    component_code: '',
    metadata: '{}',
  });
  const [preview, setPreview] = useState(false);
  const [previewCode, setPreviewCode] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const { createComponent, updateComponent, loading, error } = useComponentActions();

  useEffect(() => {
    if (component) {
      const data = {
        system: component.system,
        source: component.source,
        name: component.name,
        description: component.description || '',
        component_code: component.component_code,
        metadata: JSON.stringify(component.metadata || {}, null, 2),
      };
      setFormData(data);
      setPreviewCode(component.component_code);
    }
  }, [component]);

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));

    if (id === 'component_code') {
      setPreviewCode(value);
    }

    // Clear error for this field
    if (formErrors[id]) {
      setFormErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[id];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.system.trim()) {
      errors.system = 'System is required';
    }
    if (!formData.source.trim()) {
      errors.source = 'Source is required';
    }
    if (!formData.name.trim()) {
      errors.name = 'Component name is required';
    }
    if (!formData.component_code.trim()) {
      errors.component_code = 'Component code is required';
    }

    // Validate metadata JSON
    try {
      JSON.parse(formData.metadata || '{}');
    } catch (err) {
      errors.metadata = 'Invalid JSON format';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      const metadata = JSON.parse(formData.metadata || '{}');

      const componentData = {
        system: formData.system.trim(),
        source: formData.source.trim(),
        name: formData.name.trim(),
        description: formData.description?.trim() || '',
        component_code: formData.component_code,
        metadata,
      };

      if (isEditing) {
        await updateComponent(component.id, componentData);
      } else {
        await createComponent(componentData);
      }

      onSave?.();
    } catch (err) {
      console.error('Error saving component:', err);
    }
  };

  return (
    <div className="component-editor">
      <Tile className="editor-tile">
        <h3 className="editor-title">
          {isEditing ? 'Edit Component' : 'Create New Component'}
        </h3>

        {error && (
          <InlineNotification
            kind="error"
            title="Error"
            subtitle={error}
            lowContrast
            hideCloseButton={false}
            className="editor-notification"
          />
        )}

        <Form onSubmit={handleSubmit}>
          <Stack gap={6}>
            {/* System, Source, Name Row */}
            <div className="form-row-3">
              <TextInput
                id="system"
                labelText="System"
                placeholder="e.g., analytics"
                value={formData.system}
                onChange={handleInputChange}
                disabled={isEditing}
                invalid={!!formErrors.system}
                invalidText={formErrors.system}
                helperText="High-level category"
              />

              <TextInput
                id="source"
                labelText="Source"
                placeholder="e.g., cpu-metrics"
                value={formData.source}
                onChange={handleInputChange}
                disabled={isEditing}
                invalid={!!formErrors.source}
                invalidText={formErrors.source}
                helperText="Data source or subcategory"
              />

              <TextInput
                id="name"
                labelText="Component Name"
                placeholder="e.g., usage-chart"
                value={formData.name}
                onChange={handleInputChange}
                disabled={isEditing}
                invalid={!!formErrors.name}
                invalidText={formErrors.name}
                helperText="Unique identifier"
              />
            </div>

            {isEditing && (
              <InlineNotification
                kind="info"
                title="Note"
                subtitle="System, Source, and Name cannot be changed after creation"
                lowContrast
                hideCloseButton
              />
            )}

            {/* Description */}
            <TextInput
              id="description"
              labelText="Description"
              placeholder="Brief description of the component"
              value={formData.description}
              onChange={handleInputChange}
              helperText="Brief description of what this component does"
            />

            {/* Component Code */}
            <div className="code-section">
              <div className="code-header">
                <label htmlFor="component_code" className="code-label">
                  Component Code
                </label>
                <Toggle
                  id="preview-toggle"
                  labelText=""
                  hideLabel
                  size="sm"
                  toggled={preview}
                  onToggle={(checked) => setPreview(checked)}
                  labelA="Preview Off"
                  labelB="Preview On"
                />
              </div>
              <TextArea
                id="component_code"
                labelText=""
                hideLabel
                placeholder="const Component = () => { return <div>Hello World</div>; };"
                value={formData.component_code}
                onChange={handleInputChange}
                invalid={!!formErrors.component_code}
                invalidText={formErrors.component_code}
                rows={12}
                className="code-textarea"
              />
              <p className="helper-text">
                Available: useState, useEffect, useMemo, useCallback, useRef, useContext, echarts, ReactECharts, carbonTheme
              </p>
            </div>

            {/* Preview */}
            {preview && (
              <Tile className="preview-tile">
                <h5 className="preview-title">Live Preview</h5>
                <div className="preview-content">
                  <DynamicComponentLoader code={previewCode} />
                </div>
              </Tile>
            )}

            {/* Metadata */}
            <TextArea
              id="metadata"
              labelText="Metadata (JSON)"
              placeholder='{"dataSource": {...}, "refreshInterval": 5000}'
              value={formData.metadata}
              onChange={handleInputChange}
              invalid={!!formErrors.metadata}
              invalidText={formErrors.metadata}
              rows={6}
              className="metadata-textarea"
              helperText="Additional metadata as JSON object"
            />

            {/* Actions */}
            <div className="editor-actions">
              <Button
                kind="primary"
                type="submit"
                renderIcon={Save}
                disabled={loading}
              >
                {loading ? 'Saving...' : (isEditing ? 'Update Component' : 'Create Component')}
              </Button>
              {onCancel && (
                <Button
                  kind="secondary"
                  onClick={onCancel}
                  disabled={loading}
                  renderIcon={Close}
                >
                  Cancel
                </Button>
              )}
            </div>
          </Stack>
        </Form>
      </Tile>
    </div>
  );
}
