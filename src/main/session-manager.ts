import { randomUUID } from 'node:crypto'
import type { BrowserWindow } from 'electron'
import type {
  AgentEvent,
  AgentEventType,
  AgentSession,
  ContinueSessionInput,
  RenameSessionInput,
  StartSessionInput
} from '../shared/types'
import type { RunningSession } from './agents/types'
import { PluginManager } from './plugins/plugin-manager'
import { completeWithModel } from './model-client'
import type { ModelService } from './domains/model/ModelService'
import type { SessionService } from './domains/session/SessionService'

export class SessionManager {
  private running = new Map<string, RunningSession>()
  private queuedPrompts = new Map<string, string[]>()
  private deleted = new Set<string>()

  constructor(
    private readonly sessionService: SessionService,
    private readonly plugins: PluginManager,
    private readonly modelService: ModelService,
    private readonly getWindow: () => BrowserWindow | null
  ) {}

  async start(input: StartSessionInput): Promise<AgentSession> {
    if (input.agentId !== 'model') {
      const plugin = await this.plugins.getRunnableAgent(input.agentId)
      await plugin.runtime.validateWorkspace?.(input.workspace, plugin.executablePath)
    } else if (!input.modelProfileId) {
      throw new Error('请选择模型配置')
    }

    const now = new Date().toISOString()
    const session: AgentSession = {
      id: randomUUID(),
      title: input.prompt.trim().slice(0, 48) || '新会话',
      agentId: input.agentId,
      workspace: input.workspace,
      permissionMode: input.permissionMode,
      workflowStage: input.workflowStage,
      claudeAgent: input.claudeAgent,
      claudePromptPrefix: input.claudePromptPrefix,
      modelProfileId: input.modelProfileId,
      status: 'running',
      createdAt: now,
      updatedAt: now
    }

    await this.sessionService.save(session)
    await this.emit(session, 'user_message', input.prompt)
    void this.run(session, input.prompt)
    return session
  }

  async continue(input: ContinueSessionInput): Promise<void> {
    const stored = await this.sessionService.getById(input.sessionId)
    if (!stored) throw new Error('找不到对应会话')
    if (this.running.has(input.sessionId)) {
      const queue = this.queuedPrompts.get(input.sessionId) ?? []
      queue.push(input.prompt)
      this.queuedPrompts.set(input.sessionId, queue)
      await this.emit(stored.session, 'progress', `已排队：${input.prompt}`, { queued: true, queuePosition: queue.length })
      return
    }
    if (stored.session.agentId !== 'model') {
      const plugin = await this.plugins.getRunnableAgent(stored.session.agentId)
      await plugin.runtime.validateWorkspace?.(stored.session.workspace, plugin.executablePath)
    }

    const session = { ...stored.session, status: 'running' as const, updatedAt: new Date().toISOString() }
    await this.sessionService.save(session)
    await this.emit(session, 'user_message', input.prompt)
    void this.run(session, input.prompt)
  }

  async cancel(sessionId: string): Promise<void> {
    const running = this.running.get(sessionId)
    if (!running) return
    running.controller.abort()
    this.queuedPrompts.delete(sessionId)
    running.session.status = 'cancelled'
    running.session.updatedAt = new Date().toISOString()
    await this.sessionService.save(running.session)
    await this.emit(running.session, 'system', '运行已由用户终止')
  }

  async rename(input: RenameSessionInput): Promise<AgentSession> {
    const session = await this.sessionService.rename(input)
    const running = this.running.get(input.sessionId)
    if (running) running.session.title = session.title
    return session
  }

  async delete(sessionId: string): Promise<void> {
    this.deleted.add(sessionId)
    const running = this.running.get(sessionId)
    if (running) {
      running.controller.abort()
      this.running.delete(sessionId)
    }
    this.queuedPrompts.delete(sessionId)
    await this.sessionService.delete(sessionId)
    if (!running) this.deleted.delete(sessionId)
  }

  private async run(session: AgentSession, prompt: string): Promise<void> {
    const controller = new AbortController()
    this.running.set(session.id, { session, controller })

    try {
      let nextPrompt: string | undefined = prompt
      while (nextPrompt && !controller.signal.aborted) {
        if (session.agentId === 'model') {
          const model = await this.modelService.getModelProfile(session.modelProfileId!)
          if (!model) throw new Error('会话使用的模型配置已不存在')
          const stored = await this.sessionService.getById(session.id)
          const history = (stored?.events ?? [])
            .filter((event) => event.type === 'user_message' || event.type === 'agent_message')
            .slice(-30)
            .map((event) => ({ role: event.type === 'user_message' ? 'user' as const : 'assistant' as const, content: event.text }))
          const messages = [
            ...(model.systemPrompt ? [{ role: 'system' as const, content: model.systemPrompt }] : []),
            ...history
          ]
          const text = await completeWithModel(model, messages, controller.signal)
          await this.emit(session, 'agent_message', text || '模型返回了空内容')
        } else {
          const plugin = await this.plugins.getRunnableAgent(session.agentId)
          await plugin.runtime.run({
            prompt: session.claudePromptPrefix ? `${session.claudePromptPrefix}\n\n用户任务：\n${nextPrompt}` : nextPrompt,
            workspace: session.workspace,
            executablePath: plugin.executablePath,
            permissionMode: session.permissionMode,
            workflowStage: session.workflowStage,
            claudeAgent: session.claudeAgent,
            nativeSessionId: session.nativeSessionId,
            signal: controller.signal,
            emit: (type, text, metadata) => this.emit(session, type, text, metadata),
            setNativeSessionId: async (nativeSessionId) => {
              session.nativeSessionId = nativeSessionId
              session.updatedAt = new Date().toISOString()
              await this.sessionService.save(session)
            }
          })
        }
        nextPrompt = this.queuedPrompts.get(session.id)?.shift()
        if (nextPrompt) {
          await this.emit(session, 'system', '开始处理下一条排队指令')
          await this.emit(session, 'user_message', nextPrompt)
        }
      }
      if (!controller.signal.aborted) {
        session.status = 'completed'
        await this.emit(session, 'completed', '本轮运行已完成')
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        session.status = 'failed'
        await this.emit(session, 'error', error instanceof Error ? error.message : String(error))
      }
    } finally {
      if (!this.deleted.has(session.id)) {
        session.updatedAt = new Date().toISOString()
        await this.sessionService.save(session)
      } else {
        this.deleted.delete(session.id)
      }
      this.running.delete(session.id)
      this.queuedPrompts.delete(session.id)
    }
  }

  private async emit(
    session: AgentSession,
    type: AgentEventType,
    text: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    if (this.deleted.has(session.id)) return
    const event: AgentEvent = {
      id: randomUUID(),
      sessionId: session.id,
      type,
      text,
      createdAt: new Date().toISOString(),
      metadata
    }
    await this.sessionService.appendEvent(event)
    this.getWindow()?.webContents.send('agent:event', event)
  }
}
