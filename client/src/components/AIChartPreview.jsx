// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useState, useEffect, useMemo } from 'react';
import {
  TextInput,
  ContentSwitcher,
  Switch,
  Tag,
  Button,
  Loading
} from '@carbon/react';
import { Play, Edit, Checkmark, Close } from '@carbon/icons-react';
import DynamicComponentLoader from './DynamicComponentLoader';
import { transformData } from '../utils/dataTransforms';
import apiClient from '../api/client';
import './AIChartPreview.scss';

// Filter operator labels for display
const FILTER_OP_LABELS = {
  'eq': 'Equals (=)',
  'neq': 'Not Equals',
  'gt': '>',
  'gte': '>=',
  'lt': '<',
  'lte': '<=',
  'contains': 'Contains',
  'startsWith': 'Starts With',
  'endsWith': 'Ends With',
  'in': 'In',
  'notIn': 'Not In',
  'isNull': 'Is Null',
  'isNotNull': 'Is Not Null'
};

/**
 * AIChartPreview Component
 *
 * Read-only preview of a chart configuration created by AI.
 * Similar layout to ChartEditor but without editing capabilities,
 * except for the chart name which can be edited inline.
 */
function AIChartPreview({ chart, onNameChange }) {
  const [activeTab, setActiveTab] = useState(1); // Default to Preview tab
  const [datasourceName, setDatasourceName] = useState('');
  const [datasourceType, setDatasourceType] = useState('');
  const [datasourceDescription, setDatasourceDescription] = useState('');

  // Name editing state
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [nameError, setNameError] = useState('');

  // Preview data
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  // Fetch datasource info when chart changes
  useEffect(() => {
    const fetchDatasourceInfo = async () => {
      if (chart?.datasource_id) {
        try {
          const datasource = await apiClient.getDatasource(chart.datasource_id);
          setDatasourceName(datasource.name || chart.datasource_id);
          setDatasourceType(datasource.type || '');
          setDatasourceDescription(datasource.description || '');
        } catch (err) {
          console.error('Failed to fetch datasource:', err);
          setDatasourceName(chart.datasource_id);
        }
      } else {
        setDatasourceName('');
        setDatasourceType('');
        setDatasourceDescription('');
      }
    };
    fetchDatasourceInfo();
  }, [chart?.datasource_id]);

  // Check if chart component fetches its own data (has useData embedded)
  // If so, we don't need to fetch data ourselves - the component will do it
  const chartFetchesOwnData = chart?.component_code?.includes('useData(');

  // Auto-run query when datasource or query config changes
  // Only fetch if the chart expects data as a prop (doesn't have useData embedded)
  useEffect(() => {
    if (chart?.datasource_id && !chartFetchesOwnData) {
      console.log('[AIChartPreview] Auto-running query - chart expects data as prop');
      runQuery();
    }
  }, [chart?.datasource_id, chart?.query_config?.raw, chartFetchesOwnData]);

  // Handle name editing
  const startEditName = () => {
    setEditNameValue(chart?.name || 'Untitled');
    setNameError('');
    setEditingName(true);
  };

  const cancelEditName = () => {
    setEditingName(false);
    setEditNameValue('');
    setNameError('');
  };

  const confirmEditName = async () => {
    const newName = editNameValue.trim();
    if (!newName) {
      setNameError('Name is required');
      return;
    }
    if (newName.toLowerCase().startsWith('untitled')) {
      setNameError('Please provide a proper name');
      return;
    }
    // Check for duplicate names
    try {
      const response = await apiClient.getCharts();
      const charts = response.charts || [];
      const duplicate = charts.find(c =>
        c.name.toLowerCase() === newName.toLowerCase() &&
        c.id !== chart?.id
      );
      if (duplicate) {
        setNameError('A chart with this name already exists');
        return;
      }
    } catch (err) {
      console.error('Error checking chart names:', err);
    }

    if (onNameChange) {
      onNameChange(newName);
    }
    setEditingName(false);
    setNameError('');
  };

  // Run query for preview
  const runQuery = async () => {
    if (!chart?.datasource_id) return;

    setPreviewLoading(true);
    setPreviewError(null);
    try {
      // Use query_config if available, otherwise query with empty/default
      const queryRaw = chart?.query_config?.raw || '';
      const queryType = chart?.query_config?.type || 'sql';

      const response = await apiClient.queryDatasource(chart.datasource_id, {
        query: {
          raw: queryRaw,
          type: queryType,
          params: chart?.query_config?.params || {}
        }
      });
      if (response.success && response.result_set) {
        setPreviewData(response.result_set);
      } else {
        setPreviewError(response.error || 'Query failed');
      }
    } catch (err) {
      setPreviewError(err.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Transform data with filters/aggregation
  const transformedData = useMemo(() => {
    if (!previewData) return null;

    const dataMapping = chart?.data_mapping;
    if (!dataMapping) return previewData;

    const filters = dataMapping.filters || [];
    const aggregation = dataMapping.aggregation;
    const sortBy = dataMapping.sort_by;
    const sortOrder = dataMapping.sort_order || 'desc';
    const limit = dataMapping.limit || 0;

    const hasTransforms = filters.length > 0 || aggregation?.type || sortBy || limit > 0;
    if (!hasTransforms) return previewData;

    const transforms = {
      filters: filters,
      aggregation: aggregation?.type ? aggregation : null,
      sortBy: sortBy || null,
      sortOrder: sortOrder,
      limit: limit
    };

    const result = transformData(previewData, transforms);
    return {
      columns: result.columns,
      rows: result.rows,
      metadata: {
        ...previewData.metadata,
        row_count: result.rows.length,
        filtered: filters.length > 0
      }
    };
  }, [previewData, chart?.data_mapping]);

  if (!chart) {
    return (
      <div className="ai-chart-preview empty">
        <div className="empty-state">
          <p>Chart preview will appear here</p>
          <p className="hint">Start a conversation to create your chart</p>
        </div>
      </div>
    );
  }

  const dataMapping = chart.data_mapping || {};
  const queryConfig = chart.query_config || {};
  const filters = dataMapping.filters || [];
  const aggregation = dataMapping.aggregation;

  return (
    <div className="ai-chart-preview">
      {/* Tabs */}
      <div className="preview-switcher-wrapper">
        <ContentSwitcher
          selectedIndex={activeTab}
          onChange={({ index }) => setActiveTab(index)}
          className="preview-switcher"
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
            {/* Datasource info */}
            <div className="datasource-section">
              <div className="datasource-header">
                <label>Data Source</label>
              </div>
              <div className="datasource-display">
                <span className="datasource-name">{datasourceName || 'None selected'}</span>
                {datasourceType && (
                  <>
                    <Tag type="blue" size="sm">{datasourceType}</Tag>
                    {datasourceDescription && (
                      <span className="datasource-description">{datasourceDescription}</span>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Query section */}
            {queryConfig.raw && (
              <div className="query-section">
                <div className="query-header">
                  <label>{datasourceType === 'api' ? 'API Endpoint Path' : 'Query'}</label>
                  <Button
                    kind="tertiary"
                    size="sm"
                    renderIcon={Play}
                    onClick={runQuery}
                    disabled={previewLoading}
                  >
                    {previewLoading ? 'Running...' : 'Run Query'}
                  </Button>
                </div>
                <div className="query-display">
                  <code>{queryConfig.raw}</code>
                </div>
              </div>
            )}

            {/* Data Mapping */}
            <div className="mapping-section">
              <label>Data Mapping</label>
              <div className="mapping-grid">
                <div className="mapping-item">
                  <span className="mapping-label">X-Axis (Categories)</span>
                  <div className="mapping-value">
                    {dataMapping.x_axis ? (
                      <Tag type="blue" size="sm">{dataMapping.x_axis}</Tag>
                    ) : (
                      <span className="no-value">Not set</span>
                    )}
                  </div>
                </div>
                <div className="mapping-item">
                  <span className="mapping-label">Y-Axis (Values)</span>
                  <div className="mapping-value">
                    {dataMapping.y_axis?.length > 0 ? (
                      dataMapping.y_axis.map((col, i) => (
                        <Tag key={i} type="blue" size="sm">{col}</Tag>
                      ))
                    ) : (
                      <span className="no-value">Not set</span>
                    )}
                  </div>
                </div>
                <div className="mapping-item">
                  <span className="mapping-label">Group By</span>
                  <div className="mapping-value">
                    {dataMapping.group_by ? (
                      <Tag type="blue" size="sm">{dataMapping.group_by}</Tag>
                    ) : (
                      <span className="no-value">None</span>
                    )}
                  </div>
                </div>
              </div>
              {!previewData && (
                <p className="hint-text">Run query to modify column mappings</p>
              )}
            </div>

            {/* Filters */}
            <div className="filters-section">
              <label>Filters (Client-Side)</label>
              {filters.length > 0 ? (
                <div className="filters-list">
                  {filters.map((filter, i) => (
                    <div key={i} className="filter-item">
                      <Tag type="blue" size="sm">{filter.field}</Tag>
                      <Tag type="gray" size="sm">{FILTER_OP_LABELS[filter.op] || filter.op}</Tag>
                      {filter.value !== undefined && filter.value !== '' && (
                        <Tag type="blue" size="sm">{String(filter.value)}</Tag>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="hint-text">Run query to modify filters</p>
              )}
            </div>

            {/* Aggregation */}
            <div className="aggregation-section">
              <label>Aggregation & Sorting</label>
              {aggregation?.type ? (
                <div className="aggregation-display">
                  <span>Type: {aggregation.type}</span>
                  {aggregation.field && <span>Field: {aggregation.field}</span>}
                  {aggregation.count && <span>Count: {aggregation.count}</span>}
                </div>
              ) : (
                <p className="hint-text">No aggregation configured. Run query to add aggregation and sorting.</p>
              )}
            </div>
          </div>
        )}

        {/* Preview Tab */}
        {activeTab === 1 && (
          <div className="tab-content preview-tab">
            {previewLoading ? (
              <div className="loading-container">
                <Loading description="Loading preview..." withOverlay={false} />
              </div>
            ) : previewError ? (
              <div className="error-container">
                <p className="error-text">{previewError}</p>
                <Button kind="tertiary" size="sm" onClick={runQuery}>
                  Retry
                </Button>
              </div>
            ) : chart.component_code ? (
              <div className="chart-preview-container">
                <DynamicComponentLoader
                  code={chart.component_code}
                  props={chartFetchesOwnData ? {} : { data: transformedData }}
                />
              </div>
            ) : (
              <div className="no-preview">
                <p>No chart preview available</p>
                <p className="hint">Run query in Data Source tab to see preview</p>
              </div>
            )}
          </div>
        )}

        {/* Code Tab */}
        {activeTab === 2 && (
          <div className="tab-content code-tab">
            {chart.component_code ? (
              <div className="code-display">
                <pre><code>{chart.component_code}</code></pre>
              </div>
            ) : (
              <div className="no-code">
                <p>No component code generated yet</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Metadata Footer */}
      <div className="metadata-footer">
        <div className="metadata-row">
          <div className="metadata-item">
            <span className="metadata-label">Name</span>
            <span className="metadata-value">{chart.name || 'Untitled'}</span>
          </div>
          <div className="metadata-item">
            <span className="metadata-label">Data Source</span>
            <span className="metadata-value">
              {datasourceName || 'None'}
              {datasourceType && <Tag type="blue" size="sm">{datasourceType}</Tag>}
            </span>
          </div>
        </div>
        {chart.description && (
          <div className="metadata-row description-row">
            <div className="metadata-item full-width">
              <span className="metadata-label">Description</span>
              <span className="metadata-value">{chart.description}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AIChartPreview;
