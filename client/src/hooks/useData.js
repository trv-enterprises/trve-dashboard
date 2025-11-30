/**
 * useData Hook
 * React hook for fetching data from datasources with caching
 *
 * Usage:
 * const { data, loading, error, refetch } = useData({
 *   datasourceId: 'uuid',
 *   query: {
 *     raw: '/readings',
 *     type: 'api',
 *     params: {}
 *   },
 *   refreshInterval: 5000 // Optional: auto-refresh every 5 seconds
 * });
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { queryData } from '../api/dataClient';

export function useData({ datasourceId, query, refreshInterval = null, useCache = true }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState(null);

  const intervalRef = useRef(null);
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);

  // Serialize query for stable dependency comparison
  const queryKey = useMemo(() => JSON.stringify(query), [query]);

  // Fetch data function
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

  // Refetch function (bypasses cache)
  const refetch = useCallback(async () => {
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
  }, [datasourceId, queryKey]);

  // Initial fetch - only run once when deps change
  useEffect(() => {
    mountedRef.current = true;
    fetchData();

    return () => {
      mountedRef.current = false;
    };
  }, [datasourceId, queryKey]);

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

  return {
    data,
    loading,
    error,
    refetch,
    source,
    cached: source === 'cache' || source === 'partial-cache'
  };
}
