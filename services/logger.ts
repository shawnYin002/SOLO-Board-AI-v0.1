
export type LogLevel = 'info' | 'error' | 'success';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  details?: any;
}

type Listener = (logs: LogEntry[]) => void;

class LoggerService {
  private logs: LogEntry[] = [];
  private listeners: Listener[] = [];

  log(level: LogLevel, message: string, details?: any) {
    const entry: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      level,
      message,
      details
    };
    this.logs.unshift(entry); // Newest first
    this.notify();
  }

  info(message: string, details?: any) { this.log('info', message, details); }
  error(message: string, details?: any) { this.log('error', message, details); }
  success(message: string, details?: any) { this.log('success', message, details); }

  subscribe(listener: Listener) {
    this.listeners.push(listener);
    listener(this.logs);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l(this.logs));
  }
  
  clear() {
      this.logs = [];
      this.notify();
  }
}

export const logger = new LoggerService();
