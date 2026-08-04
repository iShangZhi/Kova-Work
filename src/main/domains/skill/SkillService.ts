import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { SkillDefinition } from '../../../shared/types'
import type { SkillRepository } from './SkillRepository'
import { logger } from '../../infrastructure/logging/Logger'

/**
 * SkillService - 技能领域服务
 *
 * 职责：
 * - 导入本地 SKILL.md（校验、去重、解析 name/description）
 * - 启用/停用技能
 * - 为模型编排器提供启用中的指令片段
 */
export class SkillService {
  constructor(private readonly repository: SkillRepository) {}

  async listSkills(): Promise<SkillDefinition[]> {
    return this.repository.list()
  }

  async listEnabledInstructions(
    maxCharacters = 16_000
  ): Promise<Array<{ name: string; content: string }>> {
    const all = await this.repository.list()
    const instructions: Array<{ name: string; content: string }> = []
    let remaining = maxCharacters

    for (const skill of all.filter((item) => item.enabled)) {
      if (remaining <= 0) break
      try {
        const content = (await readFile(skill.manifestPath, 'utf8')).trim()
        if (!content) continue
        const selected = content.slice(0, remaining)
        instructions.push({ name: skill.name, content: selected })
        remaining -= selected.length
      } catch {
        // 被移动或删除的本地技能忽略，直到用户重新导入
      }
    }
    return instructions
  }

  async importSkill(sourcePath: string): Promise<SkillDefinition> {
    const manifestPath = join(sourcePath, 'SKILL.md')

    let content: string
    try {
      content = await readFile(manifestPath, 'utf8')
    } catch {
      throw new Error('所选目录中未找到 SKILL.md')
    }

    if (await this.repository.findBySourcePath(sourcePath)) {
      throw new Error('这个技能目录已经导入')
    }

    const lines = content.split(/\r?\n/).map((line) => line.trim())
    const name =
      lines.find((line) => line.startsWith('# '))?.slice(2).trim() || basename(sourcePath)
    const description =
      lines.find((line) => line && !line.startsWith('#') && line !== '---') || '本地导入技能'

    const now = new Date().toISOString()
    const skill: SkillDefinition = {
      id: randomUUID(),
      name,
      description,
      sourcePath,
      manifestPath,
      enabled: true,
      status: 'configured',
      statusMessage: '已引用本地 SKILL.md',
      createdAt: now,
      updatedAt: now
    }

    await this.repository.save(skill)
    logger.info('Skill imported', { skillId: skill.id, name })
    return skill
  }

  async setEnabled(id: string, enabled: boolean): Promise<SkillDefinition> {
    const skill = await this.repository.findById(id)
    if (!skill) throw new Error('找不到技能')

    const updated: SkillDefinition = {
      ...skill,
      enabled,
      status: enabled ? 'configured' : 'disabled',
      statusMessage: enabled ? '已启用' : '已停用',
      updatedAt: new Date().toISOString()
    }
    await this.repository.save(updated)
    logger.info('Skill toggled', { skillId: id, enabled })
    return updated
  }

  async deleteSkill(id: string): Promise<void> {
    await this.repository.delete(id)
    logger.info('Skill deleted', { skillId: id })
  }
}
