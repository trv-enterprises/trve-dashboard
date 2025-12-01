/**
 * Data Transform Utilities
 *
 * Applies client-side filters and aggregations to data returned from the data layer.
 * This runs AFTER data is fetched/cached, allowing one cached dataset to serve
 * multiple charts with different filter configurations.
 *
 * Usage:
 * const { data } = useData({ datasourceId, query });
 * const filtered = transformData(data, {
 *   filters: [{ field: 'sensor_id', op: 'eq', value: 'sensor-001' }],
 *   aggregation: { type: 'last', sortBy: 'timestamp' }
 * });
 */

/**
 * Filter operators
 */
const OPERATORS = {
  eq: (a, b) => a === b,
  neq: (a, b) => a !== b,
  gt: (a, b) => a > b,
  gte: (a, b) => a >= b,
  lt: (a, b) => a < b,
  lte: (a, b) => a <= b,
  contains: (a, b) => String(a).toLowerCase().includes(String(b).toLowerCase()),
  startsWith: (a, b) => String(a).toLowerCase().startsWith(String(b).toLowerCase()),
  endsWith: (a, b) => String(a).toLowerCase().endsWith(String(b).toLowerCase()),
  in: (a, b) => Array.isArray(b) ? b.includes(a) : false,
  notIn: (a, b) => Array.isArray(b) ? !b.includes(a) : true,
  isNull: (a) => a === null || a === undefined,
  isNotNull: (a) => a !== null && a !== undefined,
};

/**
 * Apply a single filter to rows
 * @param {Array} rows - Array of row arrays
 * @param {Array} columns - Column names
 * @param {Object} filter - Filter config { field, op, value }
 * @returns {Array} Filtered rows
 */
function applyFilter(rows, columns, filter) {
  const { field, op, value } = filter;
  const colIndex = columns.indexOf(field);

  if (colIndex === -1) {
    console.warn(`Filter field "${field}" not found in columns`);
    return rows;
  }

  const operator = OPERATORS[op];
  if (!operator) {
    console.warn(`Unknown filter operator "${op}"`);
    return rows;
  }

  return rows.filter(row => operator(row[colIndex], value));
}

/**
 * Apply multiple filters (AND logic)
 * @param {Array} rows - Array of row arrays
 * @param {Array} columns - Column names
 * @param {Array} filters - Array of filter configs
 * @returns {Array} Filtered rows
 */
function applyFilters(rows, columns, filters) {
  if (!filters || !Array.isArray(filters) || filters.length === 0) {
    return rows;
  }

  return filters.reduce((filteredRows, filter) => {
    return applyFilter(filteredRows, columns, filter);
  }, rows);
}

/**
 * Sort rows by a column
 * @param {Array} rows - Array of row arrays
 * @param {Array} columns - Column names
 * @param {string} sortBy - Column name to sort by
 * @param {string} order - 'asc' or 'desc'
 * @returns {Array} Sorted rows
 */
function sortRows(rows, columns, sortBy, order = 'desc') {
  const colIndex = columns.indexOf(sortBy);

  if (colIndex === -1) {
    console.warn(`Sort column "${sortBy}" not found`);
    return rows;
  }

  return [...rows].sort((a, b) => {
    const valA = a[colIndex];
    const valB = b[colIndex];

    // Handle null/undefined
    if (valA == null && valB == null) return 0;
    if (valA == null) return order === 'asc' ? -1 : 1;
    if (valB == null) return order === 'asc' ? 1 : -1;

    // Compare
    if (valA < valB) return order === 'asc' ? -1 : 1;
    if (valA > valB) return order === 'asc' ? 1 : -1;
    return 0;
  });
}

/**
 * Apply aggregation to get a single value or reduced dataset
 * @param {Array} rows - Array of row arrays
 * @param {Array} columns - Column names
 * @param {Object} aggregation - Aggregation config
 * @returns {Object} { rows, value } - Aggregated result
 */
