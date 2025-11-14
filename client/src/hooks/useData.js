/**
 * useData Hook
 * React hook for fetching data from datasources with caching
 *
 * Usage:
 * const { data, loading, error, refetch } = useData({
 *   datasourceId: 'uuid',
 *   query: {
 *     table: 'metrics',
 *     metric: 'cpu_usage',
 *     aggregation: 'avg',
 *     interval: '5m',
 *     startTime: new Date(Date.now() - 3600000),
 *     endTime: new Date()
 *   },
 *   refreshInterval: 5000 // Optional: auto-refresh every 5 seconds
 * });
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { queryData } from '../api/dataClient';

export function useData({ datasourceId, query, refreshInterval = null, useCache = true }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState(null); // 'cache', 'partial-cache', or 'datasource'

  const intervalRef = useRef(null);
  const mountedRef = useRef(true);

  // Fetch data function
  const fetchData = useCallback(async () => {
    if (!datasourceId || !query) {
      setError(new Error('datasourceId and query are required'));
      setLoading(false);
      return;
    }

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
    }
  }, [datasourceId, query, useCache]);

  // Refetch function (bypasses cache)
  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await queryData(datasourceId, query, false); // Force fresh fetch

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
    }
  }, [datasourceId, query]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh interval
  useEffect(() => {
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
  }, [refreshInterval, fetchData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    data,
    loading,
    error,
    refetch,
    source, // 'cache', 'partial-cache', or 'datasource'
    cached: source === 'cache' || source === 'partial-cache'
  };
}
