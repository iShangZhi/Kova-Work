import { spawn } from 'node:child_process'

export interface ProcessResult {
  code: number | null
  stdout: string
  stderr: string
}

export function runProcess(
  command: string,
  args: string[],
  options: {
    cwd?: string
    signal?: AbortSignal
    timeoutMs?: number
    maxOutputBytes?: number
  } = {}
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController()
    const abortFromCaller = (): void => controller.abort(options.signal?.reason)
    options.signal?.addEventListener('abort', abortFromCaller, { once: true })
    if (options.signal?.aborted) abortFromCaller()
    const timeout = options.timeoutMs
      ? setTimeout(() => controller.abort(), options.timeoutMs)
      : undefined
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: process.env,
      signal: controller.signal,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stdout = ''
    let stderr = ''
    let settled = false

    const cleanup = (): void => {
      if (timeout) clearTimeout(timeout)
      options.signal?.removeEventListener('abort', abortFromCaller)
    }

    const fail = (error: Error): void => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    }

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
      if (options.maxOutputBytes && stdout.length + stderr.length > options.maxOutputBytes) {
        controller.abort()
        fail(new Error(`进程输出超过 ${options.maxOutputBytes} 字节限制`))
      }
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
      if (options.maxOutputBytes && stdout.length + stderr.length > options.maxOutputBytes) {
        controller.abort()
        fail(new Error(`进程输出超过 ${options.maxOutputBytes} 字节限制`))
      }
    })
    child.on('error', (error) => {
      if (controller.signal.aborted && options.timeoutMs && !options.signal?.aborted) {
        fail(new Error(`进程执行超时（${options.timeoutMs}ms）`))
      } else {
        fail(error)
      }
    })
    child.on('close', (code) => {
      if (settled) return
      settled = true
      cleanup()
      resolve({ code, stdout, stderr })
    })
  })
}

export async function detectCommand(command: string): Promise<{ available: boolean; version?: string }> {
  try {
    const result = await runProcess(command, ['--version'])
    if (result.code !== 0) return { available: false }
    return { available: true, version: result.stdout.trim() || result.stderr.trim() }
  } catch {
    return { available: false }
  }
}
