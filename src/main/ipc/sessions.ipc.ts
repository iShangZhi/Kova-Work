import { ipcMain } from 'electron'
import type {
  ContinueSessionInput,
  RenameSessionInput,
  StartSessionInput
} from '../../shared/types'
import type { IpcDeps } from './deps'

export function registerSessionsIpc({ services, sessionManager }: IpcDeps): void {
  ipcMain.handle('sessions:list', () => services.sessionService.list())
  ipcMain.handle('sessions:get', (_, sessionId: string) =>
    services.sessionService.getById(sessionId)
  )
  ipcMain.handle('sessions:start', (_, input: StartSessionInput) => sessionManager.start(input))
  ipcMain.handle('sessions:continue', (_, input: ContinueSessionInput) =>
    sessionManager.continue(input)
  )
  ipcMain.handle('sessions:cancel', (_, sessionId: string) => sessionManager.cancel(sessionId))
  ipcMain.handle('sessions:rename', (_, input: RenameSessionInput) => sessionManager.rename(input))
  ipcMain.handle('sessions:delete', (_, sessionId: string) => sessionManager.delete(sessionId))
}
