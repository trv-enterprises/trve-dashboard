import { useState, useEffect, useMemo, useImperativeHandle, forwardRef } from 'react';
import {
  TextInput,
  TextArea,
  Toggle,
  Select,
  SelectItem,
  Column,
  Grid,
  ContentSwitcher,
  Switch,
  Tag,
  InlineNotification,
  Button,
  NumberInput,
  IconButton
} from '@carbon/react';
import { Play, Add, TrashCan, ChartBar, Code, TableSplit } from '@carbon/icons-react';
import DynamicComponentLoader from './DynamicComponentLoader';
import SQLQueryBuilder from './SQLQueryBuilder';
import { transformData } from '../utils/dataTransforms';
import './ChartEditor.scss';

// Chart types available
const CHART_TYPES = [
  { id: 'bar', label: 'Bar Chart' },
  { id: 'line', label: 'Line Chart' },
  { id: 'area', label: 'Area Chart' },
  { id: 'pie', label: 'Pie Chart' },
  { id: 'scatter', label: 'Scatter Plot' },
  { id: 'gauge', label: 'Gauge' },
  { id: 'custom', label: 'Custom Component' }
];

// Filter operators
const FILTER_OPERATORS = [
  { id: 'eq', label: 'Equals (=)' },
  { id: 'neq', label: 'Not Equals (≠)' },
  { id: 'gt', label: 'Greater Than (>)' },
  { id: 'gte', label: 'Greater or Equal (≥)' },
  { id: 'lt', label: 'Less Than (<)' },
  { id: 'lte', label: 'Less or Equal (≤)' },
  { id: 'contains', label: 'Contains' },
  { id: 'startsWith', label: 'Starts With' },
  { id: 'endsWith', label: 'Ends With' },
  { id: 'in', label: 'In List' },
  { id: 'notIn', label: 'Not In List' },
  { id: 'isNull', label: 'Is Null' },
  { id: 'isNotNull', label: 'Is Not Null' }
];

// Aggregation types
const AGGREGATION_TYPES = [
  { id: '', label: 'None' },
  { id: 'first', label: 'First Row', needsSort: true },
  { id: 'last', label: 'Last Row', needsSort: true },
  { id: 'min', label: 'Minimum', needsField: true },
  { id: 'max', label: 'Maximum', needsField: true },
  { id: 'avg', label: 'Average', needsField: true },
  { id: 'sum', label: 'Sum', needsField: true },
  { id: 'count', label: 'Count' },
  { id: 'limit', label: 'Limit Rows', needsCount: true }
];

/**
 * ChartEditor Component
 *
 * Shared editor for creating/editing charts. Used by both:
 * - ChartEditorModal (for dashboard inline editing)
 * - ChartDetailPage (for standalone chart editing)
 *
 * Features:
 * - Chart type selection
 * - Description field
 * - Data source selection and query configuration
 * - Data mapping (columns to axes)
 * - Filters and aggregation
 * - Live preview with real data
 * - Custom code editor for advanced charts
 */
