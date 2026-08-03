// Workspace 相关类型定义

export interface Workspace {
  id: string
  name: string
  path: string
  sourceFolders?: string[]
  icon?: string
  color?: string
  pinned?: boolean
  removedAt?: string
  defaultModelProfileId?: string
  enabledPluginIds: string[]
  createdAt: string
  updatedAt: string
}

export interface CreateWorkspaceInput {
  name: string
  sourceFolders: string[]
  defaultModelProfileId?: string
}

export interface UpdateWorkspaceInput {
  id: string
  name?: string
  sourceFolders?: string[]
  icon?: string
  color?: string
  pinned?: boolean
  removed?: boolean
  enabledPluginIds?: string[]
}
