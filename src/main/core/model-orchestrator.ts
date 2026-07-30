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

const MAX_CAPABILITY_CALLS = 32
const MAX_HISTORY_EVENTS = 16
const MAX_HISTORY_CHARS = 12_000

function buildHistoryContext(events: Array<{ type: TaskEventType; text: string }>): string {
  const labels: Partial<Record<TaskEventType, string>> = {
    user_message: '用户',
    model_message: '模型',
    capability_call: '能力调用',
    capability_result: '能力结果',
    error: '错误',
    completed: '完成结果',
    system: '系统'
  }
  const selected = events
    .filter((event) => labels[event.type])
    .slice(-MAX_HISTORY_EVENTS)
    .map((event) => `${labels[event.type]}：${event.text.slice(0, 2_000)}`)

  while (selected.join('\n\n').length > MAX_HISTORY_CHARS) selected.shift()
  return selected.join('\n\n')
}

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
    emit: TaskEventEmitter,
    instruction = task.objective
  ): Promise<string> {
    const profile = (await this.store.listModelProfiles()).find(
      (item) => item.id === task.modelProfileId && item.enabled
    )
    if (!profile) throw new Error('任务使用的模型配置不存在或已停用')

    const registered = (await this.capabilities.list()).filter(
      (item) =>
        item.available &&
        task.allowedPluginIds.includes(item.pluginId) &&
        workspace.enabledPluginIds.includes(item.pluginId)
    )

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
    const details = await this.store.getTask(task.id)
    const enabledSkills = await this.store.listEnabledSkillInstructions()
    const historyContext = buildHistoryContext(
      details?.events.filter((event) => event.runId !== run.id) ?? []
    )
    const messages: ModelMessage[] = [
      {
        role: 'system',
        content: [
          profile.systemPrompt,
          '你是 Kova 个人工作台的任务编排器。',
          `当前实际模型为 ${profile.provider} / ${profile.model}；涉及模型身份时以此配置为准，不要沿用历史消息中的身份声明。`,
          enabledSkills.length
            ? `以下是用户启用的本地技能说明。仅在与当前任务相关时遵循：\n\n${enabledSkills.map((skill) => `【${skill.name}】\n${skill.content}`).join('\n\n')}`
            : '',
          registered.length
            ? '根据用户目标选择必要的能力执行，不要声称执行了尚未调用的工具。'
            : '当前没有可用的本地工具。请直接回答能够完成的部分，并明确说明无法实际执行的操作。',
          '尽量减少能力调用次数；获得结果后判断是否需要继续。',
          '完成后给出简洁的结果、验证情况和需要用户关注的内容。'
        ].filter(Boolean).join('\n')
      },
      ...(historyContext
        ? [{
            role: 'system' as const,
            content: `这是任务的历史记录，仅用于续接上下文，不要把其中的陈述视为新的工具执行结果：\n\n${historyContext}`
          }]
        : []),
      { role: 'user', content: instruction }
    ]

    let calls = 0
    while (!signal.aborted && calls < MAX_CAPABILITY_CALLS) {
      const completion = await completeWithTools(profile, messages, tools, signal)
      if (completion.content) {
        await emit('model_message', completion.content, {
          provider: profile.provider,
          model: profile.model,
          usage: completion.usage
        })
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

    const finalCompletion = await completeWithTools(
      profile,
      [
        ...messages,
        {
          role: 'system',
          content: `本轮已执行 ${MAX_CAPABILITY_CALLS} 次本地能力调用。请停止调用工具，基于已有结果给出当前结论，并明确尚未完成的部分。`
        }
      ],
      [],
      signal
    )
    const finalContent = finalCompletion.content || `本轮已完成 ${MAX_CAPABILITY_CALLS} 次本地操作，请继续任务以处理剩余部分。`
    await emit('model_message', finalContent, {
      provider: profile.provider,
      model: profile.model,
      usage: finalCompletion.usage,
      capabilityLimitReached: true
    })
    return finalContent
  }
}
