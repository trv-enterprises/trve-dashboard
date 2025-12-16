/**
 * useData Hook
 * React hook for fetching data from datasources with caching
 * Automatically uses SSE streaming for socket datasources, polling for others
 * Supports time-bucketed aggregation for socket datasources via timeBucket option
 *
 * Usage:
 * const { data, loading, error, refetch } = useData({
 *   datasourceId: 'uuid',
 *   query: {
 *     raw: '/readings',
 *     type: 'api',
 *     params: {}
 *   },
 *   refreshInterval: 5000, // Optional: auto-refresh every 5 seconds (ignored for streaming)
 *   timeBucket: {          // Optional: server-side aggregation for socket datasources
 *     interval: 60,        // Bucket size in seconds
 *     function: 'avg',     // avg, sum, min, max, count
 *     value_cols: ['temp', 'humidity'],
 *     timestamp_col: 'timestamp'
 *   }
 * });
 *
 * Returns data in format: { columns: [], rows: [] }
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { queryData } from '../api/dataClient';
import apiClient, { API_BASE } from '../api/client';

export function useData({ datasourceId, query, refreshInterval = null, useCache = true, maxBuffer = 1000, timeBucket = null }) {
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

  // Serialize timeBucket for stable dependency comparison
  const timeBucketKey = useMemo(() => JSON.stringify(timeBucket), [timeBucket]);

  // Check if we should use aggregated streaming
  const useAggregated = useMemo(() => {
    return timeBucket && timeBucket.interval > 0 && timeBucket.timestamp_col && timeBucket.value_cols?.length > 0;
  }, [timeBucket]);

  // Connect to SSE stream for socket datasources (raw or aggregated)
  useEffect(() => {
    if (typeLoading || datasourceType !== 'socket' || !datasourceId) {
      return;
    }

    mountedRef.current = true;
    let reconnectTimeout = null;
    let reconnectDelay = 1000;
    let abortController = null;

    const connectAggregated = async () => {
      if (!mountedRef.current) return;

      // Use fetch with streaming for POST endpoint
      abortController = new AbortController();
      const url = `${API_BASE}/api/datasources/${datasourceId}/stream/aggregated`;

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            interval: timeBucket.interval,
            function: timeBucket.function || 'avg',
            value_cols: timeBucket.value_cols,
            timestamp_col: timeBucket.timestamp_col,
            series_col: timeBucket.series_col || '' // Column for bucket partitioning (e.g., location)
          }),
          signal: abortController.signal
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        setConnected(true);
        setError(null);
        setLoading(false);
        setSource('aggregated-stream');
        reconnectDelay = 1000;

        // Read the streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (mountedRef.current) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events from buffer
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith('event: ')) {
              const eventType = line.substring(7);
              const nextLine = lines[i + 1];
              if (nextLine && nextLine.startsWith('data: ')) {
                const data = nextLine.substring(6);
                i++; // Skip the data line

                if (eventType === 'bucket' && mountedRef.current) {
                  try {
                    const bucket = JSON.parse(data);
                    // Remove internal bucket metadata before processing
                    const { _bucket_function, _bucket_interval, _bucket_timestamp, ...record } = bucket;
                    processStreamRecord(record);
                  } catch (err) {
                    console.error('[useData] Error parsing bucket:', err);
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') return; // Normal cleanup

        console.error('[useData] Aggregated stream error:', err);
        if (mountedRef.current) {
          setConnected(false);
          setError(new Error('Connection lost, reconnecting...'));
          reconnectTimeout = setTimeout(() => {
            connectAggregated();
          }, reconnectDelay);
          reconnectDelay = Math.min(reconnectDelay * 2, 30000);
        }
      }
    };

    const connectRaw = () => {
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
            connectRaw();
          }, reconnectDelay);

          // Exponential backoff (max 30 seconds)
          reconnectDelay = Math.min(reconnectDelay * 2, 30000);
        }
      };
    };

    // Choose connection type based on timeBucket
    if (useAggregated) {
      connectAggregated();
    } else {
      connectRaw();
    }

    // Cleanup on unmount or type change
    return () => {
      mountedRef.current = false;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (abortController) {
        abortController.abort();
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [datasourceId, datasourceType, typeLoading, processStreamRecord, useAggregated, timeBucketKey]);

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
    source: datasourceType === 'socket' ? (useAggregated ? 'aggregated-stream' : 'stream') : source,
    cached: source === 'cache' || source === 'partial-cache',
    // Streaming-specific properties
    connected: datasourceType === 'socket' ? connected : null,
    isStreaming: datasourceType === 'socket',
    isAggregated: datasourceType === 'socket' && useAggregated,
    clearBuffer: datasourceType === 'socket' ? clearBuffer : null,
  };
}