const ChartEditor = forwardRef(function ChartEditor({
  chart,
  onSave,
  onCancel,
  saving = false,
  showActions = true,
  className = '',
  onValidityChange
}, ref) {
  // Basic info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [chartType, setChartType] = useState('bar');

  // Data source configuration
  const [datasources, setDatasources] = useState([]);
  const [selectedDatasourceId, setSelectedDatasourceId] = useState('');
  const [selectedDatasource, setSelectedDatasource] = useState(null);

  // Query configuration
  const [queryRaw, setQueryRaw] = useState('');
  const [queryType, setQueryType] = useState('sql');

  // Data mapping
  const [xAxisColumn, setXAxisColumn] = useState('');
  const [yAxisColumns, setYAxisColumns] = useState([]);
  const [groupByColumn, setGroupByColumn] = useState('');

  // Filters and aggregation
  const [filters, setFilters] = useState([]);
  const [aggregation, setAggregation] = useState({ type: '', sortBy: '', field: '', count: 10 });
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [limitRows, setLimitRows] = useState(0);

  // Preview data
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [availableColumns, setAvailableColumns] = useState([]);

  // Code editor
  const [componentCode, setComponentCode] = useState('');
  const [showCustomCode, setShowCustomCode] = useState(false);

  // Query mode: 'visual' for SQLQueryBuilder, 'raw' for TextArea
  const [queryMode, setQueryMode] = useState('raw');

  // UI state
  const [activeTab, setActiveTab] = useState(0);
  const [hasChanges, setHasChanges] = useState(false);
  const [initialState, setInitialState] = useState(null);

  // Fetch datasources on mount
  useEffect(() => {
    fetchDatasources();
  }, []);

  // Initialize form when chart changes
  useEffect(() => {
    if (chart) {
      // Editing existing chart
      setName(chart.name || '');
      setDescription(chart.description || '');
      setChartType(chart.chart_type || 'bar');
      setSelectedDatasourceId(chart.datasource_id || '');
      setQueryRaw(chart.query_config?.raw || '');
      setQueryType(chart.query_config?.type || 'sql');
      setXAxisColumn(chart.data_mapping?.x_axis || '');
      setYAxisColumns(chart.data_mapping?.y_axis || []);
      setGroupByColumn(chart.data_mapping?.group_by || '');
      setFilters(chart.data_mapping?.filters || []);
      setAggregation(chart.data_mapping?.aggregation || { type: '', sortBy: '', field: '', count: 10 });
      setSortBy(chart.data_mapping?.sort_by || '');
      setSortOrder(chart.data_mapping?.sort_order || 'desc');
      setLimitRows(chart.data_mapping?.limit || 0);
      setComponentCode(chart.component_code || '');
      setShowCustomCode(chart.use_custom_code ?? (chart.chart_type === 'custom'));
      setInitialState(JSON.stringify({
        name: chart.name || '',
        description: chart.description || '',
        chartType: chart.chart_type || 'bar',
        datasourceId: chart.datasource_id || '',
        queryRaw: chart.query_config?.raw || '',
        xAxisColumn: chart.data_mapping?.x_axis || '',
        yAxisColumns: chart.data_mapping?.y_axis || [],
        filters: chart.data_mapping?.filters || [],
        showCustomCode: chart.chart_type === 'custom' || !!chart.component_code
      }));
    } else {
      // New chart - reset to defaults
      resetForm();
      setInitialState(JSON.stringify({
        name: '',
        description: '',
        chartType: 'bar',
        datasourceId: '',
        queryRaw: '',
        xAxisColumn: '',
        yAxisColumns: [],
        filters: [],
        showCustomCode: false
      }));
    }
    setHasChanges(false);
  }, [chart]);

  // Track changes
  useEffect(() => {
    if (!initialState) return;
    const currentState = JSON.stringify({
      name,
      description,
      chartType,
      datasourceId: selectedDatasourceId,
      queryRaw,
      xAxisColumn,
      yAxisColumns,
      filters,
      showCustomCode
    });
    setHasChanges(currentState !== initialState);
  }, [name, description, chartType, selectedDatasourceId, queryRaw, xAxisColumn, yAxisColumns, filters, showCustomCode, initialState]);

  // Notify parent of validity changes
  useEffect(() => {
    if (onValidityChange) {
      onValidityChange(!!name.trim());
    }
  }, [name, onValidityChange]);

  // Update selectedDatasource when ID changes
  useEffect(() => {
    if (selectedDatasourceId && datasources.length > 0) {
      const ds = datasources.find(d => d.id === selectedDatasourceId);
      setSelectedDatasource(ds || null);
    } else {
      setSelectedDatasource(null);
    }
  }, [selectedDatasourceId, datasources]);

  const handleDatasourceChange = (newDatasourceId) => {
    setSelectedDatasourceId(newDatasourceId);

    if (newDatasourceId && datasources.length > 0) {
      const ds = datasources.find(d => d.id === newDatasourceId);
      if (ds) {
        switch (ds.type) {
          case 'sql':
            setQueryType('sql');
            setQueryMode('visual'); // Default to visual query builder for SQL
            break;
          case 'api':
            setQueryType('api');
            setQueryMode('raw');
            break;
          case 'csv':
            setQueryType('csv_filter');
            setQueryMode('raw');
            break;
          case 'socket':
            setQueryType('stream_filter');
            setQueryMode('raw');
            break;
        }
      }
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setChartType('bar');
    setSelectedDatasourceId('');
    setSelectedDatasource(null);
    setQueryRaw('');
    setQueryType('sql');
    setXAxisColumn('');
    setYAxisColumns([]);
    setGroupByColumn('');
    setFilters([]);
    setAggregation({ type: '', sortBy: '', field: '', count: 10 });
    setSortBy('');
    setSortOrder('desc');
    setLimitRows(0);
    setComponentCode('');
    setShowCustomCode(false);
    setPreviewData(null);
    setPreviewError(null);
    setAvailableColumns([]);
  };

  const fetchDatasources = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/datasources?page=1&page_size=100');
      const data = await response.json();
      if (data.datasources) {
        setDatasources(data.datasources);
      }
    } catch (err) {
      console.error('Failed to fetch datasources:', err);
    }
  };

  const fetchPreviewData = async () => {
    if (!selectedDatasourceId || !queryRaw.trim()) {
      setPreviewError('Please select a data source and enter a query');
      return;
    }

    setPreviewLoading(true);
    setPreviewError(null);

    try {
      const response = await fetch(`http://localhost:3001/api/datasources/${selectedDatasourceId}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: {
            raw: queryRaw,
            type: queryType,
            params: {}
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Query failed');
      }

      setPreviewData(data.result_set);

      if (data.result_set?.columns) {
        setAvailableColumns(data.result_set.columns);

        if (!xAxisColumn && data.result_set.columns.length > 0) {
          setXAxisColumn(data.result_set.columns[0]);
        }
        if (yAxisColumns.length === 0 && data.result_set.columns.length > 1) {
          setYAxisColumns([data.result_set.columns[1]]);
        }
      }
    } catch (err) {
      setPreviewError(err.message);
      setPreviewData(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const generatedCode = useMemo(() => {
    if (showCustomCode && componentCode) {
      return componentCode;
    }

    if (!selectedDatasourceId) {
      return getStaticChartCode(chartType);
    }

    const transforms = {
      filters,
      aggregation: aggregation.type ? aggregation : null,
      sortBy,
      sortOrder,
      limit: limitRows || 0
    };

    return getDataDrivenChartCode(chartType, selectedDatasourceId, queryRaw, queryType, xAxisColumn, yAxisColumns, transforms);
  }, [chartType, selectedDatasourceId, queryRaw, queryType, xAxisColumn, yAxisColumns, filters, aggregation, sortBy, sortOrder, limitRows, showCustomCode, componentCode]);

  const filteredPreviewData = useMemo(() => {
    if (!previewData) return null;

    const hasTransforms = filters.length > 0 || aggregation?.type || sortBy || limitRows > 0;
    if (!hasTransforms) return previewData;

    const parsedFilters = filters.map(f => ({
      field: f.field,
      op: f.op,
      value: (f.op === 'in' || f.op === 'notIn') && typeof f.value === 'string'
        ? f.value.split(',').map(v => v.trim())
        : f.value
    }));

    const transforms = {
      filters: parsedFilters,
      aggregation: aggregation?.type ? aggregation : null,
      sortBy: sortBy || null,
      sortOrder: sortOrder || 'desc',
      limit: limitRows || 0
    };

    const result = transformData(previewData, transforms);
    return {
      columns: result.columns,
      rows: result.rows,
      metadata: {
        ...previewData.metadata,
        row_count: result.rows.length,
        original_row_count: previewData.rows?.length || 0,
        filtered: true
      }
    };
  }, [previewData, filters, aggregation, sortBy, sortOrder, limitRows]);

  const handleSave = () => {
    if (!name.trim()) {
      alert('Please enter a chart name');
      return;
    }

    const chartPayload = {
      name: name.trim(),
      description: description.trim(),
      chart_type: chartType,
      datasource_id: selectedDatasourceId || '',
      query_config: selectedDatasourceId ? {
        raw: queryRaw,
        type: queryType,
        params: {}
      } : null,
      data_mapping: selectedDatasourceId ? {
        x_axis: xAxisColumn,
        y_axis: yAxisColumns,
        group_by: groupByColumn || '',
        filters: filters.length > 0 ? filters : [],
        aggregation: aggregation.type ? aggregation : null,
        sort_by: sortBy || '',
        sort_order: sortOrder || 'desc',
        limit: limitRows || 0
      } : null,
      component_code: showCustomCode ? componentCode : generatedCode,
      use_custom_code: showCustomCode,
    };

    onSave(chartPayload);
  };

  const handleYAxisToggle = (column) => {
    setYAxisColumns(prev => {
      if (prev.includes(column)) {
        return prev.filter(c => c !== column);
      } else {
        return [...prev, column];
      }
    });
  };

  const addFilter = () => {
    setFilters(prev => [...prev, { field: availableColumns[0] || '', op: 'eq', value: '' }]);
  };

  const updateFilter = (index, field, value) => {
    setFilters(prev => prev.map((f, i) => i === index ? { ...f, [field]: value } : f));
  };

  const removeFilter = (index) => {
    setFilters(prev => prev.filter((_, i) => i !== index));
  };

  const updateAggregation = (field, value) => {
    setAggregation(prev => ({ ...prev, [field]: value }));
  };

  // Expose save method via ref for modal usage
  useImperativeHandle(ref, () => ({
    save: handleSave,
    getName: () => name,
    isValid: () => !!name.trim()
  }));

  return (
    <div className={`chart-editor ${className}`}>
      {/* Custom code warning */}
      {showCustomCode && (
        <InlineNotification
          kind="warning"
          title="Custom Code Mode"
          subtitle="Data mapping changes won't update the code automatically. Edit the code directly or disable custom code to regenerate."
          lowContrast
          hideCloseButton
          className="custom-code-warning"
        />
      )}

      {/* Chart basic info */}
      <div className="chart-metadata-section">
        <div className="metadata-row">
          <TextInput
            id="chart-name"
            labelText="Chart Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter chart name"
            size="md"
          />
          <Select
            id="chart-type"
            labelText="Chart Type"
            value={chartType}
            onChange={(e) => {
              setChartType(e.target.value);
              setShowCustomCode(e.target.value === 'custom');
            }}
          >
            {CHART_TYPES.map(type => (
              <SelectItem key={type.id} value={type.id} text={type.label} />
            ))}
          </Select>
        </div>
        <div className="metadata-row description-row">
          <TextInput
            id="chart-description"
            labelText="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter chart description"
            size="md"
          />
        </div>
      </div>

      <div className="chart-editor-switcher-wrapper">
        <ContentSwitcher
          selectedIndex={activeTab}
          onChange={({ index }) => setActiveTab(index)}
          className="chart-editor-switcher"
        >
          <Switch name="datasource" text="Data Source" />
          <Switch name="preview" text="Preview" />
          <Switch name="code" text="Code" />
        </ContentSwitcher>
      </div>

      <div className="tab-panels">
        {/* Data Source Tab */}
        {activeTab === 0 && (
          <div className="tab-content">
            <Grid narrow>
              <Column lg={6} md={4} sm={4}>
                <Select
                  id="datasource-select"
                  labelText="Data Source"
                  value={selectedDatasourceId}
                  onChange={(e) => handleDatasourceChange(e.target.value)}
                >
                  <SelectItem value="" text="Select a data source..." />
                  {datasources.map(ds => (
                    <SelectItem
                      key={ds.id}
                      value={ds.id}
                      text={`${ds.name} (${ds.type})`}
                    />
                  ))}
                </Select>
              </Column>
              <Column lg={6} md={4} sm={4}>
                {selectedDatasource && (
                  <div className="datasource-info">
                    <Tag type="blue">{selectedDatasource.type}</Tag>
                    <span className="datasource-description">{selectedDatasource.description}</span>
                  </div>
                )}
              </Column>
            </Grid>

            {selectedDatasource && (
              <>
                <div className="query-section">
                  <div className="query-header">
                    <h4>Query</h4>
                    <div className="query-header-actions">
                      {selectedDatasource.type === 'sql' && (
                        <ContentSwitcher
                          size="sm"
                          selectedIndex={queryMode === 'visual' ? 0 : 1}
                          onChange={(e) => setQueryMode(e.name)}
                          className="query-mode-switcher"
                        >
                          <Switch name="visual" text="Visual" />
                          <Switch name="raw" text="Raw SQL" />
                        </ContentSwitcher>
                      )}
                      {queryMode === 'raw' && (
                        <Button
                          kind="tertiary"
                          size="sm"
                          renderIcon={Play}
                          onClick={fetchPreviewData}
                          disabled={previewLoading || !queryRaw.trim()}
                        >
                          {previewLoading ? 'Running...' : 'Run Query'}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Visual SQL Query Builder for SQL datasources */}
                  {selectedDatasource.type === 'sql' && queryMode === 'visual' ? (
                    <SQLQueryBuilder
                      datasourceId={selectedDatasourceId}
                      onQueryChange={(query) => setQueryRaw(query)}
                      onExecute={(response) => {
                        if (response.success && response.result_set) {
                          setPreviewData(response.result_set);
                          if (response.result_set.columns) {
                            setAvailableColumns(response.result_set.columns);
                          }
                          setPreviewError(null);
                        } else {
                          setPreviewError(response.error);
                        }
                      }}
                      initialQuery={queryRaw}
                    />
                  ) : (
                    <TextArea
                      id="query-raw"
                      labelText={getQueryLabelForType(selectedDatasource.type)}
                      value={queryRaw}
                      onChange={(e) => setQueryRaw(e.target.value)}
                      placeholder={getQueryPlaceholderForType(selectedDatasource.type)}
                      rows={6}
                      className="query-textarea"
                    />
                  )}
                </div>

                {previewError && (
                  <InlineNotification
                    kind="error"
                    title="Query Error"
                    subtitle={previewError}
                    lowContrast
                    hideCloseButton
                  />
                )}

                <div className="mapping-section">
                  <h4>Data Mapping</h4>
                  {availableColumns.length > 0 ? (
                    <Grid narrow>
                      <Column lg={4} md={4} sm={4}>
                        <Select
                          id="x-axis-column"
                          labelText="X-Axis (Categories)"
                          value={xAxisColumn}
                          onChange={(e) => setXAxisColumn(e.target.value)}
                        >
                          <SelectItem value="" text="Select column..." />
                          {availableColumns.map(col => (
                            <SelectItem key={col} value={col} text={col} />
                          ))}
                        </Select>
                      </Column>
                      <Column lg={4} md={4} sm={4}>
                        <div className="y-axis-selector">
                          <label className="cds--label">Y-Axis (Values)</label>
                          <div className="column-tags">
                            {availableColumns.filter(c => c !== xAxisColumn).map(col => (
                              <Tag
                                key={col}
                                type={yAxisColumns.includes(col) ? 'blue' : 'gray'}
                                onClick={() => handleYAxisToggle(col)}
                                className="column-tag"
                              >
                                {col}
                              </Tag>
                            ))}
                          </div>
                        </div>
                      </Column>
                      <Column lg={4} md={4} sm={4}>
                        <Select
                          id="group-by-column"
                          labelText="Group By (Optional)"
                          value={groupByColumn}
                          onChange={(e) => setGroupByColumn(e.target.value)}
                        >
                          <SelectItem value="" text="None" />
                          {availableColumns.filter(c => c !== xAxisColumn && !yAxisColumns.includes(c)).map(col => (
                            <SelectItem key={col} value={col} text={col} />
                          ))}
                        </Select>
                      </Column>
                    </Grid>
                  ) : (
                    <div className="saved-values-display">
                      {(xAxisColumn || yAxisColumns.length > 0 || groupByColumn) ? (
                        <Grid narrow>
                          <Column lg={4} md={4} sm={4}>
                            <div className="saved-value-field">
                              <label className="cds--label">X-Axis (Categories)</label>
                              {xAxisColumn ? (
                                <Tag type="blue">{xAxisColumn}</Tag>
                              ) : (
                                <span className="no-value">Not set</span>
                              )}
                            </div>
                          </Column>
                          <Column lg={4} md={4} sm={4}>
                            <div className="saved-value-field">
                              <label className="cds--label">Y-Axis (Values)</label>
                              {yAxisColumns.length > 0 ? (
                                <div className="column-tags">
                                  {yAxisColumns.map(col => (
                                    <Tag key={col} type="blue">{col}</Tag>
                                  ))}
                                </div>
                              ) : (
                                <span className="no-value">Not set</span>
                              )}
                            </div>
                          </Column>
                          <Column lg={4} md={4} sm={4}>
                            <div className="saved-value-field">
                              <label className="cds--label">Group By</label>
                              {groupByColumn ? (
                                <Tag type="teal">{groupByColumn}</Tag>
                              ) : (
                                <span className="no-value">None</span>
                              )}
                            </div>
                          </Column>
                        </Grid>
                      ) : (
                        <p className="run-query-hint">Run query to load available columns for mapping</p>
                      )}
                      {(xAxisColumn || yAxisColumns.length > 0) && (
                        <p className="run-query-hint" style={{ marginTop: '0.5rem' }}>Run query to modify column mappings</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Filters Section */}
                <div className="filters-section">
                  <div className="section-header">
                    <h4>Filters (Client-Side)</h4>
                    <Button
                      kind="ghost"
                      size="sm"
                      renderIcon={Add}
                      onClick={addFilter}
                      disabled={availableColumns.length === 0}
                    >
                      Add Filter
                    </Button>
                  </div>
                  {filters.length > 0 ? (
                    availableColumns.length > 0 ? (
                      <div className="filters-list">
                        {filters.map((filter, index) => (
                          <div key={index} className="filter-row">
                            <Select
                              id={`filter-field-${index}`}
                              labelText="Field"
                              value={filter.field}
                              onChange={(e) => updateFilter(index, 'field', e.target.value)}
                              size="sm"
                            >
                              {availableColumns.map(col => (
                                <SelectItem key={col} value={col} text={col} />
                              ))}
                            </Select>
                            <Select
                              id={`filter-op-${index}`}
                              labelText="Operator"
                              value={filter.op}
                              onChange={(e) => updateFilter(index, 'op', e.target.value)}
                              size="sm"
                            >
                              {FILTER_OPERATORS.map(op => (
                                <SelectItem key={op.id} value={op.id} text={op.label} />
                              ))}
                            </Select>
                            {!['isNull', 'isNotNull'].includes(filter.op) && (
                              <TextInput
                                id={`filter-value-${index}`}
                                labelText="Value"
                                value={filter.value}
                                onChange={(e) => updateFilter(index, 'value', e.target.value)}
                                placeholder={filter.op === 'in' || filter.op === 'notIn' ? 'val1, val2, val3' : 'Enter value'}
                                size="sm"
                              />
                            )}
                            <IconButton
                              label="Remove filter"
                              kind="ghost"
                              size="sm"
                              onClick={() => removeFilter(index)}
                            >
                              <TrashCan />
                            </IconButton>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="saved-filters-display">
                        <div className="filters-list">
                          {filters.map((filter, index) => (
                            <div key={index} className="filter-tag-row">
                              <Tag type="purple">{filter.field}</Tag>
                              <Tag type="gray">{FILTER_OPERATORS.find(op => op.id === filter.op)?.label || filter.op}</Tag>
                              {!['isNull', 'isNotNull'].includes(filter.op) && (
                                <Tag type="cyan">{String(filter.value)}</Tag>
                              )}
                              <IconButton
                                label="Remove filter"
                                kind="ghost"
                                size="sm"
                                onClick={() => removeFilter(index)}
                              >
                                <TrashCan />
                              </IconButton>
                            </div>
                          ))}
                        </div>
                        <p className="run-query-hint" style={{ marginTop: '0.5rem' }}>Run query to modify filters</p>
                      </div>
                    )
                  ) : (
                    <p className="no-filters-message">
                      {availableColumns.length === 0
                        ? "No filters configured. Run query to add filters."
                        : "No filters configured. Filters are applied after data is fetched."}
                    </p>
                  )}
                </div>

                {/* Aggregation & Sorting Section */}
                <div className="aggregation-section">
                  <h4>Aggregation & Sorting</h4>
                  {availableColumns.length > 0 ? (
                    <>
                      <Grid narrow>
                        <Column lg={4} md={4} sm={4}>
                          <Select
                            id="aggregation-type"
                            labelText="Aggregation"
                            value={aggregation.type}
                            onChange={(e) => updateAggregation('type', e.target.value)}
                          >
                            {AGGREGATION_TYPES.map(agg => (
                              <SelectItem key={agg.id} value={agg.id} text={agg.label} />
                            ))}
                          </Select>
                        </Column>
                        {AGGREGATION_TYPES.find(a => a.id === aggregation.type)?.needsSort && (
                          <Column lg={4} md={4} sm={4}>
                            <Select
                              id="aggregation-sort"
                              labelText="Sort By"
                              value={aggregation.sortBy}
                              onChange={(e) => updateAggregation('sortBy', e.target.value)}
                            >
                              <SelectItem value="" text="Select column..." />
                              {availableColumns.map(col => (
                                <SelectItem key={col} value={col} text={col} />
                              ))}
                            </Select>
                          </Column>
                        )}
                        {AGGREGATION_TYPES.find(a => a.id === aggregation.type)?.needsField && (
                          <Column lg={4} md={4} sm={4}>
                            <Select
                              id="aggregation-field"
                              labelText="Field"
                              value={aggregation.field}
                              onChange={(e) => updateAggregation('field', e.target.value)}
                            >
                              <SelectItem value="" text="Select column..." />
                              {availableColumns.map(col => (
                                <SelectItem key={col} value={col} text={col} />
                              ))}
                            </Select>
                          </Column>
                        )}
                        {AGGREGATION_TYPES.find(a => a.id === aggregation.type)?.needsCount && (
                          <Column lg={4} md={4} sm={4}>
                            <NumberInput
                              id="aggregation-count"
                              label="Row Count"
                              value={aggregation.count}
                              onChange={(e, { value }) => updateAggregation('count', value)}
                              min={1}
                              max={1000}
                            />
                          </Column>
                        )}
                      </Grid>
                      <Grid narrow className="sort-row">
                        <Column lg={4} md={4} sm={4}>
                          <Select
                            id="sort-by"
                            labelText="Sort By"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                          >
                            <SelectItem value="" text="None" />
                            {availableColumns.map(col => (
                              <SelectItem key={col} value={col} text={col} />
                            ))}
                          </Select>
                        </Column>
                        <Column lg={4} md={4} sm={4}>
                          <Select
                            id="sort-order"
                            labelText="Sort Order"
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value)}
                            disabled={!sortBy}
                          >
                            <SelectItem value="asc" text="Ascending" />
                            <SelectItem value="desc" text="Descending" />
                          </Select>
                        </Column>
                        <Column lg={4} md={4} sm={4}>
                          <NumberInput
                            id="limit-rows"
                            label="Limit Rows"
                            value={limitRows}
                            onChange={(e, { value }) => setLimitRows(value)}
                            min={0}
                            max={10000}
                            helperText="0 = no limit"
                          />
                        </Column>
                      </Grid>
                    </>
                  ) : (
                    <div className="saved-values-display">
                      {(aggregation?.type || sortBy || limitRows > 0) ? (
                        <>
                          <Grid narrow>
                            <Column lg={4} md={4} sm={4}>
                              <div className="saved-value-field">
                                <label className="cds--label">Aggregation</label>
                                {aggregation?.type ? (
                                  <Tag type="purple">
                                    {AGGREGATION_TYPES.find(a => a.id === aggregation.type)?.label || aggregation.type}
                                  </Tag>
                                ) : (
                                  <span className="no-value">None</span>
                                )}
                              </div>
                            </Column>
                            {aggregation?.sortBy && (
                              <Column lg={4} md={4} sm={4}>
                                <div className="saved-value-field">
                                  <label className="cds--label">Agg Sort By</label>
                                  <Tag type="blue">{aggregation.sortBy}</Tag>
                                </div>
                              </Column>
                            )}
                            {aggregation?.field && (
                              <Column lg={4} md={4} sm={4}>
                                <div className="saved-value-field">
                                  <label className="cds--label">Agg Field</label>
                                  <Tag type="blue">{aggregation.field}</Tag>
                                </div>
                              </Column>
                            )}
                            {aggregation?.type === 'limit' && (
                              <Column lg={4} md={4} sm={4}>
                                <div className="saved-value-field">
                                  <label className="cds--label">Agg Count</label>
                                  <Tag type="teal">{aggregation.count}</Tag>
                                </div>
                              </Column>
                            )}
                          </Grid>
                          <Grid narrow className="sort-row">
                            <Column lg={4} md={4} sm={4}>
                              <div className="saved-value-field">
                                <label className="cds--label">Sort By</label>
                                {sortBy ? (
                                  <Tag type="blue">{sortBy}</Tag>
                                ) : (
                                  <span className="no-value">None</span>
                                )}
                              </div>
                            </Column>
                            <Column lg={4} md={4} sm={4}>
                              <div className="saved-value-field">
                                <label className="cds--label">Sort Order</label>
                                <Tag type="gray">{sortOrder === 'asc' ? 'Ascending' : 'Descending'}</Tag>
                              </div>
                            </Column>
                            <Column lg={4} md={4} sm={4}>
                              <div className="saved-value-field">
                                <label className="cds--label">Limit Rows</label>
                                <Tag type={limitRows > 0 ? 'teal' : 'gray'}>{limitRows > 0 ? limitRows : 'No limit'}</Tag>
                              </div>
                            </Column>
                          </Grid>
                          <p className="run-query-hint" style={{ marginTop: '0.5rem' }}>Run query to modify aggregation and sorting</p>
                        </>
                      ) : (
                        <p className="run-query-hint">No aggregation configured. Run query to add aggregation and sorting.</p>
                      )}
                    </div>
                  )}
                </div>

                {filteredPreviewData && (
                  <div className="data-preview">
                    <h4>
                      {filteredPreviewData.metadata?.filtered ? (
                        <>Filtered Results ({filteredPreviewData.rows?.length || 0} of {filteredPreviewData.metadata?.original_row_count || 0} rows)</>
                      ) : (
                        <>Query Results ({filteredPreviewData.metadata?.row_count || filteredPreviewData.rows?.length || 0} rows)</>
                      )}
                    </h4>
                    <div className="preview-table-container">
                      <table className="preview-table">
                        <thead>
                          <tr>
                            {filteredPreviewData.columns?.map(col => (
                              <th key={col}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPreviewData.rows?.slice(0, 10).map((row, i) => (
                            <tr key={i}>
                              {row.map((cell, j) => (
                                <td key={j}>{String(cell)}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {filteredPreviewData.rows?.length > 10 && (
                        <p className="truncated-notice">Showing first 10 of {filteredPreviewData.rows?.length} rows...</p>
                      )}
                      {filteredPreviewData.rows?.length === 0 && (
                        <p className="no-results-notice">No rows match the current filters</p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {!selectedDatasource && (
              <div className="no-datasource-message">
                <p>Select a data source to configure data-driven charts, or switch to the Code tab for a static chart.</p>
              </div>
            )}
          </div>
        )}

        {/* Preview Tab */}
        {activeTab === 1 && (
          <div className="tab-content preview-tab">
            <div className="chart-preview-container">
              {generatedCode ? (
                <>
                  <div className="preview-chart-header">
                    <span className="preview-chart-name">{name || 'Untitled Chart'}</span>
                  </div>
                  <div className="preview-chart-body">
                    <DynamicComponentLoader code={generatedCode} props={{}} />
                  </div>
                </>
              ) : (
                <div className="preview-placeholder">
                  <ChartBar size={48} />
                  <p>Configure data source and mapping to see chart preview</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Code Tab */}
        {activeTab === 2 && (
          <div className="tab-content code-tab">
            <div className="code-header">
              <Toggle
                id="custom-code-toggle"
                labelText="Custom Code"
                labelA="Use Generated"
                labelB="Custom"
                toggled={showCustomCode}
                onToggle={() => setShowCustomCode(!showCustomCode)}
                size="sm"
              />
              <p className="code-help">
                Available: useState, useEffect, useMemo, useCallback, useRef, useData, transformData, toObjects, getValue, echarts, ReactECharts
              </p>
            </div>
            <TextArea
              id="component-code"
              labelText=""
              value={showCustomCode ? componentCode : generatedCode}
              onChange={(e) => {
                if (showCustomCode) {
                  setComponentCode(e.target.value);
                }
              }}
              readOnly={!showCustomCode}
              rows={25}
              className="code-textarea"
            />
          </div>
        )}
      </div>

      {/* Action buttons (optional, for standalone page use) */}
      {showActions && (
        <div className="chart-editor-actions">
          <Button
            kind="secondary"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            kind="primary"
            onClick={handleSave}
            disabled={saving || !name.trim()}
          >
            {saving ? 'Saving...' : (chart?.id ? 'Save Changes' : 'Create Chart')}
          </Button>
        </div>
      )}
    </div>
  );
});

// Helper functions to generate chart code
function getStaticChartCode(chartType) {
  const templates = {
    bar: `const Component = () => {
  const [data] = useState([
    { name: 'Jan', value: 400 },
    { name: 'Feb', value: 300 },
    { name: 'Mar', value: 500 },
    { name: 'Apr', value: 280 },
    { name: 'May', value: 590 },
  ]);

  const option = {
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: data.map(d => d.name) },
    yAxis: { type: 'value' },
    series: [{ data: data.map(d => d.value), type: 'bar', itemStyle: { color: '#0f62fe' } }]
  };

  return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} theme="carbon-dark" />;
};`,
    line: `const Component = () => {
  const [data] = useState([
    { name: 'Jan', value: 400 },
    { name: 'Feb', value: 300 },
    { name: 'Mar', value: 500 },
    { name: 'Apr', value: 280 },
    { name: 'May', value: 590 },
  ]);

  const option = {
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: data.map(d => d.name) },
    yAxis: { type: 'value' },
    series: [{ data: data.map(d => d.value), type: 'line', smooth: true, itemStyle: { color: '#0f62fe' } }]
  };

  return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} theme="carbon-dark" />;
};`,
    area: `const Component = () => {
  const [data] = useState([
    { name: 'Jan', value: 400 },
    { name: 'Feb', value: 300 },
    { name: 'Mar', value: 500 },
    { name: 'Apr', value: 280 },
    { name: 'May', value: 590 },
  ]);

  const option = {
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: data.map(d => d.name), boundaryGap: false },
    yAxis: { type: 'value' },
    series: [{ data: data.map(d => d.value), type: 'line', areaStyle: {}, smooth: true, itemStyle: { color: '#0f62fe' } }]
  };

  return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} theme="carbon-dark" />;
};`,
    pie: `const Component = () => {
  const [data] = useState([
    { name: 'Category A', value: 400 },
    { name: 'Category B', value: 300 },
    { name: 'Category C', value: 200 },
    { name: 'Category D', value: 100 },
  ]);

  const option = {
    tooltip: { trigger: 'item' },
    series: [{
      type: 'pie',
      radius: '70%',
      data: data,
      emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' } }
    }]
  };

  return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} theme="carbon-dark" />;
};`,
    scatter: `const Component = () => {
  const [data] = useState([
    [10, 20], [20, 30], [30, 25], [40, 45], [50, 35], [60, 55], [70, 40]
  ]);

  const option = {
    tooltip: { trigger: 'item' },
    xAxis: { type: 'value' },
    yAxis: { type: 'value' },
    series: [{ data: data, type: 'scatter', symbolSize: 15, itemStyle: { color: '#0f62fe' } }]
  };

  return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} theme="carbon-dark" />;
};`,
    gauge: `const Component = () => {
  const [value] = useState(72);

  const option = {
    series: [{
      type: 'gauge',
      progress: { show: true, width: 18 },
      axisLine: { lineStyle: { width: 18 } },
      axisTick: { show: false },
      splitLine: { length: 15, lineStyle: { width: 2, color: '#999' } },
      axisLabel: { distance: 25, color: '#999', fontSize: 14 },
      anchor: { show: true, showAbove: true, size: 25, itemStyle: { borderWidth: 10 } },
      title: { show: false },
      detail: { valueAnimation: true, fontSize: 40, offsetCenter: [0, '70%'] },
      data: [{ value: value, name: 'Score' }]
    }]
  };

  return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} theme="carbon-dark" />;
};`,
    custom: `const Component = () => {
  // Custom chart component
  // Use useData hook for data fetching:
  // const { data, loading, error } = useData({ datasourceId: 'your-id', query: {...} });

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <p>Custom chart component</p>
    </div>
  );
};`
  };

  return templates[chartType] || templates.bar;
}

function getDataDrivenChartCode(chartType, datasourceId, queryRaw, queryType, xAxisCol, yAxisCols, transforms = {}) {
  const yAxisStr = yAxisCols.length > 0 ? yAxisCols.map(c => `'${c}'`).join(', ') : "'value'";
  const { filters = [], aggregation = null, sortBy = '', sortOrder = 'desc', limit = 0 } = transforms;

  const hasTransforms = filters.length > 0 || aggregation?.type || sortBy || limit > 0;
  const transformsConfig = hasTransforms ? `
  // Apply client-side transforms
  const transforms = {
    filters: ${JSON.stringify(filters.map(f => ({
      field: f.field,
      op: f.op,
      value: f.op === 'in' || f.op === 'notIn' ? f.value.split(',').map(v => v.trim()) : f.value
    })))},
    aggregation: ${aggregation?.type ? JSON.stringify(aggregation) : 'null'},
    sortBy: ${sortBy ? `'${sortBy}'` : 'null'},
    sortOrder: '${sortOrder}',
    limit: ${limit}
  };
  const transformed = transformData(data, transforms);
  const rows = transformed.rows;` : `
  const rows = data.rows;`;

  const seriesCode = yAxisCols.length > 1
    ? `const yColumns = [${yAxisStr}];
    const series = yColumns.map((col, idx) => ({
      name: col,
      data: rows.map(r => r[${hasTransforms ? 'transformed' : 'data'}.columns.indexOf(col)]),
      type: '${chartType === 'area' ? 'line' : chartType}',
      ${chartType === 'area' ? 'areaStyle: {},' : ''}
      ${chartType === 'line' || chartType === 'area' ? 'smooth: true,' : ''}
    }));`
    : `const yColumns = [${yAxisStr}];
    const series = [{
      data: rows.map(r => r[${hasTransforms ? 'transformed' : 'data'}.columns.indexOf(yColumns[0])]),
      type: '${chartType === 'area' ? 'line' : chartType}',
      ${chartType === 'area' ? 'areaStyle: {},' : ''}
      ${chartType === 'line' || chartType === 'area' ? 'smooth: true,' : ''}
      itemStyle: { color: '#0f62fe' }
    }];`;

  if (chartType === 'pie') {
    return `const Component = () => {
  const { data, loading, error } = useData({
    datasourceId: '${datasourceId}',
    query: {
      raw: \`${queryRaw.replace(/`/g, '\\`')}\`,
      type: '${queryType}',
      params: {}
    },
    refreshInterval: 30000
  });

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>Loading...</div>;
  if (error) return <div style={{ color: '#da1e28', padding: '1rem' }}>Error: {error.message}</div>;
  if (!data?.rows?.length) return <div style={{ color: '#6f6f6f', padding: '1rem' }}>No data</div>;
${transformsConfig}

  const xCol = '${xAxisCol}';
  const yCol = ${yAxisStr.split(',')[0]};
  const xIdx = ${hasTransforms ? 'transformed' : 'data'}.columns.indexOf(xCol);
  const yIdx = ${hasTransforms ? 'transformed' : 'data'}.columns.indexOf(yCol);

  const pieData = rows.map(r => ({ name: String(r[xIdx]), value: Number(r[yIdx]) }));

  const option = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    series: [{
      type: 'pie',
      radius: '70%',
      data: pieData,
      emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' } }
    }]
  };

  return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} theme="carbon-dark" />;
};`;
  }

  if (chartType === 'gauge') {
    return `const Component = () => {
  const { data, loading, error } = useData({
    datasourceId: '${datasourceId}',
    query: {
      raw: \`${queryRaw.replace(/`/g, '\\`')}\`,
      type: '${queryType}',
      params: {}
    },
    refreshInterval: 30000
  });

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>Loading...</div>;
  if (error) return <div style={{ color: '#da1e28', padding: '1rem' }}>Error: {error.message}</div>;
  if (!data?.rows?.length) return <div style={{ color: '#6f6f6f', padding: '1rem' }}>No data</div>;
${transformsConfig}

  const yCol = ${yAxisStr.split(',')[0]};
  const yIdx = ${hasTransforms ? 'transformed' : 'data'}.columns.indexOf(yCol);
  const value = rows.length > 0 ? Number(rows[0][yIdx]) : 0;

  const option = {
    series: [{
      type: 'gauge',
      progress: { show: true, width: 18 },
      axisLine: { lineStyle: { width: 18 } },
      axisTick: { show: false },
      splitLine: { length: 15, lineStyle: { width: 2, color: '#999' } },
      axisLabel: { distance: 25, color: '#999', fontSize: 14 },
      anchor: { show: true, showAbove: true, size: 25, itemStyle: { borderWidth: 10 } },
      title: { show: false },
      detail: { valueAnimation: true, fontSize: 40, offsetCenter: [0, '70%'] },
      data: [{ value: value, name: yCol }]
    }]
  };

  return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} theme="carbon-dark" />;
};`;
  }

  return `const Component = () => {
  const { data, loading, error } = useData({
    datasourceId: '${datasourceId}',
    query: {
      raw: \`${queryRaw.replace(/`/g, '\\`')}\`,
      type: '${queryType}',
      params: {}
    },
    refreshInterval: 30000
  });

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>Loading...</div>;
  if (error) return <div style={{ color: '#da1e28', padding: '1rem' }}>Error: {error.message}</div>;
  if (!data?.rows?.length) return <div style={{ color: '#6f6f6f', padding: '1rem' }}>No data</div>;
${transformsConfig}

  const xAxisCol = '${xAxisCol}';
  const xIdx = ${hasTransforms ? 'transformed' : 'data'}.columns.indexOf(xAxisCol);
  const categories = rows.map(r => String(r[xIdx]));

  ${seriesCode}

  const option = {
    tooltip: { trigger: 'axis' },
    ${yAxisCols.length > 1 ? "legend: { data: yColumns, bottom: 0 }," : ''}
    xAxis: { type: 'category', data: categories${chartType === 'area' ? ', boundaryGap: false' : ''} },
    yAxis: { type: 'value' },
    series: series
  };

  return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} theme="carbon-dark" />;
};`;
}

function getQueryLabelForType(type) {
  switch (type) {
    case 'sql': return 'SQL Query';
    case 'api': return 'API Endpoint Path';
    case 'csv': return 'Filter Expression';
    case 'socket': return 'Stream Filter';
    default: return 'Query';
  }
}

function getQueryPlaceholderForType(type) {
  switch (type) {
    case 'sql': return 'SELECT timestamp, sensor_id, value FROM sensor_readings ORDER BY timestamp DESC LIMIT 100';
    case 'api': return '/readings/latest';
    case 'csv': return 'sensor_type = temperature';
    case 'socket': return '';
    default: return '';
  }
}

export default ChartEditor;
