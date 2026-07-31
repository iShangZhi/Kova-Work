import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { PluginDefinition, RegisteredCapability, SkillDefinition } from '../../../../shared/contracts'

interface PluginsProps {
  plugins: PluginDefinition[]
  capabilities: RegisteredCapability[]
  skills: SkillDefinition[]
}

type SkillScope = 'all' | 'personal' | 'system'

export function Plugins({ plugins, capabilities, skills }: PluginsProps) {
  const [skillQuery, setSkillQuery] = useState('')
  const [skillScope, setSkillScope] = useState<SkillScope>('all')

  const visibleSkills = useMemo(() => {
    const pluginById = new Map(plugins.map((p) => [p.id, p]))

    const capabilitySkills = capabilities.map((cap) => ({
      id: `capability:${cap.pluginId}:${cap.id}`,
      name: cap.name,
      description: cap.description,
      source: 'system' as const,
      enabled: cap.pluginId === 'com.kova.core-tools' || Boolean(pluginById.get(cap.pluginId)?.enabled),
      available: cap.available,
      badge: cap.pluginId === 'com.kova.core-tools' ? 'K' : (pluginById.get(cap.pluginId)?.name.slice(0, 1) ?? '✦')
    }))

    const personalSkills = skills.map((skill) => ({
      id: `skill:${skill.id}`,
      name: skill.name,
      description: skill.description,
      source: 'personal' as const,
      enabled: skill.enabled,
      available: skill.status !== 'error',
      badge: '✦'
    }))

    const query = skillQuery.trim().toLowerCase()
    return [...capabilitySkills, ...personalSkills].filter((s) =>
      (skillScope === 'all' || s.source === skillScope) &&
      (!query || `${s.name} ${s.description}`.toLowerCase().includes(query))
    )
  }, [capabilities, plugins, skills, skillQuery, skillScope])

  return (
    <main className="skill-browser">
      <div className="skill-breadcrumb">
        <span>插件</span>
        <strong>技能</strong>
      </div>
      <header className="skill-browser-header">
        <h1>技能</h1>
        <p>通过任务专用技能扩展 Kova 的能力</p>
      </header>
      <label className="skill-search">
        <Search aria-hidden="true" />
        <input
          value={skillQuery}
          onChange={(e) => setSkillQuery(e.target.value)}
          placeholder="搜索技能"
          aria-label="搜索技能"
        />
      </label>
      <section className="installed-skills">
        <h2>已安装</h2>
        {visibleSkills.length > 0 ? (
          <div className="skill-grid">
            {visibleSkills.map((skill) => (
              <article className="skill-list-item" key={skill.id}>
                <span className="skill-list-icon">{skill.badge}</span>
                <span>
                  <strong>{skill.name}</strong>
                  <small>{skill.description}</small>
                </span>
                <i
                  className={skill.enabled && skill.available ? 'ready' : ''}
                  aria-label={skill.enabled && skill.available ? '已启用' : '不可用'}
                >
                  {skill.enabled && skill.available ? '✓' : '—'}
                </i>
              </article>
            ))}
          </div>
        ) : (
          <p className="skill-empty">没有匹配的技能</p>
        )}
      </section>
      <div className="skill-scope-tabs" role="group" aria-label="技能来源">
        {(['all', 'personal', 'system'] as Array<SkillScope>).map((id) => (
          <button
            className={skillScope === id ? 'active' : ''}
            type="button"
            key={id}
            onClick={() => setSkillScope(id)}
          >
            {{ all: '全部', personal: '个人', system: '系统' }[id]}
          </button>
        ))}
      </div>
    </main>
  )
}
