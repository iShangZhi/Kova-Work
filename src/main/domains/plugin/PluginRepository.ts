import type { McpServerDefinition, SaveMcpServerInput, UpdateMcpServerInput } from '../../../shared/contracts'
import type { JsonStore } from '../../infrastructure/persistence/JsonStore'
import { randomUUID } from 'node:crypto'

interface PluginState {
  mcpServers: McpServerDefinition[]
  pluginEnabled: Record<string, boolean>
}

export class PluginRepository {
  constructor(private store: JsonStore<PluginState>) {}

  async listMcpServers(): Promise<McpServerDefinition[]> {
    const state = this.store.getState()
    return [...state.mcpServers]
  }

  async isPluginEnabled(pluginId: string): Promise<boolean> {
    const state = this.store.getState()
    return state.pluginEnabled[pluginId] ?? true
  }

  async setPluginEnabled(pluginId: string, enabled: boolean): Promise<void> {
    this.store.setState((state) => {
      state.pluginEnabled[pluginId] = enabled
    })
  }

  async saveMcpServer(input: SaveMcpServerInput): Promise<McpServerDefinition> {
    let result: McpServerDefinition | null = null
    const now = new Date().toISOString()

    this.store.setState((state) => {
      const server: McpServerDefinition = {
        id: randomUUID(),
        name: input.name,
        transport: input.transport,
        command: input.command,
        args: input.args ?? [],
        url: input.url,
        status: 'configured',
        createdAt: now,
        updatedAt: now
      }
      state.mcpServers.push(server)
      result = server
    })

    if (!result) throw new Error('Failed to save MCP server')
    return result
  }

  async updateMcpServer(input: UpdateMcpServerInput): Promise<McpServerDefinition> {
    let result: McpServerDefinition | null = null

    this.store.setState((state) => {
      const server = state.mcpServers.find((s) => s.id === input.id)
      if (!server) throw new Error(`MCP server not found: ${input.id}`)

      server.name = input.name
      server.transport = input.transport
      server.command = input.command
      server.args = input.args ?? []
      server.url = input.url
      server.updatedAt = new Date().toISOString()

      result = server
    })

    if (!result) throw new Error('Update failed')
    return result
  }

  async deleteMcpServer(id: string): Promise<void> {
    this.store.setState((state) => {
      state.mcpServers = state.mcpServers.filter((s) => s.id !== id)
    })
  }
}
