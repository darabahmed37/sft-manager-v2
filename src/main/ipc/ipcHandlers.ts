import { ipcMain, BrowserWindow } from 'electron';
import * as path from 'path';
import { ConnectionDao } from '../dao/ConnectionDao';
import { StoredCredentialDao } from '../dao/StoredCredentialDao';
import { SettingsDao } from '../dao/SettingsDao';
import { getDatabase } from '../config/Database';
import { SshClient } from '../ssh/SshClient';
import { Config } from '../config/Config';
import { Logger } from '../log/Logger';

const log = Logger.getLogger('ipcHandlers');
const activeSessions = new Map<string, SshClient>();

// ─── Terminal Window Management ───────────────────────────────────────────────

const activeShells = new Map<string, any>(); // shellId → ssh2 shell stream
let terminalWindow: BrowserWindow | null = null;
let shellCounter = 0;

function getOrCreateTerminalWindow(mainWindow: BrowserWindow, sessionId: string, username: string, host: string): BrowserWindow {
  if (terminalWindow && !terminalWindow.isDestroyed()) {
    terminalWindow.focus();
    // Window already open — signal it to open a new tab
    terminalWindow.webContents.send('terminal-open-tab', sessionId, username, host);
    return terminalWindow;
  }

  const win = new BrowserWindow({
    width: 900,
    height: 620,
    minWidth: 500,
    minHeight: 360,
    frame: false,
    titleBarStyle: 'hidden',
    resizable: true,
    backgroundColor: '#000000',
    title: 'SSH Terminal',
    // Child of mainWindow so closing the terminal does NOT quit the app,
    // but closing the main app DOES auto-close the terminal (triggering shell cleanup).
    parent: mainWindow,
    webPreferences: {
      preload: path.join(__dirname, '../../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  // Pass the first session via URL params so the renderer opens the initial shell
  const params = new URLSearchParams({ sessionId, username, host });

  if (!mainWindow.webContents.getURL().startsWith('http')) {
    win.loadFile(path.join(__dirname, '../../../terminal.html'), { search: params.toString() });
  } else {
    win.loadURL(`http://localhost:5173/terminal.html?${params.toString()}`);
  }

  win.on('maximize', () => {
    win.webContents.send('window-maximized-state', true);
  });
  win.on('unmaximize', () => {
    win.webContents.send('window-maximized-state', false);
  });

  win.once('ready-to-show', () => win.show());

  // When the window is actually closed, kill every active shell immediately.
  // This is the hard rule: no leaked connections.
  win.on('closed', () => {
    log.info(`[Terminal] Window closed — terminating ${activeShells.size} active shell(s)`);
    for (const [shellId, stream] of activeShells.entries()) {
      try { stream.end(); } catch (_) {}
      log.info(`[Terminal] Shell ${shellId} closed on window exit`);
    }
    activeShells.clear();
    terminalWindow = null;
  });

  terminalWindow = win;
  return win;
}

async function buildHopChain(connectionId: number): Promise<any[]> {
  const chain: any[] = [];
  let currentId: number | null = connectionId;
  const visited = new Set<number>();

  while (currentId !== null) {
    if (visited.has(currentId)) {
      throw new Error('Cyclic jump proxy configuration detected');
    }
    visited.add(currentId);

    const conn = ConnectionDao.getConnection(currentId);
    if (!conn) {
      throw new Error(`Connection profile not found: ${currentId}`);
    }

    const serverConf: any = {
      host: conn.host,
      port: conn.port,
      username: '',
    };

    if (conn.credentialId) {
      const cred = StoredCredentialDao.getCredential(conn.credentialId);
      if (cred) {
        serverConf.username = cred.username;
        if (cred.type === 'KEY_ONLY') {
          if (cred.privateKeyContent) {
            serverConf.privateKey = cred.privateKeyContent;
            if (cred.privateKeyPassphrase) {
              serverConf.passphrase = cred.privateKeyPassphrase;
            }
          } else {
            try {
              const fs = require('fs');
              serverConf.privateKey = fs.readFileSync(cred.password, 'utf8');
              if (cred.totpSecret) {
                serverConf.passphrase = cred.totpSecret;
              }
            } catch (fileErr: any) {
              log.error(`Failed to read private key fallback at ${cred.password}`, fileErr);
              throw new Error(`Failed to read private key file: ${fileErr.message}`);
            }
          }
        } else {
          if (cred.password) serverConf.password = cred.password;
          if (cred.totpSecret) serverConf.totpSecret = cred.totpSecret;
        }
      }
    }

    chain.unshift(serverConf);
    currentId = conn.tunnelViaConnectionId;
  }

  return chain;
}

export function registerIpcHandlers(mainWindow: BrowserWindow) {
  // ─── Window Controls ───
  ipcMain.on('window-minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.minimize();
  });

  ipcMain.on('window-maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    }
  });

  ipcMain.on('window-close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.close();
  });

  ipcMain.handle('window-get-platform', () => {
    return process.platform;
  });

  ipcMain.handle('window-is-maximized', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return win ? win.isMaximized() : false;
  });

  ipcMain.handle('dialog-open-file', async () => {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('fs-read-file', async (event, filePath: string) => {
    try {
      const fs = require('fs');
      return fs.readFileSync(filePath, 'utf8');
    } catch (err: any) {
      log.error(`Failed to read file ${filePath}`, err);
      throw err;
    }
  });

  // ─── Database Connections CRUD ───
  ipcMain.handle('db-get-connections', () => {
    return ConnectionDao.getConnections();
  });

  ipcMain.handle('db-get-connection', (event, id: number) => {
    return ConnectionDao.getConnection(id);
  });

  ipcMain.handle('db-add-connection', (event, data: {
    name: string;
    host: string;
    port: number;
    workingDir: string;
    connectionTypeId: number;
    credentialId: number | null;
    tunnelViaConnectionId: number | null;
  }) => {
    return ConnectionDao.addConnection(
      data.name,
      data.host,
      data.port,
      data.workingDir,
      data.connectionTypeId,
      data.credentialId,
      data.tunnelViaConnectionId
    );
  });

  ipcMain.handle('db-update-connection', (event, data: {
    id: number;
    name: string;
    host: string;
    port: number;
    workingDir: string;
    connectionTypeId: number;
    credentialId: number | null;
    tunnelViaConnectionId: number | null;
  }) => {
    ConnectionDao.updateConnection(
      data.id,
      data.name,
      data.host,
      data.port,
      data.workingDir,
      data.connectionTypeId,
      data.credentialId,
      data.tunnelViaConnectionId
    );
    return { success: true };
  });

  ipcMain.handle('db-delete-connection', (event, id: number) => {
    ConnectionDao.deleteConnection(id);
    return { success: true };
  });

  ipcMain.handle('db-touch-connection', (event, id: number) => {
    ConnectionDao.touchConnection(id);
    return { success: true };
  });

  ipcMain.handle('db-get-connection-types', () => {
    return ConnectionDao.getConnectionTypes();
  });

  // ─── Database Credentials CRUD ───
  ipcMain.handle('db-get-credentials', () => {
    return StoredCredentialDao.getCredentials();
  });

  ipcMain.handle('db-get-credential', (event, id: number) => {
    return StoredCredentialDao.getCredential(id);
  });

  ipcMain.handle('db-add-credential', (event, data: {
    name: string;
    username: string;
    passwordPlain: string;
    totpSecretPlain: string;
    isDefault: boolean;
    type: string;
    privateKeyName?: string;
    privateKeyContentPlain?: string;
    privateKeyPassphrasePlain?: string;
  }) => {
    return StoredCredentialDao.addCredential(
      data.name,
      data.username,
      data.passwordPlain,
      data.totpSecretPlain,
      data.isDefault,
      data.type,
      data.privateKeyName,
      data.privateKeyContentPlain,
      data.privateKeyPassphrasePlain
    );
  });

  ipcMain.handle('db-update-credential', (event, data: {
    id: number;
    name: string;
    username: string;
    passwordPlain: string;
    totpSecretPlain: string;
    isDefault: boolean;
    type: string;
    privateKeyName?: string;
    privateKeyContentPlain?: string;
    privateKeyPassphrasePlain?: string;
  }) => {
    StoredCredentialDao.updateCredential(
      data.id,
      data.name,
      data.username,
      data.passwordPlain,
      data.totpSecretPlain,
      data.isDefault,
      data.type,
      data.privateKeyName,
      data.privateKeyContentPlain,
      data.privateKeyPassphrasePlain
    );
    return { success: true };
  });

  ipcMain.handle('db-delete-credential', (event, id: number) => {
    StoredCredentialDao.deleteCredential(id);
    return { success: true };
  });

  // ─── SSH Bridging ───
  ipcMain.handle('ssh-connect', async (event, connectionId: number) => {
    try {
      log.info(`[IPC] Connecting to connection profile id=${connectionId}`);
      const chain = await buildHopChain(connectionId);
      
      const config = new Config();
      const allSettings = SettingsDao.getAllSettings();
      for (const [k, v] of Object.entries(allSettings)) {
        config.set(k, v);
      }
      
      const client = await SshClient.connect(
        chain,
        config,
        (progressMsg) => {
          mainWindow.webContents.send('ssh-connect-progress', { connectionId, message: progressMsg });
        },
        async (hostKeyData) => {
          mainWindow.webContents.send('ssh-host-key-verify', hostKeyData);
          return new Promise<{ trust: boolean; save: boolean }>((resolve) => {
            ipcMain.once('ssh-host-key-verify-response', (event, response) => {
              resolve(response);
            });
          });
        }
      );
      
      const sessionId = `session-${connectionId}-${Date.now()}`;
      activeSessions.set(sessionId, client);
      
      ConnectionDao.touchConnection(connectionId);
      
      return { success: true, sessionId };
    } catch (err: any) {
      log.error(`[IPC] ssh-connect failed for connectionId=${connectionId}`, err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ssh-disconnect', async (event, sessionId: string) => {
    const client = activeSessions.get(sessionId);
    if (client) {
      try {
        client.close();
      } catch (err: any) {
        log.warn(`[IPC] Error during ssh session close: ${err.message}`);
      }
      activeSessions.delete(sessionId);
      return { success: true };
    }
    return { success: false, error: 'Session not found' };
  });

  // ─── Local Filesystem Operations ───
  ipcMain.handle('fs-list-directory', async (event, pathStr: string) => {
    try {
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      
      let targetPath = pathStr;
      if (!targetPath || targetPath === '~') {
        targetPath = os.homedir();
      } else if (targetPath.startsWith('~/')) {
        targetPath = path.join(os.homedir(), targetPath.substring(2));
      } else {
        targetPath = path.resolve(targetPath);
      }
      
      if (!fs.existsSync(targetPath)) {
        throw new Error(`Directory does not exist: ${targetPath}`);
      }
      
      const files = fs.readdirSync(targetPath, { withFileTypes: true });
      return files.map((f: any) => {
        let size = 0;
        let mtime = new Date();
        try {
          const stats = fs.statSync(path.join(targetPath, f.name));
          size = stats.size;
          mtime = stats.mtime;
        } catch (e) {}
        
        return {
          name: f.name,
          isDirectory: f.isDirectory(),
          size,
          modified: mtime.toISOString().substring(0, 10), // YYYY-MM-DD
        };
      });
    } catch (err: any) {
      log.error(`Local LS failed for path="${pathStr}"`, err);
      throw err;
    }
  });

  ipcMain.handle('fs-get-home-dir', () => {
    const os = require('os');
    return os.homedir();
  });

  // ─── SSH Session Filesystem Operations ───
  ipcMain.handle('ssh-list-directory', async (event, sessionId: string, pathStr: string) => {
    const client = activeSessions.get(sessionId);
    if (!client) throw new Error('Session not found or disconnected');
    return await client.listDirectory(pathStr);
  });

  ipcMain.handle('ssh-get-home-dir', async (event, sessionId: string) => {
    const client = activeSessions.get(sessionId);
    if (!client) throw new Error('Session not found or disconnected');
    return await client.getHomeDir();
  });

  ipcMain.handle('ssh-delete', async (event, sessionId: string, pathStr: string, recursive: boolean) => {
    const client = activeSessions.get(sessionId);
    if (!client) throw new Error('Session not found or disconnected');
    return await client.delete(pathStr, recursive);
  });

  ipcMain.handle('ssh-rename', async (event, sessionId: string, from: string, to: string) => {
    const client = activeSessions.get(sessionId);
    if (!client) throw new Error('Session not found or disconnected');
    return await client.rename(from, to);
  });

  ipcMain.handle('ssh-mkdir', async (event, sessionId: string, pathStr: string) => {
    const client = activeSessions.get(sessionId);
    if (!client) throw new Error('Session not found or disconnected');
    return await client.mkdir(pathStr);
  });

  // ─── Terminal: Open New Window ────────────────────────────────────────────

  ipcMain.on('terminal-open-window', (event, sessionId: string, username: string, host: string) => {
    getOrCreateTerminalWindow(mainWindow, sessionId, username, host);
  });

  // ─── Terminal: Open SSH Shell Channel ────────────────────────────────────

  ipcMain.handle('terminal-open-shell', async (event, sessionId: string, tabId: string) => {
    const client = activeSessions.get(sessionId);
    if (!client) return { success: false, error: 'Session not found or disconnected' };

    const shellId = `shell-${++shellCounter}-${Date.now()}`;

    try {
      const sshClient = (client as any);
      // Access underlying ssh2 client from state
      const state = sshClient['state'];
      if (!state) return { success: false, error: 'Internal state unavailable' };

      const targetClient = state.targetClient;

      const stream = await new Promise<any>((resolve, reject) => {
        targetClient.shell({ term: 'xterm-256color', rows: 24, cols: 80 }, (err: any, s: any) => {
          if (err) reject(err);
          else resolve(s);
        });
      });

      activeShells.set(shellId, stream);

      // Send raw Buffer — no UTF-8 conversion overhead.
      // Electron serializes Buffer as Uint8Array; xterm.write() accepts Uint8Array natively.
      stream.on('data', (data: Buffer) => {
        const win = terminalWindow;
        if (win && !win.isDestroyed()) {
          win.webContents.send('terminal-shell-data', shellId, data);
        }
      });

      stream.stderr?.on('data', (data: Buffer) => {
        const win = terminalWindow;
        if (win && !win.isDestroyed()) {
          win.webContents.send('terminal-shell-data', shellId, data);
        }
      });

      stream.on('close', () => {
        activeShells.delete(shellId);
        const win = terminalWindow;
        if (win && !win.isDestroyed()) {
          win.webContents.send('terminal-shell-close', shellId);
        }
      });

      stream.on('error', (err: any) => {
        log.error(`Shell error for ${shellId}: ${err.message}`);
        const win = terminalWindow;
        if (win && !win.isDestroyed()) {
          win.webContents.send('terminal-shell-data', shellId, `\r\n\x1b[31mShell error: ${err.message}\x1b[0m\r\n`);
        }
      });


      log.info(`[Terminal] Shell opened: shellId=${shellId} sessionId=${sessionId}`);
      return { success: true, shellId };
    } catch (err: any) {
      log.error(`[Terminal] Failed to open shell for session ${sessionId}:`, err);
      return { success: false, error: err.message };
    }
  });

  // ─── Terminal: Write to Shell ─────────────────────────────────────────────

  ipcMain.on('terminal-shell-write', (event, shellId: string, data: string) => {
    const stream = activeShells.get(shellId);
    if (stream) {
      try { stream.write(data); } catch (err: any) {
        log.warn(`Shell write error for ${shellId}: ${err.message}`);
      }
    }
  });

  // ─── Terminal: Resize Shell ───────────────────────────────────────────────

  ipcMain.on('terminal-shell-resize', (event, shellId: string, cols: number, rows: number) => {
    const stream = activeShells.get(shellId);
    if (stream && stream.setWindow) {
      try { stream.setWindow(rows, cols, 0, 0); } catch (_) {}
    }
  });

  // ─── Terminal: Close Shell ────────────────────────────────────────────────

  ipcMain.on('terminal-shell-close', (event, shellId: string) => {
    const stream = activeShells.get(shellId);
    if (stream) {
      try { stream.end(); } catch (_) {}
      activeShells.delete(shellId);
    }
  });

  // ─── Settings Key-Value ───
  ipcMain.handle('settings-get', (event, key: string, defaultValue: string) => {
    return SettingsDao.getSetting(key, defaultValue);
  });

  ipcMain.handle('settings-set', (event, key: string, value: string) => {
    SettingsDao.setSetting(key, value);
    return { success: true };
  });

  ipcMain.handle('settings-get-all', () => {
    return SettingsDao.getAllSettings();
  });

  // ─── Bookmarks CRUD ───
  ipcMain.handle('bookmarks-get', (event, connectionId: number, pane: string) => {
    return SettingsDao.getBookmarks(connectionId, pane);
  });

  ipcMain.handle('bookmarks-add', (event, connectionId: number, pane: string, path: string) => {
    SettingsDao.addBookmark(connectionId, pane, path);
    return { success: true };
  });

  ipcMain.handle('bookmarks-delete', (event, id: number) => {
    SettingsDao.deleteBookmark(id);
    return { success: true };
  });

  ipcMain.handle('bookmarks-set-default', (event, connectionId: number, pane: string, id: number) => {
    SettingsDao.setDefaultBookmark(connectionId, pane, id);
    return { success: true };
  });

  // ─── Known Hosts CRUD ───
  ipcMain.handle('known-hosts-get', () => {
    return SettingsDao.getKnownHosts();
  });

  ipcMain.handle('known-hosts-delete', (event, id: number) => {
    SettingsDao.deleteKnownHost(id);
    return { success: true };
  });

  ipcMain.handle('known-hosts-add', (event, host: string, port: number, keyType: string, publicKey: string, fingerprint: string) => {
    SettingsDao.addKnownHost(host, port, keyType, publicKey, fingerprint);
    return { success: true };
  });

  // ─── Connection Specific Layout Settings ───
  ipcMain.handle('connection-settings-get', (event, connectionId: number) => {
    return SettingsDao.getConnectionSettings(connectionId);
  });

  ipcMain.handle('connection-settings-update', (event, connectionId: number, settings: any) => {
    SettingsDao.updateConnectionSettings(connectionId, settings);
    return { success: true };
  });

  // ─── Remote Pinned Tabs ───
  ipcMain.handle('remote-tabs-get', (event, connectionId: number) => {
    return SettingsDao.getRemoteTabs(connectionId);
  });

  ipcMain.handle('remote-tabs-save', (event, connectionId: number, tabs: any[]) => {
    SettingsDao.saveRemoteTabs(connectionId, tabs);
    return { success: true };
  });

  // ─── Maintenance Actions ───
  ipcMain.handle('maintenance-reset-app', async () => {
    const db = getDatabase();
    db.close();

    const fs = require('fs');
    const path = require('path');
    const dbPath = path.join(process.cwd(), 'data', 'settings.db');
    if (fs.existsSync(dbPath)) {
      try {
        fs.unlinkSync(dbPath);
      } catch (err) {}
    }
    
    const { app } = require('electron');
    app.quit();
  });

  ipcMain.handle('maintenance-clear-temp', async () => {
    const fs = require('fs');
    const path = require('path');
    const tempDir = path.join(process.cwd(), 'data', 'temp');
    let clearedCount = 0;
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      for (const f of files) {
        try {
          const fp = path.join(tempDir, f);
          const stats = fs.statSync(fp);
          if (stats.isDirectory()) {
            fs.rmSync(fp, { recursive: true, force: true });
          } else {
            fs.unlinkSync(fp);
          }
          clearedCount++;
        } catch (err) {}
      }
    }
    return { success: true, clearedCount };
  });

  ipcMain.handle('maintenance-clear-logs', async () => {
    const fs = require('fs');
    const path = require('path');
    const logsDir = path.join(process.cwd(), 'logs');
    let clearedCount = 0;
    if (fs.existsSync(logsDir)) {
      const files = fs.readdirSync(logsDir);
      for (const f of files) {
        if (f.endsWith('.log') || f.endsWith('.log.gz')) {
          try {
            const fp = path.join(logsDir, f);
            fs.unlinkSync(fp);
            clearedCount++;
          } catch (err) {
            try {
              fs.writeFileSync(path.join(logsDir, f), '');
              clearedCount++;
            } catch (inner) {}
          }
        }
      }
    }
    return { success: true, clearedCount };
  });

  ipcMain.handle('maintenance-open-temp', async () => {
    const { shell } = require('electron');
    const path = require('path');
    const fs = require('fs');
    const tempDir = path.join(process.cwd(), 'data', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    await shell.openPath(tempDir);
    return { success: true };
  });

  // ─── Local Filesystem Additional Operations ───
  ipcMain.handle('fs-mkdir', async (event, pathStr: string) => {
    const fs = require('fs');
    fs.mkdirSync(pathStr, { recursive: true });
    return { success: true };
  });

  ipcMain.handle('fs-delete', async (event, pathStr: string, recursive: boolean) => {
    const fs = require('fs');
    if (recursive) {
      fs.rmSync(pathStr, { recursive: true, force: true });
    } else {
      fs.unlinkSync(pathStr);
    }
    return { success: true };
  });

  ipcMain.handle('fs-is-directory', async (event, pathStr: string) => {
    const fs = require('fs');
    try {
      return fs.statSync(pathStr).isDirectory();
    } catch (e) {
      return false;
    }
  });

  ipcMain.on('window-start-drag', (event, filePath: string, iconName: string) => {
    const fs = require('fs');
    const path = require('path');
    if (fs.existsSync(filePath)) {
      event.sender.startDrag({
        file: filePath,
        icon: path.join(process.cwd(), 'public', iconName || 'favicon.png'),
      });
    }
  });

  ipcMain.handle('fs-rename', async (event, from: string, to: string) => {
    const fs = require('fs');
    fs.renameSync(from, to);
    return { success: true };
  });

  ipcMain.handle('fs-copy', async (event, from: string, to: string) => {
    const fs = require('fs');
    fs.cpSync(from, to, { recursive: true });
    return { success: true };
  });

  ipcMain.handle('fs-create-file', async (event, filePath: string) => {
    const fs = require('fs');
    fs.writeFileSync(filePath, '');
    return { success: true };
  });

  ipcMain.handle('fs-compress', async (event, dirPath: string, tarPath: string) => {
    const { execSync } = require('child_process');
    const path = require('path');
    const parentDir = path.dirname(dirPath);
    const baseName = path.basename(dirPath);
    const cmd = `tar -czf "${tarPath}" -C "${parentDir}" "${baseName}"`;
    execSync(cmd);
    return { success: true };
  });

  ipcMain.handle('fs-extract', async (event, archivePath: string, destDir: string) => {
    const { execSync } = require('child_process');
    const fs = require('fs');
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    const cmd = `tar -xzf "${archivePath}" -C "${destDir}"`;
    execSync(cmd);
    return { success: true };
  });

  ipcMain.handle('fs-calculate-size', async (event, pathStr: string) => {
    const fs = require('fs').promises;
    try {
      const getLocalFolderSize = async (dirPath: string): Promise<number> => {
        let totalSize = 0;
        const files = await fs.readdir(dirPath, { withFileTypes: true });
        for (const file of files) {
          const fullPath = require('path').join(dirPath, file.name);
          if (file.isDirectory()) {
            totalSize += await getLocalFolderSize(fullPath);
          } else {
            try {
              const stat = await fs.stat(fullPath);
              totalSize += stat.size;
            } catch (e) {}
          }
        }
        return totalSize;
      };

      const stat = await fs.stat(pathStr);
      if (stat.isFile()) {
        return stat.size;
      }
      return await getLocalFolderSize(pathStr);
    } catch (err: any) {
      log.error(`Failed to calculate size for ${pathStr}`, err);
      return 0;
    }
  });

  // ─── SSH Additional Filesystem Operations ───
  ipcMain.handle('ssh-copy', async (event, sessionId: string, from: string, to: string) => {
    const client = activeSessions.get(sessionId);
    if (!client) throw new Error('Session not found or disconnected');
    const qFrom = `'${from.replace(/'/g, "'\\''")}'`;
    const qTo = `'${to.replace(/'/g, "'\\''")}'`;
    const r = await client.exec(`cp -r ${qFrom} ${qTo}`);
    if (r.exitCode !== 0) {
      throw new Error(`SSH copy failed: ${r.stderr}`);
    }
    return { success: true };
  });

  ipcMain.handle('ssh-create-file', async (event, sessionId: string, pathStr: string) => {
    const client = activeSessions.get(sessionId);
    if (!client) throw new Error('Session not found or disconnected');
    const qPath = `'${pathStr.replace(/'/g, "'\\''")}'`;
    const r = await client.exec(`touch ${qPath}`);
    if (r.exitCode !== 0) {
      throw new Error(`SSH touch failed: ${r.stderr}`);
    }
    return { success: true };
  });

  ipcMain.handle('ssh-compress', async (event, sessionId: string, dirPath: string, tarPath: string) => {
    const client = activeSessions.get(sessionId);
    if (!client) throw new Error('Session not found or disconnected');
    const path = require('path').posix;
    const parentDir = path.dirname(dirPath);
    const baseName = path.basename(dirPath);
    const qTar = `'${tarPath.replace(/'/g, "'\\''")}'`;
    const qParent = `'${parentDir.replace(/'/g, "'\\''")}'`;
    const qBase = `'${baseName.replace(/'/g, "'\\''")}'`;
    const r = await client.exec(`tar -czf ${qTar} -C ${qParent} ${qBase}`);
    if (r.exitCode !== 0) {
      throw new Error(`SSH compress failed: ${r.stderr}`);
    }
    return { success: true };
  });

  ipcMain.handle('ssh-extract', async (event, sessionId: string, archivePath: string, destDir: string) => {
    const client = activeSessions.get(sessionId);
    if (!client) throw new Error('Session not found or disconnected');
    const qArchive = `'${archivePath.replace(/'/g, "'\\''")}'`;
    const qDest = `'${destDir.replace(/'/g, "'\\''")}'`;
    const r = await client.exec(`mkdir -p ${qDest} && tar -xzf ${qArchive} -C ${qDest}`);
    if (r.exitCode !== 0) {
      throw new Error(`SSH extract failed: ${r.stderr}`);
    }
    return { success: true };
  });

  ipcMain.handle('ssh-calculate-size', async (event, sessionId: string, pathStr: string) => {
    const client = activeSessions.get(sessionId);
    if (!client) throw new Error('Session not found or disconnected');
    const qPath = `'${pathStr.replace(/'/g, "'\\''")}'`;
    const r = await client.exec(`du -sb ${qPath} 2>/dev/null || du -s ${qPath} 2>/dev/null`);
    if (r.exitCode === 0 && r.stdout) {
      const parts = r.stdout.split(/\s+/);
      const size = parseInt(parts[0], 10);
      if (!isNaN(size)) {
        return size;
      }
    }
    return 0;
  });

  ipcMain.handle('ssh-upload', async (event, sessionId: string, localPath: string, remoteDir: string) => {
    const client = activeSessions.get(sessionId);
    if (!client) throw new Error('Session not found or disconnected');
    await client.upload(localPath, remoteDir);
    return { success: true };
  });

  ipcMain.handle('ssh-download', async (event, sessionId: string, remotePath: string, localDir: string) => {
    const client = activeSessions.get(sessionId);
    if (!client) throw new Error('Session not found or disconnected');
    await client.download(remotePath, localDir);
    return { success: true };
  });

  ipcMain.handle('ssh-upload-folder', async (event, sessionId: string, localFolder: string, remoteDir: string) => {
    const client = activeSessions.get(sessionId);
    if (!client) throw new Error('Session not found or disconnected');
    await client.uploadFolder(localFolder, remoteDir);
    return { success: true };
  });

  ipcMain.handle('ssh-download-folder', async (event, sessionId: string, remoteFolder: string, localDir: string) => {
    const client = activeSessions.get(sessionId);
    if (!client) throw new Error('Session not found or disconnected');
    await client.downloadFolder(remoteFolder, localDir);
    return { success: true };
  });
}

