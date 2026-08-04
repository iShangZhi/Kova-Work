import { randomUUID } from 'node:crypto'
import { realpath, stat } from 'node:fs/promises'
import type {
  Workspace,
  CreateWorkspaceInput,
  UpdateWorkspaceInput
} from '../../../shared/types'
import type { WorkspaceRepository } from './WorkspaceRepository'
import { logger } from '../../infrastructure/logging/Logger'
import { CORE_TOOLS_PLUGIN_ID } from '../../tools/native-tool-registry'

/**
 * WorkspaceService - 工作区领域服务
 *
 * 职责：
 * - 工作区创建和验证（含路径解析、重复检查）
 * - 工作区配置管理
 * - 业务规则执行
 */
export class WorkspaceService {
  constructor(private readonly workspaceRepository: WorkspaceRepository) {}

  /**
   * 创建工作区
   */
  async createWorkspace(input: CreateWorkspaceInput): Promise<Workspace> {
    const name = input.name.trim()
    if (!name) {
      throw new Error('项目名称不能为空')
    }

    const requestedFolders = [...new Set(input.sourceFolders.map((p) => p.trim()).filter(Boolean))]
    if (requestedFolders.length === 0) {
      throw new Error('请至少添加一个源码目录')
    }

    // 解析并验证所有源文件夹
    const sourceFolders: string[] = []
    for (const folder of requestedFolders) {
      const resolved = await realpath(folder)
      if (!(await stat(resolved)).isDirectory()) {
        throw new Error(`不是有效目录：${folder}`)
      }
      if (!sourceFolders.includes(resolved)) {
        sourceFolders.push(resolved)
      }
    }

    // 检查主路径是否已被已有工作区占用
    const existingByPath = await this.workspaceRepository.findByPath(sourceFolders[0])
    if (existingByPath) {
      // 恢复已删除的工作区
      if (existingByPath.removedAt) {
        existingByPath.name = name
        existingByPath.sourceFolders = sourceFolders
        existingByPath.defaultModelProfileId = input.defaultModelProfileId
        existingByPath.removedAt = undefined
        existingByPath.updatedAt = new Date().toISOString()
        await this.workspaceRepository.save(existingByPath)
        logger.info('Workspace restored', { workspaceId: existingByPath.id, path: sourceFolders[0] })
        return existingByPath
      }
      throw new Error('该源码目录已经属于现有项目')
    }

    // 检查重名
    const allWorkspaces = await this.workspaceRepository.list()
    const duplicateName = allWorkspaces.some(
      (w) =>
        !w.removedAt &&
        w.name.localeCompare(name, undefined, { sensitivity: 'accent' }) === 0
    )
    if (duplicateName) {
      throw new Error('已存在同名项目')
    }

    const now = new Date().toISOString()
    const workspace: Workspace = {
      id: randomUUID(),
      name,
      path: sourceFolders[0],
      sourceFolders,
      defaultModelProfileId: input.defaultModelProfileId,
      enabledPluginIds: [CORE_TOOLS_PLUGIN_ID, 'com.kova.claude-code'],
      createdAt: now,
      updatedAt: now
    }

    await this.workspaceRepository.save(workspace)

    logger.info('Workspace created', {
      workspaceId: workspace.id,
      path: sourceFolders[0],
      name
    })

    return workspace
  }

