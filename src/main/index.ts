import { app, BrowserWindow, nativeImage, shell } from 'electron'
import { join } from 'node:path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { PluginManager } from './plugins/plugin-manager'
import { SessionManager } from './session-manager'
import { CapabilityRegistry } from './core/capability-registry'
import { ModelOrchestrator } from './core/model-orchestrator'
import { TaskManager } from './core/task-manager'
import { logger } from './infrastructure/logging/Logger'
import { ServiceFactory } from './application/ServiceFactory'
import { registerIpcHandlers } from './ipc/register'

let mainWindow: BrowserWindow | null = null

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
    await logger.init()
    logger.info('Kova application starting', {
      version: app.getVersion(),
      platform: process.platform
    })

    electronApp.setAppUserModelId('com.wiseailab.kova')
    if (process.platform === 'darwin') {
      const dockIcon = nativeImage.createFromPath(join(process.cwd(), 'resources/kova-icon.png'))
      if (!dockIcon.isEmpty()) app.dock?.setIcon(dockIcon)
    }
    app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

    const services = await ServiceFactory.initialize()
    await services.taskService.reconcileInterruptedTasks()

    const pluginManager = new PluginManager(services.pluginService)
    const capabilities = new CapabilityRegistry(pluginManager)
    const orchestrator = new ModelOrchestrator(
      capabilities,
      services.modelService,
      services.taskRepository,
      services.skillService
    )
    const taskManager = new TaskManager(
      services.taskService,
      services.taskRepository,
      orchestrator,
      () => mainWindow
    )
    const sessionManager = new SessionManager(
      services.sessionService,
      pluginManager,
      services.modelService,
      () => mainWindow
    )

    registerIpcHandlers({
      services,
      plugins: pluginManager,
      capabilities,
      taskManager,
      sessionManager,
      getWindow: () => mainWindow
    })

    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
