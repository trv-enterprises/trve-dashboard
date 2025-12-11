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
  Link
} from '@carbon/react';
import { TrashCan, DataBase } from '@carbon/icons-react';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');

  // Fetch data sources from API
  useEffect(() => {
    fetchDatasources();
  }, []);

  const fetchDatasources = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getDatasources();

      if (data.datasources) {
        setDatasources(data.datasources);
      } else if (data.error) {
        setError(data.error);
      } else {
        setDatasources([]);
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
      let aVal = a[sortKey] || '';
      let bVal = b[sortKey] || '';

      // Handle date sorting
      if (sortKey === 'updated_at') {
        aVal = new Date(aVal).getTime() || 0;
        bVal = new Date(bVal).getTime() || 0;
      } else {
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [datasources, searchTerm, sortKey, sortDirection]);

  const headers = [
    { key: 'name', header: 'Name', isSortable: true },
    { key: 'type', header: 'Type', isSortable: true },
    { key: 'description', header: 'Description', isSortable: false },
    { key: 'updated_at', header: 'Last modified', isSortable: true },
    { key: 'actions', header: '', isSortable: false }
  ];

  const rows = filteredAndSortedDatasources.map((datasource) => ({
    id: datasource.id,
    name: datasource.name,
    type: datasource.type,
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

      {/* Data Table with Toolbar */}
      <DataTable rows={rows} headers={headers} isSortable>
        {({ rows, headers, getTableProps, getHeaderProps, getRowProps, onInputChange }) => (
          <TableContainer>
            <TableToolbar>
              <TableToolbarContent>
                <TableToolbarSearch
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    onInputChange(e);
                  }}
                  placeholder="Search"
                  persistent
                />
                <Button
                  onClick={handleCreate}
                  size="md"
                  kind="primary"
                >
                  Create
                </Button>
              </TableToolbarContent>
            </TableToolbar>
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
    </div>
  );
}

export default DatasourcesPage;
