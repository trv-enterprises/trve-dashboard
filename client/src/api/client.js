// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

// Use current hostname for API calls (allows Tailscale/network access)
// Falls back to localhost for SSR or when window is not available
const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined') {
    return `http://${window.location.hostname}:3001`;
  }
  return 'http://localhost:3001';
};

const API_BASE_URL = getApiBaseUrl();

// Export for use in other files
export const API_BASE = API_BASE_URL;

/**
 * API Client for Dashboard Server
 */
class APIClient {
  constructor(baseURL = API_BASE_URL) {
    this.baseURL = baseURL;
    this.currentUserGuid = null;
  }

  // Set the current user GUID for authentication
  setCurrentUser(guid) {
    this.currentUserGuid = guid;
    if (guid) {
      localStorage.setItem('currentUserGuid', guid);
    } else {
      localStorage.removeItem('currentUserGuid');
    }
  }

  // Get the current user GUID (from memory or localStorage)
  getCurrentUserGuid() {
    if (!this.currentUserGuid) {
      this.currentUserGuid = localStorage.getItem('currentUserGuid');
    }
    return this.currentUserGuid;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add user authentication header if we have a current user
    const userGuid = this.getCurrentUserGuid();
    if (userGuid) {
      headers['X-User-ID'] = userGuid;
    }

    const config = {
      headers,
      ...options,
    };

    try {
      const response = await fetch(url, config);

      // Handle 204 No Content (successful DELETE)
      if (response.status === 204) {
        return { success: true };
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // Data source endpoints
  async getSystems() {
    return this.request('/api/datasources');
  }

  async getSources(system) {
    return this.request(`/api/datasources/${system}`);
  }

  async getSourceMetadata(system, source) {
    return this.request(`/api/datasources/${system}/${source}/metadata`);
  }

  async updateSourceMetadata(system, source, metadata) {
    return this.request(`/api/datasources/${system}/${source}/metadata`, {
      method: 'PUT',
      body: JSON.stringify(metadata),
    });
  }

  // Health check
  async health() {
    return this.request('/health');
  }

  // Chart endpoints
  async getCharts(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/api/charts?${params}`);
  }

  async getChart(id) {
    return this.request(`/api/charts/${id}`);
  }

  async getChartSummaries(limit = 50) {
    return this.request(`/api/charts/summaries?limit=${limit}`);
  }

  async createChart(chart) {
    return this.request('/api/charts', {
      method: 'POST',
      body: JSON.stringify(chart),
    });
  }

  async updateChart(id, updates) {
    return this.request(`/api/charts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteChart(id) {
    return this.request(`/api/charts/${id}`, {
      method: 'DELETE',
    });
  }

  // Chart versioning endpoints
  async getChartVersionInfo(id) {
    return this.request(`/api/charts/${id}/version-info`);
  }

  async getChartVersions(id) {
    return this.request(`/api/charts/${id}/versions`);
  }

  async getChartVersion(id, version) {
    return this.request(`/api/charts/${id}/versions/${version}`);
  }

  async deleteChartVersion(id, version) {
    return this.request(`/api/charts/${id}/versions/${version}`, {
      method: 'DELETE',
    });
  }

  async getChartDraft(id) {
    return this.request(`/api/charts/${id}/draft`);
  }

  async deleteChartDraft(id) {
    return this.request(`/api/charts/${id}/draft`, {
      method: 'DELETE',
    });
  }

  // Dashboard endpoints
  async getDashboards(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/api/dashboards?${params}`);
  }

  async getDashboard(id) {
    return this.request(`/api/dashboards/${id}`);
  }

  async createDashboard(dashboard) {
    return this.request('/api/dashboards', {
      method: 'POST',
      body: JSON.stringify(dashboard),
    });
  }

  async updateDashboard(id, updates) {
    return this.request(`/api/dashboards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteDashboard(id) {
    return this.request(`/api/dashboards/${id}`, {
      method: 'DELETE',
    });
  }

  // Connection endpoints (new terminology - preferred)
  async getConnections(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/api/connections?${params}`);
  }

  async getConnection(id) {
    return this.request(`/api/connections/${id}`);
  }

  async queryConnection(id, query) {
    return this.request(`/api/connections/${id}/query`, {
      method: 'POST',
      body: JSON.stringify(query),
    });
  }

  async getConnectionSchema(id) {
    return this.request(`/api/connections/${id}/schema`);
  }

  async createConnection(connection) {
    return this.request('/api/connections', {
      method: 'POST',
      body: JSON.stringify(connection),
    });
  }

  async updateConnection(id, updates) {
    return this.request(`/api/connections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteConnection(id) {
    return this.request(`/api/connections/${id}`, {
      method: 'DELETE',
    });
  }

  async testConnection(type, config) {
    return this.request('/api/connections/test', {
      method: 'POST',
      body: JSON.stringify({ type, config }),
    });
  }

  // Check health of an existing connection (uses stored credentials)
  async checkConnectionHealth(id) {
    return this.request(`/api/connections/${id}/health`, {
      method: 'POST',
    });
  }

  async getPrometheusLabelValues(connectionId, labelName) {
    return this.request(`/api/connections/${connectionId}/prometheus/labels/${encodeURIComponent(labelName)}/values`);
  }

  async getEdgeLakeDatabases(connectionId) {
    return this.request(`/api/connections/${connectionId}/edgelake/databases`);
  }

  async getEdgeLakeTables(connectionId, database) {
    return this.request(`/api/connections/${connectionId}/edgelake/tables?database=${encodeURIComponent(database)}`);
  }

  async getEdgeLakeSchema(connectionId, database, table) {
    return this.request(`/api/connections/${connectionId}/edgelake/schema?database=${encodeURIComponent(database)}&table=${encodeURIComponent(table)}`);
  }

  async getMQTTTopics(connectionId) {
    return this.request(`/api/connections/${connectionId}/mqtt/topics`);
  }

  async sampleMQTTTopic(connectionId, topic) {
    return this.request(`/api/connections/${connectionId}/mqtt/sample?topic=${encodeURIComponent(topic)}`);
  }

  // Get connections that support write operations (for controls)
  async getWritableConnections() {
    const response = await this.getConnections();
    return {
      connections: (response.datasources || response.connections || []).filter(c => c.capabilities?.can_write)
    };
  }

  // Execute a control command
  async executeControlCommand(controlId, value) {
    return this.request(`/api/controls/${controlId}/execute`, {
      method: 'POST',
      body: JSON.stringify({ value }),
    });
  }

  // Device Type endpoints
  async getDeviceTypes(filters = {}) {
    const params = new URLSearchParams();
    if (filters.category) params.append('category', filters.category);
    if (filters.protocol) params.append('protocol', filters.protocol);
    if (filters.built_in_only) params.append('built_in_only', 'true');
    if (filters.page) params.append('page', filters.page);
    if (filters.page_size) params.append('page_size', filters.page_size);
    const queryString = params.toString();
    return this.request(`/api/device-types${queryString ? '?' + queryString : ''}`);
  }

  async getDeviceType(id) {
    return this.request(`/api/device-types/${encodeURIComponent(id)}`);
  }

  async createDeviceType(deviceType) {
    return this.request('/api/device-types', {
      method: 'POST',
      body: JSON.stringify(deviceType),
    });
  }

  async updateDeviceType(id, updates) {
    return this.request(`/api/device-types/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteDeviceType(id) {
    return this.request(`/api/device-types/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  async getDeviceCategories() {
    return this.request('/api/device-types/categories');
  }

  async getDeviceTypeControlTypes() {
    return this.request('/api/device-types/control-types');
  }

  // Device endpoints
  async getDevices(filters = {}) {
    const params = new URLSearchParams();
    if (filters.device_type_id) params.append('device_type_id', filters.device_type_id);
    if (filters.connection_id) params.append('connection_id', filters.connection_id);
    if (filters.room) params.append('room', filters.room);
    if (filters.page) params.append('page', filters.page);
    if (filters.page_size) params.append('page_size', filters.page_size);
    const queryString = params.toString();
    return this.request(`/api/devices${queryString ? '?' + queryString : ''}`);
  }

  async getDevice(id) {
    return this.request(`/api/devices/${encodeURIComponent(id)}`);
  }

  async createDevice(device) {
    return this.request('/api/devices', {
      method: 'POST',
      body: JSON.stringify(device),
    });
  }

  async updateDevice(id, updates) {
    return this.request(`/api/devices/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteDevice(id) {
    return this.request(`/api/devices/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  async importDevices(connectionId, devices) {
    return this.request('/api/devices/import', {
      method: 'POST',
      body: JSON.stringify({ connection_id: connectionId, devices }),
    });
  }

  async discoverDevices(connectionId) {
    return this.request(`/api/connections/${connectionId}/discover-devices`, {
      method: 'POST',
    });
  }

  // Deprecated aliases - keep for backwards compatibility
  async getDatasources(filters = {}) {
    return this.getConnections(filters);
  }

  async getDatasource(id) {
    return this.getConnection(id);
  }

  async queryDatasource(id, query) {
    return this.queryConnection(id, query);
  }

  async getDatasourceSchema(id) {
    return this.getConnectionSchema(id);
  }

  async createDatasource(datasource) {
    return this.createConnection(datasource);
  }

  async updateDatasource(id, updates) {
    return this.updateConnection(id, updates);
  }

  async deleteDatasource(id) {
    return this.deleteConnection(id);
  }

  async testDatasource(type, config) {
    return this.testConnection(type, config);
  }

  async checkDatasourceHealth(id) {
    return this.checkConnectionHealth(id);
  }

  // AI Session endpoints
  async createAISession(chartId = null) {
    const payload = chartId ? { chart_id: chartId } : {};
    return this.request('/api/ai/sessions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getAISession(sessionId) {
    return this.request(`/api/ai/sessions/${sessionId}`);
  }

  async sendAIMessage(sessionId, content) {
    return this.request(`/api/ai/sessions/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async saveAISession(sessionId, chartName) {
    return this.request(`/api/ai/sessions/${sessionId}/save`, {
      method: 'POST',
      body: JSON.stringify({ name: chartName }),
    });
  }

  async cancelAISession(sessionId) {
    return this.request(`/api/ai/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  }

  // Returns WebSocket URL for AI session events
  getAISessionWebSocketURL(sessionId) {
    // Convert http(s) to ws(s)
    const wsProtocol = this.baseURL.startsWith('https') ? 'wss' : 'ws';
    const host = this.baseURL.replace(/^https?:\/\//, '');
    return `${wsProtocol}://${host}/api/ai/sessions/${sessionId}/ws`;
  }

  // Config endpoints
  async getSystemConfig() {
    return this.request('/api/config/system');
  }

  async updateSystemConfig(settings) {
    return this.request('/api/config/system', {
      method: 'PUT',
      body: JSON.stringify({ settings }),
    });
  }

  async getUserConfig(userId) {
    return this.request(`/api/config/user/${userId}`);
  }

  async updateUserConfig(userId, settings) {
    return this.request(`/api/config/user/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ settings }),
    });
  }

  // Server configuration (for Electron/remote connections)
  setServerUrl(url) {
    this.baseURL = url;
    localStorage.setItem('serverUrl', url);
  }

  getServerUrl() {
    return this.baseURL;
  }

  // Restore server URL from storage (call on app init)
  restoreServerUrl() {
    const savedUrl = localStorage.getItem('serverUrl');
    if (savedUrl) {
      this.baseURL = savedUrl;
    }
  }

  // Clear all stored credentials (for logout/disconnect)
  clearCredentials() {
    this.currentUserGuid = null;
    localStorage.removeItem('currentUserGuid');
    localStorage.removeItem('serverUrl');
    // Reset to default
    this.baseURL = API_BASE_URL;
  }

  // Check if credentials are stored
  hasStoredCredentials() {
    return !!(localStorage.getItem('currentUserGuid') && localStorage.getItem('serverUrl'));
  }

  // User/Auth endpoints

  // Login with a key (GUID) - validates key and returns user info
  // This endpoint does not require authentication
  async login(key) {
    const response = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ key }),
    });
    // On successful login, store the key
    if (response.guid) {
      this.setCurrentUser(response.guid);
    }
    return response;
  }

  async getUsers() {
    return this.request('/api/users');
  }

  async getCurrentUser() {
    return this.request('/api/auth/me');
  }

  async getUser(id) {
    return this.request(`/api/users/${id}`);
  }

  async createUser(user) {
    return this.request('/api/users', {
      method: 'POST',
      body: JSON.stringify(user),
    });
  }

  async updateUser(id, updates) {
    return this.request(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteUser(id) {
    return this.request(`/api/users/${id}`, {
      method: 'DELETE',
    });
  }

  // Settings endpoints
  async getSettings() {
    return this.request('/api/settings');
  }

  async getSetting(key) {
    return this.request(`/api/settings/${key}`);
  }

  async updateSetting(key, value) {
    return this.request(`/api/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    });
  }
}

export default new APIClient();
