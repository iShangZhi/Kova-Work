import { app } from 'electron'
import { readFile, rename } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  AgentEvent,
  AgentSession,
  Artifact,
  ClaudeWorkflowProfile,
  McpServerDefinition,
  ModelProfile,
  SkillDefinition,
  Task,
  TaskEvent,
  TaskRun,
  Workspace
} from '../../../shared/types'
import type { JsonStore } from './JsonStore'
import type { SkillState } from '../../domains/skill/SkillRepository'
import type { PluginStateShape } from '../../domains/plugin/PluginRepository'
import type { McpState } from '../../domains/plugin/McpRepository'
import type { SessionState } from '../../domains/session/SessionRepository'
import type { WorkflowState } from '../../domains/workflow/WorkflowRepository'
import type { ModelStateShape } from '../../domains/model/ModelRepository'
import type { WorkspaceStateShape } from '../../domains/workspace/WorkspaceRepository'
import type { TasksState } from '../../domains/task/TaskRepository'
import { CORE_TOOLS_PLUGIN_ID } from '../../tools/native-tool-registry'
import { logger } from '../logging/Logger'

/**
 * 旧统一状态文件（storage.ts 的 PersistedState 形态）
 */
interface LegacyPersistedState {
  sessions?: AgentSession[]
  events?: AgentEvent[]
  mcpServers?: McpServerDefinition[]
  skills?: SkillDefinition[]
  modelProfiles?: ModelProfile[]
  workflowProfiles?: ClaudeWorkflowProfile[]
  workspaces?: Workspace[]
  tasks?: Task[]
  taskRuns?: TaskRun[]
  taskEvents?: TaskEvent[]
  artifacts?: Artifact[]
  pluginEnabled?: Record<string, boolean>
  legacyImported?: boolean
}

export interface MigrationTargets {
  skills: JsonStore<SkillState>
  plugins: JsonStore<PluginStateShape>
  mcp: JsonStore<McpState>
  sessions: JsonStore<SessionState>
  workflows: JsonStore<WorkflowState>
  models: JsonStore<ModelStateShape>
  workspaces: JsonStore<WorkspaceStateShape>
  tasks: JsonStore<TasksState>
}

/**
 * 一次性迁移器：把 kova-state.json（+ 旧 wise-agent-state.json）分发到 8 个新 JsonStore。
 * 完成后把源文件重命名为 .migrated-<ts>，下次启动即跳过。
 */
export class StateMigration {
  private readonly primaryPath: string
  private readonly backupPath: string
  private readonly legacyPath: string

  constructor() {
    this.primaryPath = join(app.getPath('userData'), 'kova-state.json')
    this.backupPath = `${this.primaryPath}.backup`
    this.legacyPath = join(app.getPath('appData'), 'wise-agent', 'wise-agent-state.json')
  }

  async runIfNeeded(targets: MigrationTargets): Promise<void> {
    const primary = await this.readState(this.primaryPath)
    const backup = primary ? null : await this.readState(this.backupPath)
    const legacy = await this.readState(this.legacyPath)

    const merged = this.merge(primary ?? backup, legacy)
    if (!merged) {
      // 新用户；无需迁移
      return
    }

    logger.info('Legacy state detected — starting one-time migration', {
      hasPrimary: Boolean(primary ?? backup),
      hasLegacyAppData: Boolean(legacy)
    })

    await this.dispatch(merged, targets)
    await this.archiveSourceFiles()
    logger.info('Legacy state migration complete')
  }

  private merge(
    primary: LegacyPersistedState | null,
    legacy: LegacyPersistedState | null
  ): LegacyPersistedState | null {
    if (!primary && !legacy) return null
    if (!legacy) return primary!
    if (!primary) return legacy

    // 主文件优先；合并旧 wise-agent 中未包含的 session/event
    const sessionIds = new Set((primary.sessions ?? []).map((s) => s.id))
    const eventIds = new Set((primary.events ?? []).map((e) => e.id))

    const merged: LegacyPersistedState = { ...primary }
    merged.sessions = [
      ...(primary.sessions ?? []),
      ...(legacy.sessions ?? []).filter((s) => !sessionIds.has(s.id))
    ]
    merged.events = [
      ...(primary.events ?? []),
      ...(legacy.events ?? []).filter((e) => !eventIds.has(e.id))
    ]
    return merged
  }

  private async dispatch(
    state: LegacyPersistedState,
    targets: MigrationTargets
  ): Promise<void> {
    // 字段补全（对齐 storage.ts:83-119 的兜底行为）
    const modelProfiles = (state.modelProfiles ?? []).map((profile) => ({
      ...profile,
      provider: profile.provider ?? 'openai-compatible'
    }))
    const workspaces = (state.workspaces ?? []).map((workspace) => ({
      ...workspace,
      sourceFolders: workspace.sourceFolders ?? [workspace.path],
      enabledPluginIds: workspace.enabledPluginIds?.length
        ? [...new Set([CORE_TOOLS_PLUGIN_ID, ...workspace.enabledPluginIds])]
        : [CORE_TOOLS_PLUGIN_ID, 'com.kova.claude-code']
    }))

    // 修复引用了不存在模型的 workspace / task
    const enabledModels = modelProfiles.filter((p) => p.enabled)
    const fallback = enabledModels[0]
    if (fallback) {
      const enabledIds = new Set(enabledModels.map((p) => p.id))
      for (const workspace of workspaces) {
        if (!workspace.defaultModelProfileId || !enabledIds.has(workspace.defaultModelProfileId)) {
          workspace.defaultModelProfileId = fallback.id
        }
      }
      for (const task of state.tasks ?? []) {
        if (!enabledIds.has(task.modelProfileId)) {
          task.modelProfileId = fallback.id
        }
      }
    }

    await targets.skills.setState((s) => {
      s.skills = state.skills ?? []
    })
    await targets.plugins.setState((s) => {
      s.pluginEnabled = state.pluginEnabled ?? {}
    })
    await targets.mcp.setState((s) => {
      s.mcpServers = state.mcpServers ?? []
    })
    await targets.sessions.setState((s) => {
      s.sessions = state.sessions ?? []
      s.events = state.events ?? []
    })
    await targets.workflows.setState((s) => {
      s.workflowProfiles = state.workflowProfiles ?? []
    })
    await targets.models.setState((s) => {
      s.modelProfiles = modelProfiles
    })
    await targets.workspaces.setState((s) => {
      s.workspaces = workspaces
    })
    await targets.tasks.setState((s) => {
      s.tasks = state.tasks ?? []
      s.taskRuns = state.taskRuns ?? []
      s.taskEvents = state.taskEvents ?? []
      s.artifacts = state.artifacts ?? []
    })
  }

  private async archiveSourceFiles(): Promise<void> {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    await this.tryRename(this.primaryPath, `${this.primaryPath}.migrated-${stamp}`)
    await this.tryRename(this.backupPath, `${this.backupPath}.migrated-${stamp}`)
    // 旧 wise-agent-state.json 保持不动 —— 那是历史 rename 遗留的独立位置，不属于本应用管理。
  }

  private async tryRename(from: string, to: string): Promise<void> {
    try {
      await rename(from, to)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'ENOENT') return
      logger.warn('Failed to archive legacy state file', { from, to, code })
    }
  }

  private async readState(path: string): Promise<LegacyPersistedState | null> {
    try {
      const content = await readFile(path, 'utf8')
      const parsed = JSON.parse(content) as LegacyPersistedState
      return parsed
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'ENOENT') return null
      logger.warn('Failed to read legacy state file', { path, code })
      return null
    }
  }
}
