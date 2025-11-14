/**
 * Data Client
 * API wrapper for data layer queries
 */

import apiClient from './client';

/**
 * Query data from a datasource
 * @param {string} datasourceId - ID of the datasource
 * @param {object} query - Query parameters
 * @param {boolean} useCache - Whether to use cache (default: true)
 * @returns {Promise<object>} Query result with data and source
 */
export async function queryData(datasourceId, query, useCache = true) {
  try {
    const response = await apiClient.post('/data/query', {
      datasourceId,
      query,
      useCache
    });

    return {
      data: response.data,
      source: response.source,
      cached: response.cached
    };
  } catch (error) {
    console.error('Data query error:', error);
    throw new Error(error.response?.data?.error || error.message || 'Failed to query data');
  }
}

/**
 * Get cache statistics
 * @returns {Promise<object>} Cache stats
 */
export async function getCacheStats() {
  try {
    const response = await apiClient.get('/data/cache/stats');
    return response;
  } catch (error) {
    console.error('Failed to get cache stats:', error);
    throw new Error(error.response?.data?.error || 'Failed to get cache stats');
  }
}

/**
 * Invalidate cache for a datasource
 * @param {string} datasourceId - ID of the datasource
 * @param {object} query - Optional specific query to invalidate
 * @returns {Promise<object>} Success response
 */
export async function invalidateCache(datasourceId, query = null) {
  try {
    const response = await apiClient.post('/data/cache/invalidate', {
      datasourceId,
      query
    });
    return response;
  } catch (error) {
    console.error('Failed to invalidate cache:', error);
    throw new Error(error.response?.data?.error || 'Failed to invalidate cache');
  }
}
