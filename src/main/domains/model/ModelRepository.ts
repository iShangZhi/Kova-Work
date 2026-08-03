import type { ModelProfile, SaveModelProfileInput } from '../../../shared/contracts'
import type { JsonStore } from '../../infrastructure/persistence/JsonStore'
import { randomUUID } from 'node:crypto'

interface ModelState {
  modelProfiles: ModelProfile[]
}

export class ModelRepository {
  constructor(private store: JsonStore<ModelState>) {}

  async list(): Promise<ModelProfile[]> {
    const state = this.store.getState()
    return [...state.modelProfiles]
  }

  async findById(id: string): Promise<ModelProfile | null> {
    const state = this.store.getState()
    return state.modelProfiles.find((m) => m.id === id) ?? null
  }

  async save(input: SaveModelProfileInput): Promise<ModelProfile> {
    let result: ModelProfile | null = null

    this.store.setState((state) => {
      const now = new Date().toISOString()

      if (input.id) {
        const existing = state.modelProfiles.find((m) => m.id === input.id)
        if (existing) {
          Object.assign(existing, {
            name: input.name,
            provider: input.provider ?? 'openai-compatible',
            model: input.model,
            apiKey: input.apiKey,
            baseUrl: input.baseUrl,
            systemPrompt: input.systemPrompt,
            temperature: input.temperature,
            requestTimeoutMs: input.requestTimeoutMs,
            enabled: input.enabled ?? true,
            updatedAt: now
          })
          result = existing
          return
        }
      }

      const profile: ModelProfile = {
        id: input.id ?? randomUUID(),
        name: input.name,
        provider: input.provider ?? 'openai-compatible',
        model: input.model,
        apiKey: input.apiKey,
        baseUrl: input.baseUrl,
        systemPrompt: input.systemPrompt,
        temperature: input.temperature,
        requestTimeoutMs: input.requestTimeoutMs,
        enabled: input.enabled ?? true,
        createdAt: now,
        updatedAt: now
      }
      state.modelProfiles.push(profile)
      result = profile
    })

    if (!result) throw new Error('Failed to save model profile')
    return result
  }

  async delete(id: string): Promise<void> {
    this.store.setState((state) => {
      state.modelProfiles = state.modelProfiles.filter((m) => m.id !== id)
    })
  }
}
