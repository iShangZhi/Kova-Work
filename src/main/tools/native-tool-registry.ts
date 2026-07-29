import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import type {
  CapabilityCall,
  RegisteredCapability
} from '../../shared/contracts'
import { runProcess } from '../agents/process-utils'
import type { NativeTool, NativeToolContext } from './types'
import {
  resolveWorkspacePath,
  resolveWorkspaceRoot
} from './workspace-boundary'

export const CORE_TOOLS_PLUGIN_ID = 'com.kova.core-tools'

const MAX_LIST_ITEMS = 300
const MAX_READ_BYTES = 1024 * 1024
const MAX_READ_LINES = 400
const MAX_SEARCH_FILES = 800
const MAX_SEARCH_FILE_BYTES = 512 * 1024
const DEFAULT_SEARCH_RESULTS = 50
const MAX_SEARCH_RESULTS = 200
const ignoredDirectories = new Set([
  '.git',
  '.next',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out'
])

function stringArgument(
  value: Record<string, unknown>,
  key: string,
  options: { required?: boolean; maxLength?: number } = {}
): string | undefined {
  const item = value[key]
  if (item == null || item === '') {
    if (options.required) throw new Error(`${key} 为必填参数`)
    return undefined
  }
  if (typeof item !== 'string') throw new Error(`${key} 必须是字符串`)
  const normalized = item.trim()
  if (!normalized && options.required) throw new Error(`${key} 不能为空`)
  if (normalized.length > (options.maxLength ?? 2_000)) {
    throw new Error(`${key} 长度超过限制`)
  }
  return normalized
}

function integerArgument(
  value: Record<string, unknown>,
  key: string,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const item = value[key]
  if (item == null) return fallback
  if (!Number.isInteger(item) || Number(item) < minimum || Number(item) > maximum) {
    throw new Error(`${key} 必须是 ${minimum} 到 ${maximum} 之间的整数`)
  }
  return Number(item)
}

function booleanArgument(
  value: Record<string, unknown>,
  key: string,
  fallback: boolean
): boolean {
  const item = value[key]
  if (item == null) return fallback
  if (typeof item !== 'boolean') throw new Error(`${key} 必须是布尔值`)
  return item
}

function relativePath(root: string, path: string): string {
  return (relative(root, path) || '.').replaceAll('\\', '/')
}

const workspaceListTool: NativeTool = {
  definition: {
    id: 'workspace.list',
    name: '浏览工作区',
    description:
      '列出工作区内的文件和目录。适合先了解项目结构；不会跟随符号链接，也不会修改文件。',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '相对于工作区的目录，默认为根目录'
        },
        depth: {
          type: 'integer',
          minimum: 1,
          maximum: 4,
          description: '递归深度，默认 2'
        }
      },
      additionalProperties: false
    },
    risk: 'read',
    supportsStreaming: false
  },
  async execute(argumentsValue, context) {
    const requestedPath = stringArgument(argumentsValue, 'path') ?? '.'
    const depth = integerArgument(argumentsValue, 'depth', 2, 1, 4)
    const { root, path } = await resolveWorkspacePath(
      context.workspace,
      requestedPath
    )
    const pathDetails = await stat(path)
    if (!pathDetails.isDirectory()) throw new Error('workspace.list 的路径必须是目录')

    const entries: Array<{
      path: string
      type: 'file' | 'directory' | 'symlink' | 'other'
      size?: number
    }> = []

    async function visit(directory: string, remainingDepth: number): Promise<void> {
      if (context.signal.aborted) throw new DOMException('Aborted', 'AbortError')
      const children = await readdir(directory, { withFileTypes: true })
      children.sort((a, b) => a.name.localeCompare(b.name))
      for (const child of children) {
        if (entries.length >= MAX_LIST_ITEMS) return
        const childPath = join(directory, child.name)
        const type = child.isSymbolicLink()
          ? 'symlink'
          : child.isDirectory()
            ? 'directory'
            : child.isFile()
              ? 'file'
              : 'other'
        const entry: {
          path: string
          type: 'file' | 'directory' | 'symlink' | 'other'
          size?: number
        } = { path: relativePath(root, childPath), type }
        if (child.isFile()) entry.size = (await stat(childPath)).size
        entries.push(entry)
        if (
          child.isDirectory() &&
          remainingDepth > 1 &&
          !ignoredDirectories.has(child.name)
        ) {
          await visit(childPath, remainingDepth - 1)
        }
      }
    }

    await visit(path, depth)
    return {
      path: relativePath(root, path),
      entries,
      truncated: entries.length >= MAX_LIST_ITEMS
    }
  }
}

