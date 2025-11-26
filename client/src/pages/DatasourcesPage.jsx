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
import './DatasourcesPage.scss';

/**
 * DatasourcesPage Component
 *
 * Displays list of all datasources with CRUD operations.
 * Shows: Name, Type, Description, Last Modified
 * Actions: Create, View, Edit, Delete (via three-dot menu)
 */
function DatasourcesPage() {
  const navigate = useNavigate();
  const [datasources, setDatasources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch datasources from API
  useEffect(() => {
    fetchDatasources();
  }, []);

  const fetchDatasources = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/datasources?page=1&pageSize=100');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Datasources response:', data);

      // Go API returns datasources directly, not wrapped in success/data
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

  const handleView = (datasource) => {
    navigate(`/design/datasources/${datasource.id}`);
  };

  const handleEdit = (datasource) => {
    navigate(`/design/datasources/${datasource.id}`);
  };

  const handleDelete = async (datasource) => {
    // TODO: Add confirmation dialog
    if (window.confirm(`Are you sure you want to delete "${datasource.name}"?`)) {
      try {
        const response = await fetch(`http://localhost:3001/api/datasources/${datasource.id}`, {
          method: 'DELETE'
        });
        const data = await response.json();

        if (data.success) {
          fetchDatasources(); // Refresh list
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

  const getTypeColor = (type) => {
    const colors = {
      'sql': 'blue',
      'api': 'green',
      'csv': 'purple',
      'socket': 'cyan'
    };
    return colors[type?.toLowerCase()] || 'gray';
  };

  const headers = [
    { key: 'name', header: 'Name' },
    { key: 'type', header: 'Type' },
    { key: 'description', header: 'Description' },
    { key: 'updated', header: 'Last Modified' },
    { key: 'actions', header: 'Actions' }
  ];

  const rows = datasources.map((datasource) => ({
    id: datasource.id,
    name: datasource.name,
    type: datasource.type,
    description: datasource.description || 'No description',
    updated: formatDate(datasource.updated),
    datasource: datasource // Store full object for actions
  }));

  if (loading) {
    return (
      <div className="datasources-page">
        <Loading description="Loading datasources..." withOverlay={false} />
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
      <div className="page-header">
        <h1>Datasources</h1>
        <Button
          renderIcon={Add}
          onClick={handleCreate}
          size="md"
        >
          Create Datasource
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
                      if (cell.info.header === 'type') {
                        return (
                          <TableCell key={cell.id}>
                            <Tag type={getTypeColor(cell.value)} size="md">
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
                                onClick={() => handleView(row.datasource)}
                              />
                              <OverflowMenuItem
                                itemText="Edit"
                                onClick={() => handleEdit(row.datasource)}
                              />
                              <OverflowMenuItem
                                itemText="Delete"
                                isDelete
                                onClick={() => handleDelete(row.datasource)}
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

export default DatasourcesPage;
