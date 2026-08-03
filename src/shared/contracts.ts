// IPC 契约定义 - Kova API 接口

import type {
  AgentDefinition,
  AgentEvent,
  AgentSession,
  SessionWithEvents,
  StartSessionInput,
  ContinueSessionInput,
  RenameSessionInput,
  PluginScanResult,
  SkillDefinition,
  ModelProfile,
  SaveModelProfileInput,
  ModelChatInput,
  RegisteredCapability,
  Workspace,
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  Task,
  TaskWithDetails,
  TaskEvent,
  StartTaskInput,
  UpdateTaskInput,
  ContinueTaskInput,
  ClaudeWorkflowProfile,
  SaveClaudeWorkflowProfileInput,
  McpServerDefinition,
  SaveMcpServerInput,
  UpdateMcpServerInput
} from './types'

export * from './types'

/**
 * Kova 主 API 接口
 * 定义了渲染进程可以调用的所有 IPC 方法
 */
export interface KovaApi {
  // Agent & Plugin
  listAgents(): Promise<AgentDefinition[]>
  listPlugins(): Promise<PluginScanResult>
  rescanPlugins(): Promise<PluginScanResult>
  setPluginEnabled(id: string, enabled: boolean): Promise<PluginScanResult>

  // MCP Servers
  listMcpServers(): Promise<McpServerDefinition[]>
  saveMcpServer(input: SaveMcpServerInput): Promise<McpServerDefinition>
  updateMcpServer(input: UpdateMcpServerInput): Promise<McpServerDefinition>
  deleteMcpServer(id: string): Promise<void>

  // Skills
  listSkills(): Promise<SkillDefinition[]>
  chooseSkillDirectory(): Promise<string | null>
  importSkill(sourcePath: string): Promise<SkillDefinition>
  setSkillEnabled(id: string, enabled: boolean): Promise<SkillDefinition>
  deleteSkill(id: string): Promise<void>

  // Models
  listModelProfiles(): Promise<ModelProfile[]>
  saveModelProfile(input: SaveModelProfileInput): Promise<ModelProfile>
  deleteModelProfile(id: string): Promise<void>
  chatWithModel(input: ModelChatInput): Promise<string>

  // Capabilities
  listCapabilities(): Promise<RegisteredCapability[]>

  // Workspaces
  listWorkspaces(): Promise<Workspace[]>
  createWorkspace(input: CreateWorkspaceInput): Promise<Workspace>
  updateWorkspace(input: UpdateWorkspaceInput): Promise<Workspace>

  // Tasks
  listTasks(): Promise<Task[]>
  getTask(taskId: string): Promise<TaskWithDetails | null>
  startTask(input: StartTaskInput): Promise<Task>
  updateTask(input: UpdateTaskInput): Promise<Task>
  continueTask(input: ContinueTaskInput): Promise<Task>
  retryTask(taskId: string): Promise<Task>
  cancelTask(taskId: string): Promise<void>
  deleteTask(taskId: string): Promise<void>
  onTaskEvent(callback: (event: TaskEvent) => void): () => void

  // Workflows
  listWorkflowProfiles(): Promise<ClaudeWorkflowProfile[]>
  saveWorkflowProfile(input: SaveClaudeWorkflowProfileInput): Promise<ClaudeWorkflowProfile>
  deleteWorkflowProfile(id: string): Promise<void>

  // Sessions (legacy)
  listSessions(): Promise<AgentSession[]>
  getSession(sessionId: string): Promise<SessionWithEvents | null>
  chooseWorkspace(): Promise<string | null>
  startSession(input: StartSessionInput): Promise<AgentSession>
  continueSession(input: ContinueSessionInput): Promise<void>
  cancelSession(sessionId: string): Promise<void>
  renameSession(input: RenameSessionInput): Promise<AgentSession>
  deleteSession(sessionId: string): Promise<void>
  onAgentEvent(callback: (event: AgentEvent) => void): () => void

  // Utilities
  revealPath(path: string): Promise<void>
}
