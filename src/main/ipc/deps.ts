import type { BrowserWindow } from 'electron'
import type { ServiceFactory } from '../application/ServiceFactory'
import type { PluginManager } from '../plugins/plugin-manager'
import type { CapabilityRegistry } from '../core/capability-registry'
import type { TaskManager } from '../core/task-manager'
import type { SessionManager } from '../session-manager'

export interface IpcDeps {
  services: ServiceFactory
  plugins: PluginManager
  capabilities: CapabilityRegistry
  taskManager: TaskManager
  sessionManager: SessionManager
  getWindow: () => BrowserWindow | null
}
