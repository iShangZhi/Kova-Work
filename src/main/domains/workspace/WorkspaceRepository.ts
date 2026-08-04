import type { Workspace } from '../../../shared/types'
import type { JsonStore } from '../../infrastructure/persistence/JsonStore'

export interface WorkspaceStateShape {
  workspaces: Workspace[]
}

export const emptyWorkspaceState = (): WorkspaceStateShape => ({ workspaces: [] })

/**
 * WorkspaceRepository - 工作区数据访问层
 */
export class WorkspaceRepository {
  constructor(private readonly store: JsonStore<WorkspaceStateShape>) {}

  async list(): Promise<Workspace[]> {
    return [...this.store.snapshot().workspaces].sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1
      return b.updatedAt.localeCompare(a.updatedAt)
    })
  }

  async findById(id: string): Promise<Workspace | null> {
    return this.store.snapshot().workspaces.find((w) => w.id === id) ?? null
  }

  async findByPath(path: string): Promise<Workspace | null> {
    return this.store.snapshot().workspaces.find((w) => w.path === path) ?? null
  }

  async save(workspace: Workspace): Promise<void> {
    await this.store.setState((state) => {
      const index = state.workspaces.findIndex((w) => w.id === workspace.id)
      if (index >= 0) state.workspaces[index] = workspace
      else state.workspaces.push(workspace)
    })
  }

  async delete(id: string): Promise<void> {
    await this.store.setState((state) => {
      state.workspaces = state.workspaces.filter((w) => w.id !== id)
    })
  }
}
