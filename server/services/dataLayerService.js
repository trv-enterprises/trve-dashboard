/**
 * Data Layer Service
 * Handles query execution, transformations, and caching
 */

import cacheCoordinator from './cacheCoordinator.js';
import datasourceService from './datasourceService.js';
import axios from 'axios';

class DataLayerService {
  constructor() {
    this.datasourceClients = new Map();
  }

  /**
   * Execute a data query
   * @param {string} datasourceId - ID of the datasource
   * @param {object} query - Query parameters
   * @param {boolean} useCache - Whether to use cache (default: true)
   * @returns {Promise<object>} Query results
   */
  async query(datasourceId, query, useCache = true) {
    // Check cache first
    if (useCache) {
      const cached = cacheCoordinator.get(datasourceId, query);
      if (cached.data && cached.missingRanges.length === 0) {
        console.log(`✓ Cache hit for ${datasourceId}`);
        return { data: cached.data, source: 'cache' };
      }

      // Partial cache hit - fetch missing ranges
      if (cached.data && cached.missingRanges.length > 0) {
        console.log(`⚠ Partial cache hit, fetching ${cached.missingRanges.length} missing ranges`);
        const missingData = await this.fetchMissingRanges(
          datasourceId,
          query,
          cached.missingRanges
        );

        // Merge with cached data
        const mergedData = this.mergeTimeSeries(cached.data, missingData);

        // Cache the new data
        cacheCoordinator.set(datasourceId, query, mergedData);

        return { data: mergedData, source: 'partial-cache' };
      }
    }

    // Cache miss - fetch from source
    console.log(`✗ Cache miss for ${datasourceId}, fetching from source`);
    const data = await this.fetchFromDatasource(datasourceId, query);

    // Apply transformations if requested
    const transformed = query.transform
      ? this.transform(data, query.transform)
      : data;

    // Cache the result
    if (useCache) {
      cacheCoordinator.set(datasourceId, query, transformed);
    }

    return { data: transformed, source: 'datasource' };
  }

  /**
   * Fetch missing time ranges and merge into single dataset
   */
  async fetchMissingRanges(datasourceId, originalQuery, missingRanges) {
    const promises = missingRanges.map(range => {
      const rangeQuery = {
        ...originalQuery,
        startTime: range.start,
        endTime: range.end
      };
      return this.fetchFromDatasource(datasourceId, rangeQuery);
    });

    const results = await Promise.all(promises);

    // Flatten and merge all results
    return results.flat();
  }

  /**
   * Fetch data from datasource
   */
  async fetchFromDatasource(datasourceId, query) {
    const datasource = await datasourceService.getDatasource(datasourceId);
    if (!datasource) {
      throw new Error(`Datasource ${datasourceId} not found`);
    }

    switch (datasource.type) {
      case 'rest-api':
        return await this.fetchFromDatasource(datasource, query);
      default:
        throw new Error(`Unsupported datasource type: ${datasource.type}`);
    }
  }

  /**
   * Fetch data from REST API datasource
   */
  async fetchFromDatasource(datasource, query) {
    const { baseUrl, auth } = datasource.config;

    // Build datasource query
    const datasourceQuery = this.buildDatasourceQuery(query);

    try {
      const response = await axios.post(
        `${baseUrl}/query`,
        { query: datasourceQuery },
        {
          headers: {
            'Content-Type': 'application/json',
            ...(auth && { 'Authorization': `Bearer ${auth.token}` })
          },
          timeout: query.timeout || 30000
        }
      );

      return response.data;
    } catch (error) {
      console.error('Datasource query failed:', error.message);
      throw new Error(`Datasource query failed: ${error.message}`);
    }
  }

