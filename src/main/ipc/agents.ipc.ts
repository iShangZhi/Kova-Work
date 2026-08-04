import { ipcMain } from 'electron'
import type { IpcDeps } from './deps'

export function registerAgentsIpc({ plugins, capabilities }: IpcDeps): void {
  ipcMain.handle('agents:list', () => plugins.listAgents())
  ipcMain.handle('plugins:list', () => plugins.scan())
  ipcMain.handle('plugins:rescan', () => plugins.scan(true))
  ipcMain.handle('plugins:set-enabled', (_, id: string, enabled: boolean) =>
    plugins.setEnabled(id, enabled)
  )
  ipcMain.handle('capabilities:list', () => capabilities.list())
}
