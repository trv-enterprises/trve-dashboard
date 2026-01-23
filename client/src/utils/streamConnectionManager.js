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
   * Subscribe to a datasource stream
   * @param {string} datasourceId - The datasource ID
   * @param {function} callback - Called with each record: callback(record)
   * @param {object} options - Options: { onConnect, onDisconnect, onError, onReconnecting }
   * @returns {function} Unsubscribe function
   */
  subscribe(datasourceId, callback, options = {}) {
    if (!datasourceId) {
      console.error('[StreamConnectionManager] datasourceId is required');
      return () => {};
    }

    // Initialize subscribers set for this datasource
    if (!this.subscribers.has(datasourceId)) {
      this.subscribers.set(datasourceId, new Set());
    }

    // Create subscriber entry
    const subscriber = {
      callback,
      onConnect: options.onConnect || (() => {}),
      onDisconnect: options.onDisconnect || (() => {}),
      onError: options.onError || (() => {}),
      onReconnecting: options.onReconnecting || (() => {})
    };

    this.subscribers.get(datasourceId).add(subscriber);

    // Get current connection state
    const connection = this.connections.get(datasourceId);

    // If already connected, notify subscriber immediately
    if (connection?.connected) {
      subscriber.onConnect();

      // Send buffered records to new subscriber
      const buffer = this.buffers.get(datasourceId);
      if (buffer && buffer.length > 0) {
        buffer.forEach(record => subscriber.callback(record));
      }
    }

    // Start connection if not already active
    if (!connection) {
      this._connect(datasourceId);
    }

    // Return unsubscribe function
    return () => {
      this._unsubscribe(datasourceId, subscriber);
    };
  }

  /**
   * Internal: Connect to a datasource
   */
  _connect(datasourceId) {
    if (this.connections.has(datasourceId)) {
      return; // Already connecting/connected
    }

    // Mark as connecting
    this.connections.set(datasourceId, {
      eventSource: null,
      connected: false,
      reconnecting: false,
      reconnectTimeout: null,
      reconnectAttempts: 0
    });

    // Initialize buffer
    this.buffers.set(datasourceId, []);

    this._createEventSource(datasourceId);
  }

  /**
   * Internal: Create EventSource connection
   */
  _createEventSource(datasourceId) {
    const connection = this.connections.get(datasourceId);
    if (!connection) return;

    // Build URL with optional user ID
    const userGuid = apiClient.getCurrentUserGuid();
    let url = `${API_BASE}/api/datasources/${datasourceId}/stream`;
    if (userGuid) {
      url += `?user_id=${encodeURIComponent(userGuid)}`;
    }

    console.log(`[StreamConnectionManager] Connecting to ${datasourceId}`);

    const eventSource = new EventSource(url);
    connection.eventSource = eventSource;

    eventSource.onopen = () => {
      console.log(`[StreamConnectionManager] Connected to ${datasourceId}`);
      connection.connected = true;
      connection.reconnecting = false;
      connection.reconnectAttempts = 0;

      // Notify all subscribers
      const subscribers = this.subscribers.get(datasourceId);
      if (subscribers) {
        subscribers.forEach(sub => sub.onConnect());
      }
    };

    eventSource.addEventListener('record', (event) => {
      try {
        const record = JSON.parse(event.data);

        // Add to buffer
        const buffer = this.buffers.get(datasourceId) || [];
        buffer.push(record);

        // Trim buffer if too large
        if (buffer.length > this.maxBufferSize) {
          buffer.shift();
        }
        this.buffers.set(datasourceId, buffer);

        // Distribute to all subscribers
        const subscribers = this.subscribers.get(datasourceId);
        if (subscribers) {
          subscribers.forEach(sub => sub.callback(record));
        }
      } catch (err) {
        console.error('[StreamConnectionManager] Error parsing record:', err);
      }
    });

    eventSource.onerror = (err) => {
      console.error(`[StreamConnectionManager] Error on ${datasourceId}:`, err);

      // Close current connection
      eventSource.close();
      connection.eventSource = null;
      connection.connected = false;

      // Check if we still have subscribers
      const subscribers = this.subscribers.get(datasourceId);
      if (!subscribers || subscribers.size === 0) {
        // No subscribers, clean up completely
        this._cleanup(datasourceId);
        return;
      }

      // Notify subscribers of disconnect
      subscribers.forEach(sub => sub.onDisconnect());

      // Attempt reconnection with exponential backoff
      connection.reconnecting = true;
      connection.reconnectAttempts++;

      const delay = Math.min(1000 * Math.pow(2, connection.reconnectAttempts - 1), 30000);
      console.log(`[StreamConnectionManager] Reconnecting to ${datasourceId} in ${delay}ms (attempt ${connection.reconnectAttempts})`);

      // Notify subscribers of reconnecting state
      subscribers.forEach(sub => sub.onReconnecting(connection.reconnectAttempts, delay));

      connection.reconnectTimeout = setTimeout(() => {
        if (this.connections.has(datasourceId)) {
          this._createEventSource(datasourceId);
        }
      }, delay);
    };
  }

  /**
   * Internal: Unsubscribe a subscriber
   */
  _unsubscribe(datasourceId, subscriber) {
    const subscribers = this.subscribers.get(datasourceId);
    if (!subscribers) return;

    subscribers.delete(subscriber);

    console.log(`[StreamConnectionManager] Subscriber removed from ${datasourceId} (${subscribers.size} remaining)`);

    // If no more subscribers, close connection
    if (subscribers.size === 0) {
      this._cleanup(datasourceId);
    }
  }

  /**
   * Internal: Clean up a connection
   */
  _cleanup(datasourceId) {
    console.log(`[StreamConnectionManager] Cleaning up connection for ${datasourceId}`);

    const connection = this.connections.get(datasourceId);
    if (connection) {
      if (connection.eventSource) {
        connection.eventSource.close();
      }
      if (connection.reconnectTimeout) {
        clearTimeout(connection.reconnectTimeout);
      }
    }

    this.connections.delete(datasourceId);
    this.subscribers.delete(datasourceId);
    this.buffers.delete(datasourceId);
  }

  /**
   * Get connection status for a datasource
   */
  getStatus(datasourceId) {
    const connection = this.connections.get(datasourceId);
    const subscribers = this.subscribers.get(datasourceId);
    const buffer = this.buffers.get(datasourceId);

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
   * Useful for late subscribers to get initial data
   */
  getBuffer(datasourceId) {
    return this.buffers.get(datasourceId) || [];
  }
}

export default StreamConnectionManager;
