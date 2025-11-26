import { useState, useEffect } from 'react';
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
  Button,
  OverflowMenu,
  OverflowMenuItem,
  Loading
} from '@carbon/react';
import { Add } from '@carbon/icons-react';
import './DashboardsListPage.scss';

/**
 * DashboardsListPage Component
 *
 * Displays list of all dashboards with CRUD operations.
 * Shows: Name, Description, Datasources (comma-separated), Last Modified
 * Actions: Create, View, Edit, Delete (via three-dot menu)
 */
function DashboardsListPage() {
  const navigate = useNavigate();
  const [dashboards, setDashboards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch dashboards from API
  useEffect(() => {
    fetchDashboards();
  }, []);

  const fetchDashboards = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/dashboards?page=1&page_size=100');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Dashboards response:', data);

      // Go API returns dashboards directly, not wrapped in success/data
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

  const handleView = (dashboard) => {
    navigate(`/design/dashboards/${dashboard.id}`);
  };

  const handleEdit = (dashboard) => {
    navigate(`/design/dashboards/${dashboard.id}`);
  };

  const handleDelete = async (dashboard) => {
    // TODO: Add confirmation dialog
    if (window.confirm(`Are you sure you want to delete "${dashboard.name}"?`)) {
      try {
        const response = await fetch(`http://localhost:3001/api/dashboards/${dashboard.id}`, {
          method: 'DELETE'
        });
        const data = await response.json();

        if (data.success) {
          fetchDashboards(); // Refresh list
        } else {
          alert(`Failed to delete: ${data.error}`);
        }
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

  // Extract unique datasource IDs from dashboard components
  const getDatasources = (dashboard) => {
    if (!dashboard.components || dashboard.components.length === 0) {
      return 'None';
    }
    // TODO: This would need to be enriched with actual datasource names
    // For now, we'll return a placeholder
    const uniqueDatasources = new Set();
    dashboard.components.forEach(comp => {
      if (comp.datasourceId) {
        uniqueDatasources.add(comp.datasourceId);
      }
    });
    return uniqueDatasources.size > 0
      ? Array.from(uniqueDatasources).join(', ')
      : 'None';
  };

  const headers = [
    { key: 'name', header: 'Name' },
    { key: 'description', header: 'Description' },
    { key: 'datasources', header: 'Datasources' },
    { key: 'updated', header: 'Last Modified' },
    { key: 'actions', header: 'Actions' }
  ];

  const rows = dashboards.map((dashboard) => ({
    id: dashboard.id,
    name: dashboard.name,
    description: dashboard.description || 'No description',
    datasources: getDatasources(dashboard),
    updated: formatDate(dashboard.updated)
  }));

  // Helper to find original dashboard by row id
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
      <div className="page-header">
        <h1>Dashboards</h1>
        <Button
          renderIcon={Add}
          onClick={handleCreate}
          size="md"
        >
          Create Dashboard
        </Button>
      </div>

      <DataTable rows={rows} headers={headers}>
        {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
          <TableContainer>
            <Table {...getTableProps()}>
              <TableHead>
                <TableRow>
                  {headers.map((header) => (
                    <TableHeader {...getHeaderProps({ header })} key={header.key}>
                      {header.header}
                    </TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow {...getRowProps({ row })} key={row.id}>
                    {row.cells.map((cell) => {
                      if (cell.info.header === 'actions') {
                        const dashboard = getDashboardById(row.id);
                        return (
                          <TableCell key={cell.id}>
                            <OverflowMenu flipped size="sm">
                              <OverflowMenuItem
                                itemText="View"
                                onClick={() => handleView(dashboard)}
                              />
                              <OverflowMenuItem
                                itemText="Edit"
                                onClick={() => handleEdit(dashboard)}
                              />
                              <OverflowMenuItem
                                itemText="Delete"
                                hasDivider
                                isDelete
                                onClick={() => handleDelete(dashboard)}
                              />
                            </OverflowMenu>
                          </TableCell>
                        );
                      }
                      return <TableCell key={cell.id}>{cell.value}</TableCell>;
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>
    </div>
  );
}

export default DashboardsListPage;
