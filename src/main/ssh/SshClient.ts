import { Server, SshSessionState } from './types';
import { Config } from '../config/Config';
import { SshConnector } from './SshConnector';
import { SshExecutor, CmdResult } from './SshExecutor';
import { SftpBrowser, FileEntry } from './SftpBrowser';
import { SftpTransfer, Progress } from './SftpTransfer';
import { Logger } from '../log/Logger';
import * as os from 'os';
import * as path from 'path';

const log = Logger.getLogger('SshClient');

export class SshClient {
  private state: SshSessionState;
  private browser: SftpBrowser;
  private executor: SshExecutor;
  private transfer: SftpTransfer;
  
  private remoteHomeDir?: string;

  private constructor(state: SshSessionState) {
    this.state = state;
    this.browser = new SftpBrowser(state);
    this.executor = new SshExecutor(state);
    this.transfer = new SftpTransfer(state, this.executor);
  }

  get isConnected(): boolean {
    return this.state.isConnected;
  }

  get config(): Config {
    return this.state.config;
  }

  get targetServer(): Server {
    return this.state.targetServer;
  }

  get targetClient(): import('ssh2').Client {
    return this.state.targetClient;
  }

  static async connect(
    chain: Server[],
    config: Config,
    listener?: (msg: string) => void,
    verifyHostKey?: (hostKeyData: { host: string; port: number; keyType: string; fingerprint: string; publicKey: string }) => Promise<{ trust: boolean; save: boolean }>
  ): Promise<SshClient> {
    const state = await SshConnector.connect(chain, config, listener, verifyHostKey);
    return new SshClient(state);
  }

  async exec(command: string): Promise<CmdResult> {
    return this.executor.exec(command);
  }

  async resolveRemotePath(pathStr: string): Promise<string> {
    if (!pathStr) {
      return await this.getHomeDir();
    }
    const trimmed = pathStr.trim();
    if (trimmed === '~') {
      return await this.getHomeDir();
    }
    if (trimmed.startsWith('~/')) {
      const home = await this.getHomeDir();
      const subPath = trimmed.substring(2);
      return home.endsWith('/') ? `${home}${subPath}` : `${home}/${subPath}`;
    }
    return trimmed;
  }

  resolveLocalPath(pathStr: string): string {
    if (!pathStr) {
      return os.homedir();
    }
    const trimmed = pathStr.trim();
    if (trimmed === '~') {
      return os.homedir();
    }
    if (trimmed.startsWith('~/')) {
      const home = os.homedir();
      const subPath = trimmed.substring(2);
      return path.join(home, subPath);
    }
    return path.resolve(trimmed);
  }

