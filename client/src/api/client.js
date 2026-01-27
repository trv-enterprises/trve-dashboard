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

  // Data sources endpoints
  async getDatasources(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/api/datasources?${params}`);
  }

  async getDatasource(id) {
    return this.request(`/api/datasources/${id}`);
  }

  async queryDatasource(id, query) {
    return this.request(`/api/datasources/${id}/query`, {
      method: 'POST',
      body: JSON.stringify(query),
    });
  }

  async getDatasourceSchema(id) {
    return this.request(`/api/datasources/${id}/schema`);
  }

  async createDatasource(datasource) {
    return this.request('/api/datasources', {
      method: 'POST',
      body: JSON.stringify(datasource),
    });
  }

  async updateDatasource(id, updates) {
    return this.request(`/api/datasources/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteDatasource(id) {
    return this.request(`/api/datasources/${id}`, {
      method: 'DELETE',
    });
  }

  async testDatasource(type, config) {
    return this.request('/api/datasources/test', {
      method: 'POST',
      body: JSON.stringify({ type, config }),
    });
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

  // User/Auth endpoints
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
