/**
 * Cache Coordinator
 * Manages time-series data caching with intelligent range tracking
 */

class TimeRange {
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }

  contains(timestamp) {
    return timestamp >= this.start && timestamp <= this.end;
  }

  overlaps(other) {
    return this.start <= other.end && this.end >= other.start;
  }

  merge(other) {
    return new TimeRange(
      Math.min(this.start, other.start),
      Math.max(this.end, other.end)
    );
  }
}

class CacheEntry {
  constructor(data, range, ttl = 60000) {
    this.data = data;
    this.range = range;
    this.createdAt = Date.now();
    this.ttl = ttl; // milliseconds
  }

  isExpired() {
    return Date.now() - this.createdAt > this.ttl;
  }

  get expiresAt() {
    return this.createdAt + this.ttl;
  }
}

class CacheCoordinator {
  constructor() {
    // Map of query keys to arrays of cache entries
    this.cache = new Map();
  }

  /**
   * Generate cache key from query parameters
   */
  generateKey(datasourceId, query) {
    const keyParts = [
      datasourceId,
      query.metric || 'default',
      query.aggregation || 'raw',
      query.interval || 'none'
    ];
    return keyParts.join(':');
  }

  /**
   * Get cached data for a time range query
   * Returns { data, missingRanges }
   */
  get(datasourceId, query) {
    const key = this.generateKey(datasourceId, query);
    const entries = this.cache.get(key) || [];

    // Remove expired entries
    const validEntries = entries.filter(entry => !entry.isExpired());
    if (validEntries.length !== entries.length) {
      this.cache.set(key, validEntries);
    }

    if (!query.startTime || !query.endTime) {
      // Not a time-series query, return first valid entry
      return validEntries.length > 0
        ? { data: validEntries[0].data, missingRanges: [] }
        : { data: null, missingRanges: [{ start: null, end: null }] };
    }

    const requestedRange = new TimeRange(
      new Date(query.startTime).getTime(),
      new Date(query.endTime).getTime()
    );

    // Find all entries that overlap with requested range
    const overlapping = validEntries.filter(entry =>
      entry.range.overlaps(requestedRange)
    );

    if (overlapping.length === 0) {
      // No cached data at all
      return {
        data: null,
        missingRanges: [{ start: query.startTime, end: query.endTime }]
      };
    }

    // Merge overlapping data and find gaps
    const { data, coveredRanges } = this.mergeDataFromEntries(
      overlapping,
      requestedRange
    );

    const missingRanges = this.findMissingRanges(requestedRange, coveredRanges);

    return {
      data: data.length > 0 ? data : null,
      missingRanges
    };
  }

  /**
   * Merge data from multiple cache entries
   */
  mergeDataFromEntries(entries, requestedRange) {
    const allData = [];
    const coveredRanges = [];

    entries.forEach(entry => {
      // Filter data points within requested range
      const relevantData = entry.data.filter(point => {
        const timestamp = new Date(point.timestamp || point.time).getTime();
        return requestedRange.contains(timestamp);
      });

      allData.push(...relevantData);

      // Track covered range
      const intersectionStart = Math.max(entry.range.start, requestedRange.start);
      const intersectionEnd = Math.min(entry.range.end, requestedRange.end);
      if (intersectionStart < intersectionEnd) {
        coveredRanges.push(new TimeRange(intersectionStart, intersectionEnd));
      }
    });

    // Sort by timestamp and deduplicate
    const sortedData = allData.sort((a, b) => {
      const aTime = new Date(a.timestamp || a.time).getTime();
      const bTime = new Date(b.timestamp || b.time).getTime();
      return aTime - bTime;
    });

    // Remove duplicates (same timestamp)
    const uniqueData = [];
    let lastTimestamp = null;
    sortedData.forEach(point => {
      const timestamp = new Date(point.timestamp || point.time).getTime();
      if (timestamp !== lastTimestamp) {
        uniqueData.push(point);
        lastTimestamp = timestamp;
      }
    });

    return { data: uniqueData, coveredRanges };
  }

