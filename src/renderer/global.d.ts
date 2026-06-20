export interface LocalFile {
  name: string;
  isDirectory: boolean;
  size: number;
  modified: string;
}

export interface RemoteFile {
  name: string;
  isDirectory: boolean;
  isSymlink: boolean;
  size: number;
  date: string;
  permissions: string;
  owner: string;
}

export interface ConnectionProfile {
  id: number;
  name: string;
  host: string;
  port: number;
  workingDir: string;
  connectionTypeId: number;
  connectionTypeCode?: string;
  credentialId: number | null;
  tunnelViaConnectionId: number | null;
  lastUsed?: number;
}

export interface StoredCredential {
  id: number;
  name: string;
  type: string;
  username: string;
  password?: string;
  totpSecret?: string;
  privateKeyName?: string;
  privateKeyContent?: string;
  privateKeyPassphrase?: string;
  isDefault: number | boolean;
}

export interface ConnectionType {
  id: number;
  name: string;
  code: string;
}

export interface ConnectionSettings {
  connectionId: number;
  localPanelCollapsed: boolean | number;
  localSortField: 'name' | 'size' | 'modified';
  localSortAsc: boolean | number;
  localFilterText: string;
  remoteSortField: 'name' | 'size' | 'modified' | 'owner' | 'permissions';
  remoteSortAsc: boolean | number;
  remoteFilterText: string;
  localColName: number;
  localColSize: number;
  localColModified: number;
  localPanelWidth: number;
  remoteColName: number;
  remoteColSize: number;
  remoteColModified: number;
  remoteColOwner: number;
  remoteColRights: number;
}

export interface RemoteTab {
  path: string;
  isPinned: boolean | number;
  tabOrder?: number;
  isActive?: boolean | number;
}

export interface Bookmark {
  id: number;
  connectionId: number;
  pane: string;
  path: string;
  isDefault: boolean | number;
}

export interface KnownHost {
  id: number;
  host: string;
  port: number;
  keyType: string;
  publicKey: string;
  fingerprint: string;
}

export interface ElectronAPI {
  window: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    getPlatform: () => Promise<string>;
    setTheme: (theme: 'dark' | 'light') => void;
    isMaximized: () => Promise<boolean>;
    onMaximizedState: (callback: (event: unknown, isMaximized: boolean) => void) => () => void;
    openFile: () => Promise<string | null>;
    startDrag: (filePath: string, iconName?: string) => void;
  };
  fs: {
    readFile: (filePath: string) => Promise<string>;
    listDirectory: (pathStr: string) => Promise<LocalFile[]>;
    getHomeDir: () => Promise<string>;
    mkdir: (pathStr: string) => Promise<{ success: boolean }>;
    delete: (pathStr: string, recursive: boolean) => Promise<{ success: boolean }>;
    rename: (from: string, to: string) => Promise<{ success: boolean }>;
    copy: (from: string, to: string) => Promise<{ success: boolean }>;
    createFile: (filePath: string) => Promise<{ success: boolean }>;
    compress: (dirPath: string, tarPath: string) => Promise<{ success: boolean }>;
    extract: (archivePath: string, destDir: string) => Promise<{ success: boolean }>;
    calculateSize: (pathStr: string) => Promise<number>;
    isDirectory: (pathStr: string) => Promise<boolean>;
  };
  db: {
    getConnections: () => Promise<ConnectionProfile[]>;
    getConnection: (id: number) => Promise<ConnectionProfile | null>;
    addConnection: (data: Omit<ConnectionProfile, 'id'>) => Promise<number>;
    updateConnection: (data: ConnectionProfile) => Promise<{ success: boolean }>;
    deleteConnection: (id: number) => Promise<{ success: boolean }>;
    touchConnection: (id: number) => Promise<{ success: boolean }>;
    getConnectionTypes: () => Promise<ConnectionType[]>;
    getCredentials: () => Promise<StoredCredential[]>;
    getCredential: (id: number) => Promise<StoredCredential | null>;
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
    listDirectory: (sessionId: string, pathStr: string) => Promise<RemoteFile[]>;
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
      callback: (event: unknown, data: { connectionId: number; message: string }) => void
    ) => () => void;
    onHostKeyVerify: (
      callback: (event: unknown, data: { host: string; port: number; keyType: string; fingerprint: string; publicKey: string }) => void
    ) => () => void;
    respondHostKeyVerify: (response: { trust: boolean; save: boolean }) => void;
  };
  terminal: {
    openWindow: (sessionId: string, username: string, host: string) => void;
    openShell: (sessionId: string, tabId: string) => Promise<{ success: boolean; shellId: string; error?: string }>;
    writeShell: (shellId: string, data: string) => void;
    resizeShell: (shellId: string, cols: number, rows: number) => void;
    closeShell: (shellId: string) => void;
    onShellData: (callback: (event: unknown, shellId: string, data: string) => void) => () => void;
    onShellClose: (callback: (event: unknown, shellId: string) => void) => () => void;
    onOpenTab: (callback: (event: unknown, sessionId: string, username: string, host: string) => void) => () => void;
  };
  settings: {
    getSetting: (key: string, defaultValue: string) => Promise<string>;
    setSetting: (key: string, value: string) => Promise<{ success: boolean }>;
    getAllSettings: () => Promise<Record<string, string>>;
    getBookmarks: (connectionId: number, pane: string) => Promise<Bookmark[]>;
    addBookmark: (connectionId: number, pane: string, path: string) => Promise<void>;
    deleteBookmark: (id: number) => Promise<void>;
    setDefaultBookmark: (connectionId: number, pane: string, id: number) => Promise<void>;
    getKnownHosts: () => Promise<KnownHost[]>;
    deleteKnownHost: (id: number) => Promise<void>;
    addKnownHost: (host: string, port: number, keyType: string, publicKey: string, fingerprint: string) => Promise<void>;
    getConnectionSettings: (connectionId: number) => Promise<ConnectionSettings | null>;
    updateConnectionSettings: (connectionId: number, settings: Partial<ConnectionSettings>) => Promise<void>;
    getRemoteTabs: (connectionId: number) => Promise<RemoteTab[]>;
    saveRemoteTabs: (connectionId: number, tabs: RemoteTab[]) => Promise<void>;
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
