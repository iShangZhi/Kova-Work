import { randomUUID } from 'node:crypto'
import type { BrowserWindow } from 'electron'
import type {
  ContinueTaskInput,
  StartTaskInput,
  Task,
  TaskEvent,
  TaskEventType,
  TaskRun,
  Workspace
} from '../../shared/contracts'
import { SessionStore } from '../storage'
import { ModelOrchestrator } from './model-orchestrator'
import { CORE_TOOLS_PLUGIN_ID } from '../tools/native-tool-registry'

interface RunningTask {
  task: Task
  run: TaskRun
  workspace: Workspace
  controller: AbortController
}

export class TaskManager {
  private readonly running = new Map<string, RunningTask>()

  constructor(
    private readonly store: SessionStore,
    private readonly orchestrator: ModelOrchestrator,
    private readonly getWindow: () => BrowserWindow | null
  ) {}

  async start(input: StartTaskInput): Promise<Task> {
    const objective = input.objective.trim()
    if (!objective) throw new Error('任务目标不能为空')
    const model = (await this.store.listModelProfiles()).find(
      (item) => item.id === input.modelProfileId && item.enabled
    )
    if (!model) throw new Error('请选择有效的模型配置')

    const workspace = await this.store.ensureWorkspace(input.workspace, input.modelProfileId)
    const now = new Date().toISOString()
    const task: Task = {
      id: randomUUID(),
      title: objective.slice(0, 80),
      objective,
      workspaceId: workspace.id,
      modelProfileId: input.modelProfileId,
      allowedPluginIds: [
        ...new Set([
          CORE_TOOLS_PLUGIN_ID,
          ...(input.allowedPluginIds ?? workspace.enabledPluginIds)
        ])
      ],
      permissionMode: input.permissionMode,
      status: 'running',
      createdAt: now,
      updatedAt: now
    }
    const run: TaskRun = {
      id: randomUUID(),
      taskId: task.id,
      sequence: 1,
      trigger: 'user',
      status: 'running',
      startedAt: now
    }

    await this.store.saveTask(task)
    await this.store.saveTaskRun(run)
    await this.emit(task, run, 'user_message', objective)
    const controller = new AbortController()
    this.running.set(task.id, { task, run, workspace, controller })
    void this.execute(task, run, workspace, controller, objective)
    return task
  }

  async continue(input: ContinueTaskInput): Promise<Task> {
    const prompt = input.prompt.trim()
    if (!prompt) throw new Error('追加指令不能为空')
    return this.startNextRun(input.taskId, 'resume', prompt, 'user_message')
  }

  async retry(taskId: string): Promise<Task> {
    const details = await this.store.getTask(taskId)
    if (!details) throw new Error('找不到对应任务')
    if (details.task.status !== 'failed' && details.task.status !== 'cancelled') {
      throw new Error('只有失败或已终止的任务可以重试')
    }
    return this.startNextRun(
      taskId,
      'retry',
      '重新执行上一轮未完成的任务。请结合历史错误调整方案，并再次完成原始目标。',
      'system'
    )
  }

  async cancel(taskId: string): Promise<void> {
    const current = this.running.get(taskId)
    if (!current) return
    current.controller.abort()
    const now = new Date().toISOString()
    current.task.status = 'cancelled'
    current.task.updatedAt = now
    current.run.status = 'cancelled'
    current.run.completedAt = now
    await this.store.saveTask(current.task)
    await this.store.saveTaskRun(current.run)
    await this.emit(current.task, current.run, 'system', '任务已由用户停止')
  }

  async delete(taskId: string): Promise<void> {
    if (this.running.has(taskId)) throw new Error('请先停止正在运行的任务')
    const details = await this.store.getTask(taskId)
    if (!details) return
    await this.store.deleteTask(taskId)
  }

  private async startNextRun(
    taskId: string,
    trigger: TaskRun['trigger'],
    instruction: string,
    eventType: TaskEventType
  ): Promise<Task> {
    if (this.running.has(taskId)) throw new Error('任务当前正在运行')
    const details = await this.store.getTask(taskId)
    if (!details) throw new Error('找不到对应任务')
    if (!details.workspace) throw new Error('任务工作区不存在')

    const now = new Date().toISOString()
    const task = details.task
    const previousModelProfileId = task.modelProfileId
    const models = (await this.store.listModelProfiles()).filter((model) => model.enabled)
    if (!models.some((model) => model.id === task.modelProfileId)) {
      const fallback = models.find((model) => model.id === details.workspace?.defaultModelProfileId) ?? models[0]
      if (!fallback) throw new Error('没有可用的模型配置，请先在设置中添加并启用模型')
      task.modelProfileId = fallback.id
      details.workspace = await this.store.ensureWorkspace(details.workspace.path, fallback.id)
    }
    task.status = 'running'
    task.updatedAt = now
    task.completedAt = undefined
    const run: TaskRun = {
      id: randomUUID(),
      taskId,
      sequence: Math.max(0, ...details.runs.map((item) => item.sequence)) + 1,
      trigger,
      status: 'running',
      startedAt: now
    }

    await this.store.saveTask(task)
    await this.store.saveTaskRun(run)
    if (previousModelProfileId !== task.modelProfileId) {
      await this.emit(task, run, 'system', '原模型配置已不可用，任务已自动切换到当前默认模型。')
    }
    await this.emit(task, run, eventType, instruction, { trigger })
    const controller = new AbortController()
    this.running.set(task.id, { task, run, workspace: details.workspace, controller })
    void this.execute(task, run, details.workspace, controller, instruction)
    return task
  }

  private async execute(
    task: Task,
    run: TaskRun,
    workspace: Workspace,
    controller: AbortController,
    instruction: string
  ): Promise<void> {
    try {
      const result = await this.orchestrator.run(
        task,
        run,
        workspace,
        controller.signal,
        (type, text, metadata) => this.emit(task, run, type, text, metadata),
        instruction
      )
      if (controller.signal.aborted) return
      const now = new Date().toISOString()
      task.status = 'completed'
      task.updatedAt = now
      task.completedAt = now
      run.status = 'completed'
      run.completedAt = now
      await this.emit(task, run, 'completed', result)
    } catch (error) {
      if (controller.signal.aborted) return
      const now = new Date().toISOString()
      task.status = 'failed'
      task.updatedAt = now
      run.status = 'failed'
      run.completedAt = now
      run.error = error instanceof Error ? error.message : String(error)
      await this.emit(task, run, 'error', run.error)
    } finally {
      await this.store.saveTask(task)
      await this.store.saveTaskRun(run)
      this.running.delete(task.id)
    }
  }

  private async emit(
    task: Task,
    run: TaskRun,
    type: TaskEventType,
    text: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const event: TaskEvent = {
      id: randomUUID(),
      taskId: task.id,
      runId: run.id,
      type,
      text,
      createdAt: new Date().toISOString(),
      metadata
    }
    await this.store.appendTaskEvent(event)
    this.getWindow()?.webContents.send('task:event', event)
  }
}
