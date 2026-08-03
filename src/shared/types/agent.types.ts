// Agent, Plugin, Session 相关类型定义

import type { WorkflowStage } from './workflow.types'

export type AgentId = 'claude' | 'model'

export type PermissionMode = 'plan' | 'dontAsk' | 'acceptEdits'

export type SessionStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'

export type PluginStatus = 'ready' | 'detected' | 'missing' | 'disabled' | 'error'

export type PluginCapability =
  | 'agent.chat'
  | 'agent.plan'
  | 'coding.read'
  | 'coding.edit'
  | 'terminal.run'
  | 'session.resume'
  | 'tool.events'

export type AgentEventType =
  | 'user_message'
  | 'agent_message'
  | 'progress'
  | 'tool'
  | 'permission'
  | 'system'
  | 'error'
  | 'completed'

export type ExtensionLifecycleStatus = 'draft' | 'configured' | 'ready' | 'disabled' | 'error'

export interface AgentDefinition {
  id: AgentId
  name: string
  description: string
  command?: string
  available: boolean
  version?: string
  pluginId: string
  pluginStatus: PluginStatus
  executablePath?: string
  capabilities: {
    streaming: boolean
    resume: boolean
    permissionModes: PermissionMode[]
    registered: PluginCapability[]
  }
}

export interface PluginDefinition {
  id: string
  name: string
  description: string
  kind: 'cli-agent' | 'virtual-agent'
  status: PluginStatus
  statusMessage: string
  pluginVersion: string
  cliVersion?: string
  executablePath?: string
  protocol: string
  capabilities: PluginCapability[]
  permissions: {
    process: string[]
    filesystem: 'none' | 'selected-workspace'
    network: boolean
  }
  agentId: AgentId
  enabled: boolean
  available: boolean
}

export interface PluginScanResult {
  plugins: PluginDefinition[]
  scannedAt: string
}

export interface AgentEvent {
  id: string
  sessionId: string
  type: AgentEventType
  text: string
  createdAt: string
  metadata?: Record<string, unknown>
}

export interface AgentSession {
  id: string
  title: string
  agentId: AgentId
  workspace: string
  permissionMode: PermissionMode
  workflowStage?: WorkflowStage
  claudeAgent?: string
  claudePromptPrefix?: string
  modelProfileId?: string
  status: SessionStatus
  nativeSessionId?: string
  createdAt: string
  updatedAt: string
}

export interface SessionWithEvents {
  session: AgentSession
  events: AgentEvent[]
}

export interface StartSessionInput {
  agentId: AgentId
  workspace: string
  prompt: string
  permissionMode: PermissionMode
  workflowStage?: WorkflowStage
  claudeAgent?: string
  claudePromptPrefix?: string
  modelProfileId?: string
}

export interface ContinueSessionInput {
  sessionId: string
  prompt: string
}

export interface RenameSessionInput {
  sessionId: string
  title: string
}

export interface PluginPackageDefinition {
  id: string
  name: string
  version: string
  sourcePath: string
  manifestPath: string
  status: ExtensionLifecycleStatus
  statusMessage: string
  createdAt: string
  updatedAt: string
}

export interface AppConnectionDefinition {
  id: string
  name: string
  connectorId: string
  baseUrl?: string
  authType: 'oauth' | 'token' | 'local'
  status: ExtensionLifecycleStatus
  statusMessage: string
  createdAt: string
  updatedAt: string
}

export interface SkillDefinition {
  id: string
  name: string
  description: string
  sourcePath: string
  manifestPath: string
  enabled: boolean
  status: ExtensionLifecycleStatus
  statusMessage: string
  createdAt: string
  updatedAt: string
}
