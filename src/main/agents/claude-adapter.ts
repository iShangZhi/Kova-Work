import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import type { AgentEventType } from '../../shared/contracts'
import { runProcess } from './process-utils'
import type { AdapterRunInput, AgentAdapter } from './types'

type ClaudeJson = Record<string, unknown>

function textFromContent(value: unknown): string {
  if (typeof value === 'string') return value
  if (!Array.isArray(value)) return ''

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return ''
      const block = item as Record<string, unknown>
      if (block.type === 'text' && typeof block.text === 'string') return block.text
      if (block.type === 'tool_use' && typeof block.name === 'string') return `调用工具：${block.name}`
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

function normalizeClaudeEvent(payload: ClaudeJson): {
  type: AgentEventType
  text: string
  metadata?: Record<string, unknown>
} | null {
  const eventType = payload.type
  const subtype = payload.subtype

  if (eventType === 'system' && subtype === 'init') {
    return { type: 'system', text: 'Claude Code 会话已初始化', metadata: payload }
  }

  if (eventType === 'assistant') {
    const message = payload.message as Record<string, unknown> | undefined
    const text = textFromContent(message?.content)
    return text ? { type: 'agent_message', text, metadata: payload } : null
  }

  if (eventType === 'tool') {
    return { type: 'tool', text: String(payload.name ?? 'Claude Code 工具调用'), metadata: payload }
  }

  if (eventType === 'result') {
    return null
  }

  return null
}

export class ClaudeAdapter implements AgentAdapter {
  async validateWorkspace(workspace: string, executablePath = 'claude'): Promise<void> {
    try {
      const result = await runProcess(executablePath, ['--version'], { cwd: workspace })
      if (result.code !== 0) {
        throw new Error(result.stderr || result.stdout)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('EPERM') || message.includes('must be readable')) {
        throw new Error(
          '无法在所选目录启动 Claude Code。该目录受到 macOS 文件权限保护，请改选代码项目目录；若必须使用“下载”目录，请先在“系统设置 → 隐私与安全性 → 文件与文件夹”中授权。'
        )
      }
      throw new Error(`无法在所选目录启动 Claude Code：${message}`)
    }
  }

  async run(input: AdapterRunInput): Promise<void> {
    const baseArgs = [
      '--print',
      '--verbose',
      '--output-format',
      'stream-json',
      '--permission-mode',
      input.permissionMode
    ]

    if (input.nativeSessionId) baseArgs.push('--resume', input.nativeSessionId)
    const args = [...baseArgs]
    if (input.claudeAgent) args.push('--agent', input.claudeAgent)
    args.push(input.prompt)

    try {
      await this.execute(input, args)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!input.claudeAgent || !message.includes('not found') || !message.includes('--agent')) {
        throw error
      }
      await input.emit(
        'system',
        `Claude Agent“${input.claudeAgent}”不存在，已自动改用默认 Agent`
      )
      await this.execute(input, [...baseArgs, input.prompt])
    }
  }

  private async execute(input: AdapterRunInput, args: string[]): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(input.executablePath ?? 'claude', args, {
        cwd: input.workspace,
        env: process.env,
        signal: input.signal,
        stdio: ['ignore', 'pipe', 'pipe']
      })
      const lines = createInterface({ input: child.stdout })
      let stderr = ''
      let resultError = ''
      let eventQueue = Promise.resolve()

      lines.on('line', (line) => {
        eventQueue = eventQueue.then(async () => {
          try {
            const payload = JSON.parse(line) as ClaudeJson
            if (payload.type === 'result' && payload.subtype !== 'success') {
              resultError =
                typeof payload.result === 'string' ? payload.result : 'Claude Code 执行失败'
            }
            if (typeof payload.session_id === 'string') {
              await input.setNativeSessionId(payload.session_id)
            }
            const normalized = normalizeClaudeEvent(payload)
            if (normalized) await input.emit(normalized.type, normalized.text, normalized.metadata)
          } catch {
            if (line.trim()) await input.emit('progress', line.trim())
          }
        })
      })

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString()
      })
      child.on('error', reject)
      child.on('close', (code) => {
        void eventQueue.then(() => {
          if (code === 0 && !resultError) resolve()
          else reject(
            new Error(
              resultError || stderr.trim() || `Claude Code 已退出，状态码 ${String(code)}`
            )
          )
        })
      })
    })
  }
}
