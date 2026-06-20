import { SFTPWrapper } from 'ssh2';
import { SshSessionState } from './types';
import { Logger } from '../log/Logger';

const log = Logger.getLogger('SftpBrowser');

export interface FileEntry {
  name: string;
  isDirectory: boolean;
  isSymlink: boolean;
  size: number;
  date: string;
  permissions: string;
  owner: string;
}

export class SftpBrowser {
  private state: SshSessionState;
  private sftpWrapper?: SFTPWrapper;

  constructor(state: SshSessionState) {
    this.state = state;
  }

  private getSftpWrapper(): Promise<SFTPWrapper> {
    if (!this.state.hasAuthenticatedSessions) {
      this.state.fireSessionDropped();
      return Promise.reject(new Error('Session is not connected'));
    }

    return new Promise((resolve, reject) => {
      if (this.sftpWrapper) {
        return resolve(this.sftpWrapper);
      }

      this.state.targetClient.sftp((err, sftp) => {
        if (err) {
          reject(err);
        } else {
          this.sftpWrapper = sftp;
          sftp.on('close', () => {
            this.sftpWrapper = undefined;
          });
          resolve(sftp);
        }
      });
    });
  }

  async listDirectory(pathStr: string): Promise<FileEntry[] | null> {
    log.info(`LS(SFTP)  ${pathStr}`);
    try {
      const sftp = await this.getSftpWrapper();
      return await new Promise<FileEntry[]>((resolve, reject) => {
        sftp.readdir(pathStr, (err, list) => {
          if (err) {
            return reject(err);
          }

          const entries: FileEntry[] = [];
          for (const item of list) {
            const name = item.filename;
            if (name === '.' || name === '..') continue;

            const attrs = item.attrs;
            const mode = attrs.mode || 0;
            const isDir = (mode & 0x4000) !== 0; // S_IFDIR
            const isLink = (mode & 0xa000) !== 0; // S_IFLNK
            const size = attrs.size || 0;
            const date = this.formatDate(attrs.mtime || 0);
            const permissions = this.getPermissionsString(mode);

            let owner = '';
            if (item.longname) {
              const parts = item.longname.trim().split(/\s+/);
              if (parts.length >= 3) {
                owner = parts[2];
              }
            }

            entries.push({
              name,
              isDirectory: isDir,
              isSymlink: isLink,
              size,
              date,
              permissions,
              owner,
            });
          }
          log.info(`LS(SFTP)  ${pathStr} -> ${entries.length} entries`);
          resolve(entries);
        });
      });
    } catch (ex: unknown) {
      log.warn(`LS(SFTP) failed for ${pathStr} (${(ex as Error).message}); falling back to exec ls`);
      return null;
    }
  }

  async realPath(pathStr: string): Promise<string | null> {
    try {
      const sftp = await this.getSftpWrapper();
      return await new Promise<string>((resolve, reject) => {
        sftp.realpath(pathStr, (err, absPath) => {
          if (err) reject(err);
          else resolve(absPath);
        });
      });
    } catch (ex: unknown) {
      log.debug(`realPath SFTP failed (${(ex as Error).message}); falling back to exec`);
      return null;
    }
  }

  async fileExists(pathStr: string): Promise<boolean> {
    try {
      const sftp = await this.getSftpWrapper();
      return await new Promise<boolean>((resolve) => {
        sftp.stat(pathStr, (err) => {
          resolve(!err);
        });
      });
    } catch (ex: unknown) {
      log.debug(`fileExists stat failed for ${pathStr}: ${(ex as Error).message}`);
      return false;
    }
  }

  async rename(from: string, to: string): Promise<void> {
    log.info(`RENAME(SFTP)  ${from} -> ${to}`);
    const sftp = await this.getSftpWrapper();
    return new Promise((resolve, reject) => {
      sftp.rename(from, to, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async isSymlink(pathStr: string): Promise<boolean> {
    try {
      const sftp = await this.getSftpWrapper();
      return await new Promise<boolean>((resolve) => {
        sftp.lstat(pathStr, (err, stats) => {
          resolve(!err && stats.isSymbolicLink());
        });
      });
    } catch (ex: unknown) {
      log.debug(`isSymlink lstat failed for ${pathStr}: ${(ex as Error).message}`);
      return false;
    }
  }

  async resolveSymlinkIsDir(pathStr: string): Promise<boolean> {
    try {
      const sftp = await this.getSftpWrapper();
      return await new Promise<boolean>((resolve) => {
        sftp.stat(pathStr, (err, stats) => {
          resolve(!err && stats.isDirectory());
        });
      });
    } catch (ex: unknown) {
      log.debug(`resolveSymlinkIsDir stat failed for ${pathStr}: ${(ex as Error).message}`);
      return false;
    }
  }

  async deleteSimple(pathStr: string): Promise<void> {
    log.info(`DELETE SIMPLE  ${pathStr}`);
    const sftp = await this.getSftpWrapper();
    return new Promise<void>((resolve, reject) => {
      sftp.lstat(pathStr, (err, stats) => {
        if (err) {
          return reject(new Error(`Delete failed (${pathStr}): ${(err as Error).message}`));
        }
        if (stats.isSymbolicLink()) {
          sftp.unlink(pathStr, (unlinkErr) => {
            if (unlinkErr) reject(unlinkErr);
            else resolve();
          });
        } else if (stats.isDirectory()) {
          sftp.rmdir(pathStr, (rmdirErr) => {
            if (rmdirErr) reject(rmdirErr);
            else resolve();
          });
        } else {
          sftp.unlink(pathStr, (unlinkErr) => {
            if (unlinkErr) reject(unlinkErr);
            else resolve();
          });
        }
      });
    });
  }

  async mkdirRecursive(pathStr: string): Promise<void> {
    log.info(`MKDIR REC(SFTP)  ${pathStr}`);
    const sftp = await this.getSftpWrapper();
    const parts = pathStr.split('/').filter(p => p);
    let current = pathStr.startsWith('/') ? '/' : '';

    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      const exists = await this.fileExists(current);
      if (!exists) {
        await new Promise<void>((resolve) => {
          sftp.mkdir(current, (err) => {
            if (err) {
              // Ignore failure if it's due to directory existing (e.g. race condition)
              resolve();
            } else {
              resolve();
            }
          });
        });
      }
    }
  }

  close() {
    if (this.sftpWrapper) {
      try {
        this.sftpWrapper.end();
      } catch (ex: unknown) {
        log.warn(`SFTP channel close error: ${(ex as Error).message}`);
      }
      this.sftpWrapper = undefined;
    }
  }

  private getPermissionsString(mode: number): string {
    let perms = '';
    if ((mode & 0xf000) === 0xa000) perms += 'l';
    else if ((mode & 0xf000) === 0x4000) perms += 'd';
    else perms += '-';

    perms += mode & 0x0100 ? 'r' : '-';
    perms += mode & 0x0080 ? 'w' : '-';
    perms += mode & 0x0040 ? 'x' : '-';

    perms += mode & 0x0020 ? 'r' : '-';
    perms += mode & 0x0010 ? 'w' : '-';
    perms += mode & 0x0008 ? 'x' : '-';

    perms += mode & 0x0004 ? 'r' : '-';
    perms += mode & 0x0002 ? 'w' : '-';
    perms += mode & 0x0001 ? 'x' : '-';

    return perms;
  }

  private formatDate(mtime: number): string {
    const dateObj = new Date(mtime * 1000);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[dateObj.getMonth()];
    const day = String(dateObj.getDate()).padStart(2, '0');
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    return `${month} ${day} ${hours}:${minutes}`;
  }
}
export default SftpBrowser;
