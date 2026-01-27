// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  MenuButton,
  MenuItem,
  Tile,
  ContentSwitcher,
  Switch,
  Tooltip
} from '@carbon/react';
import { TrashCan, ChartLineSmooth, List, Grid, Edit, DataBase, Information, Dashboard } from '@carbon/icons-react';
import AiIcon from '../components/icons/AiIcon';
import apiClient from '../api/client';
import ChartDeleteDialog from '../components/ChartDeleteDialog';
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
  const [charts, setCharts] = useState([]);
  const [datasources, setDatasources] = useState({});
  const [dashboardCounts, setDashboardCounts] = useState({}); // Map of chart_id -> dashboard count
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [chartToDelete, setChartToDelete] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'tile'

  // Fetch charts and data sources from API
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch charts, data sources, and dashboards in parallel
      const [chartsData, datasourcesData, dashboardsData] = await Promise.all([
        apiClient.getCharts(),
        apiClient.getDatasources(),
        apiClient.getDashboards()
      ]);

      if (chartsData.charts) {
        setCharts(chartsData.charts);
      } else if (chartsData.error) {
        setError(chartsData.error);
      } else {
        setCharts([]);
      }

      // Create a lookup map for data sources
      if (datasourcesData.datasources) {
        const dsMap = {};
        datasourcesData.datasources.forEach(ds => {
          dsMap[ds.id] = ds.name;
        });
        setDatasources(dsMap);
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
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // Filter and sort charts
  const filteredAndSortedCharts = useMemo(() => {
    let result = [...charts];

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(chart => {
        const dsName = datasources[chart.datasource_id] || '';
        return chart.name?.toLowerCase().includes(term) ||
          chart.description?.toLowerCase().includes(term) ||
          chart.chart_type?.toLowerCase().includes(term) ||
          dsName.toLowerCase().includes(term);
      });
    }

    // Sort
    result.sort((a, b) => {
      let aVal, bVal;

      // Handle datasource sorting (use name lookup)
      if (sortKey === 'datasource') {
        aVal = datasources[a.datasource_id] || '';
        bVal = datasources[b.datasource_id] || '';
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
  }, [charts, datasources, dashboardCounts, searchTerm, sortKey, sortDirection]);

  const headers = [
    { key: 'name', header: 'Name', isSortable: true },
    { key: 'chart_type', header: 'Type', isSortable: true },
    { key: 'datasource', header: 'Data Source', isSortable: true },
    { key: 'dashboards', header: 'Dashboards', isSortable: true },
    { key: 'status', header: 'Status', isSortable: true },
    { key: 'description', header: 'Description', isSortable: false },
    { key: 'updated', header: 'Last modified', isSortable: true },
    { key: 'actions', header: '', isSortable: false }
  ];

  const rows = filteredAndSortedCharts.map((chart) => ({
    id: chart.id,
    name: chart.name,
    chart_type: chart.chart_type,
    datasource: datasources[chart.datasource_id] || 'None',
    dashboards: dashboardCounts[chart.id] || 0,
    status: chart.status || 'draft',
    description: chart.description || '',
    updated: formatDate(chart.updated)
  }));

  const getChartById = (id) => charts.find(c => c.id === id);

  if (loading) {
    return (
      <div className="charts-list-page">
        <Loading description="Loading charts..." withOverlay={false} />
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
        <h1>Charts</h1>
        <p className="page-description">
          Create and manage reusable chart components for your dashboards.
          Charts can connect to data sources and be placed in multiple dashboards.
          {' '}<Link href="#" onClick={(e) => e.preventDefault()}>Learn more</Link>.
        </p>
      </div>

      {/* Toolbar */}
      <div className="page-toolbar">
        <div className="toolbar-left">
          <TableToolbarSearch
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search"
            persistent
          />
          <ContentSwitcher
            onChange={(e) => setViewMode(e.name)}
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
          <MenuButton
            label="Create"
            size="md"
            kind="primary"
          >
            <MenuItem
              label="Create"
              onClick={handleCreate}
            />
            <MenuItem
              label="Create with AI"
              renderIcon={AiIcon}
              onClick={handleCreateWithAI}
            />
          </MenuButton>
        </div>
      </div>

      {/* Tile View */}
      {viewMode === 'tile' && (
        <div className="charts-content">
          {filteredAndSortedCharts.length === 0 ? (
            <div className="empty-state">
              <ChartLineSmooth size={64} />
              <h3>No charts available</h3>
              <p>
                Looks like you haven't added any charts. Click{' '}
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
                      <Tag type={getChartTypeColor(chart.chart_type)} size="sm">
                        {chart.chart_type?.toUpperCase() || 'N/A'}
                      </Tag>
                      <Tag type={chart.status === 'final' ? 'green' : 'gray'} size="sm">
                        {chart.status === 'draft'
                          ? (chart.version > 0 ? `DRAFT (v${chart.version} saved)` : 'DRAFT')
                          : `V${chart.version || 0}`}
                      </Tag>
                    </div>

                    {datasources[chart.datasource_id] && (
                      <div className="tile-datasource">
                        <DataBase size={14} />
                        <span>{datasources[chart.datasource_id]}</span>
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
                          <h3>No charts available</h3>
                          <p>
                            Looks like you haven't added any charts. Click{' '}
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
    </div>
  );
}

export default ChartsListPage;
