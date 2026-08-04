import type { ClaudeWorkflowProfile } from '../../../shared/types'
import type { JsonStore } from '../../infrastructure/persistence/JsonStore'

export interface WorkflowState {
  workflowProfiles: ClaudeWorkflowProfile[]
}

export const emptyWorkflowState = (): WorkflowState => ({ workflowProfiles: [] })

/**
 * WorkflowRepository - Claude 工作流数据存取
 */
export class WorkflowRepository {
  constructor(private readonly store: JsonStore<WorkflowState>) {}

  async list(): Promise<ClaudeWorkflowProfile[]> {
    return [...this.store.snapshot().workflowProfiles]
  }

  async findById(id: string): Promise<ClaudeWorkflowProfile | null> {
    return this.store.snapshot().workflowProfiles.find((w) => w.id === id) ?? null
  }

  async save(profile: ClaudeWorkflowProfile): Promise<void> {
    await this.store.setState((state) => {
      const index = state.workflowProfiles.findIndex((w) => w.id === profile.id)
      if (index >= 0) state.workflowProfiles[index] = profile
      else state.workflowProfiles.push(profile)
    })
  }

  async saveMany(profiles: ClaudeWorkflowProfile[]): Promise<void> {
    await this.store.setState((state) => {
      state.workflowProfiles.push(...profiles)
    })
  }

  async delete(id: string): Promise<void> {
    await this.store.setState((state) => {
      state.workflowProfiles = state.workflowProfiles.filter((w) => w.id !== id)
    })
  }

  isEmpty(): boolean {
    return this.store.snapshot().workflowProfiles.length === 0
  }
}
