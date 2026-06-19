import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  window: {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
    getPlatform: () => ipcRenderer.invoke('window-get-platform'),
    openFile: () => ipcRenderer.invoke('dialog-open-file'),
  },
  fs: {
    readFile: (filePath: string) => ipcRenderer.invoke('fs-read-file', filePath),
    listDirectory: (pathStr: string) => ipcRenderer.invoke('fs-list-directory', pathStr),
    getHomeDir: () => ipcRenderer.invoke('fs-get-home-dir'),
  },
  db: {
    getConnections: () => ipcRenderer.invoke('db-get-connections'),
    getConnection: (id: number) => ipcRenderer.invoke('db-get-connection', id),
    addConnection: (data: {
      name: string;
      host: string;
      port: number;
      workingDir: string;
      connectionTypeId: number;
      credentialId: number | null;
      tunnelViaConnectionId: number | null;
    }) => ipcRenderer.invoke('db-add-connection', data),
    updateConnection: (data: {
      id: number;
      name: string;
      host: string;
      port: number;
      workingDir: string;
      connectionTypeId: number;
      credentialId: number | null;
      tunnelViaConnectionId: number | null;
    }) => ipcRenderer.invoke('db-update-connection', data),
    deleteConnection: (id: number) => ipcRenderer.invoke('db-delete-connection', id),
    touchConnection: (id: number) => ipcRenderer.invoke('db-touch-connection', id),
    getConnectionTypes: () => ipcRenderer.invoke('db-get-connection-types'),
    getCredentials: () => ipcRenderer.invoke('db-get-credentials'),
    getCredential: (id: number) => ipcRenderer.invoke('db-get-credential', id),
    addCredential: (data: {
      name: string;
      username: string;
      passwordPlain: string;
      totpSecretPlain: string;
      isDefault: boolean;
      type: string;
      privateKeyName?: string;
      privateKeyContentPlain?: string;
      privateKeyPassphrasePlain?: string;
    }) => ipcRenderer.invoke('db-add-credential', data),
    updateCredential: (data: {
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
    }) => ipcRenderer.invoke('db-update-credential', data),
    deleteCredential: (id: number) => ipcRenderer.invoke('db-delete-credential', id),
  },
  ssh: {
    connect: (connectionId: number) => ipcRenderer.invoke('ssh-connect', connectionId),
    disconnect: (sessionId: string) => ipcRenderer.invoke('ssh-disconnect', sessionId),
    listDirectory: (sessionId: string, pathStr: string) => ipcRenderer.invoke('ssh-list-directory', sessionId, pathStr),
    getHomeDir: (sessionId: string) => ipcRenderer.invoke('ssh-get-home-dir', sessionId),
    delete: (sessionId: string, pathStr: string, recursive: boolean) => ipcRenderer.invoke('ssh-delete', sessionId, pathStr, recursive),
    rename: (sessionId: string, from: string, to: string) => ipcRenderer.invoke('ssh-rename', sessionId, from, to),
    mkdir: (sessionId: string, pathStr: string) => ipcRenderer.invoke('ssh-mkdir', sessionId, pathStr),
    onProgress: (callback: (event: any, data: { connectionId: number; message: string }) => void) => {
      ipcRenderer.on('ssh-connect-progress', callback);
      return () => {
        ipcRenderer.removeListener('ssh-connect-progress', callback);
      };
    },
  },
});