function applyAggregation(rows, columns, aggregation) {
  if (!aggregation || !aggregation.type) {
    return { rows, value: null };
  }

  const { type, sortBy, field, groupBy } = aggregation;

  // Sort if needed for first/last
  let sortedRows = rows;
  if (sortBy && (type === 'first' || type === 'last')) {
    const order = type === 'last' ? 'desc' : 'asc';
    sortedRows = sortRows(rows, columns, sortBy, order);
  }

  // Get field index for value extraction
  const fieldIndex = field ? columns.indexOf(field) : -1;

  switch (type) {
    case 'first':
      return {
        rows: sortedRows.slice(0, 1),
        value: fieldIndex >= 0 && sortedRows.length > 0 ? sortedRows[0][fieldIndex] : null
      };

    case 'last':
      return {
        rows: sortedRows.slice(0, 1),
        value: fieldIndex >= 0 && sortedRows.length > 0 ? sortedRows[0][fieldIndex] : null
      };

    case 'min':
      if (fieldIndex < 0) return { rows, value: null };
      const minVal = Math.min(...rows.map(r => Number(r[fieldIndex]) || 0));
      return { rows, value: minVal };

    case 'max':
      if (fieldIndex < 0) return { rows, value: null };
      const maxVal = Math.max(...rows.map(r => Number(r[fieldIndex]) || 0));
      return { rows, value: maxVal };

    case 'sum':
      if (fieldIndex < 0) return { rows, value: null };
      const sumVal = rows.reduce((acc, r) => acc + (Number(r[fieldIndex]) || 0), 0);
      return { rows, value: sumVal };

    case 'avg':
      if (fieldIndex < 0 || rows.length === 0) return { rows, value: null };
      const avgVal = rows.reduce((acc, r) => acc + (Number(r[fieldIndex]) || 0), 0) / rows.length;
      return { rows, value: avgVal };

    case 'count':
      return { rows, value: rows.length };

    case 'limit':
      const limit = aggregation.count || 10;
      return { rows: sortedRows.slice(0, limit), value: null };

    default:
      console.warn(`Unknown aggregation type "${type}"`);
      return { rows, value: null };
  }
}

/**
 * Main transform function
 * Applies filters and aggregations to data from the data layer
 *
 * @param {Object} data - Data from useData hook { columns, rows, metadata }
 * @param {Object} transforms - Transform configuration
 * @param {Array} transforms.filters - Array of { field, op, value }
 * @param {Object} transforms.aggregation - { type, sortBy, field }
 * @param {string} transforms.sortBy - Column to sort by
 * @param {string} transforms.sortOrder - 'asc' or 'desc'
 * @param {number} transforms.limit - Max rows to return
 * @returns {Object} Transformed data { columns, rows, metadata, aggregatedValue }
 */
export function transformData(data, transforms = {}) {
  if (!data || !data.rows || !data.columns) {
    return { columns: [], rows: [], metadata: {}, aggregatedValue: null };
  }

  const { filters, aggregation, sortBy, sortOrder, limit } = transforms;

  let rows = [...data.rows];
  const columns = data.columns;

  // 1. Apply filters
  rows = applyFilters(rows, columns, filters);

  // 2. Apply sorting (if not part of aggregation)
  if (sortBy && (!aggregation || !aggregation.sortBy)) {
    rows = sortRows(rows, columns, sortBy, sortOrder || 'desc');
  }

  // 3. Apply limit (if not part of aggregation)
  if (limit && (!aggregation || aggregation.type !== 'limit')) {
    rows = rows.slice(0, limit);
  }

  // 4. Apply aggregation
  const { rows: aggRows, value: aggregatedValue } = applyAggregation(rows, columns, aggregation);
  rows = aggRows;

  return {
    columns,
    rows,
    metadata: {
      ...data.metadata,
      originalRowCount: data.rows.length,
      filteredRowCount: rows.length,
      transformed: true
    },
    aggregatedValue
  };
}

/**
 * Helper to convert columnar data to objects for easier access
 * @param {Object} data - { columns, rows }
 * @returns {Array} Array of objects
 */
export function toObjects(data) {
  if (!data || !data.rows || !data.columns) return [];

  return data.rows.map(row => {
    const obj = {};
    data.columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

/**
 * Helper to get a single value from first row
 * @param {Object} data - { columns, rows }
 * @param {string} field - Column name
 * @returns {any} The value
 */
export function getValue(data, field) {
  if (!data || !data.rows || !data.rows.length || !data.columns) return null;

  const colIndex = data.columns.indexOf(field);
  if (colIndex === -1) return null;

  return data.rows[0][colIndex];
}

export default transformData;
