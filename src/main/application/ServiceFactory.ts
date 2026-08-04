import { JsonStore } from '../infrastructure/persistence/JsonStore'
import { StateMigration } from '../infrastructure/persistence/StateMigration'

import { SkillRepository, emptySkillState, type SkillState } from '../domains/skill/SkillRepository'
import { SkillService } from '../domains/skill/SkillService'

import {
  PluginRepository,
  emptyPluginState,
  type PluginStateShape
} from '../domains/plugin/PluginRepository'
import { PluginService } from '../domains/plugin/PluginService'
import { McpRepository, emptyMcpState, type McpState } from '../domains/plugin/McpRepository'
import { McpService } from '../domains/plugin/McpService'

import {
  SessionRepository,
  emptySessionState,
  type SessionState
} from '../domains/session/SessionRepository'
import { SessionService } from '../domains/session/SessionService'

import {
  WorkflowRepository,
  emptyWorkflowState,
  type WorkflowState
} from '../domains/workflow/WorkflowRepository'
import { WorkflowService } from '../domains/workflow/WorkflowService'

import {
  ModelRepository,
  emptyModelState,
  type ModelStateShape
} from '../domains/model/ModelRepository'
import { ModelService } from '../domains/model/ModelService'

import {
  WorkspaceRepository,
  emptyWorkspaceState,
  type WorkspaceStateShape
} from '../domains/workspace/WorkspaceRepository'
import { WorkspaceService } from '../domains/workspace/WorkspaceService'

import {
  TaskRepository,
  emptyTasksState,
  type TasksState
} from '../domains/task/TaskRepository'
import { TaskService } from '../domains/task/TaskService'

import { ArtifactRepository } from '../domains/artifact/ArtifactRepository'

/**
 * ServiceFactory - 完整 DI 容器
 *
 * 生命周期：
 *   1. `initialize()` 创建 8 个 JsonStore 并并行 load
 *   2. `StateMigration.runIfNeeded()` 一次性把 kova-state.json 分发到新 store
 *   3. 装配 Repository → Service
 */
export class ServiceFactory {
  private static instance: ServiceFactory | null = null

  // Stores
  readonly skillStore: JsonStore<SkillState>
  readonly pluginStore: JsonStore<PluginStateShape>
  readonly mcpStore: JsonStore<McpState>
  readonly sessionStore: JsonStore<SessionState>
  readonly workflowStore: JsonStore<WorkflowState>
  readonly modelStore: JsonStore<ModelStateShape>
  readonly workspaceStore: JsonStore<WorkspaceStateShape>
  readonly tasksStore: JsonStore<TasksState>

  // Repositories
  readonly skillRepository: SkillRepository
  readonly pluginRepository: PluginRepository
  readonly mcpRepository: McpRepository
  readonly sessionRepository: SessionRepository
  readonly workflowRepository: WorkflowRepository
  readonly modelRepository: ModelRepository
  readonly workspaceRepository: WorkspaceRepository
  readonly taskRepository: TaskRepository
  readonly artifactRepository: ArtifactRepository

  // Services
  readonly skillService: SkillService
  readonly pluginService: PluginService
  readonly mcpService: McpService
  readonly sessionService: SessionService
  readonly workflowService: WorkflowService
  readonly modelService: ModelService
  readonly workspaceService: WorkspaceService
  readonly taskService: TaskService

  private constructor() {
    this.skillStore = new JsonStore('kova/skills.json', emptySkillState)
    this.pluginStore = new JsonStore('kova/plugins.json', emptyPluginState)
    this.mcpStore = new JsonStore('kova/mcp.json', emptyMcpState)
    this.sessionStore = new JsonStore('kova/sessions.json', emptySessionState)
    this.workflowStore = new JsonStore('kova/workflows.json', emptyWorkflowState)
    this.modelStore = new JsonStore('kova/models.json', emptyModelState)
    this.workspaceStore = new JsonStore('kova/workspaces.json', emptyWorkspaceState)
    this.tasksStore = new JsonStore('kova/tasks.json', emptyTasksState)

    this.skillRepository = new SkillRepository(this.skillStore)
    this.pluginRepository = new PluginRepository(this.pluginStore)
    this.mcpRepository = new McpRepository(this.mcpStore)
    this.sessionRepository = new SessionRepository(this.sessionStore)
    this.workflowRepository = new WorkflowRepository(this.workflowStore)
    this.modelRepository = new ModelRepository(this.modelStore)
    this.workspaceRepository = new WorkspaceRepository(this.workspaceStore)
    this.artifactRepository = new ArtifactRepository(this.tasksStore)
    this.taskRepository = new TaskRepository(this.tasksStore, this.workspaceRepository)

    this.skillService = new SkillService(this.skillRepository)
    this.pluginService = new PluginService(this.pluginRepository)
    this.mcpService = new McpService(this.mcpRepository)
    this.sessionService = new SessionService(this.sessionRepository)
    this.workflowService = new WorkflowService(this.workflowRepository)
    this.workspaceService = new WorkspaceService(this.workspaceRepository)
    this.modelService = new ModelService(this.modelRepository, this.workspaceRepository)
    this.taskService = new TaskService(
      this.taskRepository,
      this.workspaceService,
      this.modelService
    )
  }

  /**
   * 创建并初始化单例（若不存在）。幂等：多次调用返回同一实例。
   */
  static async initialize(): Promise<ServiceFactory> {
    if (ServiceFactory.instance) return ServiceFactory.instance
    const factory = new ServiceFactory()
    await Promise.all([
      factory.skillStore.load(),
      factory.pluginStore.load(),
      factory.mcpStore.load(),
      factory.sessionStore.load(),
      factory.workflowStore.load(),
      factory.modelStore.load(),
      factory.workspaceStore.load(),
      factory.tasksStore.load()
    ])
    await new StateMigration().runIfNeeded({
      skills: factory.skillStore,
      plugins: factory.pluginStore,
      mcp: factory.mcpStore,
      sessions: factory.sessionStore,
      workflows: factory.workflowStore,
      models: factory.modelStore,
      workspaces: factory.workspaceStore,
      tasks: factory.tasksStore
    })
    ServiceFactory.instance = factory
    return factory
  }

  static getInstance(): ServiceFactory {
    if (!ServiceFactory.instance) {
      throw new Error('ServiceFactory not initialized. Call initialize() first.')
    }
    return ServiceFactory.instance
  }
}
