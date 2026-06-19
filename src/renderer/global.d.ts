export interface ElectronAPI {
  window: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    getPlatform: () => Promise<string>;
    openFile: () => Promise<string | null>;
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
    }) => Promise<number>;
    updateCredential: (data: {
      id: number;
      name: string;
      username: string;
      passwordPlain: string;
      totpSecretPlain: string;
      isDefault: boolean;
      type: string;
    }) => Promise<{ success: boolean }>;
    deleteCredential: (id: number) => Promise<{ success: boolean }>;
  };
  ssh: {
    connect: (connectionId: number) => Promise<{ success: boolean; sessionId?: string; error?: string }>;
    disconnect: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
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
