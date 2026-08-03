import type { ClaudeWorkflowProfile, SaveClaudeWorkflowProfileInput } from '../../../shared/contracts'
import type { JsonStore } from '../../infrastructure/persistence/JsonStore'
import { randomUUID } from 'node:crypto'

interface WorkflowState {
  workflowProfiles: ClaudeWorkflowProfile[]
}

export class WorkflowRepository {
  constructor(private store: JsonStore<WorkflowState>) {}

  async list(): Promise<ClaudeWorkflowProfile[]> {
    const state = this.store.getState()
    return [...state.workflowProfiles]
  }

  async save(input: SaveClaudeWorkflowProfileInput): Promise<ClaudeWorkflowProfile> {
    let result: ClaudeWorkflowProfile | null = null
    const now = new Date().toISOString()

    this.store.setState((state) => {
      if (input.id) {
        const existing = state.workflowProfiles.find((w) => w.id === input.id)
        if (existing) {
          Object.assign(existing, {
            stage: input.stage,
            name: input.name,
            agentName: input.agentName,
            promptPrefix: input.promptPrefix,
            updatedAt: now
          })
          result = existing
          return
        }
      }

      const profile: ClaudeWorkflowProfile = {
        id: input.id ?? randomUUID(),
        stage: input.stage,
        name: input.name,
        agentName: input.agentName,
        promptPrefix: input.promptPrefix,
        enabled: true,
        createdAt: now,
        updatedAt: now
      }
      state.workflowProfiles.push(profile)
      result = profile
    })

    if (!result) throw new Error('Failed to save workflow profile')
    return result
  }

  async delete(id: string): Promise<void> {
    this.store.setState((state) => {
      state.workflowProfiles = state.workflowProfiles.filter((w) => w.id !== id)
    })
  }
}
