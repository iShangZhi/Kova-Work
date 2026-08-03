import { app } from 'electron'
import { readFile } from 'node:fs/promises'
import type {
  AgentEvent,
  AgentSession,
  Artifact,
  ClaudeWorkflowProfile,
  CreateWorkspaceInput,
  McpServerDefinition,
  ModelProfile,
  SaveClaudeWorkflowProfileInput,
  SaveMcpServerInput,
  SaveModelProfileInput,
  SessionWithEvents,
  SkillDefinition,
  Task,
  TaskEvent,
  TaskRun,
  TaskWithDetails,
  UpdateMcpServerInput,
  UpdateWorkspaceInput,
  Workspace
} from '../shared/contracts'
import { JsonStore } from './infrastructure/persistence/JsonStore'
import { TaskRepository } from './domains/task/TaskRepository'
import { WorkspaceRepository } from './domains/workspace/WorkspaceRepository'
import { ModelRepository } from './domains/model/ModelRepository'
import { SessionRepository } from './domains/session/SessionRepository'
import { PluginRepository } from './domains/plugin/PluginRepository'
import { SkillRepository } from './domains/skill/SkillRepository'
import { WorkflowRepository } from './domains/workflow/WorkflowRepository'
import { ArtifactRepository } from './domains/artifact/ArtifactRepository'

interface PersistedState {
  sessions: AgentSession[]
  events: AgentEvent[]
  mcpServers: McpServerDefinition[]
  skills: SkillDefinition[]
  modelProfiles: ModelProfile[]
  workflowProfiles: ClaudeWorkflowProfile[]
  workspaces: Workspace[]
  tasks: Task[]
  taskRuns: TaskRun[]
  taskEvents: TaskEvent[]
  artifacts: Artifact[]
  pluginEnabled: Record<string, boolean>
  legacyImported: boolean
}

const emptyState = (): PersistedState => ({
  sessions: [],
  events: [],
  mcpServers: [],
  skills: [],
  modelProfiles: [],
  workflowProfiles: [],
  workspaces: [],
  tasks: [],
  taskRuns: [],
  taskEvents: [],
  artifacts: [],
  pluginEnabled: {},
  legacyImported: false
})

/**
 * 统一存储门面 - 兼容原有 API
 * 内部使用领域 Repository 实现
 */
export class SessionStore {
  private store: JsonStore<PersistedState>

  // 领域仓储
  private taskRepo: TaskRepository
  private workspaceRepo: WorkspaceRepository
  private modelRepo: ModelRepository
  private sessionRepo: SessionRepository
  private pluginRepo: PluginRepository
  private skillRepo: SkillRepository
  private workflowRepo: WorkflowRepository
  private artifactRepo: ArtifactRepository

  constructor() {
    this.store = new JsonStore('kova-state.json', emptyState)

    // 初始化所有仓储
    this.taskRepo = new TaskRepository(this.store as any)
    this.workspaceRepo = new WorkspaceRepository(this.store as any)
    this.modelRepo = new ModelRepository(this.store as any)
    this.sessionRepo = new SessionRepository(this.store as any)
    this.pluginRepo = new PluginRepository(this.store as any)
    this.skillRepo = new SkillRepository(this.store as any)
    this.workflowRepo = new WorkflowRepository(this.store as any)
    this.artifactRepo = new ArtifactRepository(this.store as any)
  }

  async load(): Promise<void> {
    await this.store.load()
    await this.performMigrations()
  }

  private async performMigrations(): Promise<void> {
    const state = this.store.getState()
    let changed = false

    // 迁移 legacyImported
    if (!state.legacyImported) {
      try {
        const legacyPath = require('node:path').join(app.getPath('appData'), 'wise-agent', 'wise-agent-state.json')
        const legacy = JSON.parse(await readFile(legacyPath, 'utf8')) as PersistedState

        const sessionIds = new Set(state.sessions.map((s) => s.id))
        const eventIds = new Set(state.events.map((e) => e.id))

        state.sessions.push(...legacy.sessions.filter((s) => !sessionIds.has(s.id)))
        state.events.push(...legacy.events.filter((e) => !eventIds.has(e.id)))
        changed = true
      } catch {
        // Legacy import is optional
      }
      state.legacyImported = true
      changed = true
    }

    // 数据迁移：确保默认值
    for (const profile of state.modelProfiles) {
      if (!profile.provider) {
        profile.provider = 'openai-compatible'
        changed = true
      }
    }

    for (const workspace of state.workspaces) {
      if (!workspace.sourceFolders) {
        workspace.sourceFolders = [workspace.path]
        changed = true
      }
    }

    if (changed) {
      this.store.setState(() => {}) // Trigger flush
    }
  }

  // ==================== Session APIs ====================
  async listSessions(): Promise<AgentSession[]> {
    return this.sessionRepo.list()
  }

