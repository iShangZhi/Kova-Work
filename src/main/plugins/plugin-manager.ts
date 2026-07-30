import type {
  AgentDefinition,
  AgentId,
  CapabilityDefinition,
  PluginDefinition,
  PluginScanResult,
  RegisteredCapability
} from '../../shared/contracts'
import type { AgentAdapter } from '../agents/types'
import { builtInPlugins } from './builtin'
import { detectPluginCli } from './detection'
import type { RegisteredPlugin, ScannedPlugin } from './types'
import { SessionStore } from '../storage'

export class PluginManager {
  private scanned = new Map<AgentId, ScannedPlugin>()
  private scannedAt = ''

  constructor(
    private readonly store: SessionStore,
    private readonly registered: RegisteredPlugin[] = builtInPlugins
  ) {}

  async scan(force = false): Promise<PluginScanResult> {
    if (this.scanned.size > 0 && !force) return this.snapshot()

    const results = await Promise.all(
      this.registered.map(async ({ manifest, runtime }): Promise<ScannedPlugin> => {
        const detected = await detectPluginCli(manifest)
        const enabled = await this.store.isPluginEnabled(manifest.id)
        let status: PluginDefinition['status']
        let statusMessage: string

        if (!enabled) {
          status = 'disabled'
          statusMessage = '插件已停用'
        } else if (!detected.found) {
          status = 'missing'
          statusMessage = '未在本机检测到 CLI'
        } else if (detected.error) {
          status = 'error'
          statusMessage = detected.error
        } else if (!manifest.runtimeReady) {
          status = 'detected'
          statusMessage = '已检测到 CLI，运行协议待接入'
        } else {
          status = 'ready'
          statusMessage = '插件已就绪'
        }

        return {
          runtime,
          permissionModes: manifest.permissionModes,
          definition: {
            id: manifest.id,
            name: manifest.name,
            description: manifest.description,
            kind: manifest.kind,
            status,
            statusMessage,
            pluginVersion: manifest.pluginVersion,
            cliVersion: detected.version,
            executablePath: detected.executablePath,
            protocol: manifest.protocol,
            capabilities: manifest.capabilities,
            permissions: manifest.permissions,
            agentId: manifest.agentId,
            enabled,
            available: status === 'ready'
          }
        }
      })
    )

    this.scanned = new Map(results.map((plugin) => [plugin.definition.agentId, plugin]))
    this.scannedAt = new Date().toISOString()
    return this.snapshot()
  }

  async listAgents(force = false): Promise<AgentDefinition[]> {
    await this.scan(force)
    return [...this.scanned.values()].map(({ definition, permissionModes }) => ({
      id: definition.agentId,
      name: definition.name,
      description: definition.description,
      command: definition.permissions.process[0],
      available: definition.available,
      version: definition.cliVersion,
      pluginId: definition.id,
      pluginStatus: definition.status,
      executablePath: definition.executablePath,
      capabilities: {
        streaming: definition.capabilities.includes('tool.events'),
        resume: definition.capabilities.includes('session.resume'),
        permissionModes,
        registered: definition.capabilities
      }
    }))
  }

  async setEnabled(pluginId: string, enabled: boolean): Promise<PluginScanResult> {
    if (!this.registered.some((plugin) => plugin.manifest.id === pluginId)) {
      throw new Error('找不到对应插件')
    }
    await this.store.setPluginEnabled(pluginId, enabled)
    return this.scan(true)
  }

  async listModelCapabilities(): Promise<RegisteredCapability[]> {
    const scan = await this.scan()
    return this.registered.flatMap(({ manifest }) => {
      const plugin = scan.plugins.find((item) => item.id === manifest.id)
      return manifest.modelCapabilities.map((capability) => ({
        ...capability,
        pluginId: manifest.id,
        pluginName: manifest.name,
        available: plugin?.available ?? false,
        statusMessage: plugin?.statusMessage ?? '插件未注册'
      }))
    })
  }

  getModelCapability(pluginId: string, capabilityId: string): CapabilityDefinition | undefined {
    return this.registered
      .find((plugin) => plugin.manifest.id === pluginId)
      ?.manifest.modelCapabilities.find((capability) => capability.id === capabilityId)
  }

  async getRunnableAgent(agentId: AgentId): Promise<{
    runtime: AgentAdapter
    executablePath?: string
  }> {
    await this.scan()
    const plugin = this.scanned.get(agentId)
    if (!plugin) throw new Error(`没有插件注册 Agent：${agentId}`)
    if (!plugin.definition.available) {
      throw new Error(`${plugin.definition.name} 插件不可用：${plugin.definition.statusMessage}`)
    }
    return {
      runtime: plugin.runtime,
      executablePath:
        plugin.definition.executablePath === 'built-in'
          ? undefined
          : plugin.definition.executablePath
    }
  }

  private snapshot(): PluginScanResult {
    return {
      plugins: [...this.scanned.values()].map((plugin) => plugin.definition),
      scannedAt: this.scannedAt
    }
  }
}
