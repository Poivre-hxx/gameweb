/**
 * 日志工具类
 * 用于记录生成过程的详细日志，支持不同级别和导出功能
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
}

class Logger {
  private logs: LogEntry[] = [];
  private enabled: boolean;
  private logLevel: LogLevel;

  constructor() {
    this.enabled = import.meta.env.VITE_ENABLE_BACKEND_EXPORT === 'true';
    this.logLevel = this.parseLogLevel(
      import.meta.env.VITE_EXPORT_LOG_LEVEL || 'info'
    );
  }

  private parseLogLevel(level: string): LogLevel {
    const levelMap: Record<string, LogLevel> = {
      debug: LogLevel.DEBUG,
      info: LogLevel.INFO,
      warn: LogLevel.WARN,
      error: LogLevel.ERROR,
    };
    return levelMap[level.toLowerCase()] || LogLevel.INFO;
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.enabled) return false;

    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);

    return messageLevelIndex >= currentLevelIndex;
  }

  private log(level: LogLevel, category: string, message: string, data?: any) {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      category,
      message,
      data,
    };

    this.logs.push(entry);

    // 同时输出到控制台
    const consoleMethod = level === LogLevel.ERROR ? 'error' : level === LogLevel.WARN ? 'warn' : 'log';
    console[consoleMethod](`[${category}] ${message}`, data || '');
  }

  debug(category: string, message: string, data?: any) {
    this.log(LogLevel.DEBUG, category, message, data);
  }

  info(category: string, message: string, data?: any) {
    this.log(LogLevel.INFO, category, message, data);
  }

  warn(category: string, message: string, data?: any) {
    this.log(LogLevel.WARN, category, message, data);
  }

  error(category: string, message: string, data?: any) {
    this.log(LogLevel.ERROR, category, message, data);
  }

  /**
   * 获取指定分类的日志
   */
  getLogsByCategory(category: string): LogEntry[] {
    return this.logs.filter((log) => log.category === category);
  }

  /**
   * 获取所有日志
   */
  getAllLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * 清空日志
   */
  clearLogs() {
    this.logs = [];
  }

  /**
   * 格式化日志为文本
   */
  formatLogsAsText(logs: LogEntry[]): string {
    return logs
      .map((log) => {
        const date = new Date(log.timestamp).toISOString();
        const dataStr = log.data ? `\n${JSON.stringify(log.data, null, 2)}` : '';
        return `[${date}] [${log.level.toUpperCase()}] [${log.category}] ${log.message}${dataStr}`;
      })
      .join('\n\n');
  }

  /**
   * 导出日志为JSON
   */
  exportLogsAsJSON(logs: LogEntry[]): string {
    return JSON.stringify(logs, null, 2);
  }
}

// 导出单例实例
export default new Logger();