  /**
   * Find gaps in coverage
   */
  findMissingRanges(requestedRange, coveredRanges) {
    if (coveredRanges.length === 0) {
      return [{
        start: new Date(requestedRange.start).toISOString(),
        end: new Date(requestedRange.end).toISOString()
      }];
    }

    // Sort covered ranges
    const sorted = coveredRanges.sort((a, b) => a.start - b.start);

    // Merge overlapping covered ranges
    const merged = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const last = merged[merged.length - 1];
      const current = sorted[i];

      if (current.start <= last.end) {
        // Overlapping, merge
        last.end = Math.max(last.end, current.end);
      } else {
        // Gap found
        merged.push(current);
      }
    }

    // Find gaps
    const gaps = [];

    // Gap before first range
    if (merged[0].start > requestedRange.start) {
      gaps.push({
        start: new Date(requestedRange.start).toISOString(),
        end: new Date(merged[0].start).toISOString()
      });
    }

    // Gaps between ranges
    for (let i = 0; i < merged.length - 1; i++) {
      gaps.push({
        start: new Date(merged[i].end).toISOString(),
        end: new Date(merged[i + 1].start).toISOString()
      });
    }

    // Gap after last range
    if (merged[merged.length - 1].end < requestedRange.end) {
      gaps.push({
        start: new Date(merged[merged.length - 1].end).toISOString(),
        end: new Date(requestedRange.end).toISOString()
      });
    }

    return gaps;
  }

  /**
   * Store data in cache with time range
   */
  set(datasourceId, query, data, ttl) {
    const key = this.generateKey(datasourceId, query);

    // Determine time range from data
    let range;
    if (query.startTime && query.endTime) {
      range = new TimeRange(
        new Date(query.startTime).getTime(),
        new Date(query.endTime).getTime()
      );
    } else if (data && data.length > 0) {
      // Infer range from data timestamps
      const timestamps = data.map(point =>
        new Date(point.timestamp || point.time).getTime()
      );
      range = new TimeRange(Math.min(...timestamps), Math.max(...timestamps));
    } else {
      // No range info, use current time
      const now = Date.now();
      range = new TimeRange(now, now);
    }

    // Determine TTL based on data recency
    let effectiveTtl = ttl;
    if (!ttl) {
      const age = Date.now() - range.end;
      if (age < 5 * 60 * 1000) {
        // Last 5 minutes: 1 minute TTL
        effectiveTtl = 60 * 1000;
      } else if (age < 60 * 60 * 1000) {
        // Last hour: 5 minute TTL
        effectiveTtl = 5 * 60 * 1000;
      } else {
        // Historical: 1 hour TTL
        effectiveTtl = 60 * 60 * 1000;
      }
    }

    const entry = new CacheEntry(data, range, effectiveTtl);

    const entries = this.cache.get(key) || [];
    entries.push(entry);
    this.cache.set(key, entries);

    return entry;
  }

  /**
   * Invalidate cache for a datasource/query
   */
  invalidate(datasourceId, query) {
    if (query) {
      const key = this.generateKey(datasourceId, query);
      this.cache.delete(key);
    } else {
      // Invalidate all entries for datasource
      const keysToDelete = [];
      for (const key of this.cache.keys()) {
        if (key.startsWith(datasourceId + ':')) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => this.cache.delete(key));
    }
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const stats = {
      totalKeys: this.cache.size,
      totalEntries: 0,
      totalDataPoints: 0,
      expiredEntries: 0
    };

    for (const entries of this.cache.values()) {
      stats.totalEntries += entries.length;
      entries.forEach(entry => {
        if (entry.isExpired()) {
          stats.expiredEntries++;
        }
        if (Array.isArray(entry.data)) {
          stats.totalDataPoints += entry.data.length;
        }
      });
    }

    return stats;
  }
}

export default new CacheCoordinator();
