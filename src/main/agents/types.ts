import type { AgentEventType, AgentSession, PermissionMode, WorkflowStage } from '../../shared/contracts'

export interface AdapterRunInput {
  prompt: string
  workspace: string
  executablePath?: string
  permissionMode: PermissionMode
  workflowStage?: WorkflowStage
  claudeAgent?: string
  nativeSessionId?: string
  signal: AbortSignal
  emit: (type: AgentEventType, text: string, metadata?: Record<string, unknown>) => Promise<void>
  setNativeSessionId: (nativeSessionId: string) => Promise<void>
}

export interface AgentAdapter {
  validateWorkspace?(workspace: string, executablePath?: string): Promise<void>
  run(input: AdapterRunInput): Promise<void>
}

export interface RunningSession {
  session: AgentSession
  controller: AbortController
}