  async getSession(sessionId: string): Promise<SessionWithEvents | null> {
    return this.sessionRepo.findById(sessionId)
  }

  async saveSession(session: AgentSession): Promise<void> {
    return this.sessionRepo.save(session)
  }

  async appendEvent(event: AgentEvent): Promise<void> {
    return this.sessionRepo.appendEvent(event)
  }

  async deleteSession(sessionId: string): Promise<void> {
    return this.sessionRepo.delete(sessionId)
  }

  // ==================== Plugin APIs ====================
  async listMcpServers(): Promise<McpServerDefinition[]> {
    return this.pluginRepo.listMcpServers()
  }

  async isPluginEnabled(pluginId: string): Promise<boolean> {
    return this.pluginRepo.isPluginEnabled(pluginId)
  }

  async setPluginEnabled(pluginId: string, enabled: boolean): Promise<void> {
    return this.pluginRepo.setPluginEnabled(pluginId, enabled)
  }

  async saveMcpServer(input: SaveMcpServerInput): Promise<McpServerDefinition> {
    return this.pluginRepo.saveMcpServer(input)
  }

  async updateMcpServer(input: UpdateMcpServerInput): Promise<McpServerDefinition> {
    return this.pluginRepo.updateMcpServer(input)
  }

  async deleteMcpServer(id: string): Promise<void> {
    return this.pluginRepo.deleteMcpServer(id)
  }

  // ==================== Skill APIs ====================
  async listSkills(): Promise<SkillDefinition[]> {
    return this.skillRepo.list()
  }

  async listEnabledSkillInstructions(maxCharacters = 16_000): Promise<Array<{ name: string; content: string }>> {
    return this.skillRepo.listEnabledInstructions(maxCharacters)
  }

  async importSkill(sourcePath: string): Promise<SkillDefinition> {
    return this.skillRepo.import(sourcePath)
  }

  async setSkillEnabled(id: string, enabled: boolean): Promise<SkillDefinition> {
    return this.skillRepo.setEnabled(id, enabled)
  }

  async deleteSkill(id: string): Promise<void> {
    return this.skillRepo.delete(id)
  }

  // ==================== Model APIs ====================
  async listModelProfiles(): Promise<ModelProfile[]> {
    return this.modelRepo.list()
  }

  async saveModelProfile(input: SaveModelProfileInput): Promise<ModelProfile> {
    return this.modelRepo.save(input)
  }

  async deleteModelProfile(id: string): Promise<void> {
    return this.modelRepo.delete(id)
  }

  // ==================== Workflow APIs ====================
  async listWorkflowProfiles(): Promise<ClaudeWorkflowProfile[]> {
    return this.workflowRepo.list()
  }

  async saveWorkflowProfile(input: SaveClaudeWorkflowProfileInput): Promise<ClaudeWorkflowProfile> {
    return this.workflowRepo.save(input)
  }

  async deleteWorkflowProfile(id: string): Promise<void> {
    return this.workflowRepo.delete(id)
  }

  // ==================== Task APIs ====================
  async reconcileInterruptedTasks(): Promise<void> {
    const interrupted = await this.taskRepo.findInterruptedTasks()
    for (const task of interrupted) {
      await this.taskRepo.update(task.id, { status: 'cancelled' })
    }
  }

  async listTasks(): Promise<Task[]> {
    return this.taskRepo.list()
  }

  async getTask(taskId: string): Promise<TaskWithDetails | null> {
    return this.taskRepo.findById(taskId)
  }

  async saveTask(task: Task): Promise<void> {
    return this.taskRepo.save(task)
  }

  async updateTask(input: { taskId: string; updates: Partial<Task> }): Promise<void> {
    return this.taskRepo.update(input.taskId, input.updates)
  }

  async deleteTask(taskId: string): Promise<void> {
    return this.taskRepo.delete(taskId)
  }

  async saveTaskRun(run: TaskRun): Promise<void> {
    return this.taskRepo.saveRun(run)
  }

  async appendTaskEvent(event: TaskEvent): Promise<void> {
    return this.taskRepo.appendEvent(event)
  }

  // ==================== Workspace APIs ====================
  async listWorkspaces(): Promise<Workspace[]> {
    return this.workspaceRepo.list()
  }

  async createWorkspace(input: CreateWorkspaceInput): Promise<Workspace> {
    return this.workspaceRepo.create(input)
  }

  async updateWorkspace(input: UpdateWorkspaceInput): Promise<Workspace> {
    return this.workspaceRepo.update(input)
  }

  async ensureWorkspace(path: string): Promise<Workspace> {
    return this.workspaceRepo.ensureWorkspace(path)
  }

  // ==================== Artifact APIs ====================
  async saveArtifact(artifact: Artifact): Promise<void> {
    return this.artifactRepo.save(artifact)
  }
}
