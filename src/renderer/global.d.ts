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
    onProgress: (
      callback: (event: any, data: { connectionId: number; message: string }) => void
    ) => () => void;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
