import { SFTPWrapper } from 'ssh2';
import * as fs from 'fs';
import * as path from 'path';
import { SshSessionState } from './types';
import { SshExecutor } from './SshExecutor';
import { Logger } from '../log/Logger';

const log = Logger.getLogger('SftpTransfer');

export interface Progress {
  update(done: number, total: number, msg: string): void;
}

export class SftpTransfer {
  private state: SshSessionState;
  private executor: SshExecutor;
  private sftpWrapper?: SFTPWrapper;
  
  isCancelRequested = false;

  constructor(state: SshSessionState, executor: SshExecutor) {
    this.state = state;
    this.executor = executor;
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

  cancelActiveTransfer() {
    this.isCancelRequested = true;
    log.info('[Transfer] Cancel requested -- aborting active streams');
  }

  async upload(localPath: string, remoteDir: string, progress?: Progress): Promise<void> {
    this.isCancelRequested = false;
    const filename = path.basename(localPath);
    const dest = `${remoteDir}/${filename}`.replace(/\/+/g, '/');
    
    log.info(`[Upload SFTP]  ${filename}  ->  target: ${dest}`);
    
    const stats = fs.statSync(localPath);
    const totalBytes = stats.size || 1;
    
    if (progress) progress.update(0, totalBytes, 'Uploading via SFTP...');
    
    const sftp = await this.getSftpWrapper();
    
    await new Promise<void>((resolve, reject) => {
      const readStream = fs.createReadStream(localPath);
      const writeStream = sftp.createWriteStream(dest);
      
      let doneBytes = 0;
      let isSettled = false;

      const cleanup = () => {
        isSettled = true;
        readStream.destroy();
        writeStream.destroy();
      };

      readStream.on('data', (chunk: any) => {
        if (this.isCancelRequested) {
          cleanup();
          return reject(new Error('Transfer cancelled by user'));
        }
        doneBytes += chunk.length;
        if (progress) {
          const pct = Math.round((doneBytes / totalBytes) * 100);
          progress.update(doneBytes, totalBytes, `Uploading ${pct}%`);
        }
      });

      writeStream.on('close', () => {
        if (!isSettled) {
          if (progress) progress.update(totalBytes, totalBytes, 'Upload complete');
          log.info(`[Upload SFTP] v  ${filename}`);
          resolve();
        }
      });

      writeStream.on('error', (err: any) => {
        cleanup();
        reject(err);
      });

      readStream.on('error', (err: any) => {
        cleanup();
        reject(err);
      });

      readStream.pipe(writeStream);
    });
  }

  async download(remotePath: string, localDir: string, progress?: Progress): Promise<void> {
    this.isCancelRequested = false;
    const filename = remotePath.substring(remotePath.lastIndexOf('/') + 1);
    const localDest = path.join(localDir, filename);

    log.info(`[Download SFTP]  target: ${remotePath}  ->  local: ${localDest}`);
    
    const sftp = await this.getSftpWrapper();
    
    // Attempt to stat size
    let totalBytes = 1;
    try {
      const stats = await new Promise<any>((resolve, reject) => {
        sftp.stat(remotePath, (err: any, s: any) => {
          if (err) reject(err);
          else resolve(s);
        });
      });
      totalBytes = stats.size || 1;
    } catch (err: any) {
      log.debug(`Could not stat size of remote path ${remotePath}: ${err.message}`);
    }

    if (progress) progress.update(0, totalBytes, 'Downloading via SFTP...');

    await new Promise<void>((resolve, reject) => {
      const readStream = sftp.createReadStream(remotePath);
      const writeStream = fs.createWriteStream(localDest);

      let doneBytes = 0;
      let isSettled = false;

      const cleanup = () => {
        isSettled = true;
        readStream.destroy();
        writeStream.destroy();
      };

      readStream.on('data', (chunk: Buffer) => {
        if (this.isCancelRequested) {
          cleanup();
          return reject(new Error('Transfer cancelled by user'));
        }
        doneBytes += chunk.length;
        if (progress) {
          const pct = Math.round((doneBytes / totalBytes) * 100);
          progress.update(doneBytes, totalBytes, `Downloading ${pct}%`);
        }
      });

      writeStream.on('close', () => {
        if (!isSettled) {
          if (progress) progress.update(totalBytes, totalBytes, 'Download complete');
          log.info(`[Download SFTP] v  ${filename}`);
          resolve();
        }
      });

      writeStream.on('error', (err: any) => {
        cleanup();
        reject(err);
      });

      readStream.on('error', (err: any) => {
        cleanup();
        reject(err);
      });

      readStream.pipe(writeStream);
    });
  }

  async uploadFolder(localFolder: string, remoteDir: string, progress?: Progress): Promise<void> {
    this.isCancelRequested = false;
    const stats = fs.statSync(localFolder);
    if (!stats.isDirectory()) {
      return this.upload(localFolder, remoteDir, progress);
    }

    const folderName = path.basename(localFolder);
    const dest = `${remoteDir}/${folderName}`.replace(/\/+/g, '/');
    
    log.info(`[UploadFolder SFTP]  ${folderName}  ->  target: ${dest}`);
    
    if (progress) progress.update(0, 1, 'Starting folder upload...');

    const localFiles = this.walkLocalFolder(localFolder);
    const totalBytes = localFiles.reduce((acc, f) => acc + f.size, 0) || 1;
    
    let doneBytes = 0;
    let fileCount = 0;
    
    const sftp = await this.getSftpWrapper();

    const makeDir = (dirPath: string): Promise<void> => {
      return new Promise((resolve) => {
        sftp.mkdir(dirPath, () => {
          resolve(); // Resolve anyway since directory might already exist
        });
      });
    };

    await makeDir(dest);

    for (const file of localFiles) {
      if (this.isCancelRequested) {
        throw new Error('Transfer cancelled by user');
      }

      const relPath = path.relative(localFolder, file.absPath).replace(/\\/g, '/');
      const remoteFileDest = `${dest}/${relPath}`.replace(/\/+/g, '/');
      const remoteFileDir = remoteFileDest.substring(0, remoteFileDest.lastIndexOf('/'));
      
      await makeDir(remoteFileDir);

      log.debug(`[UploadFolder] put ${file.name} -> ${remoteFileDest}`);

      await new Promise<void>((resolve, reject) => {
        const readStream = fs.createReadStream(file.absPath);
        const writeStream = sftp.createWriteStream(remoteFileDest);
        let isSettled = false;

        const cleanup = () => {
          isSettled = true;
          readStream.destroy();
          writeStream.destroy();
        };

        readStream.on('data', (chunk: any) => {
          if (this.isCancelRequested) {
            cleanup();
            return reject(new Error('Transfer cancelled by user'));
          }
          doneBytes += chunk.length;
          if (progress) {
            progress.update(doneBytes, totalBytes, file.name);
          }
        });

        writeStream.on('close', () => {
          if (!isSettled) {
            fileCount++;
            resolve();
          }
        });

        writeStream.on('error', (err: any) => {
          cleanup();
          reject(err);
        });

        readStream.on('error', (err: any) => {
          cleanup();
          reject(err);
        });

        readStream.pipe(writeStream);
      });
    }

    if (progress) progress.update(totalBytes, totalBytes, 'Folder upload complete');
    log.info(`[UploadFolder SFTP] v  ${folderName} (${fileCount} file(s), ${totalBytes} bytes)`);
  }

  async downloadFolder(remoteFolderPath: string, localDir: string, progress?: Progress): Promise<void> {
    this.isCancelRequested = false;
    const folderName = remoteFolderPath.substring(remoteFolderPath.lastIndexOf('/') + 1);
    const localDest = path.join(localDir, folderName);

    log.info(`[DownloadFolder SFTP]  target: ${remoteFolderPath}  ->  local: ${localDest}`);
    
    if (progress) progress.update(0, -1, 'Starting folder download...');

    // Run remote sizing concurrently
    let totalBytes = -1;
    this.executor.countRemoteBytes(remoteFolderPath).then(bytes => {
      totalBytes = bytes;
      log.info(`[DownloadFolder SFTP] Sizing completed concurrently: ${bytes} bytes`);
    }).catch(err => {
      log.warn(`Sizing concurrently failed: ${err.message}`);
    });

    let doneBytes = 0;
    let fileCount = 0;
    const sftp = await this.getSftpWrapper();

    fs.mkdirSync(localDest, { recursive: true });

    const downloadRecursive = async (remoteDir: string, localPath: string): Promise<void> => {
      if (this.isCancelRequested) {
        throw new Error('Transfer cancelled by user');
      }

      const entries = await new Promise<any[]>((resolve, reject) => {
        sftp.readdir(remoteDir, (err: any, list: any) => {
          if (err) reject(err);
          else resolve(list);
        });
      });

      for (const entry of entries) {
        if (this.isCancelRequested) {
          throw new Error('Transfer cancelled by user');
        }

        const name = entry.filename;
        if (name === '.' || name === '..') continue;

        const childRemote = `${remoteDir}/${name}`.replace(/\/+/g, '/');
        const childLocal = path.join(localPath, name);
        const mode = entry.attrs.mode || 0;
        const isDir = (mode & 0x4000) !== 0;

        if (isDir) {
          fs.mkdirSync(childLocal, { recursive: true });
          await downloadRecursive(childRemote, childLocal);
        } else {
          log.debug(`[DownloadFolder] get ${childRemote} -> ${childLocal}`);
          
          await new Promise<void>((resolve, reject) => {
            const readStream = sftp.createReadStream(childRemote);
            const writeStream = fs.createWriteStream(childLocal);
            let isSettled = false;

            const cleanup = () => {
              isSettled = true;
              readStream.destroy();
              writeStream.destroy();
            };

            readStream.on('data', (chunk: any) => {
              if (this.isCancelRequested) {
                cleanup();
                return reject(new Error('Transfer cancelled by user'));
              }
              doneBytes += chunk.length;
              if (progress) {
                progress.update(doneBytes, totalBytes > 0 ? totalBytes : doneBytes, name);
              }
            });

            writeStream.on('close', () => {
              if (!isSettled) {
                fileCount++;
                resolve();
              }
            });

            writeStream.on('error', (err: any) => {
              cleanup();
              reject(err);
            });

            readStream.on('error', (err: any) => {
              cleanup();
              reject(err);
            });

            readStream.pipe(writeStream);
          });
        }
      }
    };

    await downloadRecursive(remoteFolderPath, localDest);
    
    if (progress) progress.update(doneBytes, doneBytes, 'Folder download complete');
    log.info(`[DownloadFolder SFTP] v  ${folderName} (${fileCount} file(s), ${doneBytes} bytes)`);
  }

  close() {
    if (this.sftpWrapper) {
      try {
        this.sftpWrapper.end();
      } catch (ex: any) {
        log.warn(`SFTP channel close error: ${ex.message}`);
      }
      this.sftpWrapper = undefined;
    }
  }

  private walkLocalFolder(dir: string): Array<{ name: string; absPath: string; size: number }> {
    const results: Array<{ name: string; absPath: string; size: number }> = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const absPath = path.join(dir, file);
      const stat = fs.statSync(absPath);
      if (stat.isDirectory()) {
        results.push(...this.walkLocalFolder(absPath));
      } else {
        results.push({
          name: file,
          absPath,
          size: stat.size,
        });
      }
    }
    return results;
  }
}
export default SftpTransfer;
