// MCP Server 相关类型定义

export type McpTransport = 'stdio' | 'http'

export interface McpServerDefinition {
  id: string
  name: string
  transport: McpTransport
  command?: string
  args?: string[]
  url?: string
  status: 'configured'
  createdAt: string
  updatedAt: string
}

export interface SaveMcpServerInput {
  name: string
  transport: McpTransport
  command?: string
  args?: string[]
  url?: string
}

export interface UpdateMcpServerInput extends SaveMcpServerInput {
  id: string
}
