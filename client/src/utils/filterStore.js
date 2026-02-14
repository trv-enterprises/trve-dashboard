// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

/**
 * Simple in-memory store for preserving list view filters during a session.
 * Filters reset on page reload but persist during navigation.
 */

const filterStore = {};

/**
 * Get stored filters for a specific page
 * @param {string} pageKey - Unique identifier for the page (e.g., 'charts', 'dashboards')
 * @returns {object} - Stored filter state or empty object
 */
export function getFilters(pageKey) {
  return filterStore[pageKey] || {};
}

/**
 * Store filters for a specific page
 * @param {string} pageKey - Unique identifier for the page
 * @param {object} filters - Filter state to store
 */
export function setFilters(pageKey, filters) {
  filterStore[pageKey] = { ...filters };
}

/**
 * Clear filters for a specific page
 * @param {string} pageKey - Unique identifier for the page
 */
export function clearFilters(pageKey) {
  delete filterStore[pageKey];
}

/**
 * Clear all stored filters
 */
export function clearAllFilters() {
  Object.keys(filterStore).forEach(key => delete filterStore[key]);
}

export default {
  getFilters,
  setFilters,
  clearFilters,
  clearAllFilters
};
