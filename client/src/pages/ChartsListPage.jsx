// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
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
  TableToolbarSearch,
  Button,
  IconButton,
  Loading,
  Tag,
  Link,
  Tile,
  ContentSwitcher,
  Switch,
  Tooltip,
  InlineNotification,
  Dropdown
} from '@carbon/react';
import { TrashCan, ChartLineSmooth, List, Grid, Edit, DataBase, Information, Dashboard, Keyboard } from '@carbon/icons-react';
import AiIcon from '../components/icons/AiIcon';
import apiClient from '../api/client';
import ChartDeleteDialog from '../components/ChartDeleteDialog';
import CreateMenu from '../components/CreateMenu';
import ComponentPickerModal from '../components/ComponentPickerModal';
import './ChartsListPage.scss';

/**
 * ChartsListPage Component
 *
 * Displays list of all standalone charts with IBM Cloud-style design:
 * - Page header with title and description
 * - Search bar with filtering
 * - Sortable columns
 * - Click on row to edit, trash icon to delete
 */
function ChartsListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize state from URL params (persist filters across navigation)
  const [charts, setCharts] = useState([]);
  const [connections, setConnections] = useState({});
  const [dashboardCounts, setDashboardCounts] = useState({}); // Map of chart_id -> dashboard count
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [sortKey, setSortKey] = useState(searchParams.get('sortKey') || 'name');
  const [sortDirection, setSortDirection] = useState(searchParams.get('sortDir') || 'asc');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [chartToDelete, setChartToDelete] = useState(null);
  const [viewMode, setViewMode] = useState(searchParams.get('view') || 'list'); // 'list' or 'tile'
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerCategory, setPickerCategory] = useState('chart');
  const [controlNotice, setControlNotice] = useState(null);
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || 'all'); // 'all', 'chart', 'control'
  const [connectionFilter, setConnectionFilter] = useState(searchParams.get('ds') || 'all'); // 'all' or connection id

  // Update URL params when filters change
  const updateSearchParams = useCallback((updates) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      Object.entries(updates).forEach(([key, value]) => {
        if (value && value !== 'all' && value !== 'name' && value !== 'asc' && value !== 'list' && value !== '') {
          newParams.set(key, value);
        } else {
          newParams.delete(key);
        }
      });
      return newParams;
    }, { replace: true });
  }, [setSearchParams]);

  // Fetch charts and data sources from API
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch charts, connections, and dashboards in parallel
      const [chartsData, connectionsData, dashboardsData] = await Promise.all([
        apiClient.getCharts(),
        apiClient.getConnections(),
        apiClient.getDashboards()
      ]);

      if (chartsData.charts) {
        setCharts(chartsData.charts);
      } else if (chartsData.error) {
        setError(chartsData.error);
      } else {
        setCharts([]);
      }

      // Create a lookup map for connections
      if (connectionsData.datasources) {
        const connMap = {};
        connectionsData.datasources.forEach(conn => {
          connMap[conn.id] = conn.name;
        });
        setConnections(connMap);
      }

      // Build dashboard count map by chart_id
      if (dashboardsData.dashboards) {
        const counts = {};
        dashboardsData.dashboards.forEach(dashboard => {
          // Each dashboard has panels, each panel can have a chart_id
          if (dashboard.panels) {
            dashboard.panels.forEach(panel => {
              if (panel.chart_id) {
                counts[panel.chart_id] = (counts[panel.chart_id] || 0) + 1;
              }
            });
          }
        });
        setDashboardCounts(counts);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCharts = async () => {
    fetchData();
  };

  const handleCreate = () => {
    navigate('/design/charts/new');
  };

  const handleCreateWithAI = () => {
    navigate('/design/charts/ai/new');
  };

  // Chart picker handlers
  const handleSelectChart = () => {
    setPickerCategory('chart');
    setPickerOpen(true);
  };

  const handlePickerSelect = (item) => {
    setPickerOpen(false);
    if (pickerCategory === 'chart') {
      navigate(`/design/charts/${item.id}`);
    } else {
      navigate(`/design/controls/${item.id}`);
    }
  };

  // Control handlers (future routes)
  const handleCreateControl = () => {
    setControlNotice('Controls feature is coming soon.');
  };

  const handleCreateControlAI = () => {
    setControlNotice('Controls feature is coming soon.');
  };

  const handleSelectControl = () => {
    setPickerCategory('control');
    setPickerOpen(true);
  };

  const handleRowClick = (chart) => {
    navigate(`/design/charts/${chart.id}`);
  };

  const handleAIEdit = (e, chart) => {
    e.stopPropagation();
    navigate(`/design/charts/ai/${chart.id}`);
  };

  const handleDelete = (e, chart) => {
    e.stopPropagation();
    setChartToDelete(chart);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    setDeleteDialogOpen(false);
    setChartToDelete(null);
    fetchCharts();
  };

  const handleDeleteClose = () => {
    setDeleteDialogOpen(false);
    setChartToDelete(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getChartTypeColor = (chartType) => {
    const colors = {
      'bar': 'blue',
      'line': 'green',
      'area': 'teal',
      'pie': 'purple',
      'scatter': 'magenta',
      'gauge': 'cyan',
      'custom': 'gray'
    };
    return colors[chartType?.toLowerCase()] || 'gray';
  };

  // Handle column sorting
  const handleSort = (key) => {
    let newDirection = 'asc';
    if (sortKey === key) {
      newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      setSortDirection(newDirection);
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
    updateSearchParams({ sortKey: key, sortDir: newDirection });
  };

  // Filter and sort components (charts + controls)
  const filteredAndSortedCharts = useMemo(() => {
    let result = [...charts];

    // Filter by component type (chart vs control)
    if (typeFilter !== 'all') {
      result = result.filter(item => {
        // For now, all items are charts. Controls will have component_type: 'control'
        const componentType = item.component_type || 'chart';
        return componentType === typeFilter;
      });
    }

    // Filter by connection
    if (connectionFilter !== 'all') {
      result = result.filter(item => (item.connection_id || item.datasource_id) === connectionFilter);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(chart => {
        const connName = connections[chart.connection_id || chart.datasource_id] || '';
        return chart.name?.toLowerCase().includes(term) ||
          chart.description?.toLowerCase().includes(term) ||
          chart.chart_type?.toLowerCase().includes(term) ||
          connName.toLowerCase().includes(term);
      });
    }

    // Sort - drafts first, then by selected sort key
    result.sort((a, b) => {
      // Primary sort: drafts come first
      const aIsDraft = (a.status || 'draft') === 'draft';
      const bIsDraft = (b.status || 'draft') === 'draft';
      if (aIsDraft && !bIsDraft) return -1;
      if (!aIsDraft && bIsDraft) return 1;

      // Secondary sort: by selected sort key
      let aVal, bVal;

      // Handle connection sorting (use name lookup)
      if (sortKey === 'connection') {
        aVal = connections[a.connection_id || a.datasource_id] || '';
        bVal = connections[b.connection_id || b.datasource_id] || '';
      } else if (sortKey === 'dashboards') {
        // Handle dashboards count sorting
        aVal = dashboardCounts[a.id] || 0;
        bVal = dashboardCounts[b.id] || 0;
      } else {
        aVal = a[sortKey] || '';
        bVal = b[sortKey] || '';
      }

      // Handle date sorting
      if (sortKey === 'updated') {
        aVal = new Date(aVal).getTime() || 0;
        bVal = new Date(bVal).getTime() || 0;
      } else if (sortKey !== 'dashboards') {
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [charts, connections, dashboardCounts, searchTerm, sortKey, sortDirection, typeFilter, connectionFilter]);

  const headers = [
    { key: 'name', header: 'Name', isSortable: true },
    { key: 'component_type', header: 'Component', isSortable: true },
    { key: 'chart_type', header: 'Type', isSortable: true },
    { key: 'connection', header: 'Connection', isSortable: true },
    { key: 'dashboards', header: 'Dashboards', isSortable: true },
    { key: 'status', header: 'Status', isSortable: true },
    { key: 'description', header: 'Description', isSortable: false },
    { key: 'updated', header: 'Last modified', isSortable: true },
    { key: 'actions', header: '', isSortable: false }
  ];

  const rows = filteredAndSortedCharts.map((chart) => ({
    id: chart.id,
    name: chart.name,
    component_type: chart.component_type || 'chart',
    chart_type: chart.chart_type,
    connection: connections[chart.connection_id || chart.datasource_id] || 'None',
    dashboards: dashboardCounts[chart.id] || 0,
    status: chart.status || 'draft',
    description: chart.description || '',
    updated: formatDate(chart.updated)
  }));

  const getChartById = (id) => charts.find(c => c.id === id);

  if (loading) {
    return (
      <div className="charts-list-page">
        <Loading description="Loading components..." withOverlay={false} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="charts-list-page">
        <div className="error-message">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="charts-list-page">
      {/* Page Header */}
      <div className="page-header">
        <h1>Components</h1>
        <p className="page-description">
          Create and manage reusable components for your dashboards.
          Components include charts for data visualization and controls for user interaction.
          {' '}<Link href="#" onClick={(e) => e.preventDefault()}>Learn more</Link>.
        </p>
      </div>

      {/* Toolbar */}
      <div className="page-toolbar">
        <div className="toolbar-left">
          <TableToolbarSearch
            onChange={(e) => {
              setSearchTerm(e.target.value);
              updateSearchParams({ search: e.target.value });
            }}
            placeholder="Search"
            persistent
            value={searchTerm}
          />
          <Dropdown
            id="type-filter"
            label="Filter by type"
            titleText=""
            items={[
              { id: 'all', text: 'All Components' },
              { id: 'chart', text: 'Charts' },
              { id: 'control', text: 'Controls' }
            ]}
            itemToString={(item) => item?.text || ''}
            selectedItem={{ id: typeFilter, text: typeFilter === 'all' ? 'All Components' : typeFilter === 'chart' ? 'Charts' : 'Controls' }}
            onChange={({ selectedItem }) => {
              const newType = selectedItem?.id || 'all';
              setTypeFilter(newType);
              updateSearchParams({ type: newType });
            }}
            size="md"
          />
          <Dropdown
            id="connection-filter"
            label="Filter by connection"
            titleText=""
            items={[
              { id: 'all', text: 'All Connections' },
              ...Object.entries(connections).map(([id, name]) => ({ id, text: name }))
            ]}
            itemToString={(item) => item?.text || ''}
            selectedItem={{ id: connectionFilter, text: connectionFilter === 'all' ? 'All Connections' : (connections[connectionFilter] || 'Unknown') }}
            onChange={({ selectedItem }) => {
              const newConn = selectedItem?.id || 'all';
              setConnectionFilter(newConn);
              updateSearchParams({ ds: newConn });
            }}
            size="md"
          />
          <ContentSwitcher
            onChange={(e) => {
              setViewMode(e.name);
              updateSearchParams({ view: e.name });
            }}
            selectedIndex={viewMode === 'list' ? 0 : 1}
            size="md"
          >
            <Switch name="list">
              <List size={16} />
            </Switch>
            <Switch name="tile">
              <Grid size={16} />
            </Switch>
          </ContentSwitcher>
        </div>
        <div className="toolbar-actions">
          <CreateMenu
            onCreateChart={handleCreate}
            onCreateChartAI={handleCreateWithAI}
            onSelectChart={handleSelectChart}
            onCreateControl={handleCreateControl}
            onCreateControlAI={handleCreateControlAI}
            onSelectControl={handleSelectControl}
          />
        </div>
      </div>

      {/* Tile View */}
      {viewMode === 'tile' && (
        <div className="charts-content">
          {filteredAndSortedCharts.length === 0 ? (
            <div className="empty-state">
              <ChartLineSmooth size={64} />
              <h3>No components available</h3>
              <p>
                Looks like you haven't added any components. Click{' '}
                <Link href="#" onClick={(e) => { e.preventDefault(); handleCreate(); }}>Create</Link>
                {' '}to get started.
              </p>
            </div>
          ) : (
            <div className="charts-grid">
              {filteredAndSortedCharts.map((chart) => (
                <Tile
                  key={chart.id}
                  className="chart-tile"
                  onClick={() => handleRowClick(chart)}
                >
                  {/* Thumbnail */}
                  <div className="tile-thumbnail">
                    {chart.thumbnail ? (
                      <img src={chart.thumbnail} alt={chart.name} />
                    ) : (
                      <div className="tile-thumbnail-placeholder">
                        <ChartLineSmooth size={48} />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="tile-content">
                    <div className="tile-header">
                      <h3>{chart.name}</h3>
                      {chart.description && (
                        <Tooltip label={chart.description} align="bottom">
                          <button type="button" className="info-button" onClick={(e) => e.stopPropagation()}>
                            <Information size={16} />
                          </button>
                        </Tooltip>
                      )}
                    </div>

                    <div className="tile-meta">
                      <Tag type={(chart.component_type || 'chart') === 'chart' ? 'blue' : 'purple'} size="sm">
                        {(chart.component_type || 'chart') === 'chart' ? 'CHART' : 'CONTROL'}
                      </Tag>
                      <Tag type={getChartTypeColor(chart.chart_type)} size="sm">
                        {chart.chart_type?.toUpperCase() || 'N/A'}
                      </Tag>
                      <Tag type={chart.status === 'final' ? 'green' : 'gray'} size="sm">
                        {chart.status === 'draft'
                          ? (chart.version > 0 ? `DRAFT (v${chart.version} saved)` : 'DRAFT')
                          : `V${chart.version || 0}`}
                      </Tag>
                    </div>

                    {connections[chart.connection_id || chart.datasource_id] && (
                      <div className="tile-connection">
                        <DataBase size={14} />
                        <span>{connections[chart.connection_id || chart.datasource_id]}</span>
                      </div>
                    )}

                    {dashboardCounts[chart.id] > 0 && (
                      <div className="tile-dashboards">
                        <Dashboard size={14} />
                        <span>{dashboardCounts[chart.id]} dashboard{dashboardCounts[chart.id] !== 1 ? 's' : ''}</span>
                      </div>
                    )}

                    <div className="tile-date">
                      Updated: {formatDate(chart.updated)}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="tile-actions">
                    <IconButton
                      kind="ghost"
                      label="Edit"
                      onClick={(e) => { e.stopPropagation(); handleRowClick(chart); }}
                      size="sm"
                    >
                      <Edit size={16} />
                    </IconButton>
                    <IconButton
                      kind="ghost"
                      label="Edit with AI"
                      onClick={(e) => handleAIEdit(e, chart)}
                      size="sm"
                    >
                      <AiIcon size={16} />
                    </IconButton>
                    <IconButton
                      kind="ghost"
                      label="Delete"
                      onClick={(e) => handleDelete(e, chart)}
                      size="sm"
                    >
                      <TrashCan size={16} />
                    </IconButton>
                  </div>
                </Tile>
              ))}
            </div>
          )}
        </div>
      )}

      {/* List View (DataTable) */}
      {viewMode === 'list' && (
        <DataTable rows={rows} headers={headers} isSortable>
          {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
            <TableContainer>
              <Table {...getTableProps()}>
                <TableHead>
                  <TableRow>
                    {headers.map((header) => (
                      <TableHeader
                        {...getHeaderProps({ header })}
                        key={header.key}
                        isSortable={header.isSortable}
                        isSortHeader={sortKey === header.key}
                        sortDirection={sortKey === header.key ? sortDirection.toUpperCase() : 'NONE'}
                        onClick={() => header.isSortable && handleSort(header.key)}
                      >
                        {header.header}
                      </TableHeader>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={headers.length}>
                        <div className="empty-state">
                          <ChartLineSmooth size={64} />
                          <h3>No components available</h3>
                          <p>
                            Looks like you haven't added any components. Click{' '}
                            <Link href="#" onClick={(e) => { e.preventDefault(); handleCreate(); }}>Create</Link>
                            {' '}to get started.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => {
                      const chart = getChartById(row.id);
                      return (
                        <TableRow
                          {...getRowProps({ row })}
                          key={row.id}
                          onClick={() => handleRowClick(chart)}
                          className="clickable-row"
                        >
                          {row.cells.map((cell) => {
                            if (cell.info.header === 'component_type') {
                              const isChart = cell.value === 'chart';
                              return (
                                <TableCell key={cell.id}>
                                  <Tag type={isChart ? 'blue' : 'purple'} size="md">
                                    {isChart ? 'CHART' : 'CONTROL'}
                                  </Tag>
                                </TableCell>
                              );
                            }
                            if (cell.info.header === 'chart_type') {
                              return (
                                <TableCell key={cell.id}>
                                  <Tag type={getChartTypeColor(cell.value)} size="md">
                                    {cell.value?.toUpperCase() || 'N/A'}
                                  </Tag>
                                </TableCell>
                              );
                            }
                            if (cell.info.header === 'status') {
                              const isDraft = cell.value === 'draft';
                              const chartVersion = chart?.version || 0;
                              const hasSavedVersion = isDraft && chartVersion > 0;
                              const statusColor = cell.value === 'final' ? 'green' : 'gray';
                              const statusLabel = isDraft
                                ? (hasSavedVersion ? `DRAFT (v${chartVersion} saved)` : 'DRAFT')
                                : `V${chartVersion}`;
                              return (
                                <TableCell key={cell.id}>
                                  <Tag type={statusColor} size="md">
                                    {statusLabel}
                                  </Tag>
                                </TableCell>
                              );
                            }
                            if (cell.info.header === 'actions') {
                              return (
                                <TableCell key={cell.id} className="actions-cell">
                                  <div className="actions-wrapper">
                                    <IconButton
                                      kind="ghost"
                                      label="Edit with AI"
                                      onClick={(e) => handleAIEdit(e, chart)}
                                      size="sm"
                                    >
                                      <AiIcon size={16} />
                                    </IconButton>
                                    <IconButton
                                      kind="ghost"
                                      label="Delete"
                                      onClick={(e) => handleDelete(e, chart)}
                                      size="sm"
                                    >
                                      <TrashCan size={16} />
                                    </IconButton>
                                  </div>
                                </TableCell>
                              );
                            }
                            return <TableCell key={cell.id}>{cell.value}</TableCell>;
                          })}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DataTable>
      )}

      {/* Delete Confirmation Dialog */}
      <ChartDeleteDialog
        open={deleteDialogOpen}
        chart={chartToDelete}
        onClose={handleDeleteClose}
        onDelete={handleDeleteConfirm}
      />

      {/* Component Picker Modal */}
      <ComponentPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handlePickerSelect}
        category={pickerCategory}
      />

      {/* Controls Coming Soon Notice */}
      {controlNotice && (
        <div className="control-notice">
          <InlineNotification
            kind="info"
            title="Coming Soon"
            subtitle={controlNotice}
            onCloseButtonClick={() => setControlNotice(null)}
            lowContrast
          />
        </div>
      )}
    </div>
  );
}

export default ChartsListPage;