  /**
   * 更新工作区
   */
  async updateWorkspace(workspaceId: string, input: UpdateWorkspaceInput): Promise<Workspace> {
    const workspace = await this.workspaceRepository.findById(workspaceId)
    if (!workspace) {
      throw new Error('找不到对应项目')
    }

    // 更新名称（含重名检查）
    if (input.name !== undefined) {
      const name = input.name.trim()
      if (!name) throw new Error('项目名称不能为空')

      const allWorkspaces = await this.workspaceRepository.list()
      const duplicateName = allWorkspaces.some(
        (w) =>
          w.id !== workspace.id &&
          !w.removedAt &&
          w.name.localeCompare(name, undefined, { sensitivity: 'accent' }) === 0
      )
      if (duplicateName) throw new Error('已存在同名项目')
      workspace.name = name
    }

    // 更新源文件夹（含路径解析和交叉检查）
    if (input.sourceFolders !== undefined) {
      const requestedFolders = [...new Set(input.sourceFolders.map((p) => p.trim()).filter(Boolean))]
      if (requestedFolders.length === 0) throw new Error('请至少保留一个源码目录')

      const sourceFolders: string[] = []
      for (const folder of requestedFolders) {
        const resolved = await realpath(folder)
        if (!(await stat(resolved)).isDirectory()) {
          throw new Error(`不是有效目录：${folder}`)
        }

        const allWorkspaces = await this.workspaceRepository.list()
        const belongsToAnotherProject = allWorkspaces.some(
          (w) =>
            w.id !== workspace.id &&
            !w.removedAt &&
            (w.sourceFolders ?? []).includes(resolved)
        )
        if (belongsToAnotherProject) {
          throw new Error(`源码目录已经属于其他项目：${folder}`)
        }

        if (!sourceFolders.includes(resolved)) {
          sourceFolders.push(resolved)
        }
      }
      workspace.sourceFolders = sourceFolders
      workspace.path = sourceFolders[0]
    }

    if (input.icon !== undefined) workspace.icon = input.icon
    if (input.color !== undefined) workspace.color = input.color
    if (input.pinned !== undefined) workspace.pinned = input.pinned

    if (input.removed !== undefined) {
      workspace.removedAt = input.removed ? new Date().toISOString() : undefined
    }

    if (input.enabledPluginIds !== undefined) {
      workspace.enabledPluginIds = [
        ...new Set([CORE_TOOLS_PLUGIN_ID, ...input.enabledPluginIds.filter(Boolean)])
      ]
    }

    workspace.updatedAt = new Date().toISOString()

    await this.workspaceRepository.save(workspace)

    logger.info('Workspace updated', { workspaceId })

    return workspace
  }

  /**
   * 删除工作区
   */
  async deleteWorkspace(workspaceId: string): Promise<void> {
    const workspace = await this.workspaceRepository.findById(workspaceId)
    if (!workspace) return

    await this.workspaceRepository.delete(workspaceId)

    logger.info('Workspace deleted', { workspaceId })
  }

  /**
   * 获取或创建工作区（用于任务启动）
   */
  async ensureWorkspace(path: string, defaultModelProfileId?: string): Promise<Workspace> {
    const normalized = path.trim()
    if (!normalized) throw new Error('工作区路径不能为空')

    const existing = await this.workspaceRepository.findByPath(normalized)
    if (existing) {
      let changed = false

      if (!existing.enabledPluginIds.includes(CORE_TOOLS_PLUGIN_ID)) {
        existing.enabledPluginIds.push(CORE_TOOLS_PLUGIN_ID)
        changed = true
      }

      if (defaultModelProfileId && existing.defaultModelProfileId !== defaultModelProfileId) {
        existing.defaultModelProfileId = defaultModelProfileId
        changed = true
      }

      if (changed) {
        existing.updatedAt = new Date().toISOString()
        await this.workspaceRepository.save(existing)
      }

      return existing
    }

    const now = new Date().toISOString()
    const workspace: Workspace = {
      id: randomUUID(),
      name: normalized.split('/').pop() || 'Unnamed Workspace',
      path: normalized,
      sourceFolders: [normalized],
      defaultModelProfileId,
      enabledPluginIds: [CORE_TOOLS_PLUGIN_ID, 'com.kova.claude-code'],
      createdAt: now,
      updatedAt: now
    }

    await this.workspaceRepository.save(workspace)

    logger.info('Workspace auto-created', {
      workspaceId: workspace.id,
      path: normalized
    })

    return workspace
  }

  /**
   * 列出所有工作区
   */
  async listWorkspaces(): Promise<Workspace[]> {
    return this.workspaceRepository.list()
  }

  /**
   * 获取工作区详情
   */
  async getWorkspace(workspaceId: string): Promise<Workspace | null> {
    return this.workspaceRepository.findById(workspaceId)
  }
}
