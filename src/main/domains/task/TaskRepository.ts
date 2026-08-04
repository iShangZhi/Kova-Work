import type {
  Artifact,
  Task,
  TaskEvent,
  TaskRun,
  TaskWithDetails,
  Workspace
} from '../../../shared/types'
import type { JsonStore } from '../../infrastructure/persistence/JsonStore'
import type { WorkspaceRepository } from '../workspace/WorkspaceRepository'

export interface TasksState {
  tasks: Task[]
  taskRuns: TaskRun[]
  taskEvents: TaskEvent[]
  artifacts: Artifact[]
}

export const emptyTasksState = (): TasksState => ({
  tasks: [],
  taskRuns: [],
  taskEvents: [],
  artifacts: []
})

/**
 * TaskRepository - 任务聚合数据存取（含 runs / events / artifacts 一起持久化）
 */
export class TaskRepository {
  constructor(
    private readonly store: JsonStore<TasksState>,
    private readonly workspaceRepository: WorkspaceRepository
  ) {}

  async list(): Promise<Task[]> {
    return [...this.store.snapshot().tasks].sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1
      return b.updatedAt.localeCompare(a.updatedAt)
    })
  }

  async findById(taskId: string): Promise<TaskWithDetails | null> {
    const state = this.store.snapshot()
    const task = state.tasks.find((t) => t.id === taskId)
    if (!task) return null

    let workspace: Workspace | undefined
    if (task.workspaceId) {
      workspace = (await this.workspaceRepository.findById(task.workspaceId)) ?? undefined
    }

    return {
      task,
      workspace,
      runs: state.taskRuns.filter((r) => r.taskId === taskId),
      events: state.taskEvents.filter((e) => e.taskId === taskId),
      artifacts: state.artifacts.filter((a) => a.taskId === taskId)
    }
  }

  async save(task: Task): Promise<void> {
    await this.store.setState((state) => {
      const index = state.tasks.findIndex((t) => t.id === task.id)
      if (index >= 0) state.tasks[index] = task
      else state.tasks.push(task)
    })
  }

  async delete(taskId: string): Promise<void> {
    await this.store.setState((state) => {
      state.tasks = state.tasks.filter((t) => t.id !== taskId)
      state.taskRuns = state.taskRuns.filter((r) => r.taskId !== taskId)
      state.taskEvents = state.taskEvents.filter((e) => e.taskId !== taskId)
      state.artifacts = state.artifacts.filter((a) => a.taskId !== taskId)
    })
  }

  async saveRun(run: TaskRun): Promise<void> {
    await this.store.setState((state) => {
      const index = state.taskRuns.findIndex((r) => r.id === run.id)
      if (index >= 0) state.taskRuns[index] = run
      else state.taskRuns.push(run)
    })
  }

  async appendEvent(event: TaskEvent): Promise<void> {
    await this.store.setState((state) => {
      state.taskEvents.push(event)
    })
  }

  async saveArtifact(artifact: Artifact): Promise<void> {
    await this.store.setState((state) => {
      const index = state.artifacts.findIndex((a) => a.id === artifact.id)
      if (index >= 0) state.artifacts[index] = artifact
      else state.artifacts.push(artifact)
    })
  }

  async findInterruptedTasks(): Promise<Task[]> {
    return this.store.snapshot().tasks.filter(
      (t) => t.status === 'running' || t.status === 'queued'
    )
  }
}