const fileReadTool: NativeTool = {
  definition: {
    id: 'file.read',
    name: '读取文件',
    description:
      '读取工作区内文本文件的指定行范围。单次最多返回 400 行和 1 MiB，不允许读取工作区外路径。',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '相对于工作区的文件路径'
        },
        startLine: {
          type: 'integer',
          minimum: 1,
          description: '起始行，默认为 1'
        },
        endLine: {
          type: 'integer',
          minimum: 1,
          description: '结束行，最多比起始行多 399 行'
        }
      },
      required: ['path'],
      additionalProperties: false
    },
    risk: 'read',
    supportsStreaming: false
  },
  async execute(argumentsValue, context) {
    const requestedPath = stringArgument(argumentsValue, 'path', {
      required: true
    })!
    const { root, path } = await resolveWorkspacePath(
      context.workspace,
      requestedPath
    )
    const details = await stat(path)
    if (!details.isFile()) throw new Error('file.read 的路径必须是文件')
    if (details.size > MAX_READ_BYTES) throw new Error('文件超过 1 MiB 读取限制')

    const content = await readFile(path, 'utf8')
    if (content.includes('\u0000')) throw new Error('不支持读取二进制文件')
    const lines = content.split(/\r?\n/)
    const startLine = integerArgument(
      argumentsValue,
      'startLine',
      1,
      1,
      Math.max(1, lines.length)
    )
    const requestedEndLine = integerArgument(
      argumentsValue,
      'endLine',
      Math.min(lines.length, startLine + MAX_READ_LINES - 1),
      startLine,
      Math.max(startLine, lines.length)
    )
    const endLine = Math.min(
      requestedEndLine,
      startLine + MAX_READ_LINES - 1,
      lines.length
    )
    const selected = lines
      .slice(startLine - 1, endLine)
      .map((line, index) => `${startLine + index}: ${line}`)
      .join('\n')

    return {
      path: relativePath(root, path),
      startLine,
      endLine,
      totalLines: lines.length,
      content: selected,
      truncated: requestedEndLine > endLine
    }
  }
}

