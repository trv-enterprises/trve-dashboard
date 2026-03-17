// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useState, useEffect } from 'react';
import {
  Modal,
  TextInput,
  Select,
  SelectItem,
  Button,
  InlineNotification,
  NumberInput,
  Tag
} from '@carbon/react';
import { Add, TrashCan } from '@carbon/icons-react';
import apiClient from '../api/client';

const CATEGORIES = ['switch', 'light', 'sensor', 'thermostat', 'cover', 'other'];
const PROTOCOLS = ['mqtt', 'websocket-json'];
const CAPABILITY_TYPES = ['binary', 'numeric', 'enum', 'text'];

function DeviceTypeEditor({ deviceType, onSave, onClose }) {
  const isEdit = !!deviceType;

  const [id, setId] = useState(deviceType?.id || '');
  const [name, setName] = useState(deviceType?.name || '');
  const [description, setDescription] = useState(deviceType?.description || '');
  const [category, setCategory] = useState(deviceType?.category || 'switch');
  const [subtype, setSubtype] = useState(deviceType?.subtype || '');
  const [protocol, setProtocol] = useState(deviceType?.protocol || 'mqtt');
  const [topicPattern, setTopicPattern] = useState(deviceType?.topic_pattern || '');
  const [capabilities, setCapabilities] = useState(deviceType?.capabilities || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Auto-generate ID from name
  useEffect(() => {
    if (!isEdit && name) {
      setId(name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
    }
  }, [name, isEdit]);

  const addCapability = () => {
    setCapabilities([...capabilities, {
      name: '',
      type: 'binary',
      access: 7,
      description: '',
      state_path: ''
    }]);
  };

  const updateCapability = (index, field, value) => {
    const updated = [...capabilities];
    updated[index] = { ...updated[index], [field]: value };
    // Auto-set state_path from name
    if (field === 'name' && value) {
      updated[index].state_path = '$.' + value;
    }
    setCapabilities(updated);
  };

  const removeCapability = (index) => {
    setCapabilities(capabilities.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!id || !name || !category || !protocol) {
      setError('ID, Name, Category, and Protocol are required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (isEdit) {
        await apiClient.updateDeviceType(deviceType.id, {
          name,
          description,
          category,
          subtype,
          protocol,
          topic_pattern: topicPattern,
          capabilities
        });
      } else {
        await apiClient.createDeviceType({
          id,
          name,
          description,
          category,
          subtype,
          protocol,
          schema_ids: [],
          topic_pattern: topicPattern,
          capabilities
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
      modalHeading={isEdit ? `Edit Device Type: ${deviceType.name}` : 'New Device Type'}
      primaryButtonText={saving ? 'Saving...' : 'Save'}
      secondaryButtonText="Cancel"
      onRequestClose={onClose}
      onRequestSubmit={handleSave}
      primaryButtonDisabled={saving}
      size="lg"
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <TextInput
            id="dt-id"
            labelText="ID"
            value={id}
            onChange={e => setId(e.target.value)}
            disabled={isEdit}
            helperText="Unique slug identifier"
          />
          <TextInput
            id="dt-name"
            labelText="Name"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        <TextInput
          id="dt-description"
          labelText="Description"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          <Select
            id="dt-category"
            labelText="Category"
            value={category}
            onChange={e => setCategory(e.target.value)}
          >
            {CATEGORIES.map(c => (
              <SelectItem key={c} value={c} text={c.charAt(0).toUpperCase() + c.slice(1)} />
            ))}
          </Select>
          <TextInput
            id="dt-subtype"
            labelText="Subtype"
            value={subtype}
            onChange={e => setSubtype(e.target.value)}
            placeholder="e.g., plug, dimmer"
          />
          <Select
            id="dt-protocol"
            labelText="Protocol"
            value={protocol}
            onChange={e => setProtocol(e.target.value)}
          >
            {PROTOCOLS.map(p => (
              <SelectItem key={p} value={p} text={p} />
            ))}
          </Select>
        </div>

        <TextInput
          id="dt-topic-pattern"
          labelText="Topic Pattern"
          value={topicPattern}
          onChange={e => setTopicPattern(e.target.value)}
          placeholder="e.g., zigbee2mqtt/{device_name}"
          helperText="Use {device_name} as placeholder"
        />

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>
              Capabilities ({capabilities.length})
            </span>
            <Button kind="ghost" size="sm" renderIcon={Add} onClick={addCapability}>
              Add Capability
            </Button>
          </div>

          {capabilities.map((cap, index) => (
            <div
              key={index}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr auto',
                gap: '0.5rem',
                marginBottom: '0.5rem',
                alignItems: 'end'
              }}
            >
              <TextInput
                id={`cap-name-${index}`}
                labelText={index === 0 ? 'Name' : ''}
                size="sm"
                value={cap.name}
                onChange={e => updateCapability(index, 'name', e.target.value)}
                placeholder="state, brightness..."
              />
              <Select
                id={`cap-type-${index}`}
                labelText={index === 0 ? 'Type' : ''}
                size="sm"
                value={cap.type}
                onChange={e => updateCapability(index, 'type', e.target.value)}
              >
                {CAPABILITY_TYPES.map(t => (
                  <SelectItem key={t} value={t} text={t} />
                ))}
              </Select>
              <TextInput
                id={`cap-access-${index}`}
                labelText={index === 0 ? 'Access' : ''}
                size="sm"
                value={String(cap.access)}
                onChange={e => updateCapability(index, 'access', parseInt(e.target.value) || 0)}
                helperText="1=R 2=W 4=Report"
              />
              <Button
                kind="ghost"
                size="sm"
                hasIconOnly
                renderIcon={TrashCan}
                iconDescription="Remove"
                onClick={() => removeCapability(index)}
              />
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

export default DeviceTypeEditor;
