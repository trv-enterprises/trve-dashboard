const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * API Client for Dashboard Server
 */
class APIClient {
  constructor(baseURL = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
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

  // Component endpoints
  async getComponents(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/api/components?${params}`);
  }

  async getComponent(id) {
    return this.request(`/api/components/${id}`);
  }

  async getComponentByPath(system, source, name) {
    return this.request(`/api/components/by-path/${system}/${source}/${name}`);
  }

  async createComponent(component) {
    return this.request('/api/components', {
      method: 'POST',
      body: JSON.stringify(component),
    });
  }

  async updateComponent(id, updates) {
    return this.request(`/api/components/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteComponent(system, source, name) {
    return this.request(`/api/components/${system}/${source}/${name}`, {
      method: 'DELETE',
    });
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

  async setCurrentDimension(dimension) {
    return this.request('/api/config/system/dimension', {
      method: 'PUT',
      body: JSON.stringify({ dimension }),
    });
  }

  async getLayoutDimensions() {
    return this.request('/api/config/dimensions');
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
}

export default new APIClient();
