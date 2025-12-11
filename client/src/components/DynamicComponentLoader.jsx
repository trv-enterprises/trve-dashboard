import { useState, useEffect, useMemo, useContext, createContext } from 'react';
import * as React from 'react';
import * as echarts from 'echarts';
import ReactECharts from 'echarts-for-react';
import { carbonLightTheme, carbonDarkTheme } from '../theme/carbonEchartsTheme';
import { useData as useDataOriginal } from '../hooks/useData';
import { transformData, toObjects, getValue, formatTimestamp, formatCellValue, buildTransformsFromMapping } from '../utils/dataTransforms';
import * as Babel from '@babel/standalone';
import {
  DataTable,
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
  Loading
} from '@carbon/react';

// Context to provide transforms to child components
const TransformsContext = createContext(null);

// Context to provide data fetched by DynamicComponentLoader
const DataContext = createContext(null);

/**
 * Custom hook that wraps useData and auto-applies transforms from context
 * When dataMapping is provided to DynamicComponentLoader, the chart's filters
 * are automatically applied to the data without requiring any code changes.
 */
function useDataWithTransforms(params) {
  const transforms = useContext(TransformsContext);
  const result = useDataOriginal(params);

  // Apply transforms if we have them and data is ready
  const transformedData = useMemo(() => {
    if (!transforms || !result.data) {
      return result.data;
    }
    return transformData(result.data, transforms);
  }, [result.data, transforms]);

  return {
    ...result,
    data: transformedData,
    // Keep original data available if needed
    rawData: result.data
  };
}

/**
 * Dynamic Component Loader
 * Loads and renders React components from string code at runtime
 *
 * Available libraries in component scope:
 * - React hooks: useState, useEffect, useMemo, useCallback, useRef, useContext
 * - useData: Custom hook for fetching data from datasources with caching
 *   (auto-applies transforms from dataMapping prop if provided)
 * - transformData: Utility to apply filters and aggregations to data
 * - toObjects: Convert columnar data to array of objects
 * - getValue: Get a single value from first row of data
 * - formatTimestamp: Format timestamp values for display (supports Unix seconds, ms, ISO)
 * - formatCellValue: Auto-format cell values based on column name and value type
 * - echarts: ECharts core library
 * - ReactECharts: ECharts React wrapper component
 * - carbonTheme: Carbon Design System ECharts theme (light mode)
 * - carbonDarkTheme: Carbon Design System ECharts theme (dark mode)
 * - Carbon DataTable components: DataTable, Table, TableHead, TableRow, TableHeader,
 *   TableBody, TableCell, TableContainer, TableToolbar, TableToolbarContent, TableToolbarSearch
 */
