import type {
  AgentEvent,
  AgentSession,
  RenameSessionInput,
  SessionWithEvents
} from '../../../shared/types'
import type { SessionRepository } from './SessionRepository'
import { logger } from '../../infrastructure/logging/Logger'

/**
 * SessionService - 会话领域服务
 *
 * 说明：会话运行时（排队、AbortController、事件转发）仍由 SessionManager 负责。
 * 本服务只封装数据存取 + 校验类业务规则（rename 校验、getById 等）。
 */
export class SessionService {
  constructor(private readonly repository: SessionRepository) {}

  async list(): Promise<AgentSession[]> {
    return this.repository.list()
  }

  async getById(sessionId: string): Promise<SessionWithEvents | null> {
    return this.repository.findById(sessionId)
  }

  async save(session: AgentSession): Promise<void> {
    await this.repository.save(session)
  }

  async appendEvent(event: AgentEvent): Promise<void> {
    await this.repository.appendEvent(event)
  }

  async rename(input: RenameSessionInput): Promise<AgentSession> {
    const stored = await this.repository.findById(input.sessionId)
    if (!stored) throw new Error('找不到对应会话')
    const title = input.title.trim()
    if (!title) throw new Error('任务名称不能为空')
    const session: AgentSession = {
      ...stored.session,
      title: title.slice(0, 80),
      updatedAt: new Date().toISOString()
    }
    await this.repository.save(session)
    logger.info('Session renamed', { sessionId: session.id })
    return session
  }

  async delete(sessionId: string): Promise<void> {
    await this.repository.delete(sessionId)
    logger.info('Session deleted', { sessionId })
  }
}
