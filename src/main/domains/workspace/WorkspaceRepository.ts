import type { Workspace, CreateWorkspaceInput, UpdateWorkspaceInput } from '../../../shared/contracts'
import type { JsonStore } from '../../infrastructure/persistence/JsonStore'
import { randomUUID } from 'node:crypto'
import { basename } from 'node:path'

interface WorkspaceState {
  workspaces: Workspace[]
}

export class WorkspaceRepository {
  constructor(private store: JsonStore<WorkspaceState>) {}

  async list(): Promise<Workspace[]> {
    const state = this.store.getState()
    return [...state.workspaces]
      .filter((w) => !w.removedAt)
      .sort((a, b) => {
        if (a.pinned && !b.pinned) return -1
        if (!a.pinned && b.pinned) return 1
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
  }

  async findById(id: string): Promise<Workspace | null> {
    const state = this.store.getState()
    return state.workspaces.find((w) => w.id === id) ?? null
  }

  async findByPath(path: string): Promise<Workspace | null> {
    const state = this.store.getState()
    return state.workspaces.find((w) => w.path === path && !w.removedAt) ?? null
  }

  async create(input: CreateWorkspaceInput): Promise<Workspace> {
    let result: Workspace | null = null
    const now = new Date().toISOString()

    this.store.setState((state) => {
      const workspace: Workspace = {
        id: randomUUID(),
        name: input.name,
        path: input.sourceFolders[0] ?? '',
        sourceFolders: input.sourceFolders,
        pinned: false,
        enabledPluginIds: [],
        defaultModelProfileId: input.defaultModelProfileId,
        createdAt: now,
        updatedAt: now
      }
      state.workspaces.push(workspace)
      result = workspace
    })

    if (!result) throw new Error('Failed to create workspace')
    return result
  }

  async update(input: UpdateWorkspaceInput): Promise<Workspace> {
    let result: Workspace | null = null
    const now = new Date().toISOString()

    this.store.setState((state) => {
      const workspace = state.workspaces.find((w) => w.id === input.id)
      if (!workspace) throw new Error(`Workspace not found: ${input.id}`)

      if (input.name !== undefined) workspace.name = input.name
      if (input.sourceFolders !== undefined) workspace.sourceFolders = input.sourceFolders
      if (input.icon !== undefined) workspace.icon = input.icon
      if (input.color !== undefined) workspace.color = input.color
      if (input.pinned !== undefined) workspace.pinned = input.pinned
      if (input.removed !== undefined) workspace.removedAt = input.removed ? now : undefined
      if (input.enabledPluginIds !== undefined) workspace.enabledPluginIds = input.enabledPluginIds

      workspace.updatedAt = now
      result = workspace
    })

    if (!result) throw new Error('Update failed')
    return result
  }

  async getOrCreateFromPath(path: string): Promise<Workspace> {
    const state = this.store.getState()
    const existing = state.workspaces.find((w) => w.path === path && !w.removedAt)
    if (existing) return existing

    return this.create({
      name: basename(path),
      sourceFolders: [path]
    })
  }

  async ensureWorkspace(path: string): Promise<Workspace> {
    return this.getOrCreateFromPath(path)
  }
}
