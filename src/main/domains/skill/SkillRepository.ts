import type { SkillDefinition } from '../../../shared/contracts'
import type { JsonStore } from '../../infrastructure/persistence/JsonStore'
import { randomUUID } from 'node:crypto'
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { app } from 'electron'

interface SkillState {
  skills: SkillDefinition[]
}

export class SkillRepository {
  constructor(private store: JsonStore<SkillState>) {}

  async list(): Promise<SkillDefinition[]> {
    const state = this.store.getState()
    return [...state.skills]
  }

  async listEnabledInstructions(maxCharacters = 16_000): Promise<Array<{ name: string; content: string }>> {
    const state = this.store.getState()
    const enabled = state.skills.filter((s) => s.enabled)

    const instructions: Array<{ name: string; content: string }> = []
    let totalChars = 0

    for (const skill of enabled) {
      if (totalChars >= maxCharacters) break
      try {
        const content = await readFile(skill.manifestPath, 'utf8')
        const remaining = maxCharacters - totalChars
        const trimmed = content.slice(0, remaining)
        instructions.push({ name: skill.name, content: trimmed })
        totalChars += trimmed.length
      } catch (error) {
        console.error(`Failed to read skill ${skill.name}:`, error)
      }
    }

    return instructions
  }

  async import(sourcePath: string): Promise<SkillDefinition> {
    const manifestPath = join(sourcePath, 'SKILL.md')

    let content: string
    try {
      content = await readFile(manifestPath, 'utf8')
    } catch {
      throw new Error('所选目录中未找到 SKILL.md')
    }

    const state = this.store.getState()
    if (state.skills.some((s) => s.sourcePath === sourcePath)) {
      throw new Error('这个技能目录已经导入')
    }

    const lines = content.split(/\r?\n/).map((line) => line.trim())
    const name = lines.find((line) => line.startsWith('# '))?.slice(2).trim() || basename(sourcePath)
    const description = lines.find((line) => line && !line.startsWith('#') && line !== '---') || '本地导入技能'
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

    this.store.setState((state) => {
      state.skills.push(skill)
    })

    return skill
  }

  async setEnabled(id: string, enabled: boolean): Promise<SkillDefinition> {
    let result: SkillDefinition | null = null

    this.store.setState((state) => {
      const skill = state.skills.find((s) => s.id === id)
      if (!skill) throw new Error('找不到技能')

      skill.enabled = enabled
      skill.status = enabled ? 'configured' : 'disabled'
      skill.statusMessage = enabled ? '已启用' : '已停用'
      skill.updatedAt = new Date().toISOString()

      result = skill
    })

    if (!result) throw new Error('Update failed')
    return result
  }

  async delete(id: string): Promise<void> {
    this.store.setState((state) => {
      state.skills = state.skills.filter((s) => s.id !== id)
    })
  }
}
