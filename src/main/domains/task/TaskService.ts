import { randomUUID } from 'node:crypto'
import type {
  Task,
  TaskRun,
  TaskEvent,
  TaskWithDetails,
  StartTaskInput,
  ContinueTaskInput,
  UpdateTaskInput,
  Workspace
} from '../../../shared/types'
import type { TaskRepository } from './TaskRepository'
import type { WorkspaceService } from '../workspace/WorkspaceService'
import type { ModelService } from '../model/ModelService'
import { logger } from '../../infrastructure/logging/Logger'

/**
 * TaskService - 任务领域服务
 *
 * 职责：
 * - 任务创建和验证
 * - 任务生命周期管理
 * - 业务规则执行
 * - 跨领域协调（workspace, model）
 */
export class TaskService {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly workspaceService: WorkspaceService,
    private readonly modelService: ModelService
  ) {}

  /**
   * 创建新任务
   */
  async createTask(input: StartTaskInput, coreToolsPluginId: string): Promise<{ task: Task; run: TaskRun; workspace: Workspace }> {
    // 验证输入
    const objective = input.objective.trim()
    if (!objective) {
      throw new Error('任务目标不能为空')
    }

    // 验证模型配置
    const model = await this.modelService.getModelProfile(input.modelProfileId)
    if (!model || !model.enabled) {
      throw new Error('请选择有效的模型配置')
    }

    // 确保工作区存在
    const workspace = await this.workspaceService.ensureWorkspace(
      input.workspace,
      input.modelProfileId
    )

    // 创建任务实体
    const now = new Date().toISOString()
    const task: Task = {
      id: randomUUID(),
      title: objective.slice(0, 80),
      objective,
      workspaceId: workspace.id,
      modelProfileId: input.modelProfileId,
      allowedPluginIds: [
        ...new Set([
          coreToolsPluginId,
          ...(input.allowedPluginIds ?? workspace.enabledPluginIds)
        ])
      ],
      permissionMode: input.permissionMode,
      status: 'running',
      createdAt: now,
      updatedAt: now
    }

    // 创建首次运行记录
    const run: TaskRun = {
      id: randomUUID(),
      taskId: task.id,
      sequence: 1,
      trigger: 'user',
      status: 'running',
      startedAt: now
    }

    // 持久化
    await this.taskRepository.save(task)
    await this.taskRepository.saveRun(run)

    logger.info('Task created', {
      taskId: task.id,
      workspaceId: workspace.id,
      modelProfileId: input.modelProfileId,
      objective: objective.slice(0, 100)
    })

    return { task, run, workspace }
  }

  /**
   * 继续任务（添加新指令）
   */
  async continueTask(input: ContinueTaskInput): Promise<{ task: Task; run: TaskRun; workspace: Workspace }> {
    const prompt = input.prompt.trim()
    if (!prompt) {
      throw new Error('追加指令不能为空')
    }

    return this.startNextRun(input.taskId, 'resume', prompt)
  }

  /**
   * 重试失败的任务
   */
  async retryTask(taskId: string): Promise<{ task: Task; run: TaskRun; workspace: Workspace }> {
    const details = await this.taskRepository.findById(taskId)
    if (!details) {
      throw new Error('找不到对应任务')
    }

    const { task } = details
    if (task.status !== 'failed' && task.status !== 'cancelled') {
      throw new Error('只有失败或已终止的任务可以重试')
    }

    return this.startNextRun(
      taskId,
      'retry',
      '重新执行上一轮未完成的任务。请结合历史错误调整方案，并再次完成原始目标。'
    )
  }

  /**
   * 取消运行中的任务
   */
  async cancelTask(taskId: string): Promise<{ task: Task; run: TaskRun }> {
    const details = await this.taskRepository.findById(taskId)
    if (!details) {
      throw new Error('找不到对应任务')
    }

    const { task, runs } = details
    const currentRun = runs.find((r) => r.status === 'running')
    if (!currentRun) {
      throw new Error('任务未在运行')
    }

    // 更新状态
    const now = new Date().toISOString()
    task.status = 'cancelled'
    task.updatedAt = now
    currentRun.status = 'cancelled'
    currentRun.completedAt = now

    await this.taskRepository.save(task)
    await this.taskRepository.saveRun(currentRun)

    logger.info('Task cancelled', { taskId })

    return { task, run: currentRun }
  }

  /**
   * 完成任务
   */
  async completeTask(taskId: string, runId: string, result?: string): Promise<{ task: Task; run: TaskRun }> {
    const details = await this.taskRepository.findById(taskId)
    if (!details) {
      throw new Error('找不到对应任务')
    }

    const { task, runs } = details
    const run = runs.find((r) => r.id === runId)
    if (!run) {
      throw new Error('找不到对应的运行记录')
    }

    const now = new Date().toISOString()
    task.status = 'completed'
    task.updatedAt = now
    task.completedAt = now
    run.status = 'completed'
    run.completedAt = now

    await this.taskRepository.save(task)
    await this.taskRepository.saveRun(run)

    logger.info('Task completed', { taskId, runId })

    return { task, run }
  }

  /**
   * 标记任务失败
   */
  async failTask(taskId: string, runId: string, error: Error): Promise<{ task: Task; run: TaskRun }> {
    const details = await this.taskRepository.findById(taskId)
    if (!details) {
      throw new Error('找不到对应任务')
    }

    const { task, runs } = details
    const run = runs.find((r) => r.id === runId)
    if (!run) {
      throw new Error('找不到对应的运行记录')
    }

    const now = new Date().toISOString()
    task.status = 'failed'
    task.updatedAt = now
    run.status = 'failed'
    run.completedAt = now
    run.error = error.message

    await this.taskRepository.save(task)
    await this.taskRepository.saveRun(run)

    logger.error('Task failed', error, { taskId, runId })

    return { task, run }
  }

  /**
   * 删除任务
   */
  async deleteTask(taskId: string): Promise<void> {
    const details = await this.taskRepository.findById(taskId)
    if (!details) return

    const { task } = details
    if (task.status === 'running' || task.status === 'queued') {
      throw new Error('请先停止正在运行的任务')
    }

    await this.taskRepository.delete(taskId)
    logger.info('Task deleted', { taskId })
  }

  /**
   * 列出所有任务
   */
  async listTasks(): Promise<Task[]> {
    return this.taskRepository.list()
  }

  /**
   * 获取任务详情
   */
  async getTask(taskId: string): Promise<TaskWithDetails | null> {
    return this.taskRepository.findById(taskId)
  }

  /**
   * 更新任务元数据（标题、置顶、归档）
   */
  async updateTask(input: UpdateTaskInput): Promise<Task> {
    const details = await this.taskRepository.findById(input.id)
    if (!details) {
      throw new Error('找不到对应任务')
    }

    const { task } = details

    if (input.title !== undefined) {
      const title = input.title.trim()
      if (!title) throw new Error('任务名称不能为空')
      task.title = title.slice(0, 120)
    }

    if (input.pinned !== undefined) {
      task.pinned = input.pinned
    }

    if (input.archived !== undefined) {
      if (input.archived && task.status === 'running') {
        throw new Error('请先停止正在运行的任务')
      }
      task.archivedAt = input.archived ? new Date().toISOString() : undefined
    }

    task.updatedAt = new Date().toISOString()

    await this.taskRepository.save(task)

    logger.info('Task updated', { taskId: task.id })

    return task
  }

  /**
   * 查找被中断的任务
   */
  async findInterruptedTasks(): Promise<Task[]> {
    return this.taskRepository.findInterruptedTasks()
  }

  /**
   * 启动时协调被中断的任务（标记为失败）
   */
  async reconcileInterruptedTasks(): Promise<void> {
    const interrupted = await this.taskRepository.findInterruptedTasks()
    if (!interrupted.length) return

    const now = new Date().toISOString()

    for (const task of interrupted) {
      task.status = 'failed'
      task.updatedAt = now

      // 找到正在运行的 run
      const details = await this.taskRepository.findById(task.id)
      const run = (details?.runs ?? [])
        .filter((r) => r.status === 'running')
        .sort((a, b) => b.sequence - a.sequence)[0]

      if (!run) continue

      run.status = 'failed'
      run.completedAt = now
      run.error = '应用在任务运行期间退出，执行已中断'

      const event: TaskEvent = {
        id: randomUUID(),
        taskId: task.id,
        runId: run.id,
        type: 'error',
        text: run.error,
        createdAt: now,
        metadata: { interrupted: true }
      }

      await this.taskRepository.save(task)
      await this.taskRepository.saveRun(run)
      await this.taskRepository.appendEvent(event)
    }

    logger.info('Interrupted tasks reconciled', { count: interrupted.length })
  }

  /**
   * 私有方法：启动下一轮运行
   */
  private async startNextRun(
    taskId: string,
    trigger: TaskRun['trigger'],
    instruction: string
  ): Promise<{ task: Task; run: TaskRun; workspace: Workspace }> {
    const details = await this.taskRepository.findById(taskId)
    if (!details) {
      throw new Error('找不到对应任务')
    }

    const { task, runs } = details
    let workspace = details.task.workspaceId
      ? await this.workspaceService.getWorkspace(details.task.workspaceId)
      : null

    if (!workspace) {
      throw new Error('任务工作区不存在')
    }

    // 检查是否正在运行
    const hasRunningRun = runs.some((r) => r.status === 'running')
    if (hasRunningRun) {
      throw new Error('任务当前正在运行')
    }

    // 验证模型配置，必要时切换到可用模型
    const previousModelProfileId = task.modelProfileId
    const models = await this.modelService.listEnabledModelProfiles()

    if (!models.some((model) => model.id === task.modelProfileId)) {
      const fallback =
        models.find((model) => workspace?.defaultModelProfileId && model.id === workspace.defaultModelProfileId) ?? models[0]

      if (!fallback) {
        throw new Error('没有可用的模型配置，请先在设置中添加并启用模型')
      }

      task.modelProfileId = fallback.id
      if (workspace) {
        const updatedWorkspace = await this.workspaceService.ensureWorkspace(workspace.path, fallback.id)
        if (updatedWorkspace) {
          workspace = updatedWorkspace
        }
      }
    }

    // 更新任务状态
    const now = new Date().toISOString()
    task.status = 'running'
    task.updatedAt = now
    task.completedAt = undefined

    // 创建新的运行记录
    const run: TaskRun = {
      id: randomUUID(),
      taskId,
      sequence: Math.max(0, ...runs.map((item) => item.sequence)) + 1,
      trigger,
      status: 'running',
      startedAt: now
    }

    await this.taskRepository.save(task)
    await this.taskRepository.saveRun(run)

    logger.info('Task run started', {
      taskId,
      runId: run.id,
      sequence: run.sequence,
      trigger,
      modelSwitched: previousModelProfileId !== task.modelProfileId
    })

    return { task, run, workspace }
  }
}
