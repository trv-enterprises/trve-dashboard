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
  Loading,
  Tag
} from '@carbon/react';
import { Add } from '@carbon/icons-react';
import './ChartsListPage.scss';

/**
 * ChartsListPage Component
 *
 * Displays list of all chart components with CRUD operations.
 * Shows: Name, System, Source, Description, Last Modified
 * Actions: Create, View, Edit, Delete (via three-dot menu)
 */
function ChartsListPage() {
  const navigate = useNavigate();
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch components from API
  useEffect(() => {
    fetchComponents();
  }, []);

  const fetchComponents = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/components?page=1&page_size=100');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Components response:', data);

      // Go API returns components directly
      if (data.components) {
        setComponents(data.components);
      } else if (data.error) {
        setError(data.error);
      } else {
        setComponents([]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    navigate('/design/charts/new');
  };

  const handleView = (component) => {
    navigate(`/design/charts/${component.id}`);
  };

  const handleEdit = (component) => {
    navigate(`/design/charts/${component.id}`);
  };

  const handleDelete = async (component) => {
    // TODO: Add confirmation dialog
    if (window.confirm(`Are you sure you want to delete "${component.name}"?`)) {
      try {
        const response = await fetch(`http://localhost:3001/api/components/${component.id}`, {
          method: 'DELETE'
        });
        const data = await response.json();

        if (data.success) {
          fetchComponents(); // Refresh list
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

  const getSystemColor = (system) => {
    const colors = {
      'visualization': 'blue',
      'test': 'gray',
      'analytics': 'green',
      'monitoring': 'purple'
    };
    return colors[system?.toLowerCase()] || 'cyan';
  };

  const headers = [
    { key: 'name', header: 'Name' },
    { key: 'system', header: 'System' },
    { key: 'source', header: 'Source' },
    { key: 'description', header: 'Description' },
    { key: 'updated', header: 'Last Modified' },
    { key: 'actions', header: 'Actions' }
  ];

  const rows = components.map((component) => ({
    id: component.id,
    name: component.name,
    system: component.system,
    source: component.source,
    description: component.description || 'No description',
    updated: formatDate(component.updated),
    component: component // Store full object for actions
  }));

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
      <div className="page-header">
        <h1>Charts</h1>
        <Button
          renderIcon={Add}
          onClick={handleCreate}
          size="md"
        >
          Create Chart
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
                      if (cell.info.header === 'system') {
                        return (
                          <TableCell key={cell.id}>
                            <Tag type={getSystemColor(cell.value)} size="md">
                              {cell.value?.toUpperCase()}
                            </Tag>
                          </TableCell>
                        );
                      }
                      if (cell.info.header === 'actions') {
                        return (
                          <TableCell key={cell.id}>
                            <OverflowMenu flipped size="sm">
                              <OverflowMenuItem
                                itemText="View"
                                onClick={() => handleView(row.component)}
                              />
                              <OverflowMenuItem
                                itemText="Edit"
                                onClick={() => handleEdit(row.component)}
                              />
                              <OverflowMenuItem
                                itemText="Delete"
                                isDelete
                                onClick={() => handleDelete(row.component)}
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

export default ChartsListPage;
