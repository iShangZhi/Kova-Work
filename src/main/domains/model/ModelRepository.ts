import type { ModelProfile } from '../../../shared/types'
import type { JsonStore } from '../../infrastructure/persistence/JsonStore'

export interface ModelStateShape {
  modelProfiles: ModelProfile[]
}

export const emptyModelState = (): ModelStateShape => ({ modelProfiles: [] })

/**
 * ModelRepository - 模型配置数据访问层
 */
export class ModelRepository {
  constructor(private readonly store: JsonStore<ModelStateShape>) {}

  async list(): Promise<ModelProfile[]> {
    return [...this.store.snapshot().modelProfiles].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    )
  }

  async findById(id: string): Promise<ModelProfile | null> {
    return this.store.snapshot().modelProfiles.find((p) => p.id === id) ?? null
  }

  async listEnabled(): Promise<ModelProfile[]> {
    return this.store.snapshot().modelProfiles.filter((p) => p.enabled)
  }

  async save(profile: ModelProfile): Promise<void> {
    await this.store.setState((state) => {
      const index = state.modelProfiles.findIndex((p) => p.id === profile.id)
      if (index >= 0) state.modelProfiles[index] = profile
      else state.modelProfiles.push(profile)
    })
  }

  async delete(id: string): Promise<void> {
    await this.store.setState((state) => {
      state.modelProfiles = state.modelProfiles.filter((p) => p.id !== id)
    })
  }
}
