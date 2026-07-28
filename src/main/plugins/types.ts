import type {
  AgentId,
  PermissionMode,
  PluginCapability,
  PluginDefinition
} from '../../shared/contracts'
import type { AgentAdapter } from '../agents/types'

export interface PluginManifest {
  id: string
  name: string
  description: string
  pluginVersion: string
  kind: 'cli-agent' | 'virtual-agent'
  agentId: AgentId
  protocol: string
  runtimeReady: boolean
  capabilities: PluginCapability[]
  permissionModes: PermissionMode[]
  detection?: {
    commands: string[]
    versionArgs: string[]
    versionPattern?: string
  }
  permissions: {
    process: string[]
    filesystem: 'none' | 'selected-workspace'
    network: boolean
  }
}

export interface RegisteredPlugin {
  manifest: PluginManifest
  runtime: AgentAdapter
}

export interface ScannedPlugin {
  definition: PluginDefinition
  runtime: AgentAdapter
  permissionModes: PermissionMode[]
}
