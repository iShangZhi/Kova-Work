import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { logger } from './Logger'

type IpcHandler = (event: IpcMainInvokeEvent, ...args: any[]) => Promise<any> | any

/**
 * Wraps an IPC handler with logging
 */
export function loggedIpcHandle(channel: string, handler: IpcHandler): void {
  ipcMain.handle(channel, async (event, ...args) => {
    const startTime = Date.now()

    try {
      logger.debug(`IPC call: ${channel}`, { args })
      const result = await handler(event, ...args)
      const duration = Date.now() - startTime

      logger.debug(`IPC success: ${channel}`, { duration })
      return result
    } catch (error) {
      const duration = Date.now() - startTime
      logger.error(`IPC error: ${channel}`, error as Error, { args, duration })
      throw error
    }
  })
}

/**
 * Performance monitoring for slow IPC calls
 */
export function monitorPerformance(channel: string, duration: number): void {
  if (duration > 1000) {
    logger.warn(`Slow IPC call: ${channel}`, { duration })
  }
}
