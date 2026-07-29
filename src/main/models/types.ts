import type { ModelProfile, ModelProviderId } from '../../shared/contracts'

export interface ModelToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export type ModelMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ModelToolCall[] }
  | { role: 'tool'; content: string; tool_call_id: string }

export interface ModelTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface ModelCompletion {
  content: string
  toolCalls: ModelToolCall[]
  usage?: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
  }
}

export interface ModelCompletionRequest {
  profile: ModelProfile
  messages: ModelMessage[]
  tools?: ModelTool[]
  signal?: AbortSignal
}

export interface ModelProviderCapabilities {
  tools: boolean
  parallelToolCalls: boolean
  streaming: boolean
  reasoning: boolean
  vision: boolean
  jsonSchema: boolean
}

export interface ModelProvider {
  readonly id: ModelProviderId
  readonly name: string
  readonly capabilities: ModelProviderCapabilities

  complete(request: ModelCompletionRequest): Promise<ModelCompletion>
}
