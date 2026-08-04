import { dialog, ipcMain } from 'electron'
import type {
  CreateWorkspaceInput,
  UpdateWorkspaceInput
} from '../../shared/types'
import type { IpcDeps } from './deps'

export function registerWorkspacesIpc({ services, getWindow }: IpcDeps): void {
  ipcMain.handle('workspaces:list', () => services.workspaceService.listWorkspaces())
  ipcMain.handle('workspaces:create', (_, input: CreateWorkspaceInput) =>
    services.workspaceService.createWorkspace(input)
  )
  ipcMain.handle('workspaces:update', (_, input: UpdateWorkspaceInput) =>
    services.workspaceService.updateWorkspace(input.id, input)
  )
  ipcMain.handle('workspace:choose', async () => {
    const window = getWindow()
    if (!window) return null
    const result = await dialog.showOpenDialog(window, {
      title: '选择 Agent 工作目录',
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })
}
