import log from 'electron-log';
import * as path from 'path';
import { app } from 'electron';

// Configure electron-log
log.transports.console.level = false; // Remove console logging totally!
log.transports.file.fileName = 'app.log';
log.transports.file.maxSize = 10 * 1024 * 1024; // 10MB rotation

// Dynamically target <userData>/logs/app.log or process.cwd()/logs/app.log
const base = app.isPackaged ? app.getPath('userData') : process.cwd();
log.transports.file.resolvePathFn = () => path.join(base, 'logs', 'app.log');

export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  static getLogger(context: string): Logger {
    return new Logger(context);
  }

  static close(): void {
    // electron-log handles flush/close automatically, but we can do a sync flush if needed
  }

  private format(message: string, ...args: unknown[]): string {
    let msg = message;
    for (const arg of args) {
      if (!msg.includes('{}')) break;
      msg = msg.replace('{}', String(arg));
    }
    return `[${this.context}] ${msg}`;
  }

  trace(message: string, ...args: unknown[]): void {
    log.silly(this.format(message, ...args));
  }

  debug(message: string, ...args: unknown[]): void {
    log.debug(this.format(message, ...args));
  }

  info(message: string, ...args: unknown[]): void {
    log.info(this.format(message, ...args));
  }

  warn(message: string, ...args: unknown[]): void {
    log.warn(this.format(message, ...args));
  }

  error(message: string, error?: unknown, ...args: unknown[]): void {
    let msg = message;
    if (error && (error as Error).message) {
      msg += ` — ${(error as Error).message}`;
    } else if (error) {
      msg += ` — ${String(error)}`;
    }
    log.error(this.format(msg, ...args));
    if (error && typeof error === 'object' && 'stack' in error) {
      log.error(String((error as { stack: unknown }).stack));
    }
  }
}

export default Logger;
