import type {
  CapabilityCall,
  CapabilityDefinition,
  CapabilityResult,
  PermissionMode,
  RegisteredCapability,
  TaskEventType
} from '../../shared/contracts'
import { PluginManager } from '../plugins/plugin-manager'
import {
  CORE_TOOLS_PLUGIN_ID,
  NativeToolRegistry
} from '../tools/native-tool-registry'

export interface CapabilityExecutionContext {
  workspace: string
  permissionMode: PermissionMode
  signal: AbortSignal
  emit: (
    type: TaskEventType,
    text: string,
    metadata?: Record<string, unknown>
  ) => Promise<void>
}

const claudeCapabilities: CapabilityDefinition[] = [
  {
    id: 'code.inspect',
    name: '检查代码项目',
    description: '读取并分析工作区中的代码、配置和项目结构，不修改文件。',
    inputSchema: {
      type: 'object',
      properties: {
        objective: { type: 'string', description: '需要检查或分析的问题' }
      },
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
      properties: {
        objective: { type: 'string', description: '需要规划的开发目标' }
      },
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
      properties: {
        objective: { type: 'string', description: '具体的代码修改目标和验收要求' }
      },
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
      properties: {
        objective: { type: 'string', description: '测试范围或需要验证的行为' }
      },
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
      properties: {
        objective: { type: 'string', description: '审查范围和关注点' }
      },
      required: ['objective'],
      additionalProperties: false
    },
    risk: 'read',
    supportsStreaming: true
  }
]

const promptPrefixes: Record<string, string> = {
  'code.inspect': '只读检查当前项目，不要修改文件。请围绕以下目标分析并给出证据：',
  'code.plan': '处于规划阶段，不要修改文件。请分析项目并给出可执行计划：',
  'code.edit': '请在当前工作区完成以下代码任务，并执行必要验证：',
  'code.test': '请运行与目标相关的测试，分析结果，并在当前权限允许时修复问题：',
  'code.review': '请只读审查代码，不要修改文件。按严重程度报告具体问题：'
}

export class CapabilityRegistry {
  constructor(
    private readonly plugins: PluginManager,
    private readonly nativeTools = new NativeToolRegistry()
  ) {}

  async list(): Promise<RegisteredCapability[]> {
    const scan = await this.plugins.scan()
    const plugin = scan.plugins.find((item) => item.id === 'com.kova.claude-code')
    return [
      ...this.nativeTools.list(),
      ...claudeCapabilities.map((capability) => ({
        ...capability,
        pluginId: 'com.kova.claude-code',
        pluginName: 'Claude Code',
        available: plugin?.available ?? false,
        statusMessage: plugin?.statusMessage ?? 'Claude Code 插件未注册'
      }))
    ]
  }

  async execute(
    call: CapabilityCall,
    context: CapabilityExecutionContext
  ): Promise<CapabilityResult> {
    if (call.pluginId === CORE_TOOLS_PLUGIN_ID) {
      const output = await this.nativeTools.execute(call, {
        workspace: context.workspace,
        signal: context.signal
      })
      return {
        callId: call.id,
        status: 'completed',
        output,
        artifactIds: []
      }
    }

    const capability = claudeCapabilities.find((item) => item.id === call.capabilityId)
    if (call.pluginId !== 'com.kova.claude-code' || !capability) {
      throw new Error(`未注册的能力：${call.pluginId}/${call.capabilityId}`)
    }
    this.validateArguments(capability, call.arguments)
    if (
      context.permissionMode === 'plan' &&
      (capability.risk === 'write' || capability.risk === 'execute')
    ) {
      throw new Error(`规划权限不能调用 ${capability.id}`)
    }

    const plugin = await this.plugins.getRunnableAgent('claude')
    await plugin.runtime.validateWorkspace?.(context.workspace, plugin.executablePath)
    const objective = String(call.arguments.objective)
    const messages: string[] = []
    let nativeSessionId: string | undefined

    await plugin.runtime.run({
      prompt: `${promptPrefixes[capability.id]}\n\n${objective}`,
      workspace: context.workspace,
      executablePath: plugin.executablePath,
      permissionMode: context.permissionMode,
      nativeSessionId,
      signal: context.signal,
      emit: async (type, text, metadata) => {
        if (type === 'agent_message') messages.push(text)
        await context.emit(
          type === 'error' ? 'error' : 'cli_output',
          text,
          { ...metadata, pluginId: call.pluginId, capabilityId: call.capabilityId, sourceType: type }
        )
      },
      setNativeSessionId: async (value) => {
        nativeSessionId = value
      }
    })

    return {
      callId: call.id,
      status: 'completed',
      output: {
        text: messages.join('\n\n') || 'Claude Code 已完成调用',
        nativeSessionId
      },
      artifactIds: []
    }
  }

  private validateArguments(
    capability: CapabilityDefinition,
    value: Record<string, unknown>
  ): void {
    if (!value || typeof value !== 'object') throw new Error(`${capability.id} 参数必须是对象`)
    if (typeof value.objective !== 'string' || !value.objective.trim()) {
      throw new Error(`${capability.id} 缺少有效的 objective`)
    }
  }
}
