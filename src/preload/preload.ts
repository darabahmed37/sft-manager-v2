import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  window: {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
    getPlatform: () => ipcRenderer.invoke('window-get-platform'),
    isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
    onMaximizedState: (callback: (event: any, isMaximized: boolean) => void) => {
      ipcRenderer.on('window-maximized-state', callback);
      return () => {
        ipcRenderer.removeListener('window-maximized-state', callback);
      };
    },
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
  terminal: {
    openWindow: (sessionId: string, username: string, host: string) =>
      ipcRenderer.send('terminal-open-window', sessionId, username, host),
    openShell: (sessionId: string, tabId: string) =>
      ipcRenderer.invoke('terminal-open-shell', sessionId, tabId),
    writeShell: (shellId: string, data: string) =>
      ipcRenderer.send('terminal-shell-write', shellId, data),
    resizeShell: (shellId: string, cols: number, rows: number) =>
      ipcRenderer.send('terminal-shell-resize', shellId, cols, rows),
    closeShell: (shellId: string) =>
      ipcRenderer.send('terminal-shell-close', shellId),
    onShellData: (callback: (event: any, shellId: string, data: string) => void) => {
      ipcRenderer.on('terminal-shell-data', callback);
      return () => ipcRenderer.removeListener('terminal-shell-data', callback);
    },
    onShellClose: (callback: (event: any, shellId: string) => void) => {
      ipcRenderer.on('terminal-shell-close', callback);
      return () => ipcRenderer.removeListener('terminal-shell-close', callback);
    },
    onOpenTab: (callback: (event: any, sessionId: string, username: string, host: string) => void) => {
      ipcRenderer.on('terminal-open-tab', callback);
      return () => ipcRenderer.removeListener('terminal-open-tab', callback);
    },
  },
  settings: {
    getSetting: (key: string, defaultValue: string) => ipcRenderer.invoke('settings-get', key, defaultValue),
    setSetting: (key: string, value: string) => ipcRenderer.invoke('settings-set', key, value),
    getAllSettings: () => ipcRenderer.invoke('settings-get-all'),
    getBookmarks: (connectionId: number, pane: string) => ipcRenderer.invoke('bookmarks-get', connectionId, pane),
    addBookmark: (connectionId: number, pane: string, path: string) => ipcRenderer.invoke('bookmarks-add', connectionId, pane, path),
    deleteBookmark: (id: number) => ipcRenderer.invoke('bookmarks-delete', id),
    setDefaultBookmark: (connectionId: number, pane: string, id: number) => ipcRenderer.invoke('bookmarks-set-default', connectionId, pane, id),
    getKnownHosts: () => ipcRenderer.invoke('known-hosts-get'),
    deleteKnownHost: (id: number) => ipcRenderer.invoke('known-hosts-delete', id),
    addKnownHost: (host: string, port: number, keyType: string, publicKey: string, fingerprint: string) => ipcRenderer.invoke('known-hosts-add', host, port, keyType, publicKey, fingerprint),
    getConnectionSettings: (connectionId: number) => ipcRenderer.invoke('connection-settings-get', connectionId),
    updateConnectionSettings: (connectionId: number, settings: any) => ipcRenderer.invoke('connection-settings-update', connectionId, settings),
    getRemoteTabs: (connectionId: number) => ipcRenderer.invoke('remote-tabs-get', connectionId),
    saveRemoteTabs: (connectionId: number, tabs: any[]) => ipcRenderer.invoke('remote-tabs-save', connectionId, tabs),
    resetApp: () => ipcRenderer.invoke('maintenance-reset-app'),
    clearTemp: () => ipcRenderer.invoke('maintenance-clear-temp'),
    clearLogs: () => ipcRenderer.invoke('maintenance-clear-logs'),
    openTemp: () => ipcRenderer.invoke('maintenance-open-temp'),
  },
});
