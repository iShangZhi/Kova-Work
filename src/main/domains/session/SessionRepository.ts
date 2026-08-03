import type { AgentSession, AgentEvent, SessionWithEvents } from '../../../shared/contracts'
import type { JsonStore } from '../../infrastructure/persistence/JsonStore'

interface SessionState {
  sessions: AgentSession[]
  events: AgentEvent[]
}

export class SessionRepository {
  constructor(private store: JsonStore<SessionState>) {}

  async list(): Promise<AgentSession[]> {
    const state = this.store.getState()
    return [...state.sessions].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }

  async findById(sessionId: string): Promise<SessionWithEvents | null> {
    const state = this.store.getState()
    const session = state.sessions.find((s) => s.id === sessionId)
    if (!session) return null

    const events = state.events.filter((e) => e.sessionId === sessionId)
    return { session, events }
  }

  async save(session: AgentSession): Promise<void> {
    this.store.setState((state) => {
      const index = state.sessions.findIndex((s) => s.id === session.id)
      if (index >= 0) {
        state.sessions[index] = session
      } else {
        state.sessions.push(session)
      }
    })
  }

  async appendEvent(event: AgentEvent): Promise<void> {
    this.store.setState((state) => {
      state.events.push(event)
    })
  }

  async delete(sessionId: string): Promise<void> {
    this.store.setState((state) => {
      state.sessions = state.sessions.filter((s) => s.id !== sessionId)
      state.events = state.events.filter((e) => e.sessionId !== sessionId)
    })
  }
}
