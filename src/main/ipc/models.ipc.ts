import { ipcMain } from 'electron'
import type { ModelChatInput, SaveModelProfileInput } from '../../shared/types'
import { completeWithModel } from '../model-client'
import type { IpcDeps } from './deps'

export function registerModelsIpc({ services }: IpcDeps): void {
  ipcMain.handle('models:list', () => services.modelService.listModelProfiles())
  ipcMain.handle('models:save', (_, input: SaveModelProfileInput) =>
    services.modelService.saveModelProfile(input)
  )
  ipcMain.handle('models:delete', (_, id: string) => services.modelService.deleteModelProfile(id))
  ipcMain.handle('models:chat', async (_, input: ModelChatInput) => {
    const profile = await services.modelService.getModelProfile(input.profileId)
    if (!profile) throw new Error('找不到模型配置')
    return completeWithModel(profile, input.messages)
  })
}
