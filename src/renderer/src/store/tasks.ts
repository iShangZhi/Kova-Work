import { create } from 'zustand'
import type { Task, TaskWithDetails, StartTaskInput, ContinueTaskInput, UpdateTaskInput } from '../../../shared/contracts'

interface TaskState {
  tasks: Task[]
  activeTask: TaskWithDetails | null
  isLoading: boolean
  error: string | null

  fetchTasks: () => Promise<void>
  selectTask: (id: string) => Promise<void>
  startTask: (input: StartTaskInput) => Promise<Task>
  continueTask: (input: ContinueTaskInput) => Promise<void>
  updateTask: (input: UpdateTaskInput) => Promise<Task>
  retryTask: (taskId: string) => Promise<void>
  cancelTask: (taskId: string) => Promise<void>
  deleteTask: (taskId: string) => Promise<void>
  clearActiveTask: () => void
  setError: (error: string | null) => void
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  activeTask: null,
  isLoading: false,
  error: null,

  fetchTasks: async () => {
    set({ isLoading: true, error: null })
    try {
      const tasks = await window.kova.listTasks()
      set({ tasks, isLoading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error), isLoading: false })
    }
  },

  selectTask: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const task = await window.kova.getTask(id)
      set({ activeTask: task, isLoading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error), isLoading: false })
    }
  },

  startTask: async (input: StartTaskInput) => {
    set({ isLoading: true, error: null })
    try {
      const task = await window.kova.startTask(input)
      const details = await window.kova.getTask(task.id)
      set({ activeTask: details, isLoading: false })
      await get().fetchTasks()
      return task
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error), isLoading: false })
      throw error
    }
  },

  continueTask: async (input: ContinueTaskInput) => {
    set({ isLoading: true, error: null })
    try {
      await window.kova.continueTask(input)
      const updated = await window.kova.getTask(input.taskId)
      set({ activeTask: updated, isLoading: false })
      await get().fetchTasks()
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error), isLoading: false })
      throw error
    }
  },

  updateTask: async (input: UpdateTaskInput) => {
    set({ isLoading: true, error: null })
    try {
      const updated = await window.kova.updateTask(input)
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === updated.id ? updated : t)),
        activeTask: state.activeTask?.task.id === updated.id
          ? { ...state.activeTask, task: updated }
          : state.activeTask,
        isLoading: false
      }))
      return updated
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error), isLoading: false })
      throw error
    }
  },

  retryTask: async (taskId: string) => {
    set({ isLoading: true, error: null })
    try {
      await window.kova.retryTask(taskId)
      const updated = await window.kova.getTask(taskId)
      set({ activeTask: updated, isLoading: false })
      await get().fetchTasks()
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error), isLoading: false })
      throw error
    }
  },

  cancelTask: async (taskId: string) => {
    try {
      await window.kova.cancelTask(taskId)
      const updated = await window.kova.getTask(taskId)
      set({ activeTask: updated })
      await get().fetchTasks()
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    }
  },

  deleteTask: async (taskId: string) => {
    try {
      await window.kova.deleteTask(taskId)
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== taskId),
        activeTask: state.activeTask?.task.id === taskId ? null : state.activeTask
      }))
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
      throw error
    }
  },

  clearActiveTask: () => set({ activeTask: null }),

  setError: (error: string | null) => set({ error })
}))
