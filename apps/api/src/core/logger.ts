export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  request_id?: string;
  error?: any;
}

export const logger = {
  log(level: LogLevel, message: string, context?: Record<string, any>, error?: any): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error: error ? (error instanceof Error ? { message: error.message, stack: error.stack } : error) : undefined,
    };

    const formatted = `[${entry.timestamp}] [${level.toUpperCase()}]: ${message} ${
      context ? JSON.stringify(context) : ''
    } ${entry.error ? JSON.stringify(entry.error) : ''}`;

    if (level === 'error') {
      console.error(formatted);
    } else if (level === 'warn') {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  },

  debug(message: string, context?: Record<string, any>): void {
    this.log('debug', message, context);
  },

  info(message: string, context?: Record<string, any>): void {
    this.log('info', message, context);
  },

  warn(message: string, context?: Record<string, any>): void {
    this.log('warn', message, context);
  },

  error(message: string, error?: any, context?: Record<string, any>): void {
    this.log('error', message, context, error);
  },
};
