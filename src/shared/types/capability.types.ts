// Capability 相关类型定义

export type CapabilityRisk = 'read' | 'write' | 'execute' | 'network'

export interface CapabilityDefinition {
  id: string
  name: string
  description: string
  inputSchema: Record<string, unknown>
  outputSchema?: Record<string, unknown>
  risk: CapabilityRisk
  supportsStreaming: boolean
}

export interface RegisteredCapability extends CapabilityDefinition {
  pluginId: string
  pluginName: string
  available: boolean
  statusMessage: string
}

export interface CapabilityCall {
  id: string
  taskId: string
  runId: string
  pluginId: string
  capabilityId: string
  arguments: Record<string, unknown>
}

export interface CapabilityResult {
  callId: string
  status: 'completed' | 'failed' | 'cancelled'
  output?: Record<string, unknown>
  artifactIds?: string[]
  error?: string
}
