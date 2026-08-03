// Task, Run, Event, Artifact 相关类型定义

import type { PermissionMode } from './agent.types'
import type { Workspace } from './workspace.types'

export type TaskStatus =
  | 'draft'
  | 'queued'
  | 'running'
  | 'waiting'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type RunStatus =
  | 'queued'
  | 'running'
  | 'waiting_permission'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type TaskEventType =
  | 'user_message'
  | 'model_message'
  | 'plan'
  | 'capability_call'
  | 'capability_result'
  | 'cli_output'
  | 'permission_request'
  | 'permission_result'
  | 'artifact'
  | 'system'
  | 'error'
  | 'completed'

export type ArtifactType =
  | 'file'
  | 'code_change'
  | 'document'
  | 'test_report'
  | 'command_output'
  | 'image'
  | 'other'

export interface Task {
  id: string
  title: string
  objective: string
  workspaceId?: string
  modelProfileId: string
  allowedPluginIds: string[]
  permissionMode: PermissionMode
  status: TaskStatus
  pinned?: boolean
  archivedAt?: string
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export interface TaskRun {
  id: string
  taskId: string
  sequence: number
  trigger: 'user' | 'retry' | 'resume' | 'workflow'
  status: RunStatus
  startedAt?: string
  completedAt?: string
  error?: string
}

export interface TaskEvent {
  id: string
  taskId: string
  runId: string
  type: TaskEventType
  text: string
  createdAt: string
  metadata?: Record<string, unknown>
}

export interface Artifact {
  id: string
  taskId: string
  runId: string
  type: ArtifactType
  name: string
  path?: string
  mimeType?: string
  summary?: string
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface StartTaskInput {
  objective: string
  workspace: string
  modelProfileId: string
  allowedPluginIds?: string[]
  permissionMode: PermissionMode
}

export interface ContinueTaskInput {
  taskId: string
  prompt: string
}

export interface UpdateTaskInput {
  id: string
  title?: string
  pinned?: boolean
  archived?: boolean
}

export interface TaskWithDetails {
  task: Task
  workspace?: Workspace
  runs: TaskRun[]
  events: TaskEvent[]
  artifacts: Artifact[]
}
