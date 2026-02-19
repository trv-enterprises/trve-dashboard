// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload script - runs in renderer process with Node.js access
 * Exposes a safe, limited API to the renderer via contextBridge
 */

contextBridge.exposeInMainWorld('electron', {
  // Flag to indicate we're in Electron
  isElectron: true,

  // App info
  version: process.env.npm_package_version || '1.0.0',
  platform: process.platform,

  // Secure storage API
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  clearConfig: () => ipcRenderer.invoke('clear-config'),
});