  async listDirectory(pathStr: string): Promise<FileEntry[]> {
    const resolvedPath = await this.resolveRemotePath(pathStr);
    const result = await this.browser.listDirectory(resolvedPath);
    if (result !== null) {
      return result;
    }

    // Fallback to exec ls -la -N
    const r = await this.exec(`ls -la -N ${this.q(resolvedPath)}`);
    if (r.exitCode !== 0 && r.stderr.includes('Permission denied')) {
      throw new Error(`Permission denied: ${resolvedPath}`);
    }

    const entries: FileEntry[] = [];
    const lines = r.stdout.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      const fe = this.parseLsLine(line);
      if (fe) {
        entries.push(fe);
      }
    }
    return entries;
  }

  async getHomeDir(): Promise<string> {
    if (this.remoteHomeDir) return this.remoteHomeDir;
    
    let home = await this.browser.realPath('');
    if (!home) home = await this.browser.realPath('.');
    
    if (!home || home.endsWith('/~') || home.includes('~')) {
      const r = await this.exec('echo $HOME');
      if (r.exitCode === 0) {
        home = r.stdout.trim();
      }
    }
    
    this.remoteHomeDir = home || '/';
    return this.remoteHomeDir;
  }

  async realPath(pathStr: string): Promise<string> {
    const resolvedPath = await this.resolveRemotePath(pathStr);
    const rp = await this.browser.realPath(resolvedPath);
    if (rp !== null) return rp;

    const r = await this.exec(`cd ${this.q(resolvedPath)} && pwd`);
    return r.exitCode === 0 ? r.stdout.trim() : resolvedPath;
  }

  async fileExists(pathStr: string): Promise<boolean> {
    const resolvedPath = await this.resolveRemotePath(pathStr);
    const exists = await this.browser.fileExists(resolvedPath);
    if (exists) return true;

    const r = await this.exec(`test -e ${this.q(resolvedPath)}`);
    return r.exitCode === 0;
  }

  async resolveSymlinkIsDir(pathStr: string): Promise<boolean> {
    const resolvedPath = await this.resolveRemotePath(pathStr);
    return this.browser.resolveSymlinkIsDir(resolvedPath);
  }

  async mkdir(pathStr: string): Promise<void> {
    const resolvedPath = await this.resolveRemotePath(pathStr);
    await this.browser.mkdirRecursive(resolvedPath);
  }

  async delete(pathStr: string, recursive: boolean): Promise<void> {
    const resolvedPath = await this.resolveRemotePath(pathStr);
    log.info(`DELETE  ${resolvedPath}  recursive=${recursive}`);
    
    const isLink = await this.browser.isSymlink(resolvedPath);
    if (isLink) {
      await this.browser.deleteSimple(resolvedPath);
    } else if (recursive) {
      const exists = await this.fileExists(resolvedPath);
      if (!exists) {
        throw new Error(`File not found on server: ${resolvedPath}`);
      }
      await this.executor.deleteRecursive(resolvedPath);
    } else {
      await this.browser.deleteSimple(resolvedPath);
    }
  }

  async rename(from: string, to: string): Promise<void> {
    const resolvedFrom = await this.resolveRemotePath(from);
    const resolvedTo = await this.resolveRemotePath(to);
    try {
      await this.browser.rename(resolvedFrom, resolvedTo);
    } catch (ex: unknown) {
      log.warn(`RENAME SFTP failed (${(ex as Error).message}); falling back to exec mv`);
      const r = await this.exec(`mv ${this.q(resolvedFrom)} ${this.q(resolvedTo)}`);
      if (r.exitCode !== 0) {
        throw new Error(`Rename failed: ${r.stderr}`, { cause: ex });
      }
    }
  }

  async upload(localPath: string, remoteDir: string, progress?: Progress): Promise<void> {
    const resolvedLocal = this.resolveLocalPath(localPath);
    const resolvedRemote = await this.resolveRemotePath(remoteDir);
    await this.transfer.upload(resolvedLocal, resolvedRemote, progress);
  }

  async download(remotePath: string, localDir: string, progress?: Progress): Promise<void> {
    const resolvedRemote = await this.resolveRemotePath(remotePath);
    const resolvedLocal = this.resolveLocalPath(localDir);
    await this.transfer.download(resolvedRemote, resolvedLocal, progress);
  }

  async uploadFolder(localFolder: string, remoteDir: string, progress?: Progress): Promise<void> {
    const resolvedLocal = this.resolveLocalPath(localFolder);
    const resolvedRemote = await this.resolveRemotePath(remoteDir);
    await this.transfer.uploadFolder(resolvedLocal, resolvedRemote, progress);
  }

  async downloadFolder(remoteFolderPath: string, localDir: string, progress?: Progress): Promise<void> {
    const resolvedRemote = await this.resolveRemotePath(remoteFolderPath);
    const resolvedLocal = this.resolveLocalPath(localDir);
    await this.transfer.downloadFolder(resolvedRemote, resolvedLocal, progress);
  }

  get isCancelRequested(): boolean {
    return this.transfer.isCancelRequested;
  }

  cancelActiveTransfer() {
    this.transfer.cancelActiveTransfer();
  }

  close() {
    this.browser.close();
    this.transfer.close();
    SshConnector.disconnect(this.state);
    this.state.wipeCredentials();
  }

  private q(val: string): string {
    return `'${val.replace(/'/g, "'\\''")}'`;
  }

  private parseLsLine(line: string): FileEntry | null {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('total ')) return null;

    const columns = trimmed.split(/\s+/);
    if (columns.length < 9) return null;

    const perms = columns[0];
    const isLink = perms.startsWith('l');
    
    const size = parseInt(columns[4], 10) || 0;
    const date = `${columns[5]} ${columns[6]} ${columns[7]}`;
    
    // Joint the rest as name since name can contain spaces
    const namePart = columns.slice(8).join(' ');
    let name = this.unquoteLs(namePart);
    
    if (isLink && name.includes(' -> ')) {
      name = name.substring(0, name.indexOf(' -> '));
    }

    return {
      name,
      isDirectory: perms.startsWith('d'),
      isSymlink: isLink,
      size,
      date,
      permissions: perms,
      owner: columns[2],
    };
  }

  private unquoteLs(s: string): string {
    if (s.length < 2) return s;
    const quoted = (s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'));
    return quoted ? s.substring(1, s.length - 1) : s;
  }
}
export default SshClient;
