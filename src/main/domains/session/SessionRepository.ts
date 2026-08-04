import type { AgentSession, AgentEvent, SessionWithEvents } from '../../../shared/types'
import type { JsonStore } from '../../infrastructure/persistence/JsonStore'

export interface SessionState {
  sessions: AgentSession[]
  events: AgentEvent[]
}

export const emptySessionState = (): SessionState => ({ sessions: [], events: [] })

/**
 * SessionRepository - 会话数据存取
 */
export class SessionRepository {
  constructor(private readonly store: JsonStore<SessionState>) {}

  async list(): Promise<AgentSession[]> {
    return [...this.store.snapshot().sessions].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    )
  }

  async findById(sessionId: string): Promise<SessionWithEvents | null> {
    const state = this.store.snapshot()
    const session = state.sessions.find((s) => s.id === sessionId)
    if (!session) return null
    return { session, events: state.events.filter((e) => e.sessionId === sessionId) }
  }

  async save(session: AgentSession): Promise<void> {
    await this.store.setState((state) => {
      const index = state.sessions.findIndex((s) => s.id === session.id)
      if (index >= 0) state.sessions[index] = session
      else state.sessions.push(session)
    })
  }

  async appendEvent(event: AgentEvent): Promise<void> {
    await this.store.setState((state) => {
      state.events.push(event)
    })
  }

  async delete(sessionId: string): Promise<void> {
    await this.store.setState((state) => {
      state.sessions = state.sessions.filter((s) => s.id !== sessionId)
      state.events = state.events.filter((e) => e.sessionId !== sessionId)
    })
  }
}