const fileSearchTool: NativeTool = {
  definition: {
    id: 'file.search',
    name: '搜索文件内容',
    description:
      '在工作区文本文件中进行受限的字面量搜索，返回匹配文件、行号和文本。自动忽略依赖、构建产物和 Git 目录。',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '要搜索的字面量文本'
        },
        path: {
          type: 'string',
          description: '相对于工作区的搜索目录，默认为根目录'
        },
        caseSensitive: {
          type: 'boolean',
          description: '是否区分大小写，默认 false'
        },
        maxResults: {
          type: 'integer',
          minimum: 1,
          maximum: 200,
          description: '最多返回的匹配数，默认 50'
        }
      },
      required: ['query'],
      additionalProperties: false
    },
    risk: 'read',
    supportsStreaming: false
  },
  async execute(argumentsValue, context) {
    const query = stringArgument(argumentsValue, 'query', {
      required: true,
      maxLength: 300
    })!
    const requestedPath = stringArgument(argumentsValue, 'path') ?? '.'
    const caseSensitive = booleanArgument(
      argumentsValue,
      'caseSensitive',
      false
    )
    const maxResults = integerArgument(
      argumentsValue,
      'maxResults',
      DEFAULT_SEARCH_RESULTS,
      1,
      MAX_SEARCH_RESULTS
    )
    const { root, path } = await resolveWorkspacePath(
      context.workspace,
      requestedPath
    )
    if (!(await stat(path)).isDirectory()) {
      throw new Error('file.search 的 path 必须是目录')
    }

    const normalizedQuery = caseSensitive ? query : query.toLocaleLowerCase()
    const matches: Array<{ path: string; line: number; text: string }> = []
    let scannedFiles = 0

    async function visit(directory: string): Promise<void> {
      if (
        matches.length >= maxResults ||
        scannedFiles >= MAX_SEARCH_FILES
      ) return
      if (context.signal.aborted) throw new DOMException('Aborted', 'AbortError')
      const children = await readdir(directory, { withFileTypes: true })
      for (const child of children) {
        if (
          matches.length >= maxResults ||
          scannedFiles >= MAX_SEARCH_FILES
        ) return
        if (child.isSymbolicLink()) continue
        const childPath = join(directory, child.name)
        if (child.isDirectory()) {
          if (!ignoredDirectories.has(child.name)) await visit(childPath)
          continue
        }
        if (!child.isFile()) continue
        scannedFiles += 1
        const details = await stat(childPath)
        if (details.size > MAX_SEARCH_FILE_BYTES) continue
        let content: string
        try {
          content = await readFile(childPath, 'utf8')
        } catch {
          continue
        }
        if (content.includes('\u0000')) continue
        const lines = content.split(/\r?\n/)
        for (let index = 0; index < lines.length; index += 1) {
          const candidate = caseSensitive
            ? lines[index]
            : lines[index].toLocaleLowerCase()
          if (!candidate.includes(normalizedQuery)) continue
          matches.push({
            path: relativePath(root, childPath),
            line: index + 1,
            text: lines[index].slice(0, 500)
          })
          if (matches.length >= maxResults) break
        }
      }
    }

    await visit(path)
    return {
      query,
      path: relativePath(root, path),
      matches,
      scannedFiles,
      truncated:
        matches.length >= maxResults || scannedFiles >= MAX_SEARCH_FILES
    }
  }
}

const gitStatusTool: NativeTool = {
  definition: {
    id: 'git.status',
    name: '查看 Git 状态',
    description:
      '读取工作区当前分支和文件变更状态，不执行提交、切换分支或任何写操作。',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false
    },
    risk: 'read',
    supportsStreaming: false
  },
  async execute(_argumentsValue, context) {
    const root = await resolveWorkspaceRoot(context.workspace)
    const result = await runProcess(
      'git',
      ['status', '--short', '--branch', '--untracked-files=normal'],
      {
        cwd: root,
        signal: context.signal,
        timeoutMs: 15_000,
        maxOutputBytes: 1024 * 1024
      }
    )
    if (result.code !== 0) {
      throw new Error(result.stderr.trim() || '无法读取 Git 状态')
    }
    return {
      path: '.',
      status: result.stdout.trim() || '工作区干净'
    }
  }
}

export class NativeToolRegistry {
  private readonly tools = new Map(
    [workspaceListTool, fileReadTool, fileSearchTool, gitStatusTool].map(
      (tool) => [tool.definition.id, tool]
    )
  )

  list(): RegisteredCapability[] {
    return [...this.tools.values()].map((tool) => ({
      ...tool.definition,
      pluginId: CORE_TOOLS_PLUGIN_ID,
      pluginName: 'Kova Core Tools',
      available: true,
      statusMessage: 'Kova 内置只读工具'
    }))
  }

  async execute(
    call: CapabilityCall,
    context: NativeToolContext
  ): Promise<Record<string, unknown>> {
    const tool = this.tools.get(call.capabilityId)
    if (call.pluginId !== CORE_TOOLS_PLUGIN_ID || !tool) {
      throw new Error(`未注册的 Kova 工具：${call.capabilityId}`)
    }
    return tool.execute(call.arguments, context)
  }
}
