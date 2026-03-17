// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useState } from 'react';
import {
  Modal,
  Select,
  SelectItem,
  Button,
  Loading,
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableSelectAll,
  TableSelectRow,
  TextInput,
  Tag,
  InlineNotification
} from '@carbon/react';
import { Search } from '@carbon/icons-react';
import apiClient from '../api/client';

function DeviceDiscoveryModal({ connections, deviceTypes, onImported, onClose }) {
  const [connectionId, setConnectionId] = useState(connections[0]?.id || '');
  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const [deviceNames, setDeviceNames] = useState({}); // friendly_name -> display name
  const [deviceRooms, setDeviceRooms] = useState({}); // friendly_name -> room
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);

  const handleDiscover = async () => {
    if (!connectionId) return;

    setDiscovering(true);
    setError(null);
    setDiscovered(null);

    try {
      const result = await apiClient.discoverDevices(connectionId);
      setDiscovered(result);
      // Pre-fill device names from friendly names
      const names = {};
      (result.devices || []).forEach(d => {
        names[d.friendly_name] = d.friendly_name;
      });
      setDeviceNames(names);
    } catch (err) {
      setError(err.message);
    } finally {
      setDiscovering(false);
    }
  };

  const handleImport = async () => {
    if (selectedRows.length === 0) return;

    setImporting(true);
    setError(null);

    try {
      const devices = selectedRows.map(friendlyName => {
        const disc = discovered.devices.find(d => d.friendly_name === friendlyName);
        return {
          friendly_name: friendlyName,
          device_type_id: disc?.suggested_type_id || deviceTypes[0]?.id || '',
          name: deviceNames[friendlyName] || friendlyName,
          room: deviceRooms[friendlyName] || ''
        };
      });

      await apiClient.importDevices(connectionId, devices);
      onImported();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const discoveredDevices = discovered?.devices || [];

  const headers = [
    { key: 'friendly_name', header: 'Device' },
    { key: 'model', header: 'Model' },
    { key: 'vendor', header: 'Vendor' },
    { key: 'suggested_type', header: 'Type' },
    { key: 'capabilities_count', header: 'Capabilities' },
    { key: 'status', header: 'Status' },
    { key: 'display_name', header: 'Display Name' },
    { key: 'room', header: 'Room' }
  ];

  const rows = discoveredDevices.map(d => ({
    id: d.friendly_name,
    friendly_name: d.friendly_name,
    model: d.model || '-',
    vendor: d.vendor || '-',
    suggested_type: d.suggested_type_id || 'unknown',
    capabilities_count: String(d.capabilities?.length || 0),
    status: d.already_imported ? 'imported' : 'new',
    display_name: d.friendly_name,
    room: ''
  }));

  return (
    <Modal
      open
      modalHeading="Discover Devices"
      primaryButtonText={
        !discovered ? 'Discover' :
        importing ? 'Importing...' :
        `Import Selected (${selectedRows.length})`
      }
      secondaryButtonText="Cancel"
      onRequestClose={onClose}
      onRequestSubmit={!discovered ? handleDiscover : handleImport}
      primaryButtonDisabled={
        discovering || importing ||
        (!discovered && !connectionId) ||
        (discovered && selectedRows.length === 0)
      }
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

      {!discovered ? (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <Select
            id="discover-connection"
            labelText="MQTT Connection"
            value={connectionId}
            onChange={e => setConnectionId(e.target.value)}
          >
            {connections.map(c => (
              <SelectItem key={c.id} value={c.id} text={c.name} />
            ))}
          </Select>

          <p style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>
            This will subscribe to <code>zigbee2mqtt/bridge/devices</code> to discover
            connected Zigbee devices. The broker must be running Zigbee2MQTT.
          </p>

          {discovering && (
            <Loading description="Discovering devices..." withOverlay={false} small />
          )}
        </div>
      ) : (
        <div>
          <p style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary)', marginBottom: '1rem' }}>
            Found {discoveredDevices.length} device(s) from {discovered.source}.
            Select devices to import and set display names.
          </p>

          <DataTable
            rows={rows}
            headers={headers}
            radio={false}
          >
            {({ rows, headers, getHeaderProps, getRowProps, getSelectionProps, getTableProps, selectedRows: tableSelectedRows }) => {
              // Sync Carbon's selection state
              if (tableSelectedRows) {
                const ids = tableSelectedRows.map(r => r.id);
                if (JSON.stringify(ids) !== JSON.stringify(selectedRows)) {
                  setSelectedRows(ids);
                }
              }

              return (
                <Table {...getTableProps()}>
                  <TableHead>
                    <TableRow>
                      <TableSelectAll {...getSelectionProps()} />
                      {headers.map(header => (
                        <TableHeader {...getHeaderProps({ header })} key={header.key}>
                          {header.header}
                        </TableHeader>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map(row => (
                      <TableRow {...getRowProps({ row })} key={row.id}>
                        <TableSelectRow
                          {...getSelectionProps({ row })}
                          disabled={discoveredDevices.find(d => d.friendly_name === row.id)?.already_imported}
                        />
                        {row.cells.map(cell => (
                          <TableCell key={cell.id}>
                            {cell.info.header === 'status' ? (
                              cell.value === 'imported'
                                ? <Tag type="green" size="sm">Imported</Tag>
                                : <Tag type="blue" size="sm">New</Tag>
                            ) : cell.info.header === 'suggested_type' ? (
                              <Tag type="purple" size="sm">
                                {deviceTypes.find(dt => dt.id === cell.value)?.name || cell.value}
                              </Tag>
                            ) : cell.info.header === 'display_name' ? (
                              <TextInput
                                id={`name-${row.id}`}
                                size="sm"
                                labelText=""
                                value={deviceNames[row.id] || ''}
                                onChange={e => setDeviceNames(prev => ({
                                  ...prev, [row.id]: e.target.value
                                }))}
                              />
                            ) : cell.info.header === 'room' ? (
                              <TextInput
                                id={`room-${row.id}`}
                                size="sm"
                                labelText=""
                                placeholder="Room"
                                value={deviceRooms[row.id] || ''}
                                onChange={e => setDeviceRooms(prev => ({
                                  ...prev, [row.id]: e.target.value
                                }))}
                              />
                            ) : (
                              cell.value
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              );
            }}
          </DataTable>
        </div>
      )}
    </Modal>
  );
}

export default DeviceDiscoveryModal;
