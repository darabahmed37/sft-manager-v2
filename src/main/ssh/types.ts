import { Client } from 'ssh2';
import { Config } from '../config/Config';

export interface Server {
  host: string;
  port: number;
  username: string;
  password?: string;
  totpSecret?: string;
  privateKey?: string; // for key auth
  passphrase?: string; // for encrypted keys
}

export interface HopSession {
  client: Client;
  server: Server;
  wipe?: () => void;
}

export class SshSessionState {
  config: Config;
  hops: HopSession[];
  isConnected = false;
  dropListener: (() => void) | null = null;

  constructor(config: Config, hops: HopSession[]) {
    this.config = config;
    this.hops = hops;
  }

  get targetClient(): Client {
    return this.hops[this.hops.length - 1].client;
  }

  get targetServer(): Server {
    return this.hops[this.hops.length - 1].server;
  }

  get hasAuthenticatedSessions(): boolean {
    return this.isConnected;
  }

  fireSessionDropped() {
    if (this.dropListener) {
      const listener = this.dropListener;
      this.dropListener = null;
      try {
        listener();
      } catch (ex: any) {
        console.warn(`[SSH] Session drop listener threw: ${ex.message}`);
      }
    }
  }

  targetDisplay(): string {
    const s = this.targetServer;
    return `${s.username}@${s.host}`;
  }

  wipeCredentials() {
    this.hops.forEach(h => {
      if (h.wipe) h.wipe();
    });
  }
}
