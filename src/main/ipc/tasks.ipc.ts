import { ipcMain } from 'electron'
import type {
  ContinueTaskInput,
  StartTaskInput,
  UpdateTaskInput
} from '../../shared/types'
import type { IpcDeps } from './deps'

export function registerTasksIpc({ services, taskManager }: IpcDeps): void {
  ipcMain.handle('tasks:list', () => services.taskService.listTasks())
  ipcMain.handle('tasks:get', (_, taskId: string) => services.taskService.getTask(taskId))
  ipcMain.handle('tasks:start', (_, input: StartTaskInput) => taskManager.start(input))
  ipcMain.handle('tasks:update', (_, input: UpdateTaskInput) =>
    services.taskService.updateTask(input)
  )
  ipcMain.handle('tasks:continue', (_, input: ContinueTaskInput) => taskManager.continue(input))
  ipcMain.handle('tasks:retry', (_, taskId: string) => taskManager.retry(taskId))
  ipcMain.handle('tasks:cancel', (_, taskId: string) => taskManager.cancel(taskId))
  ipcMain.handle('tasks:delete', (_, taskId: string) => taskManager.delete(taskId))
}
