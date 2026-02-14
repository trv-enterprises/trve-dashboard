// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

/**
 * Data Client
 * API wrapper for data layer queries
 */

import apiClient from './client';

/**
 * Query data from a datasource
 * @param {string} datasourceId - ID of the datasource
 * @param {object} query - Query parameters (raw, type, params)
 * @param {boolean} useCache - Whether to use cache (default: true)
 * @returns {Promise<object>} Query result with data and source
 */
export async function queryData(datasourceId, query, useCache = true) {
  try {
    // Use the existing connection query endpoint
    const response = await apiClient.request(`/api/connections/${datasourceId}/query`, {
      method: 'POST',
      body: JSON.stringify({ query: query })
    });

    // The backend returns result_set with columns and rows
    return {
      data: response.result_set,
      source: useCache ? 'cache' : 'datasource',
      cached: useCache
    };
  } catch (error) {
    console.error('Data query error:', error);
    throw new Error(error.message || 'Failed to query data');
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
