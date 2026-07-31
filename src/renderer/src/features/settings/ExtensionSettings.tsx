import { useState } from 'react'
import { Search } from 'lucide-react'
import type {
  PluginDefinition,
  PluginStatus,
  RegisteredCapability,
  SkillDefinition,
  McpServerDefinition
} from '../../../../shared/contracts'

interface ExtensionSettingsProps {
  plugins: PluginDefinition[]
  capabilities: RegisteredCapability[]
  skills: SkillDefinition[]
  mcpServers: McpServerDefinition[]
  onPluginEnabled: (id: string, enabled: boolean) => Promise<void>
  onSkillEnabled: (id: string, enabled: boolean) => Promise<void>
  onSkillImported: (skill: SkillDefinition) => void
}

const pluginStatusLabels: Record<PluginStatus, string> = {
  ready: '运行就绪',
  detected: '运行待接入',
  missing: '缺少依赖',
  disabled: '已停用',
  error: '依赖异常'
}

export function ExtensionSettings({
  plugins,
  capabilities,
  skills,
  mcpServers,
  onPluginEnabled,
  onSkillEnabled,
  onSkillImported
}: ExtensionSettingsProps) {
  const [tab, setTab] = useState<'plugins' | 'apps' | 'mcp' | 'skills'>('plugins')
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const normalizedQuery = query.trim().toLowerCase()
  const matches = (name: string, description: string): boolean =>
    !normalizedQuery || `${name} ${description}`.toLowerCase().includes(normalizedQuery)

  async function importLocalSkill() {
    const sourcePath = await window.kova.chooseSkillDirectory()
    if (!sourcePath) return
    const imported = await window.kova.importSkill(sourcePath)
    onSkillImported(imported)
    setTab('skills')
  }

  return (
    <>
      <p className="settings-lead">管理插件、应用、MCP 和技能。</p>
      <div className="extension-settings-toolbar">
        <div className="extension-settings-tabs">
          <button className={tab === 'plugins' ? 'active' : ''} type="button" onClick={() => setTab('plugins')}>
            插件 <span>{plugins.length}</span>
          </button>
          <button className={tab === 'apps' ? 'active' : ''} type="button" onClick={() => setTab('apps')}>
            应用 <span>0</span>
          </button>
          <button className={tab === 'mcp' ? 'active' : ''} type="button" onClick={() => setTab('mcp')}>
            MCP <span>{mcpServers.length}</span>
          </button>
          <button className={tab === 'skills' ? 'active' : ''} type="button" onClick={() => setTab('skills')}>
            技能 <span>{capabilities.length + skills.length}</span>
          </button>
        </div>
        <label className="extension-settings-search">
          <Search aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索插件"
            aria-label="搜索扩展"
          />
        </label>
      </div>

      {tab === 'plugins' && (
        <section className="settings-extension-list">
          {plugins.filter((plugin) => matches(plugin.name, plugin.description)).map((plugin) => (
            <div key={plugin.id}>
              <span className="settings-extension-icon">{plugin.name.slice(0, 1)}</span>
              <span>
                <strong>{plugin.name}</strong>
                <small>{plugin.description}</small>
              </span>
              <em>{pluginStatusLabels[plugin.status]}</em>
              <button
                className={`toggle-switch ${plugin.enabled ? 'on' : ''}`}
                type="button"
                role="switch"
                aria-checked={plugin.enabled}
                disabled={busyId === plugin.id}
                onClick={() => {
                  setBusyId(plugin.id)
                  void onPluginEnabled(plugin.id, !plugin.enabled).finally(() => setBusyId(null))
                }}
              >
                <span />
              </button>
            </div>
          ))}
        </section>
      )}

      {tab === 'apps' && (
        <p className="settings-empty extension-settings-empty">尚未连接应用。应用连接将在下一阶段接入。</p>
      )}

      {tab === 'mcp' && (
        <section className="settings-extension-list">
          {mcpServers.length === 0 && <p className="settings-empty">还没有 MCP 配置。</p>}
          {mcpServers.filter((server) => matches(server.name, server.url ?? server.command ?? '')).map((server) => (
            <div key={server.id}>
              <span className="settings-extension-icon">M</span>
              <span>
                <strong>{server.name}</strong>
                <small>
                  {server.transport === 'http'
                    ? server.url
                    : [server.command, ...(server.args ?? [])].filter(Boolean).join(' ')}
                </small>
              </span>
              <em>已配置</em>
            </div>
          ))}
        </section>
      )}

      {tab === 'skills' && (
        <>
          <div className="settings-section-title extension-skill-title">
            <h2>已安装技能</h2>
            <button type="button" onClick={() => void importLocalSkill()}>
              导入技能
            </button>
          </div>
          <section className="settings-extension-list">
            {capabilities.filter((capability) => matches(capability.name, capability.description)).map((capability) => (
              <div key={`${capability.pluginId}:${capability.id}`}>
                <span className="settings-extension-icon">K</span>
                <span>
                  <strong>{capability.name}</strong>
                  <small>{capability.description}</small>
                </span>
                <em>{capability.available ? '系统' : '不可用'}</em>
                <span className="extension-check">✓</span>
              </div>
            ))}
            {skills.filter((skill) => matches(skill.name, skill.description)).map((skill) => (
              <div key={skill.id}>
                <span className="settings-extension-icon">✦</span>
                <span>
                  <strong>{skill.name}</strong>
                  <small>{skill.description}</small>
                </span>
                <em>个人</em>
                <button
                  className={`toggle-switch ${skill.enabled ? 'on' : ''}`}
                  type="button"
                  role="switch"
                  aria-checked={skill.enabled}
                  onClick={() => void onSkillEnabled(skill.id, !skill.enabled)}
                >
                  <span />
                </button>
              </div>
            ))}
          </section>
        </>
      )}
    </>
  )
}
