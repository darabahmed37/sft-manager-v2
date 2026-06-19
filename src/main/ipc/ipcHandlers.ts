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
        if (cred.password) serverConf.password = cred.password;
        if (cred.totpSecret) serverConf.totpSecret = cred.totpSecret;
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
  }) => {
    return StoredCredentialDao.addCredential(
      data.name,
      data.username,
      data.passwordPlain,
      data.totpSecretPlain,
      data.isDefault,
      data.type
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
  }) => {
    StoredCredentialDao.updateCredential(
      data.id,
      data.name,
      data.username,
      data.passwordPlain,
      data.totpSecretPlain,
      data.isDefault,
      data.type
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
}
