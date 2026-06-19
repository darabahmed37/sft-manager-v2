import { Server, HopSession, SshSessionState } from './types';
import { Config } from '../config/Config';
import { SshConnector } from './SshConnector';
import { SshExecutor, CmdResult } from './SshExecutor';
import { SftpBrowser, FileEntry } from './SftpBrowser';
import { SftpTransfer, Progress } from './SftpTransfer';
import { Logger } from '../log/Logger';

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

  static async connect(
    chain: Server[],
    config: Config,
    listener?: (msg: string) => void
  ): Promise<SshClient> {
    const state = await SshConnector.connect(chain, config, listener);
    return new SshClient(state);
  }

  async exec(command: string): Promise<CmdResult> {
    return this.executor.exec(command);
  }

  async listDirectory(pathStr: string): Promise<FileEntry[]> {
    const result = await this.browser.listDirectory(pathStr);
    if (result !== null) {
      return result;
    }

    // Fallback to exec ls -la -N
    const r = await this.exec(`ls -la -N ${this.q(pathStr)}`);
    if (r.exitCode !== 0 && r.stderr.includes('Permission denied')) {
      throw new Error(`Permission denied: ${pathStr}`);
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
    const rp = await this.browser.realPath(pathStr);
    if (rp !== null) return rp;

    const r = await this.exec(`cd ${this.q(pathStr)} && pwd`);
    return r.exitCode === 0 ? r.stdout.trim() : pathStr;
  }

  async fileExists(pathStr: string): Promise<boolean> {
    const exists = await this.browser.fileExists(pathStr);
    if (exists) return true;

    const r = await this.exec(`test -e ${this.q(pathStr)}`);
    return r.exitCode === 0;
  }

  async resolveSymlinkIsDir(pathStr: string): Promise<boolean> {
    return this.browser.resolveSymlinkIsDir(pathStr);
  }

  async mkdir(pathStr: string): Promise<void> {
    await this.browser.mkdirRecursive(pathStr);
  }

  async delete(pathStr: string, recursive: boolean): Promise<void> {
    log.info(`DELETE  ${pathStr}  recursive=${recursive}`);
    
    const isLink = await this.browser.isSymlink(pathStr);
    if (isLink) {
      await this.browser.deleteSimple(pathStr);
    } else if (recursive) {
      const exists = await this.fileExists(pathStr);
      if (!exists) {
        throw new Error(`File not found on server: ${pathStr}`);
      }
      await this.executor.deleteRecursive(pathStr);
    } else {
      await this.browser.deleteSimple(pathStr);
    }
  }

  async rename(from: string, to: string): Promise<void> {
    try {
      await this.browser.rename(from, to);
    } catch (ex: any) {
      log.warn(`RENAME SFTP failed (${ex.message}); falling back to exec mv`);
      const r = await this.exec(`mv ${this.q(from)} ${this.q(to)}`);
      if (r.exitCode !== 0) {
        throw new Error(`Rename failed: ${r.stderr}`);
      }
    }
  }

  async upload(localPath: string, remoteDir: string, progress?: Progress): Promise<void> {
    await this.transfer.upload(localPath, remoteDir, progress);
  }

  async download(remotePath: string, localDir: string, progress?: Progress): Promise<void> {
    await this.transfer.download(remotePath, localDir, progress);
  }

  async uploadFolder(localFolder: string, remoteDir: string, progress?: Progress): Promise<void> {
    await this.transfer.uploadFolder(localFolder, remoteDir, progress);
  }

  async downloadFolder(remoteFolderPath: string, localDir: string, progress?: Progress): Promise<void> {
    await this.transfer.downloadFolder(remoteFolderPath, localDir, progress);
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
