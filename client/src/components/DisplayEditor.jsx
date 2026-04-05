// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useState, useEffect } from 'react';
import {
  Select,
  SelectItem,
  Dropdown,
  TextInput,
  NumberInput
} from '@carbon/react';
import apiClient from '../api/client';

// Available display types
const DISPLAY_TYPES = [
  { id: 'frigate_camera', label: 'Frigate Camera' },
  { id: 'weather', label: 'Weather' }
];

/**
 * DisplayEditor Component
 *
 * Generic display config editor shown in ChartEditor when componentType === 'display'.
 * Delegates to subtype-specific fields based on display_type.
 * Currently only supports Frigate Camera — future subtypes (datatable, iframe) will be added here.
 */
function DisplayEditor({ displayConfig, onDisplayConfigChange }) {
  const [connections, setConnections] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [loadingCameras, setLoadingCameras] = useState(false);

  const config = displayConfig || { display_type: 'frigate_camera' };
  const displayType = config.display_type || 'frigate_camera';

  // Fetch connections on mount
  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const data = await apiClient.getConnections();
        setConnections(data.datasources || []);
      } catch (err) {
        console.error('Failed to load connections:', err);
      }
    };
    fetchConnections();
  }, []);

  // Fetch cameras when Frigate connection is selected
  useEffect(() => {
    if (displayType !== 'frigate_camera' || !config.frigate_connection_id) {
      setCameras([]);
      return;
    }

    const fetchCameras = async () => {
      setLoadingCameras(true);
      try {
        const data = await apiClient.getFrigateCameras(config.frigate_connection_id);
        setCameras(data.cameras || []);
      } catch (err) {
        console.error('Failed to load Frigate cameras:', err);
        setCameras([]);
      } finally {
        setLoadingCameras(false);
      }
    };

    fetchCameras();
  }, [displayType, config.frigate_connection_id]);

  const updateConfig = (updates) => {
    onDisplayConfigChange({ ...config, ...updates });
  };

  // Filter connections by type — prefer dedicated Frigate type, also support legacy API
  const frigateConnections = connections.filter(c => c.type === 'frigate' || c.type === 'api');
  const mqttConnections = connections.filter(c => c.type === 'mqtt');

  return (
    <div className="display-editor">
      {/* Display Type selector */}
      <div className="display-editor__section">
        <Select
          id="display-type"
          labelText="Display Type"
          value={displayType}
          onChange={(e) => updateConfig({ display_type: e.target.value })}
        >
          {DISPLAY_TYPES.map(type => (
            <SelectItem key={type.id} value={type.id} text={type.label} />
          ))}
        </Select>
      </div>

      {/* Weather fields */}
      {displayType === 'weather' && (
        <div className="display-editor__section">
          <Dropdown
            id="weather-mqtt-connection"
            titleText="MQTT Connection"
            label="Select MQTT connection with weather topics"
            items={mqttConnections}
            itemToString={(item) => item?.name || ''}
            selectedItem={mqttConnections.find(c => c.id === config.mqtt_connection_id) || null}
            onChange={({ selectedItem }) => {
              updateConfig({ mqtt_connection_id: selectedItem?.id || '' });
            }}
          />

          <TextInput
            id="weather-location"
            labelText="Location"
            value={config.weather_location || ''}
            onChange={(e) => updateConfig({ weather_location: e.target.value })}
            placeholder="e.g., Spring, TX"
            helperText="Location label displayed at the top of the widget"
            size="md"
          />

          <TextInput
            id="weather-topic-prefix"
            labelText="Topic Prefix"
            value={config.weather_topic_prefix || 'weather'}
            onChange={(e) => updateConfig({ weather_topic_prefix: e.target.value })}
            helperText="MQTT topic prefix (subscribes to prefix/#). Default: weather"
            size="md"
          />
        </div>
      )}

      {/* Frigate Camera fields */}
      {displayType === 'frigate_camera' && (
        <div className="display-editor__section">
          <Dropdown
            id="frigate-connection"
            titleText="Frigate Connection"
            label="Select Frigate connection"
            items={frigateConnections}
            itemToString={(item) => item?.name || ''}
            selectedItem={frigateConnections.find(c => c.id === config.frigate_connection_id) || null}
            onChange={({ selectedItem }) => {
              updateConfig({
                frigate_connection_id: selectedItem?.id || '',
                default_camera: '' // Reset camera when connection changes
              });
            }}
          />

          {config.frigate_connection_id && (
            <Dropdown
              id="frigate-default-camera"
              titleText="Default Camera"
              label={loadingCameras ? 'Loading cameras...' : 'Select default camera'}
              items={cameras}
              itemToString={(item) => item || ''}
              selectedItem={config.default_camera || null}
              onChange={({ selectedItem }) => {
                updateConfig({ default_camera: selectedItem || '' });
              }}
              disabled={loadingCameras || cameras.length === 0}
            />
          )}

          <Dropdown
            id="mqtt-connection"
            titleText="MQTT Connection (optional)"
            label="Select MQTT connection for alerts"
            items={[{ id: '', name: 'None' }, ...mqttConnections]}
            itemToString={(item) => item?.name || ''}
            selectedItem={mqttConnections.find(c => c.id === config.mqtt_connection_id) || { id: '', name: 'None' }}
            onChange={({ selectedItem }) => {
              updateConfig({ mqtt_connection_id: selectedItem?.id || '' });
            }}
          />

          {config.mqtt_connection_id && (
            <TextInput
              id="alert-topic"
              labelText="Alert Topic"
              value={config.alert_topic || 'frigate/reviews'}
              onChange={(e) => updateConfig({ alert_topic: e.target.value })}
              helperText="MQTT topic for Frigate review events"
              size="md"
            />
          )}

          <NumberInput
            id="snapshot-interval"
            label="Snapshot Interval (ms)"
            value={config.snapshot_interval || 10000}
            min={1000}
            max={60000}
            step={1000}
            onChange={(e, { value }) => updateConfig({ snapshot_interval: value })}
            helperText="How often to refresh the camera snapshot (idle mode)"
          />
        </div>
      )}
    </div>
  );
}

export default DisplayEditor;
