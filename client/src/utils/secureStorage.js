// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

/**
 * Secure Storage Abstraction
 *
 * Provides a unified API for storing credentials that works in both
 * Electron (using secure storage) and browser (using localStorage) environments.
 *
 * In Electron: Uses electron-store or safeStorage via IPC
 * In Browser: Falls back to localStorage (less secure, but functional for dev)
 */

import { isElectron, getElectronConfig, saveElectronConfig, clearElectronConfig } from './electron';

const STORAGE_KEYS = {
  SERVER_URL: 'dashboard_serverUrl',
  USER_KEY: 'dashboard_userKey',
  USER_NAME: 'dashboard_userName',
};

/**
 * Save credentials (server URL and user key)
 * @param {string} serverUrl - The server URL
 * @param {string} key - The user's key (GUID)
 * @param {string} userName - The user's display name (optional)
 * @returns {Promise<boolean>} True if successful
 */
export const saveCredentials = async (serverUrl, key, userName = '') => {
  if (isElectron()) {
    // Use Electron's secure storage
    return await saveElectronConfig({
      serverUrl,
      key,
      userName,
    });
  }

  // Browser fallback - use localStorage
  try {
    localStorage.setItem(STORAGE_KEYS.SERVER_URL, serverUrl);
    localStorage.setItem(STORAGE_KEYS.USER_KEY, key);
    if (userName) {
      localStorage.setItem(STORAGE_KEYS.USER_NAME, userName);
    }
    return true;
  } catch (err) {
    console.error('Failed to save credentials:', err);
    return false;
  }
};

/**
 * Get stored credentials
 * @returns {Promise<object|null>} Credentials object or null if not stored
 */
export const getCredentials = async () => {
  if (isElectron()) {
    // Use Electron's secure storage
    const config = await getElectronConfig();
    if (config && config.serverUrl && config.key) {
      return {
        serverUrl: config.serverUrl,
        key: config.key,
        userName: config.userName || '',
      };
    }
    return null;
  }

  // Browser fallback - use localStorage
  try {
    const serverUrl = localStorage.getItem(STORAGE_KEYS.SERVER_URL);
    const key = localStorage.getItem(STORAGE_KEYS.USER_KEY);

    if (serverUrl && key) {
      return {
        serverUrl,
        key,
        userName: localStorage.getItem(STORAGE_KEYS.USER_NAME) || '',
      };
    }
    return null;
  } catch (err) {
    console.error('Failed to get credentials:', err);
    return null;
  }
};

/**
 * Clear stored credentials
 * @returns {Promise<boolean>} True if successful
 */
export const clearCredentials = async () => {
  if (isElectron()) {
    // Use Electron's secure storage
    return await clearElectronConfig();
  }

  // Browser fallback - use localStorage
  try {
    localStorage.removeItem(STORAGE_KEYS.SERVER_URL);
    localStorage.removeItem(STORAGE_KEYS.USER_KEY);
    localStorage.removeItem(STORAGE_KEYS.USER_NAME);
    return true;
  } catch (err) {
    console.error('Failed to clear credentials:', err);
    return false;
  }
};

/**
 * Check if credentials are stored
 * @returns {Promise<boolean>} True if credentials exist
 */
export const hasCredentials = async () => {
  const creds = await getCredentials();
  return creds !== null;
};

/**
 * Update just the server URL (keeps existing key)
 * @param {string} serverUrl - The new server URL
 * @returns {Promise<boolean>} True if successful
 */
export const updateServerUrl = async (serverUrl) => {
  const creds = await getCredentials();
  if (creds) {
    return await saveCredentials(serverUrl, creds.key, creds.userName);
  }
  return false;
};

/**
 * Update just the user info (keeps existing server URL)
 * @param {string} key - The user's key
 * @param {string} userName - The user's display name
 * @returns {Promise<boolean>} True if successful
 */
export const updateUserInfo = async (key, userName = '') => {
  const creds = await getCredentials();
  if (creds) {
    return await saveCredentials(creds.serverUrl, key, userName);
  }
  return false;
};

export default {
  saveCredentials,
  getCredentials,
  clearCredentials,
  hasCredentials,
  updateServerUrl,
  updateUserInfo,
};
