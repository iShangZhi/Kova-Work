import { randomUUID } from 'node:crypto'
import type {
  ClaudeWorkflowProfile,
  SaveClaudeWorkflowProfileInput
} from '../../../shared/types'
import type { WorkflowRepository } from './WorkflowRepository'
import { logger } from '../../infrastructure/logging/Logger'

/**
 * WorkflowService - Claude 工作流领域服务
 *
 * - 首次 list 若为空，种下 3 条默认 stage 配置（对齐 storage.ts:385-397）
 * - save 时校验 name / agentName 非空
 */
export class WorkflowService {
  constructor(private readonly repository: WorkflowRepository) {}

  async list(): Promise<ClaudeWorkflowProfile[]> {
    if (this.repository.isEmpty()) {
      await this.seedDefaults()
    }
    return this.repository.list()
  }

  async save(input: SaveClaudeWorkflowProfileInput): Promise<ClaudeWorkflowProfile> {
    if (!input.name.trim() || !input.agentName.trim()) {
      throw new Error('工作流名称和 Claude Agent 名称不能为空')
    }

    const now = new Date().toISOString()
    const existing = input.id ? await this.repository.findById(input.id) : null

    const profile: ClaudeWorkflowProfile = {
      id: existing?.id ?? randomUUID(),
      stage: input.stage,
      name: input.name.trim(),
      agentName: input.agentName.trim(),
      promptPrefix: input.promptPrefix.trim(),
      enabled: existing?.enabled ?? true,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    }

    await this.repository.save(profile)
    logger.info('Workflow profile saved', { profileId: profile.id, stage: profile.stage })
    return profile
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id)
    logger.info('Workflow profile deleted', { profileId: id })
  }

  private async seedDefaults(): Promise<void> {
    const now = new Date().toISOString()
    const defaults: ClaudeWorkflowProfile[] = [
      {
        id: randomUUID(),
        stage: 'design',
        name: '产品与架构设计',
        agentName: 'claude',
        promptPrefix: '你现在处于设计阶段。先澄清目标、约束和验收标准，输出设计方案后再行动。',
        enabled: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: randomUUID(),
        stage: 'development',
        name: '功能开发',
        agentName: 'claude',
        promptPrefix: '你现在处于开发阶段。基于现有工程实现需求，保持改动聚焦并完成必要验证。',
        enabled: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: randomUUID(),
        stage: 'testing',
        name: '测试与验收',
        agentName: 'claude',
        promptPrefix: '你现在处于测试阶段。优先复现、验证边界并给出可追踪的测试结论。',
        enabled: true,
        createdAt: now,
        updatedAt: now
      }
    ]
    await this.repository.saveMany(defaults)
    logger.info('Workflow defaults seeded')
  }
}
