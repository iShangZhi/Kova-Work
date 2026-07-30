import { ClaudeAdapter } from '../agents/claude-adapter'
import type { CapabilityDefinition } from '../../shared/contracts'
import type { RegisteredPlugin } from './types'

export const claudeModelCapabilities: CapabilityDefinition[] = [
  {
    id: 'code.inspect',
    name: '检查代码项目',
    description: '读取并分析工作区中的代码、配置和项目结构，不修改文件。',
    inputSchema: {
      type: 'object',
      properties: { objective: { type: 'string', description: '需要检查或分析的问题' } },
      required: ['objective'],
      additionalProperties: false
    },
    risk: 'read',
    supportsStreaming: true
  },
  {
    id: 'code.plan',
    name: '制定代码实施计划',
    description: '让编码 CLI 分析项目并制定实施或修复计划，不修改文件。',
    inputSchema: {
      type: 'object',
      properties: { objective: { type: 'string', description: '需要规划的开发目标' } },
      required: ['objective'],
      additionalProperties: false
    },
    risk: 'read',
    supportsStreaming: true
  },
  {
    id: 'code.edit',
    name: '修改代码',
    description: '在授权工作区中实现功能、修复问题或重构代码。',
    inputSchema: {
      type: 'object',
      properties: { objective: { type: 'string', description: '具体的代码修改目标和验收要求' } },
      required: ['objective'],
      additionalProperties: false
    },
    risk: 'write',
    supportsStreaming: true
  },
  {
    id: 'code.test',
    name: '运行并修复测试',
    description: '在工作区中运行相关测试，分析失败原因并在授权时修复。',
    inputSchema: {
      type: 'object',
      properties: { objective: { type: 'string', description: '测试范围或需要验证的行为' } },
      required: ['objective'],
      additionalProperties: false
    },
    risk: 'execute',
    supportsStreaming: true
  },
  {
    id: 'code.review',
    name: '审查代码',
    description: '审查工作区代码或变更，指出缺陷、风险和测试遗漏。',
    inputSchema: {
      type: 'object',
      properties: { objective: { type: 'string', description: '审查范围和关注点' } },
      required: ['objective'],
      additionalProperties: false
    },
    risk: 'read',
    supportsStreaming: true
  }
]

export const builtInPlugins: RegisteredPlugin[] = [
  {
    manifest: {
      id: 'com.kova.claude-code',
      name: 'Claude Code',
      description: '通过本机 Claude Code CLI 运行开发任务。',
      pluginVersion: '1.0.0',
      kind: 'cli-agent',
      agentId: 'claude',
      protocol: 'claude-stream-json',
      runtimeReady: true,
      capabilities: [
        'agent.chat',
        'agent.plan',
        'coding.read',
        'coding.edit',
        'terminal.run',
        'session.resume',
        'tool.events'
      ],
      modelCapabilities: claudeModelCapabilities,
      permissionModes: ['plan', 'dontAsk', 'acceptEdits'],
      detection: {
        commands: ['claude'],
        versionArgs: ['--version'],
        versionPattern: 'Claude Code'
      },
      permissions: {
        process: ['claude'],
        filesystem: 'selected-workspace',
        network: true
      }
    },
    runtime: new ClaudeAdapter()
  }
]
