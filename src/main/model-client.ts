import type { ModelProfile } from '../shared/contracts'
import { ModelProviderRegistry } from './models/provider-registry'
import type {
  ModelCompletion,
  ModelMessage,
  ModelTool
} from './models/types'

export type {
  ModelCompletion,
  ModelMessage,
  ModelProviderCapabilities,
  ModelTool,
  ModelToolCall
} from './models/types'

const providers = new ModelProviderRegistry()

export async function completeWithModel(
  profile: ModelProfile,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  signal?: AbortSignal
): Promise<string> {
  const completion = await providers.getForProfile(profile).complete({
    profile,
    messages,
    signal
  })
  return completion.content
}

export async function completeWithTools(
  profile: ModelProfile,
  messages: ModelMessage[],
  tools: ModelTool[],
  signal?: AbortSignal
): Promise<ModelCompletion> {
  return providers.getForProfile(profile).complete({
    profile,
    messages,
    tools,
    signal
  })
}
