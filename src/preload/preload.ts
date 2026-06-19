import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  window: {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
    getPlatform: () => ipcRenderer.invoke('window-get-platform'),
    openFile: () => ipcRenderer.invoke('dialog-open-file'),
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
    }) => ipcRenderer.invoke('db-add-credential', data),
    updateCredential: (data: {
      id: number;
      name: string;
      username: string;
      passwordPlain: string;
      totpSecretPlain: string;
      isDefault: boolean;
      type: string;
    }) => ipcRenderer.invoke('db-update-credential', data),
    deleteCredential: (id: number) => ipcRenderer.invoke('db-delete-credential', id),
  },
  ssh: {
    connect: (connectionId: number) => ipcRenderer.invoke('ssh-connect', connectionId),
    disconnect: (sessionId: string) => ipcRenderer.invoke('ssh-disconnect', sessionId),
    onProgress: (callback: (event: any, data: { connectionId: number; message: string }) => void) => {
      ipcRenderer.on('ssh-connect-progress', callback);
      return () => {
        ipcRenderer.removeListener('ssh-connect-progress', callback);
      };
    },
  },
});
