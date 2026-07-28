import { access, realpath } from 'node:fs/promises'
import { constants } from 'node:fs'
import { delimiter, isAbsolute, join } from 'node:path'
import { runProcess } from '../agents/process-utils'
import type { PluginManifest } from './types'

export interface CliDetectionResult {
  found: boolean
  executablePath?: string
  version?: string
  error?: string
}

const standardPaths = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin']

async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

async function resolveExecutable(commands: string[]): Promise<string | null> {
  const pathEntries = [...(process.env.PATH?.split(delimiter) ?? []), ...standardPaths]
  const seen = new Set<string>()

  for (const command of commands) {
    const candidates = isAbsolute(command) ? [command] : pathEntries.map((entry) => join(entry, command))
    for (const candidate of candidates) {
      if (seen.has(candidate)) continue
      seen.add(candidate)
      if (await isExecutable(candidate)) {
        try {
          return await realpath(candidate)
        } catch {
          return candidate
        }
      }
    }
  }

  return null
}

export async function detectPluginCli(manifest: PluginManifest): Promise<CliDetectionResult> {
  if (manifest.kind === 'virtual-agent') {
    return { found: true, executablePath: 'built-in', version: 'built-in' }
  }

  if (!manifest.detection) return { found: false, error: '插件没有声明 CLI 检测规则' }
  const executablePath = await resolveExecutable(manifest.detection.commands)
  if (!executablePath) return { found: false }

  try {
    const result = await runProcess(executablePath, manifest.detection.versionArgs)
    const version = (result.stdout || result.stderr).trim()
    if (result.code !== 0) {
      return { found: true, executablePath, version, error: '版本检测命令执行失败' }
    }
    if (manifest.detection.versionPattern && !version.includes(manifest.detection.versionPattern)) {
      return { found: true, executablePath, version, error: 'CLI 版本输出与插件规则不匹配' }
    }
    return { found: true, executablePath, version }
  } catch (error) {
    return {
      found: true,
      executablePath,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
