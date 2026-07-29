import { app } from 'electron'
import { mkdir, readFile, realpath, rename, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { AgentEvent, AgentSession, Artifact, ClaudeWorkflowProfile, CreateWorkspaceInput, McpServerDefinition, ModelProfile, SaveClaudeWorkflowProfileInput, SaveMcpServerInput, SaveModelProfileInput, SessionWithEvents, SkillDefinition, Task, TaskEvent, TaskRun, TaskWithDetails, UpdateMcpServerInput, Workspace } from '../shared/contracts'
import { CORE_TOOLS_PLUGIN_ID } from './tools/native-tool-registry'

interface PersistedState {
  sessions: AgentSession[]
  events: AgentEvent[]
  mcpServers?: McpServerDefinition[]
  skills?: SkillDefinition[]
  modelProfiles?: ModelProfile[]
  workflowProfiles?: ClaudeWorkflowProfile[]
  workspaces?: Workspace[]
  tasks?: Task[]
  taskRuns?: TaskRun[]
  taskEvents?: TaskEvent[]
  artifacts?: Artifact[]
  legacyImported?: boolean
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
  legacyImported: false
})

export class SessionStore {
  private state: PersistedState = emptyState()
  private loaded = false
  private loadPromise?: Promise<void>
  private writeQueue: Promise<void> = Promise.resolve()

  private get filePath(): string {
    return join(app.getPath('userData'), 'kova-state.json')
  }

  private get backupFilePath(): string {
    return `${this.filePath}.backup`
  }

  private get legacyFilePath(): string {
    return join(app.getPath('appData'), 'wise-agent', 'wise-agent-state.json')
  }

  async load(): Promise<void> {
    if (this.loaded) return
    if (!this.loadPromise) this.loadPromise = this.performLoad()
    await this.loadPromise
  }

  private async performLoad(): Promise<void> {
    const primary = await this.readPersistedState(this.filePath)
    const backup = primary ? null : await this.readPersistedState(this.backupFilePath)
    this.state = primary ?? backup ?? emptyState()

    let stateChanged = !primary && Boolean(backup)
    if (!this.state.legacyImported) {
      try {
        const legacy = JSON.parse(await readFile(this.legacyFilePath, 'utf8')) as PersistedState
        const sessionIds = new Set(this.state.sessions.map((session) => session.id))
        const eventIds = new Set(this.state.events.map((event) => event.id))
        this.state.sessions.push(...legacy.sessions.filter((session) => !sessionIds.has(session.id)))
        this.state.events.push(...legacy.events.filter((event) => !eventIds.has(event.id)))
      } catch {
        // A legacy installation is optional.
      }
      this.state.legacyImported = true
      stateChanged = true
    }

    this.loaded = true
    this.state.mcpServers ??= []
    this.state.skills ??= []
    this.state.modelProfiles ??= []
    for (const profile of this.state.modelProfiles) {
      profile.provider ??= 'openai-compatible'
    }
    this.state.workflowProfiles ??= []
    this.state.workspaces ??= []
    for (const workspace of this.state.workspaces) {
      workspace.sourceFolders ??= [workspace.path]
    }
    this.state.tasks ??= []
    this.state.taskRuns ??= []
    this.state.taskEvents ??= []
    this.state.artifacts ??= []
    if (stateChanged) await this.flush()
  }

