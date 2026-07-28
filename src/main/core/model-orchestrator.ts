import { randomUUID } from 'node:crypto'
import type {
  CapabilityCall,
  CapabilityResult,
  Task,
  TaskEventType,
  TaskRun,
  Workspace
} from '../../shared/contracts'
import { completeWithTools, type ModelMessage, type ModelTool } from '../model-client'
import { SessionStore } from '../storage'
import { CapabilityRegistry } from './capability-registry'

const MAX_CAPABILITY_CALLS = 8

export type TaskEventEmitter = (
  type: TaskEventType,
  text: string,
  metadata?: Record<string, unknown>
) => Promise<void>

export class ModelOrchestrator {
  constructor(
    private readonly store: SessionStore,
    private readonly capabilities: CapabilityRegistry
  ) {}

  async run(
    task: Task,
    run: TaskRun,
    workspace: Workspace,
    signal: AbortSignal,
    emit: TaskEventEmitter
  ): Promise<string> {
    const profile = (await this.store.listModelProfiles()).find(
      (item) => item.id === task.modelProfileId && item.enabled
    )
    if (!profile) throw new Error('任务使用的模型配置不存在或已停用')

    const registered = (await this.capabilities.list()).filter(
      (item) => item.available && task.allowedPluginIds.includes(item.pluginId)
    )
    if (!registered.length) throw new Error('当前任务没有可用的插件能力')

    const toolToCapability = new Map(
      registered.map((capability) => [
        capability.id.replaceAll('.', '__'),
        capability
      ])
    )
    const tools: ModelTool[] = registered.map((capability) => ({
      type: 'function',
      function: {
        name: capability.id.replaceAll('.', '__'),
        description: `${capability.description} 风险级别：${capability.risk}。`,
        parameters: capability.inputSchema
      }
    }))
    const messages: ModelMessage[] = [
      {
        role: 'system',
        content: [
          profile.systemPrompt,
          '你是 Kova 个人工作台的任务编排器。',
          '根据用户目标选择必要的能力执行，不要声称执行了尚未调用的工具。',
          '尽量减少能力调用次数；获得结果后判断是否需要继续。',
          '完成后给出简洁的结果、验证情况和需要用户关注的内容。'
        ].filter(Boolean).join('\n')
      },
      { role: 'user', content: task.objective }
    ]

    let calls = 0
    while (!signal.aborted && calls < MAX_CAPABILITY_CALLS) {
      const completion = await completeWithTools(profile, messages, tools, signal)
      if (completion.content) {
        await emit('model_message', completion.content)
      }
      if (!completion.toolCalls.length) {
        return completion.content || '任务已完成'
      }

      messages.push({
        role: 'assistant',
        content: completion.content || null,
        tool_calls: completion.toolCalls
      })

      for (const toolCall of completion.toolCalls) {
        if (calls >= MAX_CAPABILITY_CALLS) break
        calls += 1
        const capability = toolToCapability.get(toolCall.function.name)
        let result: CapabilityResult

        if (!capability) {
          result = {
            callId: toolCall.id,
            status: 'failed',
            error: `模型请求了未授权能力：${toolCall.function.name}`
          }
        } else {
          let args: Record<string, unknown>
          try {
            const parsed = JSON.parse(toolCall.function.arguments) as unknown
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
              throw new Error('能力参数必须是对象')
            }
            args = parsed as Record<string, unknown>
          } catch (error) {
            result = {
              callId: toolCall.id,
              status: 'failed',
              error: `能力参数不是有效 JSON：${error instanceof Error ? error.message : String(error)}`
            }
            await emit('capability_result', result.error ?? '能力参数无效', { result })
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(result)
            })
            continue
          }

          const call: CapabilityCall = {
            id: randomUUID(),
            taskId: task.id,
            runId: run.id,
            pluginId: capability.pluginId,
            capabilityId: capability.id,
            arguments: args
          }
          await emit(
            'capability_call',
            `调用 ${capability.name}`,
            { call, risk: capability.risk }
          )

          try {
            result = await this.capabilities.execute(call, {
              workspace: workspace.path,
              permissionMode: task.permissionMode,
              signal,
              emit
            })
          } catch (error) {
            result = {
              callId: call.id,
              status: signal.aborted ? 'cancelled' : 'failed',
              error: error instanceof Error ? error.message : String(error)
            }
          }
        }

        await emit(
          'capability_result',
          result.status === 'completed'
            ? '能力调用已完成'
            : result.error ?? `能力调用${result.status}`,
          { result }
        )
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        })
      }
    }

    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
    throw new Error(`任务已达到单轮最大能力调用次数（${MAX_CAPABILITY_CALLS}）`)
  }
}
