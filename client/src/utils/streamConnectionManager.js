// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

/**
 * Stream Connection Manager
 *
 * Provides a singleton manager for SSE/EventSource connections to socket datasources.
 * Multiple chart components can subscribe to the same datasource and share a single
 * connection, reducing network overhead and ensuring data consistency.
 *
 * Usage:
 * const manager = StreamConnectionManager.getInstance();
 * const unsubscribe = manager.subscribe(datasourceId, callback);
 * // When done:
 * unsubscribe();
 */

import { API_BASE } from '../api/client';
import apiClient from '../api/client';

class StreamConnectionManager {
  static instance = null;

  constructor() {
    // Map of datasourceId -> connection state
    this.connections = new Map();
    // Map of datasourceId -> Set of subscriber callbacks
    this.subscribers = new Map();
    // Map of datasourceId -> data buffer (for late subscribers)
    this.buffers = new Map();
    // Max buffer size per datasource
    this.maxBufferSize = 1000;
  }

  static getInstance() {
    if (!StreamConnectionManager.instance) {
      StreamConnectionManager.instance = new StreamConnectionManager();
    }
    return StreamConnectionManager.instance;
  }

  /**
   * Build a connection key from datasource ID and optional topics filter.
   * Different topic filters on the same datasource get separate SSE connections
   * so the server can filter at the source.
   */
  _connectionKey(datasourceId, topics) {
    if (!topics) return datasourceId;
    return `${datasourceId}::${topics}`;
  }

  /**
   * Subscribe to a datasource stream
   * @param {string} datasourceId - The datasource ID
   * @param {function} callback - Called with each record: callback(record)
   * @param {object} options - Options: { onConnect, onDisconnect, onError, onReconnecting, topics }
   *   topics: comma-separated MQTT topic filter string (e.g., "sensors/temp/#,home/+/status")
   * @returns {function} Unsubscribe function
   */
  subscribe(datasourceId, callback, options = {}) {
    if (!datasourceId) {
      console.error('[StreamConnectionManager] datasourceId is required');
      return () => {};
    }

    const key = this._connectionKey(datasourceId, options.topics);

    // Initialize subscribers set for this connection key
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }

    // Create subscriber entry
    const subscriber = {
      callback,
      onConnect: options.onConnect || (() => {}),
      onDisconnect: options.onDisconnect || (() => {}),
      onError: options.onError || (() => {}),
      onReconnecting: options.onReconnecting || (() => {})
    };

    this.subscribers.get(key).add(subscriber);

    // Get current connection state
    const connection = this.connections.get(key);

    // If already connected, notify subscriber immediately
    if (connection?.connected) {
      subscriber.onConnect();

      // Send buffered records to new subscriber
      const buffer = this.buffers.get(key);
      if (buffer && buffer.length > 0) {
        buffer.forEach(record => subscriber.callback(record));
      }
    }

    // Start connection if not already active
    if (!connection) {
      this._connect(key, datasourceId, options.topics);
    }

