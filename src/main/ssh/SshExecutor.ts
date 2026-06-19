import { Client } from 'ssh2';
import { SshSessionState } from './types';
import { Logger } from '../log/Logger';

const log = Logger.getLogger('SshExecutor');

export interface CmdResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class SshExecutor {
  private state: SshSessionState;

  constructor(state: SshSessionState) {
    this.state = state;
  }

  async exec(command: string): Promise<CmdResult> {
    if (!this.state.hasAuthenticatedSessions) {
      log.warn(`EXEC skipped -- not connected: ${command}`);
      this.state.fireSessionDropped();
      return { stdout: '', stderr: 'Not connected', exitCode: -1 };
    }

    log.info(`EXEC >  ${command.substring(0, 120)}`);
    const client = this.state.targetClient;

    return new Promise((resolve) => {
      client.exec(command, (err, stream) => {
        if (err) {
          log.error(`EXEC error cmd=${command}`, err);
          return resolve({ stdout: '', stderr: err.message, exitCode: -1 });
        }

        let stdout = '';
        let stderr = '';

        stream.on('data', (data: Buffer) => {
          stdout += data.toString('utf8');
        });

        stream.stderr.on('data', (data: Buffer) => {
          stderr += data.toString('utf8');
        });

        stream.on('close', (code: number) => {
          stdout = stdout.trim();
          stderr = stderr.trim();

          if (code === 0) {
            log.info(`EXEC v  exit=0  bytes=${stdout.length}`);
          } else {
            log.warn(`EXEC x  exit=${code}  cmd=${command.substring(0, 80)}`);
          }

          resolve({ stdout, stderr, exitCode: code });
        });
      });
    });
  }

  async mkdir(pathStr: string): Promise<void> {
    log.info(`MKDIR  ${pathStr}`);
    const qPath = `'${pathStr.replace(/'/g, "'\\''")}'`;
    const r = await this.exec(`mkdir -p ${qPath}`);
    if (r.exitCode !== 0) {
      log.warn(`MKDIR failed: ${r.stderr}`);
    }
  }

  async deleteRecursive(pathStr: string): Promise<void> {
    log.info(`DELETE REC  ${pathStr}`);
    const qPath = `'${pathStr.replace(/'/g, "'\\''")}'`;
    const r = await this.exec(`rm -rf ${qPath}`);
    if (r.exitCode !== 0) {
      throw new Error(`Delete failed (${pathStr}): ${r.stderr}`);
    }
  }

  async isRemoteTextFile(remotePath: string): Promise<boolean> {
    const qPath = `'${remotePath.replace(/'/g, "'\\''")}'`;
    const r = await this.exec(`file -b ${qPath} 2>/dev/null`);
    if (r.exitCode !== 0 || !r.stdout) {
      log.warn(`'file' command unavailable for ${remotePath}, assuming text`);
      return true;
    }
    const out = r.stdout.toLowerCase();
    log.debug(`file -b ${remotePath} -> ${out}`);
    return out.includes('text') || out.includes('ascii') || out.includes('unicode') || out.includes('script') || out.includes('empty');
  }

  async countRemoteBytes(remotePath: string): Promise<number> {
    const qPath = `'${remotePath.replace(/'/g, "'\\''")}'`;
    const cmd = `find ${qPath} -type f -printf '%s\\n' 2>/dev/null | awk '{sum+=$1} END{print (sum?sum:0)}'`;
    const r = await this.exec(cmd);
    if (r.exitCode === 0 && r.stdout) {
      const bytes = parseInt(r.stdout.trim(), 10);
      if (!isNaN(bytes)) {
        return bytes;
      }
    }
    return 1;
  }
}
export default SshExecutor;
