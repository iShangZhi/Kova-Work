import { app, BrowserWindow, dialog, ipcMain, nativeImage, shell } from 'electron'
import { join } from 'node:path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { PluginManager } from './plugins/plugin-manager'
import { SessionManager } from './session-manager'
import { SessionStore } from './storage'
import { completeWithModel } from './model-client'
import { CapabilityRegistry } from './core/capability-registry'
import { ModelOrchestrator } from './core/model-orchestrator'
import { TaskManager } from './core/task-manager'
import type {
  CreateWorkspaceInput,
  ContinueTaskInput,
  ContinueSessionInput,
  RenameSessionInput,
  SaveMcpServerInput,
  SaveModelProfileInput,
  ModelChatInput,
  UpdateMcpServerInput,
  SaveClaudeWorkflowProfileInput,
  StartSessionInput,
  StartTaskInput,
  UpdateWorkspaceInput
} from '../shared/contracts'

let mainWindow: BrowserWindow | null = null
const store = new SessionStore()
const pluginManager = new PluginManager(store)
const sessionManager = new SessionManager(store, pluginManager, () => mainWindow)
const capabilityRegistry = new CapabilityRegistry(pluginManager)
const modelOrchestrator = new ModelOrchestrator(store, capabilityRegistry)
const taskManager = new TaskManager(store, modelOrchestrator, () => mainWindow)

function createWindow(): void {
  const iconPath = join(process.cwd(), 'resources/kova-icon.png')
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 780,
    minWidth: 880,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#101113',
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.setName('Kova')

const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })

  void app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.wiseailab.kova')
  if (process.platform === 'darwin') {
    const dockIcon = nativeImage.createFromPath(join(process.cwd(), 'resources/kova-icon.png'))
    if (!dockIcon.isEmpty()) app.dock?.setIcon(dockIcon)
  }
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))
  await store.load()
  await store.reconcileInterruptedTasks()

  ipcMain.handle('agents:list', () => pluginManager.listAgents())
  ipcMain.handle('plugins:list', () => pluginManager.scan())
  ipcMain.handle('plugins:rescan', () => pluginManager.scan(true))
  ipcMain.handle('plugins:set-enabled', (_, id: string, enabled: boolean) => pluginManager.setEnabled(id, enabled))
  ipcMain.handle('mcp:list', () => store.listMcpServers())
  ipcMain.handle('mcp:save', (_, input: SaveMcpServerInput) => store.saveMcpServer(input))
  ipcMain.handle('mcp:update', (_, input: UpdateMcpServerInput) => store.updateMcpServer(input))
  ipcMain.handle('mcp:delete', (_, id: string) => store.deleteMcpServer(id))
  ipcMain.handle('skills:list', () => store.listSkills())
  ipcMain.handle('skills:choose-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, { title: '选择包含 SKILL.md 的技能目录', properties: ['openDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })
  ipcMain.handle('skills:import', (_, sourcePath: string) => store.importSkill(sourcePath))
  ipcMain.handle('skills:set-enabled', (_, id: string, enabled: boolean) => store.setSkillEnabled(id, enabled))
  ipcMain.handle('skills:delete', (_, id: string) => store.deleteSkill(id))
  ipcMain.handle('models:list', () => store.listModelProfiles())
  ipcMain.handle('models:save', (_, input: SaveModelProfileInput) => store.saveModelProfile(input))
  ipcMain.handle('models:delete', (_, id: string) => store.deleteModelProfile(id))
  ipcMain.handle('models:chat', async (_, input: ModelChatInput) => {
    const profile = (await store.listModelProfiles()).find((item) => item.id === input.profileId)
    if (!profile) throw new Error('找不到模型配置')
    return completeWithModel(profile, input.messages)
  })
  ipcMain.handle('capabilities:list', () => capabilityRegistry.list())
  ipcMain.handle('workspaces:list', () => store.listWorkspaces())
  ipcMain.handle('workspaces:create', (_, input: CreateWorkspaceInput) => store.createWorkspace(input))
  ipcMain.handle('workspaces:update', (_, input: UpdateWorkspaceInput) => store.updateWorkspace(input))
  ipcMain.handle('tasks:list', () => store.listTasks())
  ipcMain.handle('tasks:get', (_, taskId: string) => store.getTask(taskId))
  ipcMain.handle('tasks:start', (_, input: StartTaskInput) => taskManager.start(input))
  ipcMain.handle('tasks:continue', (_, input: ContinueTaskInput) => taskManager.continue(input))
  ipcMain.handle('tasks:retry', (_, taskId: string) => taskManager.retry(taskId))
  ipcMain.handle('tasks:cancel', (_, taskId: string) => taskManager.cancel(taskId))
  ipcMain.handle('tasks:delete', (_, taskId: string) => taskManager.delete(taskId))
  ipcMain.handle('path:reveal', (_, path: string) => shell.showItemInFolder(path))
  ipcMain.handle('workflows:list', () => store.listWorkflowProfiles())
  ipcMain.handle('workflows:save', (_, input: SaveClaudeWorkflowProfileInput) => store.saveWorkflowProfile(input))
  ipcMain.handle('workflows:delete', (_, id: string) => store.deleteWorkflowProfile(id))
  ipcMain.handle('sessions:list', () => store.listSessions())
  ipcMain.handle('sessions:get', (_, sessionId: string) => store.getSession(sessionId))
  ipcMain.handle('workspace:choose', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: '选择 Agent 工作目录',
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })
  ipcMain.handle('sessions:start', (_, input: StartSessionInput) => sessionManager.start(input))
  ipcMain.handle('sessions:continue', (_, input: ContinueSessionInput) => sessionManager.continue(input))
  ipcMain.handle('sessions:cancel', (_, sessionId: string) => sessionManager.cancel(sessionId))
  ipcMain.handle('sessions:rename', (_, input: RenameSessionInput) => sessionManager.rename(input))
  ipcMain.handle('sessions:delete', (_, sessionId: string) => sessionManager.delete(sessionId))

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
