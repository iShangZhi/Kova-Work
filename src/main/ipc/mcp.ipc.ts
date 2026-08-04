import { ipcMain } from 'electron'
import type {
  SaveMcpServerInput,
  UpdateMcpServerInput
} from '../../shared/types'
import type { IpcDeps } from './deps'

export function registerMcpIpc({ services }: IpcDeps): void {
  ipcMain.handle('mcp:list', () => services.mcpService.list())
  ipcMain.handle('mcp:save', (_, input: SaveMcpServerInput) => services.mcpService.save(input))
  ipcMain.handle('mcp:update', (_, input: UpdateMcpServerInput) =>
    services.mcpService.update(input)
  )
  ipcMain.handle('mcp:delete', (_, id: string) => services.mcpService.delete(id))
}