  /**
   * Build datasource SQL query from parameters
   */
  buildDatasourceQuery(query) {
    const {
      table,
      metric,
      aggregation,
      interval,
      startTime,
      endTime,
      groupBy,
      where
    } = query;

    let sql = 'SELECT ';

    // Build SELECT clause
    if (aggregation) {
      const agg = aggregation.toUpperCase();
      sql += `${agg}(${metric}) as value`;

      if (interval) {
        sql += `, time_bucket('${interval}', timestamp) as time`;
      } else {
        sql += `, timestamp as time`;
      }
    } else {
      sql += metric ? `${metric}, timestamp as time` : '*, timestamp as time';
    }

    // FROM clause
    sql += ` FROM ${table}`;

    // WHERE clause
    const conditions = [];
    if (startTime) {
      conditions.push(`timestamp >= '${startTime}'`);
    }
    if (endTime) {
      conditions.push(`timestamp <= '${endTime}'`);
    }
    if (where) {
      conditions.push(`(${where})`);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    // GROUP BY clause
    if (aggregation && interval) {
      sql += ` GROUP BY time`;
      if (groupBy) {
        sql += `, ${groupBy}`;
      }
    } else if (groupBy) {
      sql += ` GROUP BY ${groupBy}`;
    }

    // ORDER BY
    sql += ' ORDER BY time';

    return sql;
  }

  /**
   * Transform data based on transformation rules
   */
  transform(data, transformConfig) {
    if (!data || !Array.isArray(data)) {
      return data;
    }

    let result = data;

    // Apply transformations in sequence
    if (transformConfig.filter) {
      result = this.applyFilter(result, transformConfig.filter);
    }

    if (transformConfig.map) {
      result = this.applyMap(result, transformConfig.map);
    }

    if (transformConfig.aggregate) {
      result = this.applyAggregate(result, transformConfig.aggregate);
    }

    if (transformConfig.sort) {
      result = this.applySort(result, transformConfig.sort);
    }

    if (transformConfig.limit) {
      result = result.slice(0, transformConfig.limit);
    }

    return result;
  }

  /**
   * Apply filter transformation
   */
  applyFilter(data, filterConfig) {
    return data.filter(item => {
      for (const [key, condition] of Object.entries(filterConfig)) {
        if (typeof condition === 'object') {
          // Complex condition: { $gt: 100, $lt: 200 }
          for (const [op, value] of Object.entries(condition)) {
            switch (op) {
              case '$gt': if (!(item[key] > value)) return false; break;
              case '$gte': if (!(item[key] >= value)) return false; break;
              case '$lt': if (!(item[key] < value)) return false; break;
              case '$lte': if (!(item[key] <= value)) return false; break;
              case '$eq': if (item[key] !== value) return false; break;
              case '$ne': if (item[key] === value) return false; break;
              default: return false;
            }
          }
        } else {
          // Simple equality
          if (item[key] !== condition) return false;
        }
      }
      return true;
    });
  }

  /**
   * Apply map transformation
   */
  applyMap(data, mapConfig) {
    return data.map(item => {
      const mapped = {};
      for (const [newKey, oldKey] of Object.entries(mapConfig)) {
        mapped[newKey] = item[oldKey];
      }
      return mapped;
    });
  }

  /**
   * Apply aggregate transformation
   */
  applyAggregate(data, aggregateConfig) {
    const { groupBy, metrics } = aggregateConfig;

    if (!groupBy) {
      // Aggregate entire dataset
      const result = {};
      for (const [key, operation] of Object.entries(metrics)) {
        result[key] = this.calculateMetric(data, key, operation);
      }
      return [result];
    }

    // Group and aggregate
    const groups = new Map();
    data.forEach(item => {
      const groupKey = item[groupBy];
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey).push(item);
    });

    const results = [];
    for (const [groupKey, groupData] of groups.entries()) {
      const result = { [groupBy]: groupKey };
      for (const [key, operation] of Object.entries(metrics)) {
        result[key] = this.calculateMetric(groupData, key, operation);
      }
      results.push(result);
    }

    return results;
  }

  /**
   * Calculate metric (avg, sum, min, max, count)
   */
  calculateMetric(data, field, operation) {
    const values = data.map(item => item[field]).filter(v => v != null);

    switch (operation) {
      case 'avg':
        return values.reduce((sum, v) => sum + v, 0) / values.length;
      case 'sum':
        return values.reduce((sum, v) => sum + v, 0);
      case 'min':
        return Math.min(...values);
      case 'max':
        return Math.max(...values);
      case 'count':
        return values.length;
      default:
        return null;
    }
  }

  /**
   * Apply sort transformation
   */
  applySort(data, sortConfig) {
    const { field, order = 'asc' } = sortConfig;
    return data.sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return order === 'desc' ? -comparison : comparison;
    });
  }

  /**
   * Merge time series data (deduplicate by timestamp)
   */
  mergeTimeSeries(data1, data2) {
    const merged = [...data1, ...data2];
    const seen = new Set();

    return merged
      .filter(item => {
        const timestamp = item.timestamp || item.time;
        if (seen.has(timestamp)) {
          return false;
        }
        seen.add(timestamp);
        return true;
      })
      .sort((a, b) => {
        const aTime = new Date(a.timestamp || a.time).getTime();
        const bTime = new Date(b.timestamp || b.time).getTime();
        return aTime - bTime;
      });
  }

  /**
   * Invalidate cache for a datasource
   */
  invalidateCache(datasourceId, query = null) {
    cacheCoordinator.invalidate(datasourceId, query);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return cacheCoordinator.getStats();
  }
}

export default new DataLayerService();
