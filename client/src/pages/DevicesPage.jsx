// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useState, useEffect, useCallback } from 'react';
import {
  Loading,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  DataTable,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableToolbar,
  TableToolbarContent,
  Button,
  Tag,
  InlineNotification,
  Modal,
  TextInput,
  Select,
  SelectItem,
  Toggle
} from '@carbon/react';
import { Add, TrashCan, Edit, Search as SearchIcon, Renew } from '@carbon/icons-react';
import apiClient from '../api/client';
import DeviceTypeEditor from '../components/DeviceTypeEditor';
import DeviceEditor from '../components/DeviceEditor';
import DeviceDiscoveryModal from '../components/DeviceDiscoveryModal';
import './DevicesPage.scss';

function DevicesPage() {
  // Devices state
  const [devices, setDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(true);

  // Device types state
  const [deviceTypes, setDeviceTypes] = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(true);

  // Connections for reference
  const [connections, setConnections] = useState([]);

  // UI state
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);

  // Modal states
  const [typeEditorOpen, setTypeEditorOpen] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [deviceEditorOpen, setDeviceEditorOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [discoveryOpen, setDiscoveryOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // { kind: 'device'|'device-type', item }

  const fetchDevices = useCallback(async () => {
    try {
      setLoadingDevices(true);
      const data = await apiClient.getDevices({ page_size: 100 });
      setDevices(data.devices || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingDevices(false);
    }
  }, []);

  const fetchDeviceTypes = useCallback(async () => {
    try {
      setLoadingTypes(true);
      const data = await apiClient.getDeviceTypes({ page_size: 100 });
      setDeviceTypes(data.device_types || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingTypes(false);
    }
  }, []);

  const fetchConnections = useCallback(async () => {
    try {
      const data = await apiClient.getConnections();
      setConnections(data.datasources || []);
    } catch (err) {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    fetchDevices();
    fetchDeviceTypes();
    fetchConnections();
  }, [fetchDevices, fetchDeviceTypes, fetchConnections]);

  const getTypeName = (typeId) => {
    const dt = deviceTypes.find(t => t.id === typeId);
    return dt ? dt.name : typeId;
  };

  const getConnectionName = (connId) => {
    const conn = connections.find(c => c.id === connId);
    return conn ? conn.name : connId;
  };

  const hasMQTTConnections = connections.some(c => c.type === 'mqtt');

  // Delete handlers
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.kind === 'device') {
        await apiClient.deleteDevice(deleteTarget.item.id);
        setNotification({ kind: 'success', title: 'Device deleted' });
        fetchDevices();
      } else {
        await apiClient.deleteDeviceType(deleteTarget.item.id);
        setNotification({ kind: 'success', title: 'Device type deleted' });
        fetchDeviceTypes();
      }
    } catch (err) {
      setNotification({ kind: 'error', title: 'Delete failed', subtitle: err.message });
    } finally {
      setDeleteModalOpen(false);
      setDeleteTarget(null);
    }
  };

  // Device type save handler
  const handleTypeSaved = () => {
    setTypeEditorOpen(false);
    setEditingType(null);
    fetchDeviceTypes();
    setNotification({ kind: 'success', title: 'Device type saved' });
  };

  // Device save handler
  const handleDeviceSaved = () => {
    setDeviceEditorOpen(false);
    setEditingDevice(null);
    fetchDevices();
    setNotification({ kind: 'success', title: 'Device saved' });
  };

  // Discovery import handler
  const handleDiscoveryImported = () => {
    setDiscoveryOpen(false);
    fetchDevices();
    setNotification({ kind: 'success', title: 'Devices imported' });
  };

  // Device type table
  const typeHeaders = [
    { key: 'name', header: 'Name' },
    { key: 'category', header: 'Category' },
    { key: 'subtype', header: 'Subtype' },
    { key: 'protocol', header: 'Protocol' },
    { key: 'capabilities', header: 'Capabilities' },
    { key: 'built_in', header: 'Type' },
    { key: 'actions', header: '' }
  ];

  const typeRows = deviceTypes.map(dt => ({
    id: dt.id,
    name: dt.name,
    category: dt.category,
    subtype: dt.subtype || '-',
    protocol: dt.protocol,
    capabilities: String(dt.capabilities?.length || 0),
    built_in: dt.is_built_in ? 'built-in' : 'custom',
    actions: dt.id,
    _raw: dt
  }));

  // Device table
  const deviceHeaders = [
    { key: 'name', header: 'Name' },
    { key: 'type', header: 'Type' },
    { key: 'connection', header: 'Connection' },
    { key: 'room', header: 'Room' },
    { key: 'target', header: 'Target' },
    { key: 'enabled', header: 'Enabled' },
    { key: 'actions', header: '' }
  ];

  const deviceRows = devices.map(d => ({
    id: d.id,
    name: d.name,
    type: getTypeName(d.device_type_id),
    connection: getConnectionName(d.connection_id),
    room: d.room || '-',
    target: d.target,
    enabled: d.enabled ? 'Yes' : 'No',
    actions: d.id,
    _raw: d
  }));

  const renderCellContent = (cell, row) => {
    if (cell.info.header === 'built_in') {
      return cell.value === 'built-in'
        ? <Tag type="blue" size="sm">Built-in</Tag>
        : <Tag type="gray" size="sm">Custom</Tag>;
    }
    if (cell.info.header === 'category') {
      return <Tag type="purple" size="sm">{cell.value}</Tag>;
    }
    if (cell.info.header === 'protocol') {
      return <Tag type="teal" size="sm">{cell.value}</Tag>;
    }
    if (cell.info.header === 'enabled') {
      return cell.value === 'Yes'
        ? <Tag type="green" size="sm">Enabled</Tag>
        : <Tag type="gray" size="sm">Disabled</Tag>;
    }
    if (cell.info.header === 'actions') {
      const rawItem = row.cells.find(c => c.info.header === 'name');
      return null; // Actions handled by row click
    }
    return cell.value;
  };

  if (loadingDevices && loadingTypes) {
    return <Loading description="Loading devices..." withOverlay={false} />;
  }

  return (
    <div className="devices-page">
      <div className="devices-page-header">
        <h2>Devices</h2>
      </div>

      {notification && (
        <InlineNotification
          kind={notification.kind}
          title={notification.title}
          subtitle={notification.subtitle}
          onClose={() => setNotification(null)}
          style={{ marginBottom: '1rem' }}
        />
      )}

      {error && (
        <InlineNotification
          kind="error"
          title="Error"
          subtitle={error}
          onClose={() => setError(null)}
          style={{ marginBottom: '1rem' }}
        />
      )}

      <Tabs>
        <TabList aria-label="Device management tabs">
          <Tab>Devices ({devices.length})</Tab>
          <Tab>Device Types ({deviceTypes.length})</Tab>
        </TabList>
        <TabPanels>
          {/* Devices Tab */}
          <TabPanel>
            <DataTable rows={deviceRows} headers={deviceHeaders} isSortable>
              {({ rows, headers, getHeaderProps, getRowProps, getTableProps }) => (
                <TableContainer>
                  <TableToolbar>
                    <TableToolbarContent>
                      {hasMQTTConnections && (
                        <Button
                          kind="secondary"
                          size="sm"
                          renderIcon={SearchIcon}
                          onClick={() => setDiscoveryOpen(true)}
                        >
                          Discover Devices
                        </Button>
                      )}
                      <Button
                        kind="primary"
                        size="sm"
                        renderIcon={Add}
                        onClick={() => {
                          setEditingDevice(null);
                          setDeviceEditorOpen(true);
                        }}
                      >
                        Add Device
                      </Button>
                    </TableToolbarContent>
                  </TableToolbar>
                  <Table {...getTableProps()}>
                    <TableHead>
                      <TableRow>
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
                          {row.cells.map(cell => (
                            <TableCell key={cell.id}>
                              {cell.info.header === 'actions' ? (
                                <div className="row-actions">
                                  <Button
                                    kind="ghost"
                                    size="sm"
                                    hasIconOnly
                                    renderIcon={Edit}
                                    iconDescription="Edit"
                                    onClick={() => {
                                      const device = devices.find(d => d.id === row.id);
                                      setEditingDevice(device);
                                      setDeviceEditorOpen(true);
                                    }}
                                  />
                                  <Button
                                    kind="ghost"
                                    size="sm"
                                    hasIconOnly
                                    renderIcon={TrashCan}
                                    iconDescription="Delete"
                                    onClick={() => {
                                      const device = devices.find(d => d.id === row.id);
                                      setDeleteTarget({ kind: 'device', item: device });
                                      setDeleteModalOpen(true);
                                    }}
                                  />
                                </div>
                              ) : (
                                renderCellContent(cell, row)
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </DataTable>
            {devices.length === 0 && !loadingDevices && (
              <div className="empty-state">
                No devices configured. Add devices manually or discover them from an MQTT connection.
              </div>
            )}
          </TabPanel>

          {/* Device Types Tab */}
          <TabPanel>
            <DataTable rows={typeRows} headers={typeHeaders} isSortable>
              {({ rows, headers, getHeaderProps, getRowProps, getTableProps }) => (
                <TableContainer>
                  <TableToolbar>
                    <TableToolbarContent>
                      <Button
                        kind="primary"
                        size="sm"
                        renderIcon={Add}
                        onClick={() => {
                          setEditingType(null);
                          setTypeEditorOpen(true);
                        }}
                      >
                        Add Device Type
                      </Button>
                    </TableToolbarContent>
                  </TableToolbar>
                  <Table {...getTableProps()}>
                    <TableHead>
                      <TableRow>
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
                          {row.cells.map(cell => (
                            <TableCell key={cell.id}>
                              {cell.info.header === 'actions' ? (
                                <div className="row-actions">
                                  {!deviceTypes.find(dt => dt.id === row.id)?.is_built_in && (
                                    <>
                                      <Button
                                        kind="ghost"
                                        size="sm"
                                        hasIconOnly
                                        renderIcon={Edit}
                                        iconDescription="Edit"
                                        onClick={() => {
                                          const dt = deviceTypes.find(t => t.id === row.id);
                                          setEditingType(dt);
                                          setTypeEditorOpen(true);
                                        }}
                                      />
                                      <Button
                                        kind="ghost"
                                        size="sm"
                                        hasIconOnly
                                        renderIcon={TrashCan}
                                        iconDescription="Delete"
                                        onClick={() => {
                                          const dt = deviceTypes.find(t => t.id === row.id);
                                          setDeleteTarget({ kind: 'device-type', item: dt });
                                          setDeleteModalOpen(true);
                                        }}
                                      />
                                    </>
                                  )}
                                </div>
                              ) : (
                                renderCellContent(cell, row)
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </DataTable>
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Device Type Editor Modal */}
      {typeEditorOpen && (
        <DeviceTypeEditor
          deviceType={editingType}
          onSave={handleTypeSaved}
          onClose={() => { setTypeEditorOpen(false); setEditingType(null); }}
        />
      )}

      {/* Device Editor Modal */}
      {deviceEditorOpen && (
        <DeviceEditor
          device={editingDevice}
          deviceTypes={deviceTypes}
          connections={connections}
          onSave={handleDeviceSaved}
          onClose={() => { setDeviceEditorOpen(false); setEditingDevice(null); }}
        />
      )}

      {/* Device Discovery Modal */}
      {discoveryOpen && (
        <DeviceDiscoveryModal
          connections={connections.filter(c => c.type === 'mqtt')}
          deviceTypes={deviceTypes}
          onImported={handleDiscoveryImported}
          onClose={() => setDiscoveryOpen(false)}
        />
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteModalOpen}
        danger
        modalHeading={`Delete ${deleteTarget?.kind === 'device' ? 'device' : 'device type'}?`}
        primaryButtonText="Delete"
        secondaryButtonText="Cancel"
        onRequestClose={() => { setDeleteModalOpen(false); setDeleteTarget(null); }}
        onRequestSubmit={handleDeleteConfirm}
      >
        <p>
          Are you sure you want to delete <strong>{deleteTarget?.item?.name}</strong>?
          This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

export default DevicesPage;
