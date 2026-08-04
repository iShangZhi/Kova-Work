import type { IpcDeps } from './deps'
import { registerAgentsIpc } from './agents.ipc'
import { registerMcpIpc } from './mcp.ipc'
import { registerSkillsIpc } from './skills.ipc'
import { registerModelsIpc } from './models.ipc'
import { registerWorkspacesIpc } from './workspaces.ipc'
import { registerTasksIpc } from './tasks.ipc'
import { registerSessionsIpc } from './sessions.ipc'
import { registerWorkflowsIpc } from './workflows.ipc'
import { registerPathIpc } from './path.ipc'

/**
 * 主进程 IPC 装配入口。按领域拆到 *.ipc.ts。
 * index.ts 只负责调这一个函数。
 */
export function registerIpcHandlers(deps: IpcDeps): void {
  registerAgentsIpc(deps)
  registerMcpIpc(deps)
  registerSkillsIpc(deps)
  registerModelsIpc(deps)
  registerWorkspacesIpc(deps)
  registerTasksIpc(deps)
  registerSessionsIpc(deps)
  registerWorkflowsIpc(deps)
  registerPathIpc(deps)
}
