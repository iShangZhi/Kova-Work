export type AgentId = 'claude' | 'model'

export type PermissionMode = 'plan' | 'dontAsk' | 'acceptEdits'
export type WorkflowStage = 'design' | 'development' | 'testing'

export type SessionStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'

export type PluginStatus = 'ready' | 'detected' | 'missing' | 'error'

export type PluginCapability =
  | 'agent.chat'
  | 'agent.plan'
  | 'coding.read'
  | 'coding.edit'
  | 'terminal.run'
  | 'session.resume'
  | 'tool.events'

export type AgentEventType =
  | 'user_message'
  | 'agent_message'
  | 'progress'
  | 'tool'
  | 'permission'
  | 'system'
  | 'error'
  | 'completed'

export interface AgentDefinition {
  id: AgentId
  name: string
  description: string
  command?: string
  available: boolean
  version?: string
  pluginId: string
  pluginStatus: PluginStatus
  executablePath?: string
  capabilities: {
    streaming: boolean
    resume: boolean
    permissionModes: PermissionMode[]
    registered: PluginCapability[]
  }
}

export interface PluginDefinition {
  id: string
  name: string
  description: string
  kind: 'cli-agent' | 'virtual-agent'
  status: PluginStatus
  statusMessage: string
  pluginVersion: string
  cliVersion?: string
  executablePath?: string
  protocol: string
  capabilities: PluginCapability[]
  permissions: {
    process: string[]
    filesystem: 'none' | 'selected-workspace'
    network: boolean
  }
  agentId: AgentId
  available: boolean
}

export interface PluginScanResult {
  plugins: PluginDefinition[]
  scannedAt: string
}

export interface AgentEvent {
  id: string
  sessionId: string
  type: AgentEventType
  text: string
  createdAt: string
  metadata?: Record<string, unknown>
}

export interface AgentSession {
  id: string
  title: string
  agentId: AgentId
  workspace: string
  permissionMode: PermissionMode
  workflowStage?: WorkflowStage
  claudeAgent?: string
  claudePromptPrefix?: string
  modelProfileId?: string
  status: SessionStatus
  nativeSessionId?: string
  createdAt: string
  updatedAt: string
}

export interface SessionWithEvents {
  session: AgentSession
  events: AgentEvent[]
}

export interface StartSessionInput {
  agentId: AgentId
  workspace: string
  prompt: string
  permissionMode: PermissionMode
  workflowStage?: WorkflowStage
  claudeAgent?: string
  claudePromptPrefix?: string
  modelProfileId?: string
}

export interface ContinueSessionInput {
  sessionId: string
  prompt: string
}

export interface RenameSessionInput {
  sessionId: string
  title: string
}

export type McpTransport = 'stdio' | 'http'

export type ExtensionLifecycleStatus = 'draft' | 'configured' | 'ready' | 'disabled' | 'error'

export interface PluginPackageDefinition {
  id: string
  name: string
  version: string
  sourcePath: string
  manifestPath: string
  status: ExtensionLifecycleStatus
  statusMessage: string
  createdAt: string
  updatedAt: string
}

export interface AppConnectionDefinition {
  id: string
  name: string
  connectorId: string
  baseUrl?: string
  authType: 'oauth' | 'token' | 'local'
  status: ExtensionLifecycleStatus
  statusMessage: string
  createdAt: string
  updatedAt: string
}

export interface SkillDefinition {
  id: string
  name: string
  description: string
  sourcePath: string
  manifestPath: string
  enabled: boolean
  status: ExtensionLifecycleStatus
  statusMessage: string
  createdAt: string
  updatedAt: string
}

