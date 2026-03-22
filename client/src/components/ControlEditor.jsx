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
  InlineNotification,
  ComboBox,
  IconButton,
  Loading
} from '@carbon/react';
import { Renew } from '@carbon/icons-react';
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
  const [mqttTopics, setMqttTopics] = useState([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [mqttDeviceTypes, setMqttDeviceTypes] = useState([]);

  // Extract config values with defaults
  const controlType = controlConfig?.control_type || CONTROL_TYPES.BUTTON;
  const commandConfig = controlConfig?.command_config || {};
  const uiConfig = controlConfig?.ui_config || {};

  // Detect MQTT connection
  const isMQTT = selectedConnection?.type === 'mqtt';

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

    // Fetch available MQTT device types (for command templates)
    apiClient.getDeviceTypes({ protocol: 'mqtt' })
      .then(result => setMqttDeviceTypes(result?.device_types || []))
      .catch(() => setMqttDeviceTypes([]));
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

  const fetchMQTTTopics = async () => {
    if (!connectionId) return;
    try {
      setLoadingTopics(true);
      const response = await apiClient.getMQTTTopics(connectionId);
      const allTopics = response.topics || [];
      // Filter out Zigbee2MQTT internals and command topics
      const filtered = allTopics.filter(t => {
        const topic = typeof t === 'string' ? t : t.topic;
        if (topic.includes('/bridge/')) return false;
        if (topic.endsWith('/set')) return false;
        if (topic.endsWith('/get')) return false;
        if (topic.endsWith('/availability')) return false;
        return true;
      });
      setMqttTopics(filtered.map(t => typeof t === 'string' ? t : t.topic));
    } catch (err) {
      console.error('Failed to fetch MQTT topics:', err);
      setMqttTopics([]);
    } finally {
      setLoadingTopics(false);
    }
  };

  // Fetch MQTT topics when an MQTT connection is selected
  useEffect(() => {
    if (!isMQTT || !connectionId) {
      setMqttTopics([]);
      return;
    }
    fetchMQTTTopics();
  }, [connectionId, isMQTT]);

  // Derive selected state topic from controlConfig.target (strip /set suffix)
  const selectedStateTopic = controlConfig?.target?.endsWith('/set')
    ? controlConfig.target.slice(0, -4)
    : controlConfig?.target || '';

  // Handle MQTT topic selection — sets target but does NOT auto-assign a device type
  const handleTopicSelect = (topic) => {
    if (!topic) {
      const newConfig = { ...controlConfig };
      delete newConfig.target;
      delete newConfig.device_type_id;
      delete newConfig.command_config;
      onControlConfigChange(newConfig);
      return;
    }
    // Default to topic/set, but user can edit the target below
    const commandTopic = `${topic}/set`;
    const newConfig = {
      ...controlConfig,
      target: commandTopic,
      command_config: null
    };
    // Don't force a device type — keep existing if set, or leave empty
    onControlConfigChange(newConfig);
  };

  // Handle MQTT device type selection
  const handleDeviceTypeSelect = (deviceTypeId) => {
    const newConfig = { ...controlConfig };
    if (deviceTypeId) {
      newConfig.device_type_id = deviceTypeId;
      newConfig.command_config = null; // Device type handles commands
    } else {
      delete newConfig.device_type_id;
    }
    onControlConfigChange(newConfig);
  };

  // Get payload preview from the selected device type
  const getPayloadPreview = () => {
    if (!controlConfig?.device_type_id) return null;
    const dt = mqttDeviceTypes.find(d => d.id === controlConfig.device_type_id);
    if (!dt?.commands) return null;

    // Find the command definition for the current control type, or the first available
    const cmdDef = dt.commands[controlType] || Object.values(dt.commands)[0];
    if (!cmdDef?.template) return null;

    const template = cmdDef.template;
    const valueMap = cmdDef.value_map || {};

    // Build ON/OFF or value previews
    const previews = [];
    if (valueMap['true'] !== undefined && valueMap['false'] !== undefined) {
      const onPayload = { ...template };
      const offPayload = { ...template };
      for (const key of Object.keys(template)) {
        if (template[key] === '{{value}}') {
          onPayload[key] = valueMap['true'];
          offPayload[key] = valueMap['false'];
        }
      }
      previews.push({ label: `${valueMap['true']} payload`, payload: onPayload });
      previews.push({ label: `${valueMap['false']} payload`, payload: offPayload });
    } else {
      previews.push({ label: 'Payload template', payload: template });
    }
    return previews;
  };

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
        {isMQTT ? (
          <Grid narrow>
            <Column lg={8} md={5} sm={3}>
              <ComboBox
                id="mqtt-topic-select"
                titleText="Device Topic"
                items={mqttTopics}
                itemToString={(item) => item || ''}
                selectedItem={selectedStateTopic || null}
                onChange={({ selectedItem }) => handleTopicSelect(selectedItem)}
                placeholder={loadingTopics ? 'Loading topics...' : 'Select a device topic...'}
                disabled={loadingTopics}
                helperText="Select a device state topic to auto-fill the command target"
              />
            </Column>
            <Column lg={1} md={1} sm={1}>
              <div className="mqtt-topic-refresh">
                <IconButton
                  label="Refresh topics"
                  kind="ghost"
                  onClick={fetchMQTTTopics}
                  disabled={loadingTopics}
                >
                  {loadingTopics ? <Loading small withOverlay={false} /> : <Renew />}
                </IconButton>
              </div>
            </Column>
            <Column lg={3} md={2} sm={4}>
              <Select
                id="mqtt-device-type-select"
                labelText="Device Type"
                value={controlConfig?.device_type_id || ''}
                onChange={(e) => handleDeviceTypeSelect(e.target.value || null)}
                helperText="Optional — defines payload format"
              >
                <SelectItem value="" text="None (manual payload)" />
                {mqttDeviceTypes.map(dt => (
                  <SelectItem key={dt.id} value={dt.id} text={dt.name} />
                ))}
              </Select>
            </Column>
            <Column lg={12} md={8} sm={4}>
              <TextInput
                id="mqtt-command-target"
                labelText="Command Target (topic)"
                value={controlConfig?.target || ''}
                onChange={(e) => updateConfig('target', e.target.value)}
                placeholder="e.g., zigbee2mqtt/device/set or caseta/device"
                helperText="MQTT topic to publish commands to"
              />
            </Column>
            {controlConfig?.device_type_id && (() => {
              const previews = getPayloadPreview();
              if (!previews) return null;
              return (
                <Column lg={12} md={8} sm={4}>
                  <div className="mqtt-schema-info">
                    <Tag type="teal">Device Type: {controlConfig.device_type_id}</Tag>
                    <div className="payload-preview">
                      {previews.map((p, i) => (
                        <span key={i}>
                          <span className="payload-label">{p.label}:</span>
                          <code>{JSON.stringify(p.payload)}</code>
                        </span>
                      ))}
                    </div>
                  </div>
                </Column>
              );
            })()}
          </Grid>
        ) : (
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
        )}
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

          {/* Plug UI Config */}
          {controlType === CONTROL_TYPES.PLUG && (
            <>
              <Column lg={4} md={4} sm={4}>
                <TextInput
                  id="ui-label"
                  labelText="Label"
                  value={uiConfig.label || ''}
                  onChange={(e) => updateUIConfig('label', e.target.value)}
                  placeholder="Plug"
                />
              </Column>
              <Column lg={4} md={4} sm={4}>
                <TextInput
                  id="ui-on-label"
                  labelText="On Label"
                  value={uiConfig.onLabel || ''}
                  onChange={(e) => updateUIConfig('onLabel', e.target.value)}
                  placeholder="On"
                />
              </Column>
              <Column lg={4} md={4} sm={4}>
                <TextInput
                  id="ui-off-label"
                  labelText="Off Label"
                  value={uiConfig.offLabel || ''}
                  onChange={(e) => updateUIConfig('offLabel', e.target.value)}
                  placeholder="Off"
                />
              </Column>
            </>
          )}

          {/* Dimmer UI Config */}
          {controlType === CONTROL_TYPES.DIMMER && (
            <>
              <Column lg={4} md={4} sm={4}>
                <TextInput
                  id="ui-label"
                  labelText="Label"
                  value={uiConfig.label || ''}
                  onChange={(e) => updateUIConfig('label', e.target.value)}
                  placeholder="Light"
                />
              </Column>
              <Column lg={3} md={2} sm={4}>
                <NumberInput
                  id="ui-min"
                  label="Min"
                  value={uiConfig.min ?? 0}
                  onChange={(e, { value }) => updateUIConfig('min', value)}
                  min={0}
                  max={999}
                  step={1}
                />
              </Column>
              <Column lg={3} md={2} sm={4}>
                <NumberInput
                  id="ui-max"
                  label="Max"
                  value={uiConfig.max ?? 100}
                  onChange={(e, { value }) => updateUIConfig('max', value)}
                  min={1}
                  max={1000}
                  step={1}
                />
              </Column>
              <Column lg={2} md={2} sm={4}>
                <NumberInput
                  id="ui-step"
                  label="Step"
                  value={uiConfig.step ?? 1}
                  onChange={(e, { value }) => updateUIConfig('step', value)}
                  min={1}
                  max={100}
                  step={1}
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
