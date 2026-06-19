export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
}

export class Logger {
  private context: string;
  private static minLevel: LogLevel = LogLevel.DEBUG;

  constructor(context: string) {
    this.context = context;
  }

  static getLogger(context: string): Logger {
    return new Logger(context);
  }

  static setLogLevel(level: LogLevel) {
    Logger.minLevel = level;
  }

  private format(levelStr: string, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19) + '.' + 
      String(new Date().getMilliseconds()).padStart(3, '0');
    
    let formattedMsg = message;
    for (const arg of args) {
      if (formattedMsg.indexOf('{}') === -1) break;
      formattedMsg = formattedMsg.replace('{}', String(arg));
    }
    
    return `[${timestamp}] [${levelStr}] [${this.context}] ${formattedMsg}`;
  }

  trace(message: string, ...args: any[]) {
    if (Logger.minLevel <= LogLevel.TRACE) {
      console.log(this.format('TRACE', message, ...args));
    }
  }

  debug(message: string, ...args: any[]) {
    if (Logger.minLevel <= LogLevel.DEBUG) {
      console.log(this.format('DEBUG', message, ...args));
    }
  }

  info(message: string, ...args: any[]) {
    if (Logger.minLevel <= LogLevel.INFO) {
      console.log(this.format('INFO ', message, ...args));
    }
  }

  warn(message: string, ...args: any[]) {
    if (Logger.minLevel <= LogLevel.WARN) {
      console.warn(this.format('WARN ', message, ...args));
    }
  }

  error(message: string, error?: any, ...args: any[]) {
    if (Logger.minLevel <= LogLevel.ERROR) {
      let msg = message;
      if (error && error.message) {
        msg += ` - Error: ${error.message}`;
      } else if (error) {
        msg += ` - Error: ${String(error)}`;
      }
      console.error(this.format('ERROR', msg, ...args));
      if (error && error.stack) {
        console.error(error.stack);
      }
    }
  }
}
export default Logger;
