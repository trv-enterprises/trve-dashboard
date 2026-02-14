// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

/**
 * useStreamData Hook
 * React hook for streaming data from socket datasources via SSE
 *
 * Usage:
 * const { data, connected, error, clearBuffer } = useStreamData({
 *   datasourceId: 'uuid',
 *   maxBuffer: 1000 // Optional: max records to keep in buffer
 * });
 *
 * Returns data in same format as useData: { columns: [], rows: [] }
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE } from '../api/client';

export function useStreamData({ datasourceId, maxBuffer = 1000 }) {
  const [data, setData] = useState({ columns: [], rows: [] });
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);

  const eventSourceRef = useRef(null);
  const mountedRef = useRef(true);
  const columnsRef = useRef([]);

  // Clear buffer function
  const clearBuffer = useCallback(() => {
    setData({ columns: columnsRef.current, rows: [] });
  }, []);

  // Process incoming record and accumulate in state
  const processRecord = useCallback((record) => {
    if (!mountedRef.current) return;

    setData((prev) => {
      // Build columns from record keys if not already set
      let columns = prev.columns;
      if (columns.length === 0) {
        columns = Object.keys(record);
        columnsRef.current = columns;
      }

      // Convert record object to row array (matching column order)
      const row = columns.map(col => record[col]);

      // Append row to existing rows, respecting maxBuffer
      let newRows = [...prev.rows, row];
      if (newRows.length > maxBuffer) {
        newRows = newRows.slice(newRows.length - maxBuffer);
      }

      return { columns, rows: newRows };
    });
  }, [maxBuffer]);

  // Connect to SSE stream
  useEffect(() => {
    if (!datasourceId) {
      setError(new Error('datasourceId is required'));
      return;
    }

    mountedRef.current = true;
    let reconnectTimeout = null;
    let reconnectDelay = 1000;

    const connect = () => {
      if (!mountedRef.current) return;

      const url = `${API_BASE}/api/connections/${datasourceId}/stream`;
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        if (!mountedRef.current) return;
        setConnected(true);
        setError(null);
        reconnectDelay = 1000; // Reset backoff on successful connection
      };

      eventSource.addEventListener('record', (event) => {
        if (!mountedRef.current) return;
        try {
          const record = JSON.parse(event.data);
          processRecord(record);
        } catch (err) {
          console.error('[useStreamData] Error parsing record:', err);
        }
      });

      eventSource.addEventListener('heartbeat', () => {
        // Heartbeat received, connection is alive
      });

      eventSource.onerror = (err) => {
        if (!mountedRef.current) return;

        console.error('[useStreamData] EventSource error:', err);
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

    // Cleanup on unmount
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
  }, [datasourceId, processRecord]);

  return {
    data,
    connected,
    error,
    clearBuffer,
    // For compatibility with useData
    loading: !connected && data.rows.length === 0,
    refetch: clearBuffer,
    source: 'stream',
    cached: false
  };
}
