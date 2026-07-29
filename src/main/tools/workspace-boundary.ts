import { realpath, stat } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'

function isInside(root: string, candidate: string): boolean {
  const relativePath = relative(root, candidate)
  return (
    relativePath === '' ||
    (!relativePath.startsWith('..') && !isAbsolute(relativePath))
  )
}

export async function resolveWorkspaceRoot(workspace: string): Promise<string> {
  const root = await realpath(workspace)
  const details = await stat(root)
  if (!details.isDirectory()) throw new Error('工作区不是有效目录')
  return root
}

export async function resolveWorkspacePath(
  workspace: string,
  requestedPath = '.'
): Promise<{ root: string; path: string }> {
  const root = await resolveWorkspaceRoot(workspace)
  const candidate = resolve(root, requestedPath)
  if (!isInside(root, candidate)) throw new Error('路径超出工作区范围')

  const canonicalPath = await realpath(candidate)
  if (!isInside(root, canonicalPath)) {
    throw new Error('路径通过符号链接指向工作区外部')
  }
  return { root, path: canonicalPath }
}
