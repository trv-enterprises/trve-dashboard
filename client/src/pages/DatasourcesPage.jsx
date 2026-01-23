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
  Tile,
  ContentSwitcher,
  Switch,
  Tooltip
} from '@carbon/react';
import { TrashCan, DataBase, List, Grid, Edit, Information, Sql, Api, Document, NetworkEnterprise, ChartLineSmooth } from '@carbon/icons-react';
import apiClient from '../api/client';
import './DatasourcesPage.scss';

/**
 * DatasourcesPage Component
 *
 * Displays list of all data sources with IBM Cloud-style design:
 * - Page header with title and description
 * - Search bar with filtering
 * - Sortable columns
 * - Click on row to edit, trash icon to delete
 */
function DatasourcesPage() {
  const navigate = useNavigate();
  const [datasources, setDatasources] = useState([]);
  const [chartCounts, setChartCounts] = useState({}); // Map of datasource_id -> chart count
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'tile'

  // Get icon for datasource type
  const getTypeIcon = (type) => {
    const icons = {
      'sql': Sql,
      'api': Api,
      'csv': Document,
      'socket': NetworkEnterprise
    };
    return icons[type?.toLowerCase()] || DataBase;
  };

  // Fetch data sources from API
  useEffect(() => {
    fetchDatasources();
  }, []);

  const fetchDatasources = async () => {
    try {
      setLoading(true);
      // Fetch data sources and charts in parallel
      const [datasourcesData, chartsData] = await Promise.all([
        apiClient.getDatasources(),
        apiClient.getCharts()
      ]);

      if (datasourcesData.datasources) {
        setDatasources(datasourcesData.datasources);
      } else if (datasourcesData.error) {
        setError(datasourcesData.error);
      } else {
        setDatasources([]);
      }

      // Build chart count map by datasource_id
      if (chartsData.charts) {
        const counts = {};
        chartsData.charts.forEach(chart => {
          if (chart.datasource_id) {
            counts[chart.datasource_id] = (counts[chart.datasource_id] || 0) + 1;
          }
        });
        setChartCounts(counts);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    navigate('/design/datasources/new');
  };

  const handleRowClick = (datasource) => {
    navigate(`/design/datasources/${datasource.id}`);
  };

  const handleDelete = async (e, datasource) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${datasource.name}"?`)) {
      try {
        await apiClient.deleteDatasource(datasource.id);
        fetchDatasources();
      } catch (err) {
        alert(`Error: ${err.message}`);
      }
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getTypeColor = (type) => {
    const colors = {
      'sql': 'blue',
      'api': 'green',
      'csv': 'purple',
      'socket': 'cyan'
    };
    return colors[type?.toLowerCase()] || 'gray';
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

  // Filter and sort data sources
  const filteredAndSortedDatasources = useMemo(() => {
    let result = [...datasources];

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(datasource =>
        datasource.name?.toLowerCase().includes(term) ||
        datasource.description?.toLowerCase().includes(term) ||
        datasource.type?.toLowerCase().includes(term)
      );
    }

    // Sort
    result.sort((a, b) => {
      let aVal, bVal;

      // Handle charts count sorting
      if (sortKey === 'charts') {
        aVal = chartCounts[a.id] || 0;
        bVal = chartCounts[b.id] || 0;
      } else {
        aVal = a[sortKey] || '';
        bVal = b[sortKey] || '';
      }

      // Handle date sorting
      if (sortKey === 'updated_at') {
        aVal = new Date(aVal).getTime() || 0;
        bVal = new Date(bVal).getTime() || 0;
      } else if (sortKey !== 'charts') {
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [datasources, chartCounts, searchTerm, sortKey, sortDirection]);

  const headers = [
    { key: 'name', header: 'Name', isSortable: true },
    { key: 'type', header: 'Type', isSortable: true },
    { key: 'charts', header: 'Charts', isSortable: true },
    { key: 'description', header: 'Description', isSortable: false },
    { key: 'updated_at', header: 'Last modified', isSortable: true },
    { key: 'actions', header: '', isSortable: false }
  ];

  const rows = filteredAndSortedDatasources.map((datasource) => ({
    id: datasource.id,
    name: datasource.name,
    type: datasource.type,
    charts: chartCounts[datasource.id] || 0,
    description: datasource.description || '',
    updated_at: formatDate(datasource.updated_at)
  }));

  const getDatasourceById = (id) => datasources.find(d => d.id === id);

  if (loading) {
    return (
      <div className="datasources-page">
        <Loading description="Loading data sources..." withOverlay={false} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="datasources-page">
        <div className="error-message">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="datasources-page">
      {/* Page Header */}
      <div className="page-header">
        <h1>Data Sources</h1>
        <p className="page-description">
          Configure connections to SQL databases, REST APIs, CSV files, and WebSocket streams.
          Data sources provide the data that powers your chart visualizations.
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
          <Button
            onClick={handleCreate}
            size="md"
            kind="primary"
          >
            Create
          </Button>
        </div>
      </div>

      {/* Tile View */}
      {viewMode === 'tile' && (
        <div className="datasources-content">
          {filteredAndSortedDatasources.length === 0 ? (
            <div className="empty-state">
              <DataBase size={64} />
              <h3>No data sources available</h3>
              <p>
                Looks like you haven't added any data sources. Click{' '}
                <Link href="#" onClick={(e) => { e.preventDefault(); handleCreate(); }}>Create</Link>
                {' '}to get started.
              </p>
            </div>
          ) : (
            <div className="datasources-grid">
              {filteredAndSortedDatasources.map((datasource) => {
                const TypeIcon = getTypeIcon(datasource.type);
                return (
                  <Tile
                    key={datasource.id}
                    className="datasource-tile"
                    onClick={() => handleRowClick(datasource)}
                  >
                    {/* Icon Header */}
                    <div className="tile-icon-header">
                      <TypeIcon size={48} />
                    </div>

                    {/* Content */}
                    <div className="tile-content">
                      <div className="tile-header">
                        <h3>{datasource.name}</h3>
                        {datasource.description && (
                          <Tooltip label={datasource.description} align="bottom">
                            <button type="button" className="info-button" onClick={(e) => e.stopPropagation()}>
                              <Information size={16} />
                            </button>
                          </Tooltip>
                        )}
                      </div>

                      <div className="tile-meta">
                        <Tag type={getTypeColor(datasource.type)} size="sm">
                          {datasource.type?.toUpperCase() || 'N/A'}
                        </Tag>
                      </div>

                      {chartCounts[datasource.id] > 0 && (
                        <div className="tile-charts">
                          <ChartLineSmooth size={14} />
                          <span>{chartCounts[datasource.id]} chart{chartCounts[datasource.id] !== 1 ? 's' : ''}</span>
                        </div>
                      )}

                      <div className="tile-date">
                        Updated: {formatDate(datasource.updated_at)}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="tile-actions">
                      <IconButton
                        kind="ghost"
                        label="Edit"
                        onClick={(e) => { e.stopPropagation(); handleRowClick(datasource); }}
                        size="sm"
                      >
                        <Edit size={16} />
                      </IconButton>
                      <IconButton
                        kind="ghost"
                        label="Delete"
                        onClick={(e) => handleDelete(e, datasource)}
                        size="sm"
                      >
                        <TrashCan size={16} />
                      </IconButton>
                    </div>
                  </Tile>
                );
              })}
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
                          <DataBase size={64} />
                          <h3>No data sources available</h3>
                          <p>
                            Looks like you haven't added any data sources. Click{' '}
                            <Link href="#" onClick={(e) => { e.preventDefault(); handleCreate(); }}>Create</Link>
                            {' '}to get started.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => {
                      const datasource = getDatasourceById(row.id);
                      return (
                        <TableRow
                          {...getRowProps({ row })}
                          key={row.id}
                          onClick={() => handleRowClick(datasource)}
                          className="clickable-row"
                        >
                          {row.cells.map((cell) => {
                            if (cell.info.header === 'type') {
                              return (
                                <TableCell key={cell.id}>
                                  <Tag type={getTypeColor(cell.value)} size="md">
                                    {cell.value?.toUpperCase() || 'N/A'}
                                  </Tag>
                                </TableCell>
                              );
                            }
                            if (cell.info.header === 'actions') {
                              return (
                                <TableCell key={cell.id} className="actions-cell">
                                  <IconButton
                                    kind="ghost"
                                    label="Delete"
                                    onClick={(e) => handleDelete(e, datasource)}
                                    size="sm"
                                  >
                                    <TrashCan size={16} />
                                  </IconButton>
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
    </div>
  );
}

export default DatasourcesPage;
