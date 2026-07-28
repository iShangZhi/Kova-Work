import { spawn } from 'node:child_process'

export interface ProcessResult {
  code: number | null
  stdout: string
  stderr: string
}

export function runProcess(
  command: string,
  args: string[],
  options: { cwd?: string; signal?: AbortSignal } = {}
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: process.env,
      signal: options.signal,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => resolve({ code, stdout, stderr }))
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
