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
} from '../../shared/types'
import { ModelOrchestrator } from './model-orchestrator'
import { CORE_TOOLS_PLUGIN_ID } from '../tools/native-tool-registry'
import { logger } from '../infrastructure/logging/Logger'
import type { TaskService } from '../domains/task/TaskService'
import type { TaskRepository } from '../domains/task/TaskRepository'

interface RunningTask {
  task: Task
  run: TaskRun
  workspace: Workspace
  controller: AbortController
}

/**
 * TaskManager - 任务管理器（基础设施层）
 *
 * 职责：
 * - 管理运行中任务的生命周期（运行状态、AbortController）
 * - 协调 TaskService 和 ModelOrchestrator
 * - 事件发射到前端
 * - 任务执行编排
 *
 * 注意：业务逻辑已移至 TaskService，TaskManager 仅负责运行时管理
 */
export class TaskManager {
  private readonly running = new Map<string, RunningTask>()

  constructor(
    private readonly taskService: TaskService,
    private readonly taskRepository: TaskRepository,
    private readonly orchestrator: ModelOrchestrator,
    private readonly getWindow: () => BrowserWindow | null
  ) {}

  async start(input: StartTaskInput): Promise<Task> {
    // 委托给 TaskService 创建任务
    const { task, run, workspace } = await this.taskService.createTask(input, CORE_TOOLS_PLUGIN_ID)

    // 发射初始事件
    await this.emit(task, run, 'user_message', input.objective)

    // 创建控制器并开始执行
    const controller = new AbortController()
    this.running.set(task.id, { task, run, workspace, controller })

    void this.execute(task, run, workspace, controller, input.objective)
    return task
  }

  async continue(input: ContinueTaskInput): Promise<Task> {
    // 委托给 TaskService 继续任务
    const { task, run, workspace } = await this.taskService.continueTask(input)

    // 发射事件
    await this.emit(task, run, 'user_message', input.prompt, { trigger: 'resume' })

    // 创建控制器并开始执行
    const controller = new AbortController()
    this.running.set(task.id, { task, run, workspace, controller })

    void this.execute(task, run, workspace, controller, input.prompt)
    return task
  }

  async retry(taskId: string): Promise<Task> {
    // 委托给 TaskService 重试任务
    const instruction = '重新执行上一轮未完成的任务。请结合历史错误调整方案，并再次完成原始目标。'
    const { task, run, workspace } = await this.taskService.retryTask(taskId)

    // 发射事件
    await this.emit(task, run, 'system', instruction, { trigger: 'retry' })

    // 创建控制器并开始执行
    const controller = new AbortController()
    this.running.set(task.id, { task, run, workspace, controller })

    void this.execute(task, run, workspace, controller, instruction)
    return task
  }

  async cancel(taskId: string): Promise<void> {
    const current = this.running.get(taskId)
    if (!current) return

    // 中止执行
    current.controller.abort()

    // 委托给 TaskService 更新状态
    const { task, run } = await this.taskService.cancelTask(taskId)

    // 发射事件
    await this.emit(task, run, 'system', '任务已由用户停止')

    // 清理运行状态
    this.running.delete(taskId)
  }

  async delete(taskId: string): Promise<void> {
    // 委托给 TaskService 删除任务
    await this.taskService.deleteTask(taskId)
  }

  private async execute(
    task: Task,
    run: TaskRun,
    workspace: Workspace,
    controller: AbortController,
    instruction: string
  ): Promise<void> {
    const startTime = Date.now()

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

      // 委托给 TaskService 标记完成
      const { task: updatedTask, run: updatedRun } = await this.taskService.completeTask(
        task.id,
        run.id,
        result
      )

      await this.emit(updatedTask, updatedRun, 'completed', result)

      const duration = Date.now() - startTime
      logger.info('Task completed', { taskId: task.id, runId: run.id, duration })
    } catch (error) {
      if (controller.signal.aborted) return

      // 委托给 TaskService 标记失败
      const { task: updatedTask, run: updatedRun } = await this.taskService.failTask(
        task.id,
        run.id,
        error as Error
      )

      await this.emit(updatedTask, updatedRun, 'error', updatedRun.error!)

      const duration = Date.now() - startTime
      logger.error('Task failed', error as Error, { taskId: task.id, runId: run.id, duration })
    } finally {
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
    await this.taskRepository.appendEvent(event)
    this.getWindow()?.webContents.send('task:event', event)
  }
}
