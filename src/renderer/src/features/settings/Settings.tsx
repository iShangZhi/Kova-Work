import { useState } from 'react'
import { ArrowLeft, Cpu, Search, ShieldCheck, SunMoon, Wrench } from 'lucide-react'
import { useModelStore } from '../../store/models'
import { useUIStore } from '../../store/ui'
import { ModelSettings } from './ModelSettings'
import { ExtensionSettings } from './ExtensionSettings'
import packageInfo from '../../../../../package.json'
import type {
  PluginDefinition,
  RegisteredCapability,
  SkillDefinition,
  McpServerDefinition,
  PermissionMode
} from '../../../../shared/contracts'

type SettingsSectionId = 'general' | 'models' | 'appearance' | 'extensions'
type ThemeMode = 'dark' | 'light'

interface SettingsProps {
  plugins: PluginDefinition[]
  capabilities: RegisteredCapability[]
  skills: SkillDefinition[]
  mcpServers: McpServerDefinition[]
  onBack: () => void
  onPluginEnabled: (id: string, enabled: boolean) => Promise<void>
  onSkillEnabled: (id: string, enabled: boolean) => Promise<void>
  onSkillImported: (skill: SkillDefinition) => void
}

export function Settings({
  plugins,
  capabilities,
  skills,
  mcpServers,
  onBack,
  onPluginEnabled,
  onSkillEnabled,
  onSkillImported
}: SettingsProps) {
  const { profiles, defaultProfileId, setDefaultProfile } = useModelStore()
  const { themeMode, defaultPermissionMode, setThemeMode, setDefaultPermissionMode } = useUIStore()
  const [section, setSection] = useState<SettingsSectionId>('general')
  const [query, setQuery] = useState('')

  const sections = [
    { id: 'general' as const, label: '常规', keywords: '常规 权限 默认 permission', icon: ShieldCheck },
    { id: 'models' as const, label: '模型', keywords: '模型 deepseek api key', icon: Cpu },
    { id: 'appearance' as const, label: '外观', keywords: '外观 深色 浅色 主题', icon: SunMoon },
    { id: 'extensions' as const, label: '插件', keywords: '插件 技能 MCP 应用 扩展', icon: Wrench }
  ]

  const normalizedQuery = query.trim().toLowerCase()
  const visibleSections = normalizedQuery
    ? sections.filter((item) => `${item.label} ${item.keywords}`.toLowerCase().includes(normalizedQuery))
    : sections
  const currentTitle = sections.find((item) => item.id === section)?.label ?? '常规'

  return (
    <div className="settings-workspace">
      <aside className="settings-sidebar">
        <div className="settings-window-drag" />
        <button className="settings-back" type="button" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          <span>返回应用</span>
        </button>
        <label className="settings-search">
          <Search aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索设置…"
            aria-label="搜索设置"
          />
        </label>
        <span className="settings-nav-label">设置</span>
        <nav className="settings-nav">
          {visibleSections.map((item) => {
            const Icon = item.icon
            return (
              <button
                className={section === item.id ? 'active' : ''}
                type="button"
                key={item.id}
                onClick={() => setSection(item.id)}
              >
                <Icon aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            )
          })}
          {visibleSections.length === 0 && <p>没有匹配的设置</p>}
        </nav>
        <span className="settings-version">Kova v{packageInfo.version}</span>
      </aside>

      <main className="settings-detail">
        <div className="settings-detail-inner">
          <h1>{currentTitle}</h1>

          {section === 'general' && (
            <>
              <h2>权限</h2>
              <section className="settings-card permission-settings" role="radiogroup" aria-label="默认任务权限">
                {([
                  ['acceptEdits', '默认权限', '允许模型读取并编辑当前项目中的文件。'],
                  ['dontAsk', '严格模式', '无法确认的写入和命令将被拒绝。'],
                  ['plan', '只读模式', '只允许分析、读取和检查项目。']
                ] as Array<[PermissionMode, string, string]>).map(([mode, title, description]) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={defaultPermissionMode === mode}
                    className={defaultPermissionMode === mode ? 'active' : ''}
                    key={mode}
                    onClick={() => setDefaultPermissionMode(mode)}
                  >
                    <span>
                      <strong>{title}</strong>
                      <small>{description}</small>
                    </span>
                    <i aria-hidden="true" />
                  </button>
                ))}
              </section>
            </>
          )}

          {section === 'models' && (
            <ModelSettings
              models={profiles}
              defaultModelProfileId={defaultProfileId}
              onDefaultChange={setDefaultProfile}
            />
          )}

          {section === 'appearance' && (
            <>
              <h2>主题</h2>
              <section className="settings-card">
                <div className="settings-control-row">
                  <span>
                    <strong>显示模式</strong>
                    <small>选择 Kova 的界面外观。</small>
                  </span>
                  <div className="segmented-control">
                    <button
                      className={themeMode === 'dark' ? 'active' : ''}
                      type="button"
                      onClick={() => setThemeMode('dark')}
                    >
                      深色
                    </button>
                    <button
                      className={themeMode === 'light' ? 'active' : ''}
                      type="button"
                      onClick={() => setThemeMode('light')}
                    >
                      浅色
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}

          {section === 'extensions' && (
            <ExtensionSettings
              plugins={plugins}
              capabilities={capabilities}
              skills={skills}
              mcpServers={mcpServers}
              onPluginEnabled={onPluginEnabled}
              onSkillEnabled={onSkillEnabled}
              onSkillImported={onSkillImported}
            />
          )}
        </div>
      </main>
    </div>
  )
}
