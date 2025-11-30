import { useState, useEffect, useMemo } from 'react';
import {
  Modal,
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
  Loading
} from '@carbon/react';
import { Play, Code, ChartBar } from '@carbon/icons-react';
import DynamicComponentLoader from './DynamicComponentLoader';
import './ChartEditorModal.scss';

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

/**
 * ChartEditorModal Component
 *
 * Large modal dialog for creating/editing charts directly from the dashboard editor.
 * Features:
 * - Chart type selection
 * - Data source selection and query configuration
 * - Data mapping (columns to axes)
 * - Live preview with real data
 * - Custom code editor for advanced charts
 */
function ChartEditorModal({ open, onClose, onSave, chart, panelId }) {
  // Basic info
  const [name, setName] = useState('');
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

  // Preview data
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [availableColumns, setAvailableColumns] = useState([]);

  // Code editor
  const [componentCode, setComponentCode] = useState('');
  const [showCustomCode, setShowCustomCode] = useState(false);

  // UI state
  const [activeTab, setActiveTab] = useState(0);
  const [saving, setSaving] = useState(false);

  // Fetch datasources on mount
  useEffect(() => {
    fetchDatasources();
  }, []);

  // Initialize form when modal opens or chart changes
  useEffect(() => {
    if (open) {
      if (chart) {
        // Editing existing chart
        setName(chart.name || '');
        setChartType(chart.chart_type || 'bar');
        setSelectedDatasourceId(chart.datasource_id || '');
        setQueryRaw(chart.query_config?.raw || '');
        setQueryType(chart.query_config?.type || 'sql');
        setXAxisColumn(chart.data_mapping?.x_axis || '');
        setYAxisColumns(chart.data_mapping?.y_axis || []);
        setGroupByColumn(chart.data_mapping?.group_by || '');
        setComponentCode(chart.component_code || '');
        setShowCustomCode(chart.chart_type === 'custom' || !!chart.component_code);
      } else {
        // New chart - reset to defaults
        resetForm();
      }
    }
  }, [open, chart]);

  // Update selectedDatasource when ID changes
  useEffect(() => {
    if (selectedDatasourceId && datasources.length > 0) {
      const ds = datasources.find(d => d.id === selectedDatasourceId);
      setSelectedDatasource(ds || null);

      // Set default query type based on datasource type
      if (ds) {
        switch (ds.type) {
          case 'sql':
            setQueryType('sql');
            break;
          case 'api':
            setQueryType('api');
            break;
          case 'csv':
            setQueryType('csv_filter');
            break;
          case 'socket':
            setQueryType('stream_filter');
            break;
        }
      }
    } else {
      setSelectedDatasource(null);
    }
  }, [selectedDatasourceId, datasources]);

  const resetForm = () => {
    setName('');
    setChartType('bar');
    setSelectedDatasourceId('');
    setSelectedDatasource(null);
    setQueryRaw('');
    setQueryType('sql');
    setXAxisColumn('');
    setYAxisColumns([]);
    setGroupByColumn('');
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

  // Execute query to get preview data
  const fetchPreviewData = async () => {
    if (!selectedDatasourceId || !queryRaw.trim()) {
      setPreviewError('Please select a datasource and enter a query');
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

      // Extract column names from result
      if (data.result_set?.columns) {
        setAvailableColumns(data.result_set.columns);

        // Auto-select first column as X axis if not set
        if (!xAxisColumn && data.result_set.columns.length > 0) {
          setXAxisColumn(data.result_set.columns[0]);
        }
        // Auto-select second column as Y axis if not set
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

  // Generate component code based on configuration
  const generatedCode = useMemo(() => {
    if (showCustomCode && componentCode) {
      return componentCode;
    }

    if (!selectedDatasourceId) {
      return getStaticChartCode(chartType);
    }

    return getDataDrivenChartCode(chartType, selectedDatasourceId, queryRaw, queryType, xAxisColumn, yAxisColumns);
  }, [chartType, selectedDatasourceId, queryRaw, queryType, xAxisColumn, yAxisColumns, showCustomCode, componentCode]);

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Please enter a chart name');
      return;
    }

    setSaving(true);
    try {
      const chartData = {
        id: chart?.id || crypto.randomUUID(),
        name: name.trim(),
        chart_type: chartType,
        datasource_id: selectedDatasourceId || null,
        query_config: selectedDatasourceId ? {
          raw: queryRaw,
          type: queryType,
          params: {}
        } : null,
        data_mapping: selectedDatasourceId ? {
          x_axis: xAxisColumn,
          y_axis: yAxisColumns,
          group_by: groupByColumn || null
        } : null,
        component_code: showCustomCode ? componentCode : generatedCode,
        panel_id: panelId,
      };

      await onSave(chartData);
      onClose();
    } catch (err) {
      alert(`Error saving chart: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      onClose();
    }
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

  return (
    <Modal
      open={open}
      onRequestClose={handleClose}
      onRequestSubmit={handleSave}
      modalHeading={chart ? `Edit Chart: ${chart.name || 'Untitled'}` : 'Create New Chart'}
      modalLabel="Chart Editor"
      primaryButtonText={saving ? 'Saving...' : 'Save Chart'}
      secondaryButtonText="Cancel"
      primaryButtonDisabled={saving || !name.trim()}
      size="lg"
      className="chart-editor-modal"
      preventCloseOnClickOutside
      isFullWidth
    >
      <div className="chart-editor-content">
        {/* Chart basic info */}
        <div className="chart-metadata-section">
          <Grid narrow>
            <Column lg={6} md={4} sm={4}>
              <TextInput
                id="chart-name"
                labelText="Chart Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter chart name"
                size="md"
              />
            </Column>
            <Column lg={6} md={4} sm={4}>
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
            </Column>
          </Grid>
        </div>

        <ContentSwitcher
          selectedIndex={activeTab}
          onChange={({ index }) => setActiveTab(index)}
          className="chart-editor-switcher"
        >
          <Switch name="datasource" text="Data Source" />
          <Switch name="preview" text="Preview" />
          <Switch name="code" text="Code" />
        </ContentSwitcher>

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
                      onChange={(e) => setSelectedDatasourceId(e.target.value)}
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
                        <Button
                          kind="tertiary"
                          size="sm"
                          renderIcon={Play}
                          onClick={fetchPreviewData}
                          disabled={previewLoading || !queryRaw.trim()}
                        >
                          {previewLoading ? 'Running...' : 'Run Query'}
                        </Button>
                      </div>
                      <TextArea
                        id="query-raw"
                        labelText={getQueryLabelForType(selectedDatasource.type)}
                        value={queryRaw}
                        onChange={(e) => setQueryRaw(e.target.value)}
                        placeholder={getQueryPlaceholderForType(selectedDatasource.type)}
                        rows={6}
                        className="query-textarea"
                      />
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

                    {availableColumns.length > 0 && (
                      <div className="mapping-section">
                        <h4>Data Mapping</h4>
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
                      </div>
                    )}

                    {previewData && (
                      <div className="data-preview">
                        <h4>Query Results ({previewData.metadata?.row_count || 0} rows)</h4>
                        <div className="preview-table-container">
                          <table className="preview-table">
                            <thead>
                              <tr>
                                {previewData.columns?.map(col => (
                                  <th key={col}>{col}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {previewData.rows?.slice(0, 10).map((row, i) => (
                                <tr key={i}>
                                  {row.map((cell, j) => (
                                    <td key={j}>{String(cell)}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {previewData.rows?.length > 10 && (
                            <p className="truncated-notice">Showing first 10 rows...</p>
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
                  Available: useState, useEffect, useMemo, useCallback, useRef, useData, echarts, ReactECharts
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
      </div>
    </Modal>
  );
}

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

function getDataDrivenChartCode(chartType, datasourceId, queryRaw, queryType, xAxisCol, yAxisCols) {
  const yAxisStr = yAxisCols.length > 0 ? yAxisCols.map(c => `'${c}'`).join(', ') : "'value'";

  const seriesCode = yAxisCols.length > 1
    ? `const yColumns = [${yAxisStr}];
    const series = yColumns.map((col, idx) => ({
      name: col,
      data: rows.map(r => r[data.columns.indexOf(col)]),
      type: '${chartType === 'area' ? 'line' : chartType}',
      ${chartType === 'area' ? 'areaStyle: {},' : ''}
      ${chartType === 'line' || chartType === 'area' ? 'smooth: true,' : ''}
    }));`
    : `const yColumns = [${yAxisStr}];
    const series = [{
      data: rows.map(r => r[data.columns.indexOf(yColumns[0])]),
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

  const xCol = '${xAxisCol}';
  const yCol = ${yAxisStr.split(',')[0]};
  const xIdx = data.columns.indexOf(xCol);
  const yIdx = data.columns.indexOf(yCol);

  const pieData = data.rows.map(r => ({ name: String(r[xIdx]), value: Number(r[yIdx]) }));

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

  const rows = data.rows;
  const xAxisCol = '${xAxisCol}';
  const xIdx = data.columns.indexOf(xAxisCol);
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

export default ChartEditorModal;
