// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

const { app, BrowserWindow, ipcMain, safeStorage } = require('electron');
const path = require('path');
const Store = require('electron-store');

// Initialize electron-store for persistent storage
const store = new Store({
  name: 'trve-dashboards-config',
  encryptionKey: 'trve-dashboards-v1', // Basic encryption for config
});

// Check if running in development mode
const isDev = process.env.ELECTRON_DEV === 'true';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    titleBarStyle: 'hiddenInset', // macOS style title bar
    backgroundColor: '#161616', // Carbon g100 background
    show: false, // Don't show until ready
  });

  // Load the app
  if (isDev) {
    // Development: load from Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    // Production: load from built files
    const appPath = path.join(process.resourcesPath, 'app', 'index.html');
    mainWindow.loadFile(appPath);
  }

  // Show window when ready to prevent white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers for secure storage

// Get stored configuration
ipcMain.handle('get-config', async () => {
  try {
    const config = store.get('credentials');
    if (!config) return null;

    // If we have encrypted key data, decrypt it
    if (config.encryptedKey && safeStorage.isEncryptionAvailable()) {
      try {
        const decryptedKey = safeStorage.decryptString(Buffer.from(config.encryptedKey, 'base64'));
        return {
          serverUrl: config.serverUrl,
          key: decryptedKey,
          userName: config.userName,
        };
      } catch (err) {
        console.error('Failed to decrypt key:', err);
        return null;
      }
    }

    // Fallback for unencrypted storage (when safeStorage unavailable)
    return {
      serverUrl: config.serverUrl,
      key: config.key,
      userName: config.userName,
    };
  } catch (err) {
    console.error('Failed to get config:', err);
    return null;
  }
});

// Save configuration
ipcMain.handle('save-config', async (event, config) => {
  try {
    const { serverUrl, key, userName } = config;

    // Try to encrypt the key if safeStorage is available
    if (safeStorage.isEncryptionAvailable()) {
      const encryptedKey = safeStorage.encryptString(key).toString('base64');
      store.set('credentials', {
        serverUrl,
        encryptedKey,
        userName,
      });
    } else {
      // Fallback to unencrypted storage
      console.warn('safeStorage not available, storing key unencrypted');
      store.set('credentials', {
        serverUrl,
        key,
        userName,
      });
    }
    return true;
  } catch (err) {
    console.error('Failed to save config:', err);
    return false;
  }
});

// Clear configuration
ipcMain.handle('clear-config', async () => {
  try {
    store.delete('credentials');
    return true;
  } catch (err) {
    console.error('Failed to clear config:', err);
    return false;
  }
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // On macOS, re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // On macOS, keep app running until explicitly quit
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
});
