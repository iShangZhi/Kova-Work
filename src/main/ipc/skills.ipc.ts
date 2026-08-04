import { dialog, ipcMain } from 'electron'
import type { IpcDeps } from './deps'

export function registerSkillsIpc({ services, getWindow }: IpcDeps): void {
  ipcMain.handle('skills:list', () => services.skillService.listSkills())
  ipcMain.handle('skills:choose-directory', async () => {
    const window = getWindow()
    if (!window) return null
    const result = await dialog.showOpenDialog(window, {
      title: '选择包含 SKILL.md 的技能目录',
      properties: ['openDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })
  ipcMain.handle('skills:import', (_, sourcePath: string) =>
    services.skillService.importSkill(sourcePath)
  )
  ipcMain.handle('skills:set-enabled', (_, id: string, enabled: boolean) =>
    services.skillService.setEnabled(id, enabled)
  )
  ipcMain.handle('skills:delete', (_, id: string) => services.skillService.deleteSkill(id))
}
