import type { ModelProfile } from '../shared/contracts'

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
}

async function requestCompletion(
  profile: ModelProfile,
  messages: ModelMessage[],
  tools?: ModelTool[],
  signal?: AbortSignal
): Promise<ModelCompletion> {
  const response = await fetch(`${profile.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(profile.apiKey ? { Authorization: `Bearer ${profile.apiKey}` } : {})
    },
    body: JSON.stringify({
      model: profile.model,
      messages,
      stream: false,
      ...(tools?.length ? { tools, tool_choice: 'auto' } : {}),
      ...(profile.temperature == null ? {} : { temperature: profile.temperature })
    }),
    signal
  })
  if (!response.ok) throw new Error(`模型请求失败：${response.status} ${await response.text()}`)
  const payload = await response.json() as {
    choices?: Array<{
      message?: {
        content?: string | null
        tool_calls?: ModelToolCall[]
      }
    }>
  }
  const message = payload.choices?.[0]?.message
  return {
    content: message?.content?.trim() ?? '',
    toolCalls: message?.tool_calls ?? []
  }
}

export async function completeWithModel(
  profile: ModelProfile,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  signal?: AbortSignal
): Promise<string> {
  const completion = await requestCompletion(profile, messages, undefined, signal)
  return completion.content
}

export async function completeWithTools(
  profile: ModelProfile,
  messages: ModelMessage[],
  tools: ModelTool[],
  signal?: AbortSignal
): Promise<ModelCompletion> {
  return requestCompletion(profile, messages, tools, signal)
}
