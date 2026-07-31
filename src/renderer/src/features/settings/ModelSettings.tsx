import { useState } from 'react'
import { useModelStore } from '../../store/models'
import type { ModelProfile } from '../../../../shared/contracts'

interface ModelSettingsProps {
  models: ModelProfile[]
  defaultModelProfileId: string
  onDefaultChange: (id: string) => void
}

export function ModelSettings({ models, defaultModelProfileId, onDefaultChange }: ModelSettingsProps) {
  const { saveProfile, deleteProfile } = useModelStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(models.length === 0)
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('https://api.deepseek.com')
  const [model, setModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [temperature, setTemperature] = useState('0.2')
  const [timeoutSeconds, setTimeoutSeconds] = useState('120')
  const [enabled, setEnabled] = useState(true)
  const [error, setError] = useState('')
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; text: string }>>({})

  function resetForm() {
    setEditingId(null)
    setName('')
    setBaseUrl('https://api.deepseek.com')
    setModel('')
    setApiKey('')
    setSystemPrompt('')
    setTemperature('0.2')
    setTimeoutSeconds('120')
    setEnabled(true)
    setError('')
  }

  function addModel() {
    resetForm()
    setShowForm(true)
  }

  function editModel(profile: ModelProfile) {
    setEditingId(profile.id)
    setName(profile.name)
    setBaseUrl(profile.baseUrl)
    setModel(profile.model)
    setApiKey('')
    setSystemPrompt(profile.systemPrompt ?? '')
    setTemperature(String(profile.temperature ?? 0.2))
    setTimeoutSeconds(String(Math.round((profile.requestTimeoutMs ?? 120_000) / 1_000)))
    setEnabled(profile.enabled)
    setError('')
    setShowForm(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const timeout = Number(timeoutSeconds)
      const nextTemperature = Number(temperature)
      if (!Number.isFinite(timeout) || timeout < 1 || timeout > 1_800) {
        throw new Error('请求超时必须在 1 到 1800 秒之间')
      }
      if (!Number.isFinite(nextTemperature) || nextTemperature < 0 || nextTemperature > 2) {
        throw new Error('温度必须在 0 到 2 之间')
      }
      await saveProfile({
        id: editingId ?? undefined,
        name,
        baseUrl,
        model,
        apiKey,
        systemPrompt,
        temperature: nextTemperature,
        requestTimeoutMs: timeout * 1_000,
        enabled
      })
      resetForm()
      setShowForm(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  async function testModel(profile: ModelProfile) {
    setTestingId(profile.id)
    setTestResults((current) => {
      const next = { ...current }
      delete next[profile.id]
      return next
    })
    try {
      await window.kova.chatWithModel({
        profileId: profile.id,
        messages: [{ role: 'user', content: '请只回复 OK' }]
      })
      setTestResults((current) => ({ ...current, [profile.id]: { ok: true, text: '连接成功' } }))
    } catch (cause) {
      setTestResults((current) => ({
        ...current,
        [profile.id]: {
          ok: false,
          text: cause instanceof Error ? cause.message : String(cause)
        }
      }))
    } finally {
      setTestingId(null)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (confirm(`确定删除模型配置"${name}"吗？`)) {
      await deleteProfile(id)
    }
  }

  return (
    <>
      <div className="settings-section-title">
        <h2>模型配置</h2>
        <button type="button" onClick={addModel}>
          添加模型
        </button>
      </div>
      <section className="model-profile-list">
        {models.length === 0 && <p className="settings-empty">还没有模型配置。</p>}
        {models.map((item) => (
          <article className="settings-card model-profile-card" key={item.id}>
            <div className="model-profile-main">
              <span>
                <strong>{item.name}</strong>
                <small>
                  {item.model} · {item.baseUrl}
                </small>
              </span>
              <div className="model-badges">
                {defaultModelProfileId === item.id && <em className="default">默认</em>}
                <em className={item.enabled ? 'enabled' : ''}>{item.enabled ? '已启用' : '已停用'}</em>
              </div>
            </div>
            {testResults[item.id] && (
              <p className={`model-test-result ${testResults[item.id].ok ? 'success' : 'failed'}`}>
                {testResults[item.id].text}
              </p>
            )}
            <div className="model-profile-actions">
              {defaultModelProfileId !== item.id && (
                <button type="button" onClick={() => onDefaultChange(item.id)}>
                  设为默认
                </button>
              )}
              <button
                type="button"
                disabled={testingId === item.id || !item.enabled}
                onClick={() => void testModel(item)}
              >
                {testingId === item.id ? '测试中…' : '测试连接'}
              </button>
              <button type="button" onClick={() => editModel(item)}>
                编辑
              </button>
              <button className="danger" type="button" onClick={() => void handleDelete(item.id, item.name)}>
                删除
              </button>
            </div>
          </article>
        ))}
      </section>
      {showForm && (
        <>
          <h2>{editingId ? '编辑模型' : '添加模型'}</h2>
          <form className="settings-card model-editor" onSubmit={(e) => void save(e)}>
            <label>
              <span>配置名称</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：DeepSeek" />
            </label>
            <label>
              <span>API 地址</span>
              <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.deepseek.com" />
            </label>
            <label>
              <span>模型 ID</span>
              <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="模型 ID" />
            </label>
            <label>
              <span>API Key</span>
              <input
                value={apiKey}
                type="password"
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={editingId ? '留空则保留现有密钥' : '输入 API Key'}
              />
            </label>
            <label>
              <span>温度</span>
              <input
                value={temperature}
                type="number"
                min="0"
                max="2"
                step="0.1"
                onChange={(e) => setTemperature(e.target.value)}
              />
            </label>
            <label>
              <span>请求超时（秒）</span>
              <input
                value={timeoutSeconds}
                type="number"
                min="1"
                max="1800"
                onChange={(e) => setTimeoutSeconds(e.target.value)}
              />
            </label>
            <label className="model-system-prompt">
              <span>系统提示词</span>
              <textarea
                value={systemPrompt}
                rows={3}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="可选"
              />
            </label>
            <label className="model-enabled">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              <span>启用此模型</span>
            </label>
            {error && <p className="form-error">{error}</p>}
            <div className="model-editor-actions">
              <button
                type="button"
                onClick={() => {
                  resetForm()
                  setShowForm(false)
                }}
              >
                取消
              </button>
              <button className="primary-button" type="submit">
                {editingId ? '保存修改' : '添加模型'}
              </button>
            </div>
          </form>
        </>
      )}
    </>
  )
}
