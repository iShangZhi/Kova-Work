import { ipcMain } from 'electron'
import type { SaveClaudeWorkflowProfileInput } from '../../shared/types'
import type { IpcDeps } from './deps'

export function registerWorkflowsIpc({ services }: IpcDeps): void {
  ipcMain.handle('workflows:list', () => services.workflowService.list())
  ipcMain.handle('workflows:save', (_, input: SaveClaudeWorkflowProfileInput) =>
    services.workflowService.save(input)
  )
  ipcMain.handle('workflows:delete', (_, id: string) => services.workflowService.delete(id))
}
