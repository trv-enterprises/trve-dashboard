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
}

export default new APIClient();