  private async readPersistedState(path: string): Promise<PersistedState | null> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const parsed = JSON.parse(await readFile(path, 'utf8')) as Partial<PersistedState>
        if (!Array.isArray(parsed.sessions) || !Array.isArray(parsed.events)) {
          throw new Error('状态文件缺少基础数据结构')
        }
        return parsed as PersistedState
      } catch {
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 40 * (attempt + 1)))
        }
      }
    }
    return null
  }

  async listSessions(): Promise<AgentSession[]> {
    await this.load()
    return [...this.state.sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async getSession(sessionId: string): Promise<SessionWithEvents | null> {
    await this.load()
    const session = this.state.sessions.find((item) => item.id === sessionId)
    if (!session) return null

    return {
      session,
      events: this.state.events.filter((event) => event.sessionId === sessionId)
    }
  }

  async saveSession(session: AgentSession): Promise<void> {
    await this.load()
    const index = this.state.sessions.findIndex((item) => item.id === session.id)
    if (index >= 0) this.state.sessions[index] = session
    else this.state.sessions.push(session)
    await this.flush()
  }

  async appendEvent(event: AgentEvent): Promise<void> {
    await this.load()
    this.state.events.push(event)
    await this.flush()
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.load()
    this.state.sessions = this.state.sessions.filter((session) => session.id !== sessionId)
    this.state.events = this.state.events.filter((event) => event.sessionId !== sessionId)
    await this.flush()
  }

  async listMcpServers(): Promise<McpServerDefinition[]> {
    await this.load()
    return [...(this.state.mcpServers ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async saveMcpServer(input: SaveMcpServerInput): Promise<McpServerDefinition> {
    await this.load()
    const name = input.name.trim()
    if (!name) throw new Error('MCP 服务名称不能为空')
    if (input.transport === 'stdio' && !input.command?.trim()) throw new Error('stdio MCP 需要启动命令')
    if (input.transport === 'http' && !input.url?.trim()) throw new Error('HTTP MCP 需要服务地址')

    const now = new Date().toISOString()
    const server: McpServerDefinition = {
      id: randomUUID(),
      name,
      transport: input.transport,
      command: input.command?.trim() || undefined,
      args: input.args?.filter(Boolean) ?? [],
      url: input.url?.trim() || undefined,
      status: 'configured',
      createdAt: now,
      updatedAt: now
    }
    this.state.mcpServers ??= []
    this.state.mcpServers.push(server)
    await this.flush()
    return server
  }

  async updateMcpServer(input: UpdateMcpServerInput): Promise<McpServerDefinition> {
    await this.load()
    const servers = this.state.mcpServers ?? []
    const index = servers.findIndex((server) => server.id === input.id)
    if (index < 0) throw new Error('找不到 MCP 服务配置')
    const name = input.name.trim()
    if (!name) throw new Error('MCP 服务名称不能为空')
    if (input.transport === 'stdio' && !input.command?.trim()) throw new Error('stdio MCP 需要启动命令')
    if (input.transport === 'http' && !input.url?.trim()) throw new Error('HTTP MCP 需要服务地址')

    const server: McpServerDefinition = {
      ...servers[index],
      name,
      transport: input.transport,
      command: input.command?.trim() || undefined,
      args: input.args?.filter(Boolean) ?? [],
      url: input.url?.trim() || undefined,
      updatedAt: new Date().toISOString()
    }
    servers[index] = server
    await this.flush()
    return server
  }

  async deleteMcpServer(id: string): Promise<void> {
    await this.load()
    this.state.mcpServers = (this.state.mcpServers ?? []).filter((server) => server.id !== id)
    await this.flush()
  }

  async listSkills(): Promise<SkillDefinition[]> {
    await this.load()
    return [...(this.state.skills ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async importSkill(sourcePath: string): Promise<SkillDefinition> {
    await this.load()
    const manifestPath = join(sourcePath, 'SKILL.md')
    let content: string
    try { content = await readFile(manifestPath, 'utf8') } catch { throw new Error('所选目录中未找到 SKILL.md') }
    if ((this.state.skills ?? []).some((skill) => skill.sourcePath === sourcePath)) throw new Error('这个技能目录已经导入')
    const lines = content.split(/\r?\n/).map((line) => line.trim())
    const name = lines.find((line) => line.startsWith('# '))?.slice(2).trim() || basename(sourcePath)
    const description = lines.find((line) => line && !line.startsWith('#') && line !== '---') || '本地导入技能'
    const now = new Date().toISOString()
    const skill: SkillDefinition = { id: randomUUID(), name, description, sourcePath, manifestPath, enabled: true, status: 'configured', statusMessage: '已引用本地 SKILL.md', createdAt: now, updatedAt: now }
    this.state.skills ??= []
    this.state.skills.push(skill)
    await this.flush()
    return skill
  }

  async setSkillEnabled(id: string, enabled: boolean): Promise<SkillDefinition> {
    await this.load()
    const index = (this.state.skills ?? []).findIndex((skill) => skill.id === id)
    if (index < 0) throw new Error('找不到技能')
    const skill = { ...this.state.skills![index], enabled, status: enabled ? 'configured' as const : 'disabled' as const, statusMessage: enabled ? '已启用' : '已停用', updatedAt: new Date().toISOString() }
    this.state.skills![index] = skill
    await this.flush()
    return skill
  }

  async deleteSkill(id: string): Promise<void> {
    await this.load()
    this.state.skills = (this.state.skills ?? []).filter((skill) => skill.id !== id)
    await this.flush()
  }

  async listModelProfiles(): Promise<ModelProfile[]> {
    await this.load()
    return [...(this.state.modelProfiles ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async saveModelProfile(input: SaveModelProfileInput): Promise<ModelProfile> {
    await this.load()
    if (!input.name.trim() || !input.baseUrl.trim() || !input.model.trim()) throw new Error('模型名称、接口地址和模型 ID 均为必填项')
    if (
      input.requestTimeoutMs != null &&
      (!Number.isFinite(input.requestTimeoutMs) ||
        input.requestTimeoutMs < 1_000 ||
        input.requestTimeoutMs > 30 * 60_000)
    ) {
      throw new Error('模型请求超时必须在 1 秒到 30 分钟之间')
    }
    const now = new Date().toISOString()
    const profile: ModelProfile = { id: randomUUID(), name: input.name.trim(), provider: input.provider ?? 'openai-compatible', baseUrl: input.baseUrl.trim().replace(/\/$/, ''), model: input.model.trim(), apiKey: input.apiKey?.trim() || undefined, systemPrompt: input.systemPrompt?.trim() || undefined, temperature: input.temperature, requestTimeoutMs: input.requestTimeoutMs, enabled: true, createdAt: now, updatedAt: now }
    this.state.modelProfiles ??= []
    this.state.modelProfiles.push(profile)
    await this.flush()
    return profile
  }

  async deleteModelProfile(id: string): Promise<void> {
    await this.load()
    this.state.modelProfiles = (this.state.modelProfiles ?? []).filter((profile) => profile.id !== id)
    await this.flush()
  }

  async listWorkflowProfiles(): Promise<ClaudeWorkflowProfile[]> {
    await this.load()
    if (!this.state.workflowProfiles?.length) {
      const now = new Date().toISOString()
      this.state.workflowProfiles = [
        { id: randomUUID(), stage: 'design', name: '产品与架构设计', agentName: 'claude', promptPrefix: '你现在处于设计阶段。先澄清目标、约束和验收标准，输出设计方案后再行动。', enabled: true, createdAt: now, updatedAt: now },
        { id: randomUUID(), stage: 'development', name: '功能开发', agentName: 'claude', promptPrefix: '你现在处于开发阶段。基于现有工程实现需求，保持改动聚焦并完成必要验证。', enabled: true, createdAt: now, updatedAt: now },
        { id: randomUUID(), stage: 'testing', name: '测试与验收', agentName: 'claude', promptPrefix: '你现在处于测试阶段。优先复现、验证边界并给出可追踪的测试结论。', enabled: true, createdAt: now, updatedAt: now }
      ]
      await this.flush()
    }
    return [...this.state.workflowProfiles]
  }

  async saveWorkflowProfile(input: SaveClaudeWorkflowProfileInput): Promise<ClaudeWorkflowProfile> {
    await this.load()
    if (!input.name.trim() || !input.agentName.trim()) throw new Error('工作流名称和 Claude Agent 名称不能为空')
    const now = new Date().toISOString()
    const existing = input.id ? (this.state.workflowProfiles ?? []).find((item) => item.id === input.id) : undefined
    const profile: ClaudeWorkflowProfile = {
      id: existing?.id ?? randomUUID(),
      stage: input.stage,
      name: input.name.trim(),
      agentName: input.agentName.trim(),
      promptPrefix: input.promptPrefix.trim(),
      enabled: true,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    }
    this.state.workflowProfiles ??= []
    const index = this.state.workflowProfiles.findIndex((item) => item.id === profile.id)
    if (index >= 0) this.state.workflowProfiles[index] = profile
    else this.state.workflowProfiles.push(profile)
    await this.flush()
    return profile
  }

  async deleteWorkflowProfile(id: string): Promise<void> {
    await this.load()
    this.state.workflowProfiles = (this.state.workflowProfiles ?? []).filter((profile) => profile.id !== id)
    await this.flush()
  }

  async reconcileInterruptedTasks(): Promise<void> {
    await this.load()
    const interrupted = (this.state.tasks ?? []).filter(
      (task) => task.status === 'running' || task.status === 'queued'
    )
    if (!interrupted.length) return
    const now = new Date().toISOString()

    for (const task of interrupted) {
      task.status = 'failed'
      task.updatedAt = now
      const run = [...(this.state.taskRuns ?? [])]
        .filter((item) => item.taskId === task.id && item.status === 'running')
        .sort((a, b) => b.sequence - a.sequence)[0]
      if (!run) continue
      run.status = 'failed'
      run.completedAt = now
      run.error = '应用在任务运行期间退出，执行已中断'
      this.state.taskEvents ??= []
      this.state.taskEvents.push({
        id: randomUUID(),
        taskId: task.id,
        runId: run.id,
        type: 'error',
        text: run.error,
        createdAt: now,
        metadata: { interrupted: true }
      })
    }
    await this.flush()
  }

  async listWorkspaces(): Promise<Workspace[]> {
    await this.load()
    return [...(this.state.workspaces ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async createWorkspace(input: CreateWorkspaceInput): Promise<Workspace> {
    await this.load()
    const name = input.name.trim()
    if (!name) throw new Error('项目名称不能为空')

    const requestedFolders = [...new Set(input.sourceFolders.map((path) => path.trim()).filter(Boolean))]
    if (requestedFolders.length === 0) throw new Error('请至少添加一个源码目录')

    const sourceFolders: string[] = []
    for (const folder of requestedFolders) {
      const resolved = await realpath(folder)
      if (!(await stat(resolved)).isDirectory()) throw new Error(`不是有效目录：${folder}`)
      if (!sourceFolders.includes(resolved)) sourceFolders.push(resolved)
    }

    const existingPath = (this.state.workspaces ?? []).find((workspace) => workspace.path === sourceFolders[0])
    if (existingPath) throw new Error('该源码目录已经属于现有项目')
    const duplicateName = (this.state.workspaces ?? []).some(
      (workspace) => workspace.name.localeCompare(name, undefined, { sensitivity: 'accent' }) === 0
    )
    if (duplicateName) throw new Error('已存在同名项目')

    const now = new Date().toISOString()
    const workspace: Workspace = {
      id: randomUUID(),
      name,
      path: sourceFolders[0],
      sourceFolders,
      defaultModelProfileId: input.defaultModelProfileId,
      enabledPluginIds: [CORE_TOOLS_PLUGIN_ID, 'com.kova.claude-code'],
      createdAt: now,
      updatedAt: now
    }
    this.state.workspaces ??= []
    this.state.workspaces.push(workspace)
    await this.flush()
    return workspace
  }

  async ensureWorkspace(path: string, defaultModelProfileId?: string): Promise<Workspace> {
    await this.load()
    const normalized = path.trim()
    if (!normalized) throw new Error('工作区路径不能为空')
    const existing = (this.state.workspaces ?? []).find((workspace) => workspace.path === normalized)
    if (existing) {
      if (!existing.enabledPluginIds.includes(CORE_TOOLS_PLUGIN_ID)) {
        existing.enabledPluginIds.push(CORE_TOOLS_PLUGIN_ID)
        existing.updatedAt = new Date().toISOString()
        await this.flush()
      }
      if (defaultModelProfileId && existing.defaultModelProfileId !== defaultModelProfileId) {
        existing.defaultModelProfileId = defaultModelProfileId
        existing.updatedAt = new Date().toISOString()
        await this.flush()
      }
      return existing
    }

    const now = new Date().toISOString()
    const workspace: Workspace = {
      id: randomUUID(),
      name: basename(normalized),
      path: normalized,
      sourceFolders: [normalized],
      defaultModelProfileId,
      enabledPluginIds: [CORE_TOOLS_PLUGIN_ID, 'com.kova.claude-code'],
      createdAt: now,
      updatedAt: now
    }
    this.state.workspaces ??= []
    this.state.workspaces.push(workspace)
    await this.flush()
    return workspace
  }

  async listTasks(): Promise<Task[]> {
    await this.load()
    return [...(this.state.tasks ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async getTask(taskId: string): Promise<TaskWithDetails | null> {
    await this.load()
    const task = (this.state.tasks ?? []).find((item) => item.id === taskId)
    if (!task) return null
    return {
      task,
      workspace: task.workspaceId
        ? (this.state.workspaces ?? []).find((item) => item.id === task.workspaceId)
        : undefined,
      runs: (this.state.taskRuns ?? []).filter((item) => item.taskId === taskId),
      events: (this.state.taskEvents ?? []).filter((item) => item.taskId === taskId),
      artifacts: (this.state.artifacts ?? []).filter((item) => item.taskId === taskId)
    }
  }

  async saveTask(task: Task): Promise<void> {
    await this.load()
    this.state.tasks ??= []
    const index = this.state.tasks.findIndex((item) => item.id === task.id)
    if (index >= 0) this.state.tasks[index] = task
    else this.state.tasks.push(task)
    await this.flush()
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.load()
    this.state.tasks = (this.state.tasks ?? []).filter((task) => task.id !== taskId)
    this.state.taskRuns = (this.state.taskRuns ?? []).filter((run) => run.taskId !== taskId)
    this.state.taskEvents = (this.state.taskEvents ?? []).filter((event) => event.taskId !== taskId)
    this.state.artifacts = (this.state.artifacts ?? []).filter((artifact) => artifact.taskId !== taskId)
    await this.flush()
  }

  async saveTaskRun(run: TaskRun): Promise<void> {
    await this.load()
    this.state.taskRuns ??= []
    const index = this.state.taskRuns.findIndex((item) => item.id === run.id)
    if (index >= 0) this.state.taskRuns[index] = run
    else this.state.taskRuns.push(run)
    await this.flush()
  }

  async appendTaskEvent(event: TaskEvent): Promise<void> {
    await this.load()
    this.state.taskEvents ??= []
    this.state.taskEvents.push(event)
    await this.flush()
  }

  async saveArtifact(artifact: Artifact): Promise<void> {
    await this.load()
    this.state.artifacts ??= []
    const index = this.state.artifacts.findIndex((item) => item.id === artifact.id)
    if (index >= 0) this.state.artifacts[index] = artifact
    else this.state.artifacts.push(artifact)
    await this.flush()
  }

  private async flush(): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      await mkdir(dirname(this.filePath), { recursive: true })
      const temporaryPath = `${this.filePath}.tmp`
      const serialized = JSON.stringify(this.state, null, 2)
      try {
        const current = await readFile(this.filePath, 'utf8')
        const parsed = JSON.parse(current) as Partial<PersistedState>
        if (!Array.isArray(parsed.sessions) || !Array.isArray(parsed.events)) {
          throw new Error('当前状态文件无效')
        }
        await writeFile(this.backupFilePath, current, 'utf8')
      } catch {
        // Keep the last valid backup when the primary file is missing or corrupt.
      }
      await writeFile(temporaryPath, serialized, 'utf8')
      await rename(temporaryPath, this.filePath)
    })
    await this.writeQueue
  }
}
