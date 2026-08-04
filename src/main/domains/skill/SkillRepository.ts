import type { SkillDefinition } from '../../../shared/types'
import type { JsonStore } from '../../infrastructure/persistence/JsonStore'

export interface SkillState {
  skills: SkillDefinition[]
}

export const emptySkillState = (): SkillState => ({ skills: [] })

/**
 * SkillRepository - 技能数据访问层
 * 只做数据存取，不含业务规则。
 */
export class SkillRepository {
  constructor(private readonly store: JsonStore<SkillState>) {}

  async list(): Promise<SkillDefinition[]> {
    return [...this.store.snapshot().skills].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    )
  }

  async findById(id: string): Promise<SkillDefinition | null> {
    return this.store.snapshot().skills.find((s) => s.id === id) ?? null
  }

  async findBySourcePath(sourcePath: string): Promise<SkillDefinition | null> {
    return this.store.snapshot().skills.find((s) => s.sourcePath === sourcePath) ?? null
  }

  async save(skill: SkillDefinition): Promise<void> {
    await this.store.setState((state) => {
      const index = state.skills.findIndex((s) => s.id === skill.id)
      if (index >= 0) state.skills[index] = skill
      else state.skills.push(skill)
    })
  }

  async delete(id: string): Promise<void> {
    await this.store.setState((state) => {
      state.skills = state.skills.filter((s) => s.id !== id)
    })
  }
}