    // Return unsubscribe function
    return () => {
      this._unsubscribe(key, subscriber);
    };
  }

  /**
   * Internal: Connect to a datasource
   * @param {string} key - Connection key (datasourceId or datasourceId::topics)
   * @param {string} datasourceId - The datasource ID
   * @param {string} topics - Optional comma-separated MQTT topic filter
   */
  _connect(key, datasourceId, topics) {
    if (this.connections.has(key)) {
      return; // Already connecting/connected
    }

    // Mark as connecting
    this.connections.set(key, {
      eventSource: null,
      connected: false,
      reconnecting: false,
      reconnectTimeout: null,
      reconnectAttempts: 0,
      heartbeatTimer: null,
      lastActivity: 0,
      datasourceId,
      topics
    });

    // Initialize buffer
    this.buffers.set(key, []);

    this._createEventSource(key);
  }

  /**
   * Internal: Create EventSource connection
   */
  _createEventSource(key) {
    const connection = this.connections.get(key);
    if (!connection) return;

    const { datasourceId, topics } = connection;

    // Build URL with optional user ID and topic filters
    const userGuid = apiClient.getCurrentUserGuid();
    const params = new URLSearchParams();
    if (userGuid) {
      params.set('user_id', userGuid);
    }
    if (topics) {
      params.set('topics', topics);
    }
    const queryString = params.toString();
    let url = `${API_BASE}/api/connections/${datasourceId}/stream`;
    if (queryString) {
      url += `?${queryString}`;
    }

    console.log(`[StreamConnectionManager] Connecting to ${key}${topics ? ` (topics: ${topics})` : ''}`);

    const eventSource = new EventSource(url);
    connection.eventSource = eventSource;

    eventSource.onopen = () => {
      console.log(`[StreamConnectionManager] Connected to ${key}`);
      connection.connected = true;
      connection.reconnecting = false;
      connection.reconnectAttempts = 0;
      connection.lastActivity = Date.now();

      // Start heartbeat watchdog — server sends heartbeats every 30s,
      // so if we see nothing for 60s the connection is likely dead
      this._startHeartbeatWatchdog(key);

      // Notify all subscribers
      const subscribers = this.subscribers.get(key);
      if (subscribers) {
        subscribers.forEach(sub => sub.onConnect());
      }
    };

    // Track heartbeat events for the watchdog
    eventSource.addEventListener('heartbeat', () => {
      connection.lastActivity = Date.now();
    });

    eventSource.addEventListener('record', (event) => {
      connection.lastActivity = Date.now();
      try {
        const record = JSON.parse(event.data);

        // Add to buffer
        const buffer = this.buffers.get(key) || [];
        buffer.push(record);

        // Trim buffer if too large
        if (buffer.length > this.maxBufferSize) {
          buffer.shift();
        }
        this.buffers.set(key, buffer);

        // Distribute to all subscribers
        const subscribers = this.subscribers.get(key);
        if (subscribers) {
          subscribers.forEach(sub => sub.callback(record));
        }
      } catch (err) {
        console.error('[StreamConnectionManager] Error parsing record:', err);
      }
    });

    eventSource.onerror = (err) => {
      console.error(`[StreamConnectionManager] Error on ${key}:`, err);

      // Stop watchdog and close current connection
      this._stopHeartbeatWatchdog(key);
      eventSource.close();
      connection.eventSource = null;
      connection.connected = false;

      // Check if we still have subscribers
      const subscribers = this.subscribers.get(key);
      if (!subscribers || subscribers.size === 0) {
        // No subscribers, clean up completely
        this._cleanup(key);
        return;
      }

      // Notify subscribers of disconnect
      subscribers.forEach(sub => sub.onDisconnect());

      // Attempt reconnection with exponential backoff
      connection.reconnecting = true;
      connection.reconnectAttempts++;

      const delay = Math.min(1000 * Math.pow(2, connection.reconnectAttempts - 1), 30000);
      console.log(`[StreamConnectionManager] Reconnecting to ${key} in ${delay}ms (attempt ${connection.reconnectAttempts})`);

      // Notify subscribers of reconnecting state
      subscribers.forEach(sub => sub.onReconnecting(connection.reconnectAttempts, delay));

      connection.reconnectTimeout = setTimeout(() => {
        if (this.connections.has(key)) {
          this._createEventSource(key);
        }
      }, delay);
    };
  }

  /**
   * Internal: Unsubscribe a subscriber
   */
  _unsubscribe(key, subscriber) {
    const subscribers = this.subscribers.get(key);
    if (!subscribers) return;

    subscribers.delete(subscriber);

    console.log(`[StreamConnectionManager] Subscriber removed from ${key} (${subscribers.size} remaining)`);

    // If no more subscribers, close connection
    if (subscribers.size === 0) {
      this._cleanup(key);
    }
  }

  /**
   * Internal: Clean up a connection
   */
  _cleanup(key) {
    console.log(`[StreamConnectionManager] Cleaning up connection for ${key}`);

    const connection = this.connections.get(key);
    if (connection) {
      this._stopHeartbeatWatchdog(key);
      if (connection.eventSource) {
        connection.eventSource.close();
      }
      if (connection.reconnectTimeout) {
        clearTimeout(connection.reconnectTimeout);
      }
    }

    this.connections.delete(key);
    this.subscribers.delete(key);
    this.buffers.delete(key);
  }

  /**
   * Internal: Start a heartbeat watchdog that force-reconnects if no activity
   * is seen for 60 seconds. The server sends heartbeats every 30s, so missing
   * two in a row means the connection is dead (e.g., laptop sleep/wake).
   */
  _startHeartbeatWatchdog(key) {
    this._stopHeartbeatWatchdog(key);
    const connection = this.connections.get(key);
    if (!connection) return;

    connection.heartbeatTimer = setInterval(() => {
      const conn = this.connections.get(key);
      if (!conn || !conn.connected) return;

      const elapsed = Date.now() - conn.lastActivity;
      if (elapsed > 60000) {
        console.warn(`[StreamConnectionManager] No activity on ${key} for ${Math.round(elapsed / 1000)}s — forcing reconnect`);
        this._stopHeartbeatWatchdog(key);

        // Close the stale EventSource
        if (conn.eventSource) {
          conn.eventSource.close();
          conn.eventSource = null;
        }
        conn.connected = false;

        // Notify subscribers of disconnect
        const subscribers = this.subscribers.get(key);
        if (subscribers && subscribers.size > 0) {
          subscribers.forEach(sub => sub.onDisconnect());

          // Reconnect immediately (no backoff — this is a stale connection, not a server error)
          conn.reconnecting = true;
          conn.reconnectAttempts = 0;
          subscribers.forEach(sub => sub.onReconnecting(1, 0));
          this._createEventSource(key);
        } else {
          this._cleanup(key);
        }
      }
    }, 15000); // Check every 15 seconds
  }

  /**
   * Internal: Stop the heartbeat watchdog
   */
  _stopHeartbeatWatchdog(key) {
    const connection = this.connections.get(key);
    if (connection?.heartbeatTimer) {
      clearInterval(connection.heartbeatTimer);
      connection.heartbeatTimer = null;
    }
  }

  /**
   * Get connection status for a datasource
   * @param {string} datasourceId - The datasource ID
   * @param {string} topics - Optional topic filter (must match what was used in subscribe)
   */
  getStatus(datasourceId, topics) {
    const key = this._connectionKey(datasourceId, topics);
    const connection = this.connections.get(key);
    const subscribers = this.subscribers.get(key);
    const buffer = this.buffers.get(key);

    return {
      connected: connection?.connected || false,
      reconnecting: connection?.reconnecting || false,
      reconnectAttempts: connection?.reconnectAttempts || 0,
      subscriberCount: subscribers?.size || 0,
      bufferSize: buffer?.length || 0
    };
  }

  /**
   * Get the current buffer for a datasource
   * @param {string} datasourceId - The datasource ID
   * @param {string} topics - Optional topic filter (must match what was used in subscribe)
   */
  getBuffer(datasourceId, topics) {
    const key = this._connectionKey(datasourceId, topics);
    return this.buffers.get(key) || [];
  }
}

export default StreamConnectionManager;
