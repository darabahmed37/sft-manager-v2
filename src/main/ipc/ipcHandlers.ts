import { ipcMain, BrowserWindow } from 'electron';
import { ConnectionDao } from '../dao/ConnectionDao';
import { StoredCredentialDao } from '../dao/StoredCredentialDao';
import { SshClient } from '../ssh/SshClient';
import { Config } from '../config/Config';
import { Logger } from '../log/Logger';

const log = Logger.getLogger('ipcHandlers');
const activeSessions = new Map<string, SshClient>();

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
  ipcMain.on('window-minimize', () => {
    mainWindow.minimize();
  });

  ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.on('window-close', () => {
    mainWindow.close();
  });

  ipcMain.handle('window-get-platform', () => {
    return process.platform;
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
      
      const client = await SshClient.connect(chain, config, (progressMsg) => {
        mainWindow.webContents.send('ssh-connect-progress', { connectionId, message: progressMsg });
      });
      
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
}

