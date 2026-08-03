// Model 相关类型定义

export type ModelProviderId = 'openai-compatible'

export interface ModelProfile {
  id: string
  name: string
  provider: ModelProviderId
  baseUrl: string
  model: string
  apiKey?: string
  systemPrompt?: string
  temperature?: number
  requestTimeoutMs?: number
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface SaveModelProfileInput {
  id?: string
  name: string
  provider?: ModelProviderId
  baseUrl: string
  model: string
  apiKey?: string
  systemPrompt?: string
  temperature?: number
  requestTimeoutMs?: number
  enabled?: boolean
}

export interface ModelChatInput {
  profileId: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
}
