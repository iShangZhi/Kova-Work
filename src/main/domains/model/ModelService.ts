import { randomUUID } from 'node:crypto'
import type {
  ModelProfile,
  SaveModelProfileInput
} from '../../../shared/types'
import type { ModelRepository } from './ModelRepository'
import type { WorkspaceRepository } from '../workspace/WorkspaceRepository'
import { logger } from '../../infrastructure/logging/Logger'

/**
 * ModelService - 模型配置领域服务
 *
 * 职责：
 * - 模型配置创建和验证
 * - 模型配置管理（含级联更新）
 * - 业务规则执行
 */
export class ModelService {
  constructor(
    private readonly modelRepository: ModelRepository,
    private readonly workspaceRepository: WorkspaceRepository
  ) {}

  /**
   * 保存模型配置（创建或更新）
   */
  async saveModelProfile(input: SaveModelProfileInput): Promise<ModelProfile> {
    const name = input.name.trim()
    if (!name) {
      throw new Error('模型名称不能为空')
    }

    if (!input.model.trim()) {
      throw new Error('模型 ID 不能为空')
    }

    // 超时范围验证
    if (
      input.requestTimeoutMs != null &&
      (!Number.isFinite(input.requestTimeoutMs) ||
        input.requestTimeoutMs < 1_000 ||
        input.requestTimeoutMs > 30 * 60_000)
    ) {
      throw new Error('模型请求超时必须在 1 秒到 30 分钟之间')
    }

    const now = new Date().toISOString()

    if (input.id) {
      const existing = await this.modelRepository.findById(input.id)
      if (!existing) {
        throw new Error('找不到要编辑的模型配置')
      }

      const updated: ModelProfile = {
        ...existing,
        name,
        provider: input.provider ?? existing.provider,
        model: input.model.trim(),
        // URL 规范化：去除末尾斜杠
        baseUrl: input.baseUrl?.trim().replace(/\/$/, '') || existing.baseUrl,
        apiKey: input.apiKey?.trim() || existing.apiKey,
        systemPrompt: input.systemPrompt?.trim() || undefined,
        temperature: input.temperature,
        requestTimeoutMs: input.requestTimeoutMs,
        enabled: input.enabled ?? existing.enabled,
        updatedAt: now
      }

      await this.modelRepository.save(updated)

      logger.info('Model profile updated', {
        profileId: updated.id,
        name,
        provider: updated.provider,
        model: updated.model
      })

      return updated
    }

    // 创建新配置
    const profile: ModelProfile = {
      id: randomUUID(),
      name,
      provider: input.provider ?? 'openai-compatible',
      model: input.model.trim(),
      baseUrl: input.baseUrl?.trim().replace(/\/$/, '') || '',
      apiKey: input.apiKey?.trim() || undefined,
      systemPrompt: input.systemPrompt?.trim() || undefined,
      temperature: input.temperature,
      requestTimeoutMs: input.requestTimeoutMs,
      enabled: input.enabled ?? true,
      createdAt: now,
      updatedAt: now
    }

    await this.modelRepository.save(profile)

    logger.info('Model profile created', {
      profileId: profile.id,
      name,
      provider: profile.provider,
      model: profile.model
    })

    return profile
  }

  /**
   * 删除模型配置（含级联 fallback 更新）
   */
  async deleteModelProfile(profileId: string): Promise<void> {
    const profile = await this.modelRepository.findById(profileId)
    if (!profile) return

    // TODO: 检查是否有任务正在使用此模型配置

    await this.modelRepository.delete(profileId)

    // Fallback：将引用此模型的 workspace 和 task 切换到其他可用模型
    const allModels = await this.modelRepository.list()
    const fallback = allModels.find((m) => m.enabled)

    if (fallback) {
      const allWorkspaces = await this.workspaceRepository.list()
      for (const workspace of allWorkspaces) {
        if (workspace.defaultModelProfileId === profileId) {
          workspace.defaultModelProfileId = fallback.id
          workspace.updatedAt = new Date().toISOString()
          await this.workspaceRepository.save(workspace)
        }
      }
    }

    logger.info('Model profile deleted', { profileId })
  }

  /**
   * 启用/禁用模型配置
   */
  async toggleModelProfile(profileId: string, enabled: boolean): Promise<ModelProfile> {
    const profile = await this.modelRepository.findById(profileId)
    if (!profile) {
      throw new Error('找不到对应的模型配置')
    }

    profile.enabled = enabled
    profile.updatedAt = new Date().toISOString()

    await this.modelRepository.save(profile)

    logger.info('Model profile toggled', { profileId, enabled })

    return profile
  }

  /**
   * 列出所有模型配置
   */
  async listModelProfiles(): Promise<ModelProfile[]> {
    return this.modelRepository.list()
  }

  /**
   * 列出启用的模型配置
   */
  async listEnabledModelProfiles(): Promise<ModelProfile[]> {
    return this.modelRepository.listEnabled()
  }

  /**
   * 获取模型配置详情
   */
  async getModelProfile(profileId: string): Promise<ModelProfile | null> {
    return this.modelRepository.findById(profileId)
  }

  /**
   * 验证模型配置是否可用
   */
  async validateModelProfile(profileId: string): Promise<boolean> {
    const profile = await this.modelRepository.findById(profileId)
    if (!profile) return false

    if (!profile.enabled) return false
    if (!profile.provider || !profile.model) return false

    return true
  }

  /**
   * 获取默认模型配置
   */
  async getDefaultModelProfile(): Promise<ModelProfile | null> {
    const enabled = await this.listEnabledModelProfiles()
    return enabled[0] ?? null
  }
}
