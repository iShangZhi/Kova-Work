import { ipcMain, shell } from 'electron'
import type { IpcDeps } from './deps'

export function registerPathIpc(_deps: IpcDeps): void {
  ipcMain.handle('path:reveal', (_, path: string) => shell.showItemInFolder(path))
}
