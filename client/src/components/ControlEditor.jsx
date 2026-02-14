// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useState, useEffect } from 'react';
import {
  Select,
  SelectItem,
  TextInput,
  NumberInput,
  TextArea,
  Grid,
  Column,
  Tag,
  InlineNotification
} from '@carbon/react';
import { CONTROL_TYPES, CONTROL_TYPE_INFO } from './controls';
import apiClient from '../api/client';
import './ControlEditor.scss';

/**
 * ControlEditor Component
 *
 * Editor for configuring control components (buttons, toggles, sliders, text inputs).
 * Used within ChartEditor when component_type="control".
 */
function ControlEditor({
  controlConfig,
  connectionId,
  onControlConfigChange,
  onConnectionIdChange
}) {
  const [connections, setConnections] = useState([]);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [loadingConnections, setLoadingConnections] = useState(true);

  // Extract config values with defaults
  const controlType = controlConfig?.control_type || CONTROL_TYPES.BUTTON;
  const commandConfig = controlConfig?.command_config || {};
  const uiConfig = controlConfig?.ui_config || {};

  // Fetch writable connections on mount
  useEffect(() => {
    const fetchConnections = async () => {
      try {
        setLoadingConnections(true);
        const response = await apiClient.getWritableConnections();
        setConnections(response.connections || []);
      } catch (err) {
        console.error('Failed to fetch writable connections:', err);
      } finally {
        setLoadingConnections(false);
      }
    };
    fetchConnections();
  }, []);

  // Update selected connection when connectionId changes
  useEffect(() => {
    if (connectionId && connections.length > 0) {
      const conn = connections.find(c => c.id === connectionId);
      setSelectedConnection(conn || null);
    } else {
      setSelectedConnection(null);
    }
  }, [connectionId, connections]);

  // Helper to update control config
  const updateConfig = (field, value) => {
    const newConfig = {
      ...controlConfig,
      [field]: value
    };
    onControlConfigChange(newConfig);
  };

  // Helper to update command config
  const updateCommandConfig = (field, value) => {
    const newCommandConfig = {
      ...commandConfig,
      [field]: value
    };
    updateConfig('command_config', newCommandConfig);
  };

  // Helper to update UI config
  const updateUIConfig = (field, value) => {
    const newUIConfig = {
      ...uiConfig,
      [field]: value
    };
    updateConfig('ui_config', newUIConfig);
  };

  // Handle control type change - reset UI config to defaults
  const handleControlTypeChange = (newType) => {
    const typeInfo = CONTROL_TYPE_INFO[newType];
    const newConfig = {
      ...controlConfig,
      control_type: newType,
      ui_config: typeInfo?.defaultUIConfig || {}
    };
    onControlConfigChange(newConfig);
  };

  // Parse payload template from JSON string
  const parsePayloadTemplate = (jsonStr) => {
    try {
      return JSON.parse(jsonStr);
    } catch {
      return {};
    }
  };

  // Stringify payload template for editing
  const stringifyPayloadTemplate = (template) => {
    return JSON.stringify(template || {}, null, 2);
  };

  return (
    <div className="control-editor">
      {/* Control Type Selection */}
      <div className="control-type-section">
        <h4>Control Type</h4>
        <div className="control-type-grid">
          {Object.entries(CONTROL_TYPE_INFO).map(([type, info]) => (
            <div
              key={type}
              className={`control-type-option ${controlType === type ? 'selected' : ''}`}
              onClick={() => handleControlTypeChange(type)}
            >
              <div className="type-label">{info.label}</div>
              <div className="type-description">{info.description}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Connection Selection */}
      <div className="connection-section">
        <h4>Connection</h4>
        <Grid narrow>
          <Column lg={8} md={4} sm={4}>
            <Select
              id="control-connection"
              labelText="Target Connection"
              value={connectionId || ''}
              onChange={(e) => onConnectionIdChange(e.target.value)}
              disabled={loadingConnections}
              helperText="Select a connection that supports write operations"
            >
              <SelectItem value="" text={loadingConnections ? 'Loading...' : 'Select a connection...'} />
              {connections.map(conn => (
                <SelectItem
                  key={conn.id}
                  value={conn.id}
                  text={`${conn.name} (${conn.type})`}
                />
              ))}
            </Select>
          </Column>
          <Column lg={4} md={4} sm={4}>
            {selectedConnection && (
              <div className="connection-info">
                <Tag type="cyan">{selectedConnection.type}</Tag>
                {selectedConnection.description && (
                  <span className="connection-description">{selectedConnection.description}</span>
                )}
              </div>
            )}
          </Column>
        </Grid>

        {connections.length === 0 && !loadingConnections && (
          <InlineNotification
            kind="warning"
            title="No writable connections"
            subtitle="Create a bidirectional connection (like WebSocket) to use controls"
            lowContrast
            hideCloseButton
          />
        )}
      </div>

      {/* Command Configuration */}
      <div className="command-section">
        <h4>Command Configuration</h4>
        <Grid narrow>
          <Column lg={6} md={4} sm={4}>
            <TextInput
              id="command-action"
              labelText="Action"
              value={commandConfig.action || ''}
              onChange={(e) => updateCommandConfig('action', e.target.value)}
              placeholder="set, toggle, send, execute..."
              helperText="The command action to perform"
            />
          </Column>
          <Column lg={6} md={4} sm={4}>
            <TextInput
              id="command-target"
              labelText="Target (optional)"
              value={commandConfig.target || ''}
              onChange={(e) => updateCommandConfig('target', e.target.value)}
              placeholder="device_id, channel, topic..."
              helperText="Optional target identifier"
            />
          </Column>
          <Column lg={12} md={8} sm={4}>
            <TextArea
              id="command-payload-template"
              labelText="Payload Template (JSON)"
              value={stringifyPayloadTemplate(commandConfig.payload_template)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  updateCommandConfig('payload_template', parsed);
                } catch {
                  // Allow invalid JSON while editing
                }
              }}
              placeholder='{"value": "{{value}}", "timestamp": "{{value}}"}'
              helperText='Use {{value}} as placeholder for the control value'
              rows={4}
            />
          </Column>
        </Grid>
      </div>

      {/* UI Configuration - varies by control type */}
      <div className="ui-config-section">
        <h4>UI Configuration</h4>
        <Grid narrow>
          {/* Button UI Config */}
          {controlType === CONTROL_TYPES.BUTTON && (
            <>
              <Column lg={6} md={4} sm={4}>
                <TextInput
                  id="ui-label"
                  labelText="Button Label"
                  value={uiConfig.label || ''}
                  onChange={(e) => updateUIConfig('label', e.target.value)}
                  placeholder="Execute"
                />
              </Column>
              <Column lg={6} md={4} sm={4}>
                <Select
                  id="ui-kind"
                  labelText="Button Style"
                  value={uiConfig.kind || 'primary'}
                  onChange={(e) => updateUIConfig('kind', e.target.value)}
                >
                  <SelectItem value="primary" text="Primary (Blue)" />
                  <SelectItem value="secondary" text="Secondary (Gray)" />
                  <SelectItem value="danger" text="Danger (Red)" />
                  <SelectItem value="ghost" text="Ghost (Transparent)" />
                </Select>
              </Column>
            </>
          )}

          {/* Toggle UI Config */}
          {controlType === CONTROL_TYPES.TOGGLE && (
            <>
              <Column lg={6} md={4} sm={4}>
                <TextInput
                  id="ui-label"
                  labelText="On Label"
                  value={uiConfig.label || ''}
                  onChange={(e) => updateUIConfig('label', e.target.value)}
                  placeholder="Enable"
                />
              </Column>
              <Column lg={6} md={4} sm={4}>
                <TextInput
                  id="ui-off-label"
                  labelText="Off Label"
                  value={uiConfig.offLabel || ''}
                  onChange={(e) => updateUIConfig('offLabel', e.target.value)}
                  placeholder="Disable"
                />
              </Column>
            </>
          )}

          {/* Slider UI Config */}
          {controlType === CONTROL_TYPES.SLIDER && (
            <>
              <Column lg={4} md={4} sm={4}>
                <TextInput
                  id="ui-label"
                  labelText="Label"
                  value={uiConfig.label || ''}
                  onChange={(e) => updateUIConfig('label', e.target.value)}
                  placeholder="Value"
                />
              </Column>
              <Column lg={4} md={4} sm={4}>
                <NumberInput
                  id="ui-min"
                  label="Minimum"
                  value={uiConfig.min ?? 0}
                  onChange={(e) => updateUIConfig('min', e.imaginaryTarget.value)}
                  min={-1000000}
                  max={1000000}
                />
              </Column>
              <Column lg={4} md={4} sm={4}>
                <NumberInput
                  id="ui-max"
                  label="Maximum"
                  value={uiConfig.max ?? 100}
                  onChange={(e) => updateUIConfig('max', e.imaginaryTarget.value)}
                  min={-1000000}
                  max={1000000}
                />
              </Column>
              <Column lg={4} md={4} sm={4}>
                <NumberInput
                  id="ui-step"
                  label="Step"
                  value={uiConfig.step ?? 1}
                  onChange={(e) => updateUIConfig('step', e.imaginaryTarget.value)}
                  min={0.001}
                  max={1000}
                  step={0.001}
                />
              </Column>
            </>
          )}

          {/* Text Input UI Config */}
          {controlType === CONTROL_TYPES.TEXT_INPUT && (
            <>
              <Column lg={4} md={4} sm={4}>
                <TextInput
                  id="ui-label"
                  labelText="Label"
                  value={uiConfig.label || ''}
                  onChange={(e) => updateUIConfig('label', e.target.value)}
                  placeholder="Command"
                />
              </Column>
              <Column lg={4} md={4} sm={4}>
                <TextInput
                  id="ui-placeholder"
                  labelText="Placeholder"
                  value={uiConfig.placeholder || ''}
                  onChange={(e) => updateUIConfig('placeholder', e.target.value)}
                  placeholder="Enter value..."
                />
              </Column>
              <Column lg={4} md={4} sm={4}>
                <TextInput
                  id="ui-submit-label"
                  labelText="Submit Button Label"
                  value={uiConfig.submitLabel || ''}
                  onChange={(e) => updateUIConfig('submitLabel', e.target.value)}
                  placeholder="Send"
                />
              </Column>
            </>
          )}
        </Grid>
      </div>

      {/* Preview section */}
      <div className="preview-section">
        <h4>Preview</h4>
        <div className="control-preview">
          <div className="preview-placeholder">
            Control preview will appear here when saved to a dashboard
          </div>
        </div>
      </div>
    </div>
  );
}

export default ControlEditor;
