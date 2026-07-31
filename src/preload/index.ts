import { contextBridge, ipcRenderer } from 'electron'
import type {
  AgentEvent,
  CreateWorkspaceInput,
  ContinueTaskInput,
  ContinueSessionInput,
  RenameSessionInput,
  SaveMcpServerInput,
  SaveModelProfileInput,
  SaveClaudeWorkflowProfileInput,
  UpdateMcpServerInput,
  StartSessionInput,
  StartTaskInput,
  TaskEvent,
  UpdateTaskInput,
  UpdateWorkspaceInput,
  KovaApi
} from '../shared/contracts'

const api: KovaApi = {
  listAgents: () => ipcRenderer.invoke('agents:list'),
  listPlugins: () => ipcRenderer.invoke('plugins:list'),
  rescanPlugins: () => ipcRenderer.invoke('plugins:rescan'),
  setPluginEnabled: (id: string, enabled: boolean) => ipcRenderer.invoke('plugins:set-enabled', id, enabled),
  listMcpServers: () => ipcRenderer.invoke('mcp:list'),
  saveMcpServer: (input: SaveMcpServerInput) => ipcRenderer.invoke('mcp:save', input),
  updateMcpServer: (input: UpdateMcpServerInput) => ipcRenderer.invoke('mcp:update', input),
  deleteMcpServer: (id: string) => ipcRenderer.invoke('mcp:delete', id),
  listSkills: () => ipcRenderer.invoke('skills:list'),
  chooseSkillDirectory: () => ipcRenderer.invoke('skills:choose-directory'),
  importSkill: (sourcePath: string) => ipcRenderer.invoke('skills:import', sourcePath),
  setSkillEnabled: (id: string, enabled: boolean) => ipcRenderer.invoke('skills:set-enabled', id, enabled),
  deleteSkill: (id: string) => ipcRenderer.invoke('skills:delete', id),
  listModelProfiles: () => ipcRenderer.invoke('models:list'),
  saveModelProfile: (input: SaveModelProfileInput) => ipcRenderer.invoke('models:save', input),
  deleteModelProfile: (id: string) => ipcRenderer.invoke('models:delete', id),
  chatWithModel: (input) => ipcRenderer.invoke('models:chat', input),
  listCapabilities: () => ipcRenderer.invoke('capabilities:list'),
  listWorkspaces: () => ipcRenderer.invoke('workspaces:list'),
  createWorkspace: (input: CreateWorkspaceInput) => ipcRenderer.invoke('workspaces:create', input),
  updateWorkspace: (input: UpdateWorkspaceInput) => ipcRenderer.invoke('workspaces:update', input),
  listTasks: () => ipcRenderer.invoke('tasks:list'),
  getTask: (taskId: string) => ipcRenderer.invoke('tasks:get', taskId),
  startTask: (input: StartTaskInput) => ipcRenderer.invoke('tasks:start', input),
  updateTask: (input: UpdateTaskInput) => ipcRenderer.invoke('tasks:update', input),
  continueTask: (input: ContinueTaskInput) => ipcRenderer.invoke('tasks:continue', input),
  retryTask: (taskId: string) => ipcRenderer.invoke('tasks:retry', taskId),
  cancelTask: (taskId: string) => ipcRenderer.invoke('tasks:cancel', taskId),
  deleteTask: (taskId: string) => ipcRenderer.invoke('tasks:delete', taskId),
  onTaskEvent: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, taskEvent: TaskEvent): void => callback(taskEvent)
    ipcRenderer.on('task:event', listener)
    return () => ipcRenderer.removeListener('task:event', listener)
  },
  revealPath: (path: string) => ipcRenderer.invoke('path:reveal', path),
  listWorkflowProfiles: () => ipcRenderer.invoke('workflows:list'),
  saveWorkflowProfile: (input: SaveClaudeWorkflowProfileInput) => ipcRenderer.invoke('workflows:save', input),
  deleteWorkflowProfile: (id: string) => ipcRenderer.invoke('workflows:delete', id),
  listSessions: () => ipcRenderer.invoke('sessions:list'),
  getSession: (sessionId) => ipcRenderer.invoke('sessions:get', sessionId),
  chooseWorkspace: () => ipcRenderer.invoke('workspace:choose'),
  startSession: (input: StartSessionInput) => ipcRenderer.invoke('sessions:start', input),
  continueSession: (input: ContinueSessionInput) => ipcRenderer.invoke('sessions:continue', input),
  cancelSession: (sessionId) => ipcRenderer.invoke('sessions:cancel', sessionId),
  renameSession: (input: RenameSessionInput) => ipcRenderer.invoke('sessions:rename', input),
  deleteSession: (sessionId) => ipcRenderer.invoke('sessions:delete', sessionId),
  onAgentEvent: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, agentEvent: AgentEvent): void => callback(agentEvent)
    ipcRenderer.on('agent:event', listener)
    return () => ipcRenderer.removeListener('agent:event', listener)
  }
}

contextBridge.exposeInMainWorld('kova', api)
