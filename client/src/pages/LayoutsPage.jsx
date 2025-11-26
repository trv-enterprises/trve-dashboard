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
import './LayoutsPage.scss';

/**
 * LayoutsPage Component
 *
 * Displays list of all layouts with CRUD operations.
 * Shows: Name, Description, Last Modified
 * Actions: Create, View, Edit, Delete (via three-dot menu)
 */
function LayoutsPage() {
  const navigate = useNavigate();
  const [layouts, setLayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch layouts from API
  useEffect(() => {
    fetchLayouts();
  }, []);

  const fetchLayouts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('http://localhost:3001/api/layouts?page=1&pageSize=100');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Layouts response:', data);

      // Go API returns layouts directly, not wrapped in success/data
      if (data.layouts) {
        setLayouts(data.layouts);
      } else if (data.error) {
        setError(data.error);
      } else {
        setLayouts([]);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    navigate('/design/layouts/new');
  };

  const handleView = (layout) => {
    navigate(`/design/layouts/${layout.id}`);
  };

  const handleEdit = (layout) => {
    navigate(`/design/layouts/${layout.id}`);
  };

  const handleDelete = async (layout) => {
    // TODO: Add confirmation dialog
    if (window.confirm(`Are you sure you want to delete "${layout.name}"?`)) {
      try {
        const response = await fetch(`http://localhost:3001/api/layouts/${layout.id}`, {
          method: 'DELETE'
        });
        const data = await response.json();

        if (data.success) {
          fetchLayouts(); // Refresh list
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

  const headers = [
    { key: 'name', header: 'Name' },
    { key: 'description', header: 'Description' },
    { key: 'updated', header: 'Last Modified' },
    { key: 'actions', header: 'Actions' }
  ];

  const rows = layouts.map((layout) => ({
    id: layout.id,
    name: layout.name,
    description: layout.description || 'No description',
    updated: formatDate(layout.updated)
  }));

  // Helper to find original layout by row id
  const getLayoutById = (id) => layouts.find(l => l.id === id);

  if (loading) {
    return (
      <div className="layouts-page">
        <Loading description="Loading layouts..." withOverlay={false} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="layouts-page">
        <div className="error-message">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="layouts-page">
      <div className="page-header">
        <h1>Layouts</h1>
        <Button
          renderIcon={Add}
          onClick={handleCreate}
          size="md"
        >
          Create Layout
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
                        const layout = getLayoutById(row.id);
                        return (
                          <TableCell key={cell.id}>
                            <OverflowMenu flipped size="sm">
                              <OverflowMenuItem
                                itemText="View"
                                onClick={() => handleView(layout)}
                              />
                              <OverflowMenuItem
                                itemText="Edit"
                                onClick={() => handleEdit(layout)}
                              />
                              <OverflowMenuItem
                                itemText="Delete"
                                hasDivider
                                isDelete
                                onClick={() => handleDelete(layout)}
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

export default LayoutsPage;
