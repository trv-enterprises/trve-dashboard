/**
 * useData Hook
 * React hook for fetching data from datasources with caching
 * Automatically uses SSE streaming for socket datasources, polling for others
 *
 * Usage:
 * const { data, loading, error, refetch } = useData({
 *   datasourceId: 'uuid',
 *   query: {
 *     raw: '/readings',
 *     type: 'api',
 *     params: {}
 *   },
 *   refreshInterval: 5000 // Optional: auto-refresh every 5 seconds (ignored for streaming)
 * });
 *
 * Returns data in format: { columns: [], rows: [] }
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { queryData } from '../api/dataClient';
import apiClient from '../api/client';

const API_BASE = 'http://localhost:3001';

export function useData({ datasourceId, query, refreshInterval = null, useCache = true, maxBuffer = 1000 }) {
  // Common state
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState(null);
  const [connected, setConnected] = useState(false);

  // Datasource type detection
  const [datasourceType, setDatasourceType] = useState(null);
  const [typeLoading, setTypeLoading] = useState(true);

  // Refs for cleanup
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);
  const intervalRef = useRef(null);
  const eventSourceRef = useRef(null);
  const columnsRef = useRef([]);

  // Serialize query for stable dependency comparison
  const queryKey = useMemo(() => JSON.stringify(query), [query]);

  // Fetch datasource type on mount
  useEffect(() => {
    if (!datasourceId) {
      setTypeLoading(false);
      return;
    }

    let cancelled = false;

    const fetchType = async () => {
      try {
        const ds = await apiClient.getDatasource(datasourceId);
        if (!cancelled && mountedRef.current) {
          setDatasourceType(ds.type);
          setTypeLoading(false);
        }
      } catch (err) {
        console.error('[useData] Failed to fetch datasource type:', err);
        if (!cancelled && mountedRef.current) {
          // Default to non-streaming on error
          setDatasourceType('unknown');
          setTypeLoading(false);
        }
      }
    };

    fetchType();

    return () => {
      cancelled = true;
    };
  }, [datasourceId]);

  // === STREAMING LOGIC (for socket datasources) ===
  const processStreamRecord = useCallback((record) => {
    if (!mountedRef.current) return;

    setData((prev) => {
      const prevData = prev || { columns: [], rows: [] };

      // Build columns from record keys if not already set
      let columns = prevData.columns;
      if (columns.length === 0) {
        columns = Object.keys(record);
        columnsRef.current = columns;
      }

      // Convert record object to row array (matching column order)
      const row = columns.map(col => record[col]);

      // Append row to existing rows, respecting maxBuffer
      let newRows = [...prevData.rows, row];
      if (newRows.length > maxBuffer) {
        newRows = newRows.slice(newRows.length - maxBuffer);
      }

      return { columns, rows: newRows };
    });
  }, [maxBuffer]);

  // Connect to SSE stream for socket datasources
  useEffect(() => {
    if (typeLoading || datasourceType !== 'socket' || !datasourceId) {
      return;
    }

    mountedRef.current = true;
    let reconnectTimeout = null;
    let reconnectDelay = 1000;

    const connect = () => {
      if (!mountedRef.current) return;

      const url = `${API_BASE}/api/datasources/${datasourceId}/stream`;
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        if (!mountedRef.current) return;
        setConnected(true);
        setError(null);
        setLoading(false);
        setSource('stream');
        reconnectDelay = 1000; // Reset backoff on successful connection
      };

      eventSource.addEventListener('record', (event) => {
        if (!mountedRef.current) return;
        try {
          const record = JSON.parse(event.data);
          processStreamRecord(record);
        } catch (err) {
          console.error('[useData] Error parsing stream record:', err);
        }
      });

      eventSource.addEventListener('heartbeat', () => {
        // Heartbeat received, connection is alive
      });

      eventSource.onerror = (err) => {
        if (!mountedRef.current) return;

        console.error('[useData] EventSource error:', err);
        setConnected(false);

        // Close the errored connection
        eventSource.close();
        eventSourceRef.current = null;

        // Attempt to reconnect with exponential backoff
        if (mountedRef.current) {
          setError(new Error('Connection lost, reconnecting...'));
          reconnectTimeout = setTimeout(() => {
            connect();
          }, reconnectDelay);

          // Exponential backoff (max 30 seconds)
          reconnectDelay = Math.min(reconnectDelay * 2, 30000);
        }
      };
    };

    connect();

    // Cleanup on unmount or type change
    return () => {
      mountedRef.current = false;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [datasourceId, datasourceType, typeLoading, processStreamRecord]);

  // === POLLING LOGIC (for non-socket datasources) ===
  const fetchData = useCallback(async () => {
    if (!datasourceId || !query) {
      setError(new Error('datasourceId and query are required'));
      setLoading(false);
      return;
    }

    // Prevent concurrent fetches
    if (fetchingRef.current) {
      return;
    }

    fetchingRef.current = true;

    try {
      setLoading(true);
      setError(null);

      const result = await queryData(datasourceId, query, useCache);

      if (mountedRef.current) {
        setData(result.data);
        setSource(result.source);
        setLoading(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err);
        setLoading(false);
      }
    } finally {
      fetchingRef.current = false;
    }
  }, [datasourceId, queryKey, useCache]);

  // Initial fetch for non-socket datasources
  useEffect(() => {
    if (typeLoading || datasourceType === 'socket' || !datasourceId) {
      return;
    }

    mountedRef.current = true;
    fetchData();

    return () => {
      mountedRef.current = false;
    };
  }, [datasourceId, queryKey, datasourceType, typeLoading, fetchData]);

  // Auto-refresh interval for non-socket datasources
  useEffect(() => {
    if (typeLoading || datasourceType === 'socket') {
      return; // Streaming handles its own updates
    }

    if (refreshInterval && refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        fetchData();
      }, refreshInterval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [refreshInterval, fetchData, datasourceType, typeLoading]);

  // Refetch function (bypasses cache for polling, clears buffer for streaming)
  const refetch = useCallback(async () => {
    if (datasourceType === 'socket') {
      // For streaming, clear the buffer
      setData({ columns: columnsRef.current, rows: [] });
      return;
    }

    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      setLoading(true);
      setError(null);

      const result = await queryData(datasourceId, query, false);

      if (mountedRef.current) {
        setData(result.data);
        setSource(result.source);
        setLoading(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err);
        setLoading(false);
      }
    } finally {
      fetchingRef.current = false;
    }
  }, [datasourceId, queryKey, datasourceType]);

  // Clear buffer function (for streaming)
  const clearBuffer = useCallback(() => {
    setData({ columns: columnsRef.current, rows: [] });
  }, []);

  return {
    data,
    loading: typeLoading || loading,
    error,
    refetch,
    source: datasourceType === 'socket' ? 'stream' : source,
    cached: source === 'cache' || source === 'partial-cache',
    // Streaming-specific properties
    connected: datasourceType === 'socket' ? connected : null,
    isStreaming: datasourceType === 'socket',
    clearBuffer: datasourceType === 'socket' ? clearBuffer : null,
  };
}
