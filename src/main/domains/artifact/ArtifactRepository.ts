import type { Artifact } from '../../../shared/types'
import type { JsonStore } from '../../infrastructure/persistence/JsonStore'

/**
 * Artifact 存储与 Task 同居一个 JsonStore（tasks.json 内的 artifacts 段）。
 * 见 TaskRepository.ts 里 TasksState 的完整形态。
 */
export interface ArtifactHolderState {
  artifacts: Artifact[]
}

export class ArtifactRepository {
  constructor(private readonly store: JsonStore<ArtifactHolderState>) {}

  async list(): Promise<Artifact[]> {
    return [...this.store.snapshot().artifacts]
  }

  async findByTaskId(taskId: string): Promise<Artifact[]> {
    return this.store.snapshot().artifacts.filter((a) => a.taskId === taskId)
  }

  async save(artifact: Artifact): Promise<void> {
    await this.store.setState((state) => {
      const index = state.artifacts.findIndex((a) => a.id === artifact.id)
      if (index >= 0) state.artifacts[index] = artifact
      else state.artifacts.push(artifact)
    })
  }

  async deleteByTaskId(taskId: string): Promise<void> {
    await this.store.setState((state) => {
      state.artifacts = state.artifacts.filter((a) => a.taskId !== taskId)
    })
  }
}
