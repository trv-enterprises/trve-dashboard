// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useState, useMemo } from 'react';
import {
  Modal,
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
  Loading
} from '@carbon/react';
import { useData } from '../hooks/useData';
import { toObjects, formatCellValue, transformData, buildTransformsFromMapping } from '../utils/dataTransforms';
import './ChartDataModal.scss';

/**
 * ChartDataModal Component
 *
 * Displays chart data in a modal with a searchable, sortable DataTable.
 * Fetches data using the chart's datasource configuration.
 */
function ChartDataModal({ open, chart, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');

  // Build query from chart config
  const query = useMemo(() => {
    if (!chart?.query_config) return null;
    return {
      raw: chart.query_config.raw || '',
      type: chart.query_config.type || 'api',
      params: chart.query_config.params || {}
    };
  }, [chart?.query_config]);

  // Build transforms from data_mapping (filters, aggregations)
  const transforms = useMemo(() => buildTransformsFromMapping(chart?.data_mapping), [chart?.data_mapping]);

  // Fetch data using the chart's datasource
  const { data: rawData, loading, error } = useData({
    datasourceId: chart?.datasource_id,
    query,
    useCache: true
  });

  // Apply transforms (filters, aggregations) to match chart's view
  const data = useMemo(() => {
    if (!rawData) return null;
    return transformData(rawData, transforms);
  }, [rawData, transforms]);

  // Convert columnar data to array of objects
  const rows = useMemo(() => {
    if (!data) return [];
    return toObjects(data);
  }, [data]);

  // Get column headers from data
  const columns = useMemo(() => {
    if (!data?.columns) return [];
    return data.columns;
  }, [data?.columns]);

  // Filter and sort data
  const filteredAndSortedRows = useMemo(() => {
    let result = [...rows];

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(row =>
        Object.values(row).some(value =>
          String(value).toLowerCase().includes(term)
        )
      );
    }

    // Sort
    if (sortKey) {
      result.sort((a, b) => {
        let aVal = a[sortKey];
        let bVal = b[sortKey];

        // Handle null/undefined
        if (aVal == null) aVal = '';
        if (bVal == null) bVal = '';

        // Handle numeric sorting
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }

        // String sorting
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();

        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [rows, searchTerm, sortKey, sortDirection]);

  // Handle column sorting
  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // Build headers for DataTable
  const headers = columns.map(col => ({
    key: col,
    header: col,
    isSortable: true
  }));

  // For data tables, always use a format with seconds for better precision
  // Chart axis labels use compact formats, but data tables should show full detail
  const timestampFormat = 'chart_time_seconds';

  // Build rows for DataTable
  const tableRows = filteredAndSortedRows.map((row, index) => ({
    id: String(index),
    ...Object.fromEntries(
      columns.map(col => [col, formatCellValue(row[col], col, { timestampFormat })])
    )
  }));

  return (
    <Modal
      open={open}
      onRequestClose={onClose}
      modalHeading={chart?.name || 'Chart Data'}
      passiveModal
      size="lg"
      className="chart-data-modal"
    >
      <div className="modal-content">
        {loading && (
          <div className="loading-container">
            <Loading description="Loading data..." withOverlay={false} />
          </div>
        )}

        {error && (
          <div className="error-message">
            Error loading data: {error.message}
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="empty-state">
            No data available for this chart.
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <DataTable rows={tableRows} headers={headers} isSortable>
            {({ rows, headers, getTableProps, getHeaderProps, getRowProps, onInputChange }) => (
              <TableContainer>
                <TableToolbar>
                  <TableToolbarContent>
                    <TableToolbarSearch
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        onInputChange(e);
                      }}
                      placeholder="Search data..."
                      persistent
                    />
                    <span className="row-count">
                      {filteredAndSortedRows.length} of {tableRows.length} rows
                    </span>
                  </TableToolbarContent>
                </TableToolbar>
                <div className="table-scroll-container">
                  <Table {...getTableProps()} size="md">
                    <TableHead>
                      <TableRow>
                        {headers.map((header) => (
                          <TableHeader
                            {...getHeaderProps({ header })}
                            key={header.key}
                            isSortable={header.isSortable}
                            isSortHeader={sortKey === header.key}
                            sortDirection={sortKey === header.key ? sortDirection.toUpperCase() : 'NONE'}
                            onClick={() => handleSort(header.key)}
                          >
                            {header.header}
                          </TableHeader>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow {...getRowProps({ row })} key={row.id}>
                          {row.cells.map((cell) => (
                            <TableCell key={cell.id}>{cell.value}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TableContainer>
            )}
          </DataTable>
        )}
      </div>
    </Modal>
  );
}

export default ChartDataModal;
