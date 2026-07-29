import type { ModelProfile, ModelProviderId } from '../../shared/contracts'
import { OpenAICompatibleProvider } from './openai-compatible-provider'
import type { ModelProvider } from './types'

export class ModelProviderRegistry {
  private readonly providers: Map<ModelProviderId, ModelProvider>

  constructor(providers: ModelProvider[] = [new OpenAICompatibleProvider()]) {
    this.providers = new Map(providers.map((provider) => [provider.id, provider]))
  }

  getForProfile(profile: ModelProfile): ModelProvider {
    // Profiles created before the provider layer existed are OpenAI-compatible.
    const providerId = profile.provider ?? 'openai-compatible'
    const provider = this.providers.get(providerId)
    if (!provider) throw new Error(`模型 Provider 未注册：${providerId}`)
    return provider
  }

  list(): ModelProvider[] {
    return [...this.providers.values()]
  }
}
