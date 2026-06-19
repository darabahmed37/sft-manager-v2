export interface ElectronAPI {
  window: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    getPlatform: () => Promise<string>;
    isMaximized: () => Promise<boolean>;
    onMaximizedState: (callback: (event: any, isMaximized: boolean) => void) => () => void;
    openFile: () => Promise<string | null>;
  };
  fs: {
    readFile: (filePath: string) => Promise<string>;
    listDirectory: (pathStr: string) => Promise<any[]>;
    getHomeDir: () => Promise<string>;
    mkdir: (pathStr: string) => Promise<{ success: boolean }>;
    delete: (pathStr: string, recursive: boolean) => Promise<{ success: boolean }>;
    rename: (from: string, to: string) => Promise<{ success: boolean }>;
    copy: (from: string, to: string) => Promise<{ success: boolean }>;
    createFile: (filePath: string) => Promise<{ success: boolean }>;
    compress: (dirPath: string, tarPath: string) => Promise<{ success: boolean }>;
    extract: (archivePath: string, destDir: string) => Promise<{ success: boolean }>;
    calculateSize: (pathStr: string) => Promise<number>;
  };
  db: {
    getConnections: () => Promise<any[]>;
    getConnection: (id: number) => Promise<any | null>;
    addConnection: (data: {
      name: string;
      host: string;
      port: number;
      workingDir: string;
      connectionTypeId: number;
      credentialId: number | null;
      tunnelViaConnectionId: number | null;
    }) => Promise<number>;
    updateConnection: (data: {
      id: number;
      name: string;
      host: string;
      port: number;
      workingDir: string;
      connectionTypeId: number;
      credentialId: number | null;
      tunnelViaConnectionId: number | null;
    }) => Promise<{ success: boolean }>;
    deleteConnection: (id: number) => Promise<{ success: boolean }>;
    touchConnection: (id: number) => Promise<{ success: boolean }>;
    getConnectionTypes: () => Promise<any[]>;
    getCredentials: () => Promise<any[]>;
    getCredential: (id: number) => Promise<any | null>;
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
    }) => Promise<number>;
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
    }) => Promise<{ success: boolean }>;
    deleteCredential: (id: number) => Promise<{ success: boolean }>;
  };
  ssh: {
    connect: (connectionId: number) => Promise<{ success: boolean; sessionId?: string; error?: string }>;
    disconnect: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
    listDirectory: (sessionId: string, pathStr: string) => Promise<any[]>;
    getHomeDir: (sessionId: string) => Promise<string>;
    delete: (sessionId: string, pathStr: string, recursive: boolean) => Promise<void>;
    rename: (sessionId: string, from: string, to: string) => Promise<void>;
    mkdir: (sessionId: string, pathStr: string) => Promise<void>;
    copy: (sessionId: string, from: string, to: string) => Promise<{ success: boolean }>;
    createFile: (sessionId: string, pathStr: string) => Promise<{ success: boolean }>;
    compress: (sessionId: string, dirPath: string, tarPath: string) => Promise<{ success: boolean }>;
    extract: (sessionId: string, archivePath: string, destDir: string) => Promise<{ success: boolean }>;
    calculateSize: (sessionId: string, pathStr: string) => Promise<number>;
    upload: (sessionId: string, localPath: string, remoteDir: string) => Promise<{ success: boolean }>;
    download: (sessionId: string, remotePath: string, localDir: string) => Promise<{ success: boolean }>;
    uploadFolder: (sessionId: string, localFolder: string, remoteDir: string) => Promise<{ success: boolean }>;
    downloadFolder: (sessionId: string, remoteFolder: string, localDir: string) => Promise<{ success: boolean }>;
    onProgress: (
      callback: (event: any, data: { connectionId: number; message: string }) => void
    ) => () => void;
    onHostKeyVerify: (
      callback: (event: any, data: { host: string; port: number; keyType: string; fingerprint: string; publicKey: string }) => void
    ) => () => void;
    respondHostKeyVerify: (response: { trust: boolean; save: boolean }) => void;
  };
  settings: {
    getSetting: (key: string, defaultValue: string) => Promise<string>;
    setSetting: (key: string, value: string) => Promise<any>;
    getAllSettings: () => Promise<Record<string, string>>;
    getBookmarks: (connectionId: number, pane: string) => Promise<any[]>;
    addBookmark: (connectionId: number, pane: string, path: string) => Promise<void>;
    deleteBookmark: (id: number) => Promise<void>;
    setDefaultBookmark: (connectionId: number, pane: string, id: number) => Promise<void>;
    getKnownHosts: () => Promise<any[]>;
    deleteKnownHost: (id: number) => Promise<void>;
    addKnownHost: (host: string, port: number, keyType: string, publicKey: string, fingerprint: string) => Promise<void>;
    getConnectionSettings: (connectionId: number) => Promise<any | null>;
    updateConnectionSettings: (connectionId: number, settings: any) => Promise<void>;
    getRemoteTabs: (connectionId: number) => Promise<any[]>;
    saveRemoteTabs: (connectionId: number, tabs: any[]) => Promise<void>;
    resetApp: () => Promise<void>;
    clearTemp: () => Promise<{ success: boolean; clearedCount: number }>;
    clearLogs: () => Promise<{ success: boolean; clearedCount: number }>;
    openTemp: () => Promise<void>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
