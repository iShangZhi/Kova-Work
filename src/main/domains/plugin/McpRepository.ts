import type { McpServerDefinition } from '../../../shared/types'
import type { JsonStore } from '../../infrastructure/persistence/JsonStore'

export interface McpState {
  mcpServers: McpServerDefinition[]
}

export const emptyMcpState = (): McpState => ({ mcpServers: [] })

/**
 * McpRepository - MCP 服务配置存取
 */
export class McpRepository {
  constructor(private readonly store: JsonStore<McpState>) {}

  async list(): Promise<McpServerDefinition[]> {
    return [...this.store.snapshot().mcpServers].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    )
  }

  async findById(id: string): Promise<McpServerDefinition | null> {
    return this.store.snapshot().mcpServers.find((s) => s.id === id) ?? null
  }

  async save(server: McpServerDefinition): Promise<void> {
    await this.store.setState((state) => {
      const index = state.mcpServers.findIndex((s) => s.id === server.id)
      if (index >= 0) state.mcpServers[index] = server
      else state.mcpServers.push(server)
    })
  }

  async delete(id: string): Promise<void> {
    await this.store.setState((state) => {
      state.mcpServers = state.mcpServers.filter((s) => s.id !== id)
    })
  }
}
