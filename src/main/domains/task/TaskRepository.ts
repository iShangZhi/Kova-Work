import type { Task, TaskEvent, TaskRun, TaskWithDetails } from '../../../shared/contracts'
import type { JsonStore } from '../../infrastructure/persistence/JsonStore'

interface TaskState {
  tasks: Task[]
  taskRuns: TaskRun[]
  taskEvents: TaskEvent[]
}

export class TaskRepository {
  constructor(private store: JsonStore<TaskState>) {}

  async list(): Promise<Task[]> {
    const state = this.store.getState()
    return [...state.tasks].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }

  async findById(taskId: string): Promise<TaskWithDetails | null> {
    const state = this.store.getState()
    const task = state.tasks.find((t) => t.id === taskId)
    if (!task) return null

    const runs = state.taskRuns.filter((r) => r.taskId === taskId)
    const events = state.taskEvents.filter((e) => e.taskId === taskId)
    const artifacts: any[] = [] // Will be populated by artifact queries

    return { task, runs, events, artifacts }
  }

  async save(task: Task): Promise<void> {
    this.store.setState((state) => {
      const index = state.tasks.findIndex((t) => t.id === task.id)
      if (index >= 0) {
        state.tasks[index] = task
      } else {
        state.tasks.push(task)
      }
    })
  }

  async update(taskId: string, updates: Partial<Task>): Promise<void> {
    this.store.setState((state) => {
      const task = state.tasks.find((t) => t.id === taskId)
      if (task) Object.assign(task, updates)
    })
  }

  async delete(taskId: string): Promise<void> {
    this.store.setState((state) => {
      state.tasks = state.tasks.filter((t) => t.id !== taskId)
      state.taskRuns = state.taskRuns.filter((r) => r.taskId !== taskId)
      state.taskEvents = state.taskEvents.filter((e) => e.taskId !== taskId)
    })
  }

  async saveRun(run: TaskRun): Promise<void> {
    this.store.setState((state) => {
      const index = state.taskRuns.findIndex((r) => r.id === run.id)
      if (index >= 0) {
        state.taskRuns[index] = run
      } else {
        state.taskRuns.push(run)
      }
    })
  }

  async appendEvent(event: TaskEvent): Promise<void> {
    this.store.setState((state) => {
      state.taskEvents.push(event)
    })
  }

  async findInterruptedTasks(): Promise<Task[]> {
    const state = this.store.getState()
    return state.tasks.filter((t) => t.status === 'running' || t.status === 'queued')
  }
}
