import { app, BrowserWindow, Menu } from 'electron';
import * as path from 'path';
import { registerIpcHandlers } from './ipc/ipcHandlers';

function createWindow() {
  // Remove the native menu bar (File/Edit/View/Window) from every window
  Menu.setApplicationMenu(null);

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  registerIpcHandlers(mainWindow);

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-maximized-state', true);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-maximized-state', false);
  });

  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    // DevTools are NOT auto-opened — they add significant IPC/render overhead.
    // Open manually via Ctrl+Shift+I if needed.
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../index.html'));
  }

  // App lifetime is tied to the MAIN window only.
  // Closing the terminal window must NOT quit the app.
  mainWindow.on('closed', () => {
    app.quit();
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Do NOT auto-quit here. App lifetime is managed by mainWindow.on('closed') above.
// This prevents the terminal window closing from killing the main process.
app.on('window-all-closed', () => {
  // macOS: standard behaviour is to keep the app running
  // Windows/Linux: we intentionally ignore this — only the main window closing triggers quit
});