export interface ModelProfile {
  id: string
  name: string
  baseUrl: string
  model: string
  apiKey?: string
  systemPrompt?: string
  temperature?: number
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface SaveModelProfileInput {
  name: string
  baseUrl: string
  model: string
  apiKey?: string
  systemPrompt?: string
  temperature?: number
}

export interface ModelChatInput {
  profileId: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
}

export type TaskStatus =
  | 'draft'
  | 'queued'
  | 'running'
  | 'waiting'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type RunStatus =
  | 'queued'
  | 'running'
  | 'waiting_permission'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type TaskEventType =
  | 'user_message'
  | 'model_message'
  | 'plan'
  | 'capability_call'
  | 'capability_result'
  | 'cli_output'
  | 'permission_request'
  | 'permission_result'
  | 'artifact'
  | 'system'
  | 'error'
  | 'completed'

export type ArtifactType =
  | 'file'
  | 'code_change'
  | 'document'
  | 'test_report'
  | 'command_output'
  | 'image'
  | 'other'

export type CapabilityRisk = 'read' | 'write' | 'execute' | 'network'

export interface Workspace {
  id: string
  name: string
  path: string
  defaultModelProfileId?: string
  enabledPluginIds: string[]
  createdAt: string
  updatedAt: string
}

export interface Task {
  id: string
  title: string
  objective: string
  workspaceId?: string
  modelProfileId: string
  allowedPluginIds: string[]
  permissionMode: PermissionMode
  status: TaskStatus
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export interface TaskRun {
  id: string
  taskId: string
  sequence: number
  trigger: 'user' | 'retry' | 'resume' | 'workflow'
  status: RunStatus
  startedAt?: string
  completedAt?: string
  error?: string
}

export interface TaskEvent {
  id: string
  taskId: string
  runId: string
  type: TaskEventType
  text: string
  createdAt: string
  metadata?: Record<string, unknown>
}

export interface Artifact {
  id: string
  taskId: string
  runId: string
  type: ArtifactType
  name: string
  path?: string
  mimeType?: string
  summary?: string
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface CapabilityDefinition {
  id: string
  name: string
  description: string
  inputSchema: Record<string, unknown>
  outputSchema?: Record<string, unknown>
  risk: CapabilityRisk
  supportsStreaming: boolean
}

export interface RegisteredCapability extends CapabilityDefinition {
  pluginId: string
  pluginName: string
  available: boolean
  statusMessage: string
}

export interface CapabilityCall {
  id: string
  taskId: string
  runId: string
  pluginId: string
  capabilityId: string
  arguments: Record<string, unknown>
}

export interface CapabilityResult {
  callId: string
  status: 'completed' | 'failed' | 'cancelled'
  output?: Record<string, unknown>
  artifactIds?: string[]
  error?: string
}

export interface StartTaskInput {
  objective: string
  workspace: string
  modelProfileId: string
  allowedPluginIds?: string[]
  permissionMode: PermissionMode
}

export interface TaskWithDetails {
  task: Task
  workspace?: Workspace
  runs: TaskRun[]
  events: TaskEvent[]
  artifacts: Artifact[]
}

export interface ClaudeWorkflowProfile {
  id: string
  stage: WorkflowStage
  name: string
  agentName: string
  promptPrefix: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface SaveClaudeWorkflowProfileInput {
  id?: string
  stage: WorkflowStage
  name: string
  agentName: string
  promptPrefix: string
}

export interface McpServerDefinition {
  id: string
  name: string
  transport: McpTransport
  command?: string
  args?: string[]
  url?: string
  status: 'configured'
  createdAt: string
  updatedAt: string
}

export interface SaveMcpServerInput {
  name: string
  transport: McpTransport
  command?: string
  args?: string[]
  url?: string
}

export interface UpdateMcpServerInput extends SaveMcpServerInput {
  id: string
}

export interface KovaApi {
  listAgents(): Promise<AgentDefinition[]>
  listPlugins(): Promise<PluginScanResult>
  rescanPlugins(): Promise<PluginScanResult>
  listMcpServers(): Promise<McpServerDefinition[]>
  saveMcpServer(input: SaveMcpServerInput): Promise<McpServerDefinition>
  updateMcpServer(input: UpdateMcpServerInput): Promise<McpServerDefinition>
  deleteMcpServer(id: string): Promise<void>
  listSkills(): Promise<SkillDefinition[]>
  chooseSkillDirectory(): Promise<string | null>
  importSkill(sourcePath: string): Promise<SkillDefinition>
  setSkillEnabled(id: string, enabled: boolean): Promise<SkillDefinition>
  deleteSkill(id: string): Promise<void>
  listModelProfiles(): Promise<ModelProfile[]>
  saveModelProfile(input: SaveModelProfileInput): Promise<ModelProfile>
  deleteModelProfile(id: string): Promise<void>
  chatWithModel(input: ModelChatInput): Promise<string>
  listCapabilities(): Promise<RegisteredCapability[]>
  listWorkspaces(): Promise<Workspace[]>
  listTasks(): Promise<Task[]>
  getTask(taskId: string): Promise<TaskWithDetails | null>
  startTask(input: StartTaskInput): Promise<Task>
  cancelTask(taskId: string): Promise<void>
  onTaskEvent(callback: (event: TaskEvent) => void): () => void
  revealPath(path: string): Promise<void>
  listWorkflowProfiles(): Promise<ClaudeWorkflowProfile[]>
  saveWorkflowProfile(input: SaveClaudeWorkflowProfileInput): Promise<ClaudeWorkflowProfile>
  deleteWorkflowProfile(id: string): Promise<void>
  listSessions(): Promise<AgentSession[]>
  getSession(sessionId: string): Promise<SessionWithEvents | null>
  chooseWorkspace(): Promise<string | null>
  startSession(input: StartSessionInput): Promise<AgentSession>
  continueSession(input: ContinueSessionInput): Promise<void>
  cancelSession(sessionId: string): Promise<void>
  renameSession(input: RenameSessionInput): Promise<AgentSession>
  deleteSession(sessionId: string): Promise<void>
  onAgentEvent(callback: (event: AgentEvent) => void): () => void
}
