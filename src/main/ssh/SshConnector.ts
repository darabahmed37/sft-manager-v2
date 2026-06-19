import { Client } from 'ssh2';
import { generateTOTP } from './totp';
import { Server, HopSession, SshSessionState } from './types';
import { Config } from '../config/Config';
import { Logger } from '../log/Logger';

const log = Logger.getLogger('SshConnector');

export class SshConnector {
  static async connect(
    chain: Server[],
    config: Config,
    listener?: (msg: string) => void
  ): Promise<SshSessionState> {
    if (chain.length === 0) {
      throw new Error('Hop chain must not be empty');
    }

    const completedHops: HopSession[] = [];

    try {
      for (let i = 0; i < chain.length; i++) {
        const server = chain[i];
        const hopLabel = chain.length === 1 
          ? `${server.username}@${server.host}` 
          : `${server.username}@${server.host} (${i + 1}/${chain.length})`;

        this.notify(listener, `Connecting to ${hopLabel}...`);
        log.info(`[Hop ${i + 1}/${chain.length}] Connecting ${server.username}@${server.host}:${server.port}`);

        let sock: any = undefined;

        if (i > 0) {
          const prevClient = completedHops[completedHops.length - 1].client;
          const cmd = `nc ${server.host} ${server.port} 2>/dev/null || bash -c 'exec 3<>/dev/tcp/${server.host}/${server.port}; cat <&3 & cat >&3; wait'`;
          log.info(`[Hop ${i + 1}] Exec-proxy command on jump: ${cmd}`);

          sock = await new Promise((resolve, reject) => {
            prevClient.exec(cmd, (err, stream) => {
              if (err) {
                reject(err);
              } else {
                resolve(stream);
              }
            });
          });
        }

        const client = await this.connectHop(server, config, sock);
        completedHops.push({
          client,
          server,
          wipe: () => {
            if (server.password) server.password = '';
            if (server.passphrase) server.passphrase = '';
          }
        });

        log.info(`[Hop ${i + 1}/${chain.length}] Authenticated: ${server.username}@${server.host}`);
        if (i < chain.length - 1) {
          this.notify(listener, `Hop ${i + 1} authenticated — continuing...`);
        }
      }

      const state = new SshSessionState(config, completedHops);
      state.isConnected = true;
      log.info(`Session READY — ${state.targetDisplay()}`);
      return state;

    } catch (ex: any) {
      log.error('Connection failed, rolling back active connections', ex);
      for (let i = completedHops.length - 1; i >= 0; i--) {
        try {
          completedHops[i].client.end();
        } catch (cleanupErr: any) {
          log.debug(`Failed to close connection on rollback: ${cleanupErr.message}`);
        }
      }
      throw ex;
    }
  }

  private static connectHop(server: Server, config: Config, sock?: any): Promise<Client> {
    return new Promise((resolve, reject) => {
      const client = new Client();
      let isSettled = false;

      const handleSettled = (cb: () => void) => {
        if (!isSettled) {
          isSettled = true;
          cb();
        }
      };

      client.on('ready', () => {
        try {
          client.setNoDelay(true);
        } catch (err: any) {
          log.warn(`Failed to set setNoDelay: ${err.message}`);
        }
        handleSettled(() => resolve(client));
      });

      client.on('error', (err) => {
        handleSettled(() => reject(err));
      });

      client.on('close', () => {
        handleSettled(() => reject(new Error('Connection closed before ready')));
      });

      client.on('keyboard-interactive', (name, instruction, instructions, prompts, finish) => {
        log.debug(`[Auth] Keyboard-interactive prompts received: ${prompts.length}`);
        const responses: string[] = [];

        for (const p of prompts) {
          const promptText = p.prompt.toLowerCase();
          log.info(`[Auth] prompt='${p.prompt.trim()}'`);

          if (promptText.includes('password') || promptText.includes('first factor') || promptText.includes('passcode')) {
            if (server.password) {
              log.info('[Auth] -> sending stored password');
              responses.push(server.password);
            } else {
              log.warn('[Auth] -> no password configured');
              responses.push('');
            }
          } else if (
            promptText.includes('second') || 
            promptText.includes('verification') || 
            promptText.includes('totp') || 
            promptText.includes('google') ||
            promptText.includes('token')
          ) {
            if (server.totpSecret) {
              try {
                const code = generateTOTP(server.totpSecret);
                log.info('[Auth] -> generating and sending TOTP code');
                responses.push(code);
              } catch (ex: any) {
                log.error('[Auth] Failed to generate TOTP code', ex);
                responses.push('');
              }
            } else {
              log.warn('[Auth] -> no TOTP secret configured');
              responses.push('');
            }
          } else {
            log.warn(`[Auth] -> unexpected interactive prompt: ${p.prompt}`);
            responses.push('');
          }
        }
        finish(responses);
      });

      const connectTimeout = parseInt(config.get('ssh.connect.timeout', '60'), 10);
      const keepaliveInterval = parseInt(config.get('ssh.keepalive.interval', '180'), 10);
      const keepaliveMaxFailures = parseInt(config.get('ssh.keepalive.max.failures', '3'), 10);

      const connOpts: any = {
        username: server.username,
        tryKeyboard: true,
        readyTimeout: connectTimeout * 1000,
        keepaliveInterval: keepaliveInterval * 1000,
        keepaliveCountMax: keepaliveMaxFailures,
      };

      if (sock) {
        connOpts.sock = sock;
      } else {
        connOpts.host = server.host;
        connOpts.port = server.port;
      }

      if (server.password) {
        connOpts.password = server.password;
      }

      if (server.privateKey) {
        connOpts.privateKey = server.privateKey;
        if (server.passphrase) {
          connOpts.passphrase = server.passphrase;
        }
      }

      client.connect(connOpts);
    });
  }

  static disconnect(state: SshSessionState) {
    for (let i = state.hops.length - 1; i >= 0; i--) {
      try {
        state.hops[i].client.end();
      } catch (ex: any) {
        log.debug(`Session disconnect error: ${ex.message}`);
      }
    }
    state.isConnected = false;
    log.info(`SSH session closed (${state.targetDisplay()})`);
  }

  private static notify(listener: ((msg: string) => void) | undefined, msg: string) {
    if (listener) {
      try {
        listener(msg);
      } catch (ex) {
        // Ignore listener exceptions
      }
    }
  }
}
export default SshConnector;
