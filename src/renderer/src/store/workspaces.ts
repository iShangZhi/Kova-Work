import { create } from 'zustand'
import type { Workspace, CreateWorkspaceInput, UpdateWorkspaceInput } from '../../../shared/contracts'

interface WorkspaceState {
  workspaces: Workspace[]
  currentWorkspacePath: string
  isLoading: boolean

  fetchWorkspaces: () => Promise<void>
  createWorkspace: (input: CreateWorkspaceInput) => Promise<Workspace>
  updateWorkspace: (input: UpdateWorkspaceInput) => Promise<Workspace>
  setCurrentWorkspace: (path: string) => void
  chooseWorkspace: () => Promise<string | null>
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  currentWorkspacePath: '',
  isLoading: false,

  fetchWorkspaces: async () => {
    set({ isLoading: true })
    try {
      const workspaces = await window.kova.listWorkspaces()
      set({ workspaces, isLoading: false })
    } catch (error) {
      console.error('Failed to fetch workspaces:', error)
      set({ isLoading: false })
    }
  },

  createWorkspace: async (input: CreateWorkspaceInput) => {
    const workspace = await window.kova.createWorkspace(input)
    set((state) => ({
      workspaces: [workspace, ...state.workspaces.filter((w) => w.id !== workspace.id)]
    }))
    return workspace
  },

  updateWorkspace: async (input: UpdateWorkspaceInput) => {
    const updated = await window.kova.updateWorkspace(input)
    set((state) => ({
      workspaces: state.workspaces.map((w) => (w.id === updated.id ? updated : w))
    }))
    return updated
  },

  setCurrentWorkspace: (path: string) => set({ currentWorkspacePath: path }),

  chooseWorkspace: async () => {
    return await window.kova.chooseWorkspace()
  }
}))
