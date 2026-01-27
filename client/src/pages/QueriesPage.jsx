// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useState } from 'react';
import { Tile, Tag, DataTable, Pagination, TextInput, Select, SelectItem } from '@carbon/react';
import { Search } from '@carbon/icons-react';
import { generateRecentQueries } from '../utils/mockData';
import './QueriesPage.scss';

const {
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableContainer,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
} = DataTable;

function QueriesPage() {
  const [queries] = useState(generateRecentQueries(50));
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Filter queries based on search and status
  const filteredQueries = queries.filter(q => {
    const matchesSearch = q.query.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Paginate filtered queries
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedQueries = filteredQueries.slice(startIndex, endIndex);

  // DataTable headers
  const headers = [
    { key: 'id', header: 'ID' },
    { key: 'query', header: 'Query' },
    { key: 'node', header: 'Node' },
    { key: 'status', header: 'Status' },
    { key: 'duration', header: 'Duration (ms)' },
    { key: 'timeAgo', header: 'Executed' }
  ];

  // DataTable rows
  const rows = paginatedQueries.map(q => ({
    ...q,
    query: q.query.length > 80 ? q.query.substring(0, 80) + '...' : q.query
  }));

  return (
    <div className="queries-page">
      <div className="page-header">
        <h2>Query History</h2>
        <p>View and analyze query execution across the database cluster</p>
      </div>

      {/* Filters */}
      <Tile className="filters-tile">
        <div className="filters">
          <TextInput
            id="search-query"
            labelText="Search queries"
            placeholder="Search by query text..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="md"
          />
          <Select
            id="status-filter"
            labelText="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            size="md"
          >
            <SelectItem value="all" text="All statuses" />
            <SelectItem value="completed" text="Completed" />
            <SelectItem value="running" text="Running" />
            <SelectItem value="failed" text="Failed" />
          </Select>
        </div>
      </Tile>

      {/* Queries Table */}
      <Tile className="table-tile">
        <DataTable rows={rows} headers={headers} isSortable>
          {({ rows, headers, getHeaderProps, getTableProps }) => (
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
                    <TableRow key={row.id}>
                      {row.cells.map((cell) => {
                        // Special rendering for status column
                        if (cell.info.header === 'status') {
                          const status = cell.value;
                          const tagType =
                            status === 'completed' ? 'green' :
                            status === 'running' ? 'blue' :
                            'red';
                          return (
                            <TableCell key={cell.id}>
                              <Tag type={tagType} size="sm">
                                {status}
                              </Tag>
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

        {/* Pagination */}
        <Pagination
          totalItems={filteredQueries.length}
          pageSize={pageSize}
          pageSizes={[10, 20, 30, 40, 50]}
          page={currentPage}
          onChange={({ page, pageSize: newPageSize }) => {
            setCurrentPage(page);
            setPageSize(newPageSize);
          }}
        />
      </Tile>
    </div>
  );
}

export default QueriesPage;
