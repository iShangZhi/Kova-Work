import { app } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * 底层 JSON 持久化引擎
 * 职责：读写 JSON 文件、备份恢复、写队列管理
 */
export class JsonStore<T extends Record<string, any>> {
  private state: T
  private loaded = false
  private loadPromise?: Promise<void>
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(
    private readonly fileName: string,
    private readonly emptyState: () => T
  ) {
    this.state = emptyState()
  }

  private get filePath(): string {
    return join(app.getPath('userData'), this.fileName)
  }

  private get backupFilePath(): string {
    return `${this.filePath}.backup`
  }

  async load(): Promise<void> {
    if (this.loaded) return
    if (!this.loadPromise) this.loadPromise = this.performLoad()
    await this.loadPromise
  }

  private async performLoad(): Promise<void> {
    const primary = await this.readState(this.filePath)
    const backup = primary ? null : await this.readState(this.backupFilePath)
    this.state = primary ?? backup ?? this.emptyState()
    this.loaded = true
  }

  private async readState(path: string): Promise<T | null> {
    try {
      const content = await readFile(path, 'utf8')
      return JSON.parse(content) as T
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      console.error(`Failed to read state from ${path}:`, error)
      return null
    }
  }

  getState(): T {
    if (!this.loaded) throw new Error('Store not loaded. Call load() first.')
    return this.state
  }

  setState(updater: (state: T) => void): void {
    if (!this.loaded) throw new Error('Store not loaded.')
    updater(this.state)
    this.flush()
  }

  private flush(): void {
    this.writeQueue = this.writeQueue.then(async () => {
      const content = JSON.stringify(this.state, null, 2)
      await writeFile(this.backupFilePath, content, 'utf8')
      await writeFile(this.filePath, content, 'utf8')
    })
  }
}
