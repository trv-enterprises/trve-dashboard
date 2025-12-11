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
  Link
} from '@carbon/react';
import { TrashCan, Dashboard } from '@carbon/icons-react';
import apiClient from '../api/client';
import './DashboardsListPage.scss';

/**
 * DashboardsListPage Component
 *
 * Displays list of all dashboards with IBM Cloud-style design:
 * - Page header with title and description
 * - Search bar with filtering
 * - Sortable columns
 * - Click on row to edit, trash icon to delete
 */
function DashboardsListPage() {
  const navigate = useNavigate();
  const [dashboards, setDashboards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');

  // Fetch dashboards from API
  useEffect(() => {
    fetchDashboards();
  }, []);

  const fetchDashboards = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getDashboards({ include_datasources: true });

      if (data.dashboards) {
        setDashboards(data.dashboards);
      } else if (data.error) {
        setError(data.error);
      } else {
        setDashboards([]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    navigate('/design/dashboards/new');
  };

  const handleRowClick = (dashboard) => {
    navigate(`/design/dashboards/${dashboard.id}`);
  };

  const handleDelete = async (e, dashboard) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${dashboard.name}"?`)) {
      try {
        await apiClient.deleteDashboard(dashboard.id);
        fetchDashboards();
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

  const getPanelCount = (dashboard) => {
    if (!dashboard.panels || dashboard.panels.length === 0) {
      return '0 panels';
    }
    const count = dashboard.panels.length;
    return `${count} panel${count === 1 ? '' : 's'}`;
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

  // Filter and sort dashboards
  const filteredAndSortedDashboards = useMemo(() => {
    let result = [...dashboards];

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(dashboard =>
        dashboard.name?.toLowerCase().includes(term) ||
        dashboard.description?.toLowerCase().includes(term)
      );
    }

    // Sort
    result.sort((a, b) => {
      let aVal = a[sortKey] || '';
      let bVal = b[sortKey] || '';

      // Handle date sorting
      if (sortKey === 'updated') {
        aVal = new Date(aVal).getTime() || 0;
        bVal = new Date(bVal).getTime() || 0;
      } else if (sortKey === 'panels') {
        aVal = a.panels?.length || 0;
        bVal = b.panels?.length || 0;
      } else {
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [dashboards, searchTerm, sortKey, sortDirection]);

  const headers = [
    { key: 'name', header: 'Name', isSortable: true },
    { key: 'description', header: 'Description', isSortable: false },
    { key: 'panels', header: 'Panels', isSortable: true },
    { key: 'datasources', header: 'Data Sources', isSortable: false },
    { key: 'updated', header: 'Last modified', isSortable: true },
    { key: 'actions', header: '', isSortable: false }
  ];

  const getDatasourceNames = (dashboard) => {
    const names = dashboard.datasource_names || [];
    if (names.length === 0) return '-';
    return names.join(', ');
  };

  const rows = filteredAndSortedDashboards.map((dashboard) => ({
    id: dashboard.id,
    name: dashboard.name,
    description: dashboard.description || '',
    panels: getPanelCount(dashboard),
    datasources: getDatasourceNames(dashboard),
    updated: formatDate(dashboard.updated)
  }));

  const getDashboardById = (id) => dashboards.find(d => d.id === id);

  if (loading) {
    return (
      <div className="dashboards-list-page">
        <Loading description="Loading dashboards..." withOverlay={false} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboards-list-page">
        <div className="error-message">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="dashboards-list-page">
      {/* Page Header */}
      <div className="page-header">
        <h1>Dashboards</h1>
        <p className="page-description">
          Create and manage dashboards that combine layouts with charts and data visualizations.
          Dashboards can be viewed in real-time with auto-refresh capabilities.
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
                        <Dashboard size={64} />
                        <h3>No dashboards available</h3>
                        <p>
                          Looks like you haven't added any dashboards. Click{' '}
                          <Link href="#" onClick={(e) => { e.preventDefault(); handleCreate(); }}>Create</Link>
                          {' '}to get started.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => {
                    const dashboard = getDashboardById(row.id);
                    return (
                      <TableRow
                        {...getRowProps({ row })}
                        key={row.id}
                        onClick={() => handleRowClick(dashboard)}
                        className="clickable-row"
                      >
                        {row.cells.map((cell) => {
                          if (cell.info.header === 'actions') {
                            return (
                              <TableCell key={cell.id} className="actions-cell">
                                <IconButton
                                  kind="ghost"
                                  label="Delete"
                                  onClick={(e) => handleDelete(e, dashboard)}
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

export default DashboardsListPage;
