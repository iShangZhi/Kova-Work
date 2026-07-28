import { ClaudeAdapter } from '../agents/claude-adapter'
import type { RegisteredPlugin } from './types'

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
