// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useState, useEffect } from 'react';
import {
  Modal,
  TextInput,
  Select,
  SelectItem,
  Toggle,
  InlineNotification
} from '@carbon/react';
import apiClient from '../api/client';

function DeviceEditor({ device, deviceTypes, connections, onSave, onClose }) {
  const isEdit = !!device;

  const [name, setName] = useState(device?.name || '');
  const [deviceTypeId, setDeviceTypeId] = useState(device?.device_type_id || '');
  const [connectionId, setConnectionId] = useState(device?.connection_id || '');
  const [target, setTarget] = useState(device?.target || '');
  const [stateTopic, setStateTopic] = useState(device?.state_topic || '');
  const [room, setRoom] = useState(device?.room || '');
  const [enabled, setEnabled] = useState(device?.enabled !== false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Auto-derive target and state topic from device type's topic pattern
  const selectedType = deviceTypes.find(dt => dt.id === deviceTypeId);

  useEffect(() => {
    if (!isEdit && selectedType?.topic_pattern && name) {
      const baseTopic = selectedType.topic_pattern.replace('{device_name}', name);
      setStateTopic(baseTopic);
      setTarget(baseTopic + '/set');
    }
  }, [deviceTypeId, name, isEdit, selectedType]);

  const handleSave = async () => {
    if (!name || !deviceTypeId || !connectionId || !target) {
      setError('Name, Device Type, Connection, and Target are required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (isEdit) {
        await apiClient.updateDevice(device.id, {
          name,
          device_type_id: deviceTypeId,
          connection_id: connectionId,
          target,
          state_topic: stateTopic,
          room,
          enabled
        });
      } else {
        await apiClient.createDevice({
          name,
          device_type_id: deviceTypeId,
          connection_id: connectionId,
          target,
          state_topic: stateTopic,
          room,
          enabled
        });
      }
      onSave();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      modalHeading={isEdit ? `Edit Device: ${device.name}` : 'New Device'}
      primaryButtonText={saving ? 'Saving...' : 'Save'}
      secondaryButtonText="Cancel"
      onRequestClose={onClose}
      onRequestSubmit={handleSave}
      primaryButtonDisabled={saving}
      size="md"
    >
      {error && (
        <InlineNotification
          kind="error"
          title="Error"
          subtitle={error}
          onClose={() => setError(null)}
          style={{ marginBottom: '1rem' }}
        />
      )}

      <div style={{ display: 'grid', gap: '1rem' }}>
        <TextInput
          id="device-name"
          labelText="Name"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g., Kitchen Plug"
        />

        <Select
          id="device-type"
          labelText="Device Type"
          value={deviceTypeId}
          onChange={e => setDeviceTypeId(e.target.value)}
        >
          <SelectItem value="" text="Select a device type..." />
          {deviceTypes.map(dt => (
            <SelectItem
              key={dt.id}
              value={dt.id}
              text={`${dt.name} (${dt.category})`}
            />
          ))}
        </Select>

        <Select
          id="device-connection"
          labelText="Connection"
          value={connectionId}
          onChange={e => setConnectionId(e.target.value)}
        >
          <SelectItem value="" text="Select a connection..." />
          {connections.map(c => (
            <SelectItem
              key={c.id}
              value={c.id}
              text={`${c.name} (${c.type})`}
            />
          ))}
        </Select>

        <TextInput
          id="device-target"
          labelText="Command Target"
          value={target}
          onChange={e => setTarget(e.target.value)}
          placeholder="e.g., zigbee2mqtt/kitchen_plug/set"
          helperText="MQTT topic to publish commands to"
        />

        <TextInput
          id="device-state-topic"
          labelText="State Topic"
          value={stateTopic}
          onChange={e => setStateTopic(e.target.value)}
          placeholder="e.g., zigbee2mqtt/kitchen_plug"
          helperText="MQTT topic to subscribe for state updates"
        />

        <TextInput
          id="device-room"
          labelText="Room"
          value={room}
          onChange={e => setRoom(e.target.value)}
          placeholder="e.g., Kitchen, Living Room"
        />

        <Toggle
          id="device-enabled"
          labelText="Enabled"
          labelA="Disabled"
          labelB="Enabled"
          toggled={enabled}
          onToggle={setEnabled}
        />
      </div>
    </Modal>
  );
}

export default DeviceEditor;
