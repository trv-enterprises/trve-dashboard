// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useState, useEffect } from 'react';
import {
  Modal,
  TextInput,
  TextArea,
  Select,
  SelectItem,
  RadioButtonGroup,
  RadioButton
} from '@carbon/react';
import apiClient from '../api/client';
import './AIPreflightModal.scss';

// Chart types for display components (same as ChartEditor)
const CHART_TYPES = [
  { id: 'bar', label: 'Bar Chart' },
  { id: 'line', label: 'Line Chart' },
  { id: 'area', label: 'Area Chart' },
  { id: 'pie', label: 'Pie Chart' },
  { id: 'scatter', label: 'Scatter Plot' },
  { id: 'gauge', label: 'Gauge' },
  { id: 'dataview', label: 'Data Table' },
  { id: 'custom', label: 'Custom Component' }
];

// Control types (from controls/index.js)
const CONTROL_TYPES = [
  { id: 'button', label: 'Button' },
  { id: 'toggle', label: 'Toggle' },
  { id: 'slider', label: 'Slider' },
  { id: 'text_input', label: 'Text Input' }
];

/**
 * AIPreflightModal Component
 *
 * Modal for gathering optional context before starting an AI session.
 * Component type selection is required; all other fields are optional.
 *
 * @param {boolean} open - Whether the modal is open
 * @param {Function} onClose - Handler for closing the modal
 * @param {Function} onContinue - Handler when user clicks Continue, receives context object
 */
function AIPreflightModal({ open, onClose, onContinue }) {
  const [componentType, setComponentType] = useState(''); // 'chart' or 'control'
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [connectionId, setConnectionId] = useState('');
  const [chartType, setChartType] = useState('');
  const [controlType, setControlType] = useState('');
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch connections when modal opens
  useEffect(() => {
    if (open) {
      fetchConnections();
    }
  }, [open]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setComponentType('');
      setName('');
      setDescription('');
      setConnectionId('');
      setChartType('');
      setControlType('');
    }
  }, [open]);

  const fetchConnections = async () => {
    setLoading(true);
    try {
      // For controls, we need writable connections; for displays, any connection works
      // Fetch all connections and let user pick
      const data = await apiClient.getConnections();
      if (data.datasources) {
        setConnections(data.datasources);
      }
    } catch (err) {
      console.error('Failed to fetch connections:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    const context = {
      componentType,
      name: name.trim() || undefined,
      description: description.trim() || undefined,
      connectionId: connectionId || undefined,
      chartType: componentType === 'chart' ? (chartType || undefined) : undefined,
      controlType: componentType === 'control' ? (controlType || undefined) : undefined
    };
    onContinue(context);
  };

  const isValid = componentType !== '';

  return (
    <Modal
      open={open}
      onRequestClose={onClose}
      onRequestSubmit={handleContinue}
      modalHeading="Create Component with AI"
      primaryButtonText="Continue"
      secondaryButtonText="Cancel"
      primaryButtonDisabled={!isValid}
      size="md"
    >
      <div className="ai-preflight-modal">
        {/* Required: Component Type */}
        <div className="form-section required-section">
          <RadioButtonGroup
            legendText="Component Type *"
            name="component-type"
            valueSelected={componentType}
            onChange={(value) => {
              setComponentType(value);
              // Reset type-specific fields when switching
              setChartType('');
              setControlType('');
            }}
            orientation="horizontal"
          >
            <RadioButton
              labelText="Display"
              value="chart"
              id="type-display"
            />
            <RadioButton
              labelText="Control"
              value="control"
              id="type-control"
            />
          </RadioButtonGroup>
        </div>

        {/* Divider */}
        <div className="form-divider">
          <span>Optional - provide details to help AI</span>
        </div>

        {/* Optional fields */}
        <div className="form-section optional-section">
          <TextInput
            id="component-name"
            labelText="Name"
            placeholder="e.g., Temperature Chart, Power Toggle"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <TextArea
            id="component-description"
            labelText="Description"
            placeholder="Describe what this component should do..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />

          <Select
            id="connection-select"
            labelText="Connection"
            value={connectionId}
            onChange={(e) => setConnectionId(e.target.value)}
            disabled={loading}
          >
            <SelectItem value="" text="Select a connection..." />
            {connections.map((conn) => (
              <SelectItem
                key={conn.id}
                value={conn.id}
                text={`${conn.name} (${conn.type})`}
              />
            ))}
          </Select>

          {/* Display-specific: Chart Type */}
          {componentType === 'chart' && (
            <Select
              id="chart-type-select"
              labelText="Chart Type"
              value={chartType}
              onChange={(e) => setChartType(e.target.value)}
            >
              <SelectItem value="" text="Select a chart type..." />
              {CHART_TYPES.map((type) => (
                <SelectItem
                  key={type.id}
                  value={type.id}
                  text={type.label}
                />
              ))}
            </Select>
          )}

          {/* Control-specific: Control Type */}
          {componentType === 'control' && (
            <Select
              id="control-type-select"
              labelText="Control Type"
              value={controlType}
              onChange={(e) => setControlType(e.target.value)}
            >
              <SelectItem value="" text="Select a control type..." />
              {CONTROL_TYPES.map((type) => (
                <SelectItem
                  key={type.id}
                  value={type.id}
                  text={type.label}
                />
              ))}
            </Select>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default AIPreflightModal;
