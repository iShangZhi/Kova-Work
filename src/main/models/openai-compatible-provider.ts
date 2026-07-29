import type { ModelProfile } from '../../shared/contracts'
import type {
  ModelCompletion,
  ModelCompletionRequest,
  ModelProvider,
  ModelToolCall
} from './types'

const DEFAULT_TIMEOUT_MS = 120_000
const MAX_RESPONSE_CHARACTERS = 10 * 1024 * 1024
const MAX_ERROR_CHARACTERS = 2_000

interface OpenAICompatiblePayload {
  choices?: Array<{
    message?: {
      content?: string | null
      tool_calls?: unknown
    }
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

function completionUrl(profile: ModelProfile): string {
  let baseUrl: URL
  try {
    baseUrl = new URL(profile.baseUrl)
  } catch {
    throw new Error('模型接口地址不是有效 URL')
  }
  if (baseUrl.protocol !== 'http:' && baseUrl.protocol !== 'https:') {
    throw new Error('模型接口地址仅支持 HTTP 或 HTTPS')
  }
  return `${baseUrl.toString().replace(/\/$/, '')}/chat/completions`
}

function normalizeToolCalls(value: unknown): ModelToolCall[] {
  if (value == null) return []
  if (!Array.isArray(value)) throw new Error('模型响应中的 tool_calls 不是数组')

  return value.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`模型响应中的第 ${index + 1} 个工具调用无效`)
    }
    const candidate = item as {
      id?: unknown
      type?: unknown
      function?: { name?: unknown; arguments?: unknown }
    }
    if (
      typeof candidate.id !== 'string' ||
      (candidate.type != null && candidate.type !== 'function') ||
      typeof candidate.function?.name !== 'string' ||
      typeof candidate.function.arguments !== 'string'
    ) {
      throw new Error(`模型响应中的第 ${index + 1} 个工具调用字段不完整`)
    }
    return {
      id: candidate.id,
      type: 'function',
      function: {
        name: candidate.function.name,
        arguments: candidate.function.arguments
      }
    }
  })
}

async function readBoundedResponse(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_CHARACTERS) {
    throw new Error('模型响应过大，已拒绝读取')
  }
  const text = await response.text()
  if (text.length > MAX_RESPONSE_CHARACTERS) {
    throw new Error('模型响应过大，已拒绝处理')
  }
  return text
}

export class OpenAICompatibleProvider implements ModelProvider {
  readonly id = 'openai-compatible' as const
  readonly name = 'OpenAI Compatible'
  readonly capabilities = {
    tools: true,
    parallelToolCalls: true,
    streaming: false,
    reasoning: false,
    vision: false,
    jsonSchema: false
  } as const

  async complete(request: ModelCompletionRequest): Promise<ModelCompletion> {
    const controller = new AbortController()
    let timedOut = false
    const timeoutMs = request.profile.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS
    const timeout = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeoutMs)
    const abortFromCaller = (): void => controller.abort(request.signal?.reason)
    request.signal?.addEventListener('abort', abortFromCaller, { once: true })
    if (request.signal?.aborted) abortFromCaller()

    try {
      const response = await fetch(completionUrl(request.profile), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(request.profile.apiKey
            ? { Authorization: `Bearer ${request.profile.apiKey}` }
            : {})
        },
        body: JSON.stringify({
          model: request.profile.model,
          messages: request.messages,
          stream: false,
          ...(request.tools?.length
            ? { tools: request.tools, tool_choice: 'auto' }
            : {}),
          ...(request.profile.temperature == null
            ? {}
            : { temperature: request.profile.temperature })
        }),
        signal: controller.signal
      })
      const responseText = await readBoundedResponse(response)
      if (!response.ok) {
        throw new Error(
          `模型请求失败：${response.status} ${responseText.slice(0, MAX_ERROR_CHARACTERS)}`
        )
      }

      let payload: OpenAICompatiblePayload
      try {
        payload = JSON.parse(responseText) as OpenAICompatiblePayload
      } catch {
        throw new Error('模型返回的内容不是有效 JSON')
      }
      const message = payload.choices?.[0]?.message
      if (!message) throw new Error('模型响应缺少 choices[0].message')
      if (message.content != null && typeof message.content !== 'string') {
        throw new Error('模型响应中的 content 不是字符串')
      }

      return {
        content: message.content?.trim() ?? '',
        toolCalls: normalizeToolCalls(message.tool_calls),
        usage: payload.usage
          ? {
              inputTokens: payload.usage.prompt_tokens,
              outputTokens: payload.usage.completion_tokens,
              totalTokens: payload.usage.total_tokens
            }
          : undefined
      }
    } catch (error) {
      if (timedOut) {
        throw new Error(`模型请求超时（${timeoutMs}ms）`)
      }
      throw error
    } finally {
      clearTimeout(timeout)
      request.signal?.removeEventListener('abort', abortFromCaller)
    }
  }
}
