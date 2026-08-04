import { app } from 'electron'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

/**
 * 底层 JSON 持久化引擎
 *
 * 保证：
 * - 原子写入（.tmp + rename），断电/kill 不会读到半个 JSON
 * - 写入串行化（writeQueue）
 * - setState 返回 Promise，可 await 到落盘完成
 */
export class JsonStore<T extends object> {
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

  private get tempFilePath(): string {
    return `${this.filePath}.tmp`
  }

  async load(): Promise<void> {
    if (this.loaded) return
    if (!this.loadPromise) this.loadPromise = this.performLoad()
    await this.loadPromise
  }

  hasLoaded(): boolean {
    return this.loaded
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

  /**
   * 只读快照。给纯查询消费者用，语义化命名。
   */
  snapshot(): Readonly<T> {
    return this.getState()
  }

  /**
   * 变更 state 并串行落盘。返回值 await 后即代表已写入磁盘。
   */
  async setState(updater: (state: T) => void): Promise<void> {
    if (!this.loaded) throw new Error('Store not loaded.')
    updater(this.state)
    await this.flush()
  }

  private async flush(): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      const serialized = JSON.stringify(this.state, null, 2)
      await mkdir(dirname(this.filePath), { recursive: true })

      // 先把当前 primary（如果存在且合法）复制成 backup
      try {
        const current = await readFile(this.filePath, 'utf8')
        JSON.parse(current)
        await writeFile(this.backupFilePath, current, 'utf8')
      } catch {
        // primary 不存在或损坏，保留上一份 backup 即可
      }

      // 原子写：先写 .tmp 再 rename 覆盖 primary
      await writeFile(this.tempFilePath, serialized, 'utf8')
      await rename(this.tempFilePath, this.filePath)
    })
    await this.writeQueue
  }
}
