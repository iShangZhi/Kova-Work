import { randomUUID } from 'node:crypto'
import type {
  McpServerDefinition,
  SaveMcpServerInput,
  UpdateMcpServerInput
} from '../../../shared/types'
import type { McpRepository } from './McpRepository'
import { logger } from '../../infrastructure/logging/Logger'

/**
 * McpService - MCP 服务领域服务
 *
 * 从 storage.ts 迁移入校验：
 * - 名称非空
 * - stdio 需要 command，http 需要 url
 * - args 过滤空值、字符串 trim
 */
export class McpService {
  constructor(private readonly repository: McpRepository) {}

  async list(): Promise<McpServerDefinition[]> {
    return this.repository.list()
  }

  async save(input: SaveMcpServerInput): Promise<McpServerDefinition> {
    const server = this.validateAndBuild(input)
    await this.repository.save(server)
    logger.info('MCP server created', { serverId: server.id, name: server.name })
    return server
  }

  async update(input: UpdateMcpServerInput): Promise<McpServerDefinition> {
    const existing = await this.repository.findById(input.id)
    if (!existing) throw new Error('找不到 MCP 服务配置')
    const updated = this.validateAndBuild(input, existing)
    await this.repository.save(updated)
    logger.info('MCP server updated', { serverId: updated.id })
    return updated
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id)
    logger.info('MCP server deleted', { serverId: id })
  }

  private validateAndBuild(
    input: SaveMcpServerInput,
    existing?: McpServerDefinition
  ): McpServerDefinition {
    const name = input.name.trim()
    if (!name) throw new Error('MCP 服务名称不能为空')
    if (input.transport === 'stdio' && !input.command?.trim()) {
      throw new Error('stdio MCP 需要启动命令')
    }
    if (input.transport === 'http' && !input.url?.trim()) {
      throw new Error('HTTP MCP 需要服务地址')
    }
    const now = new Date().toISOString()
    return {
      id: existing?.id ?? randomUUID(),
      name,
      transport: input.transport,
      command: input.command?.trim() || undefined,
      args: input.args?.filter(Boolean) ?? [],
      url: input.url?.trim() || undefined,
      status: 'configured',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    }
  }
}