export default function DynamicComponentLoader({ code, props = {}, dataMapping = null, datasourceId = null, dataRefreshInterval = null }) {
  const [error, setError] = useState(null);
  const [Component, setComponent] = useState(null);

  // Get datasource ID from prop or dataMapping
  const effectiveDatasourceId = datasourceId || dataMapping?.datasource_id;

  // Build transforms from dataMapping (memoized)
  const transforms = useMemo(() => buildTransformsFromMapping(dataMapping), [dataMapping]);

  // Determine if we need to fetch data ourselves
  // Fetch data when: datasourceId is available AND no data prop was provided
  const shouldFetchData = effectiveDatasourceId && !props.data;

  // Use data hook when we need to fetch (always called but disabled when not needed)
  // dataRefreshInterval is in milliseconds, passed from dashboard settings
  const {
    data: fetchedData,
    loading: dataLoading,
    error: dataError,
    isStreaming
  } = useDataOriginal({
    datasourceId: shouldFetchData ? effectiveDatasourceId : null,
    query: dataMapping?.query_config || { raw: '', type: 'sql' },
    refreshInterval: dataRefreshInterval,
    useCache: true
  });

  // Apply transforms to fetched data
  const transformedFetchedData = useMemo(() => {
    if (!shouldFetchData || !fetchedData) return null;
    if (!transforms) return fetchedData;
    return transformData(fetchedData, transforms);
  }, [fetchedData, transforms, shouldFetchData]);

  useEffect(() => {
    if (!code) {
      setComponent(null);
      setError(null);
      return;
    }

    try {
      // Register Carbon themes with ECharts
      echarts.registerTheme('carbon-light', carbonLightTheme);
      echarts.registerTheme('carbon-dark', carbonDarkTheme);

      // Transform JSX to JavaScript using Babel
      const transformedCode = Babel.transform(code, {
        presets: ['react'],
      }).code;

      // Create a function that will evaluate the component code
      // We provide React hooks, data fetching, transforms, and visualization libraries in the scope
      const componentFunction = new Function(
        'React',
        'useState',
        'useEffect',
        'useMemo',
        'useCallback',
        'useRef',
        'useContext',
        'useData',
        'transformData',
        'toObjects',
        'getValue',
        'formatTimestamp',
        'formatCellValue',
        'echarts',
        'ReactECharts',
        'carbonTheme',
        'carbonDarkTheme',
        'DataTable',
        'Table',
        'TableHead',
        'TableRow',
        'TableHeader',
        'TableBody',
        'TableCell',
        'TableContainer',
        'TableToolbar',
        'TableToolbarContent',
        'TableToolbarSearch',
        `
        ${transformedCode}
        return typeof Component !== 'undefined' ? Component :
               typeof Widget !== 'undefined' ? Widget :
               (function() { throw new Error('Component or Widget not found in code') })();
        `
      );

      // Execute the function with React dependencies, data hooks, transforms, and visualization libraries
      const LoadedComponent = componentFunction(
        React,
        React.useState,
        React.useEffect,
        React.useMemo,
        React.useCallback,
        React.useRef,
        React.useContext,
        useDataWithTransforms, // Use our wrapped version that auto-applies transforms from context
        transformData,
        toObjects,
        getValue,
        formatTimestamp,
        formatCellValue,
        echarts,
        ReactECharts,
        carbonLightTheme,
        carbonDarkTheme,
        DataTable,
        Table,
        TableHead,
        TableRow,
        TableHeader,
        TableBody,
        TableCell,
        TableContainer,
        TableToolbar,
        TableToolbarContent,
        TableToolbarSearch
      );

      setComponent(() => LoadedComponent);
      setError(null);
    } catch (err) {
      console.error('Error loading component:', err);
      setError(err.message);
      setComponent(null);
    }
  }, [code]);

  if (error) {
    return (
      <div style={{
        padding: '20px',
        border: '2px solid #da1e28',
        borderRadius: '4px',
        backgroundColor: '#fff1f1',
        color: '#750e13'
      }}>
        <h3 style={{ margin: '0 0 10px 0', fontWeight: 600 }}>Component Error</h3>
        <pre style={{
          margin: 0,
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
          fontSize: '14px',
          fontFamily: "'IBM Plex Mono', 'Menlo', 'Courier New', monospace"
        }}>
          {error}
        </pre>
      </div>
    );
  }

  if (!Component) {
    return null;
  }

  // If we're fetching data ourselves and it's loading (and no data yet)
  if (shouldFetchData && dataLoading && !transformedFetchedData) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#c6c6c6'
      }}>
        <Loading description={isStreaming ? 'Connecting to stream...' : 'Loading data...'} withOverlay={false} small />
      </div>
    );
  }

  // If we're fetching data ourselves and there's an error
  if (shouldFetchData && dataError && !transformedFetchedData) {
    return (
      <div style={{
        padding: '20px',
        border: '1px solid #da1e28',
        borderRadius: '4px',
        backgroundColor: 'rgba(218, 30, 40, 0.1)',
        color: '#fa4d56'
      }}>
        <p style={{ margin: 0, fontSize: '14px' }}>Data Error: {dataError.message || 'Failed to fetch data'}</p>
      </div>
    );
  }

  // Determine final props - if we fetched data, add it; otherwise use provided props
  const finalProps = shouldFetchData
    ? { ...props, data: transformedFetchedData }
    : props;

  return (
    <TransformsContext.Provider value={transforms}>
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Component {...finalProps} />
      </div>
    </TransformsContext.Provider>
  );
}
