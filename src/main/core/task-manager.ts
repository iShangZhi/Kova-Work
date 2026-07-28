import { randomUUID } from 'node:crypto'
import type { BrowserWindow } from 'electron'
import type {
  StartTaskInput,
  Task,
  TaskEvent,
  TaskEventType,
  TaskRun,
  Workspace
} from '../../shared/contracts'
import { SessionStore } from '../storage'
import { ModelOrchestrator } from './model-orchestrator'

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
      allowedPluginIds: input.allowedPluginIds?.length
        ? [...new Set(input.allowedPluginIds)]
        : ['com.kova.claude-code'],
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
    void this.execute(task, run, workspace, controller)
    return task
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

  private async execute(
    task: Task,
    run: TaskRun,
    workspace: Workspace,
    controller: AbortController
  ): Promise<void> {
    try {
      const result = await this.orchestrator.run(
        task,
        run,
        workspace,
        controller.signal,
        (type, text, metadata) => this.emit(task, run, type, text, metadata)
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
