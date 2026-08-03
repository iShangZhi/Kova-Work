import { app } from 'electron'
import { join } from 'node:path'
import { writeFile, appendFile, mkdir, readdir, stat, unlink } from 'node:fs/promises'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  meta?: Record<string, any>
}

export class Logger {
  private logPath: string
  private maxFileSize = 10 * 1024 * 1024 // 10MB
  private maxFiles = 5

  constructor() {
    this.logPath = join(app.getPath('logs'), 'kova.log')
  }

  async init(): Promise<void> {
    const logsDir = app.getPath('logs')
    await mkdir(logsDir, { recursive: true })
    await this.rotateIfNeeded()
  }

  private async rotateIfNeeded(): Promise<void> {
    try {
      const stats = await stat(this.logPath)
      if (stats.size >= this.maxFileSize) {
        await this.rotate()
      }
    } catch {
      // File doesn't exist yet, no rotation needed
    }
  }

  private async rotate(): Promise<void> {
    const logsDir = app.getPath('logs')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const archivePath = join(logsDir, `kova-${timestamp}.log`)

    try {
      await writeFile(archivePath, await this.readLogFile())
      await writeFile(this.logPath, '')
      await this.cleanOldLogs()
    } catch (error) {
      console.error('Failed to rotate logs:', error)
    }
  }

  private async readLogFile(): Promise<string> {
    try {
      return await require('node:fs/promises').readFile(this.logPath, 'utf8')
    } catch {
      return ''
    }
  }

  private async cleanOldLogs(): Promise<void> {
    const logsDir = app.getPath('logs')
    const files = await readdir(logsDir)
    const logFiles = files
      .filter((f) => f.startsWith('kova-') && f.endsWith('.log'))
      .map((f) => join(logsDir, f))

    if (logFiles.length > this.maxFiles) {
      const stats = await Promise.all(logFiles.map(async (f) => ({ file: f, mtime: (await stat(f)).mtime })))
      const sorted = stats.sort((a, b) => a.mtime.getTime() - b.mtime.getTime())
      const toDelete = sorted.slice(0, sorted.length - this.maxFiles)

      for (const { file } of toDelete) {
        await unlink(file).catch(() => {})
      }
    }
  }

  private async write(level: LogLevel, message: string, meta?: Record<string, any>): Promise<void> {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      meta
    }

    const line = JSON.stringify(entry) + '\n'

    // Console output in development
    if (!app.isPackaged) {
      const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'
      console[consoleMethod](`[${level.toUpperCase()}] ${message}`, meta ?? '')
    }

    // Write to file
    try {
      await this.rotateIfNeeded()
      await appendFile(this.logPath, line, 'utf8')
    } catch (error) {
      console.error('Failed to write log:', error)
    }
  }

  debug(message: string, meta?: Record<string, any>): void {
    if (!app.isPackaged) {
      this.write('debug', message, meta).catch(() => {})
    }
  }

  info(message: string, meta?: Record<string, any>): void {
    this.write('info', message, meta).catch(() => {})
  }

  warn(message: string, meta?: Record<string, any>): void {
    this.write('warn', message, meta).catch(() => {})
  }

  error(message: string, error?: Error, meta?: Record<string, any>): void {
    const fullMeta = {
      ...meta,
      error: error?.message,
      stack: error?.stack
    }
    this.write('error', message, fullMeta).catch(() => {})
  }
}

// Singleton instance
export const logger = new Logger()
