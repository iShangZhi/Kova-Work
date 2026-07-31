import { useState } from 'react'
import { FolderOpen } from 'lucide-react'
import { useTaskStore } from '../../store/tasks'
import { useWorkspaceStore } from '../../store/workspaces'
import { useModelStore } from '../../store/models'
import { useUIStore } from '../../store/ui'
import { workspaceName } from '../../utils/format'
import type { PermissionMode } from '../../../../shared/contracts'

export function TaskCreate() {
  const { startTask, setError } = useTaskStore()
  const { currentWorkspacePath, chooseWorkspace } = useWorkspaceStore()
  const { selectedProfileId, profiles } = useModelStore()
  const { defaultPermissionMode } = useUIStore()
  const [prompt, setPrompt] = useState('')
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(defaultPermissionMode)

  async function handleChooseWorkspace() {
    const chosen = await chooseWorkspace()
    if (chosen) {
      useWorkspaceStore.setState({ currentWorkspacePath: chosen })
    }
  }

  async function handleSubmit() {
    const objective = prompt.trim()
    if (!objective) return

    if (!currentWorkspacePath) {
      setError('请先选择 Agent 工作目录。')
      return
    }

    if (!selectedProfileId) {
      setError('请先在设置中添加并选择模型配置。')
      return
    }

    setError(null)
    setPrompt('')

    try {
      await startTask({
        objective,
        workspace: currentWorkspacePath,
        modelProfileId: selectedProfileId,
        permissionMode
      })
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <div className="conversation">
      <div className="welcome">
        <div className="welcome-icon">✦</div>
        <h2>开始新任务</h2>
        <p>描述你想完成的工作。</p>
      </div>

      <footer className="composer">
        <div className="composer-box">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleSubmit()
              }
            }}
            placeholder="随心输入"
            rows={2}
            aria-label="会话输入"
          />
          <div className="composer-toolbar">
            <div className="composer-context">
              <button
                className="composer-context-button"
                type="button"
                onClick={handleChooseWorkspace}
              >
                <FolderOpen aria-hidden="true" />
                <span>{currentWorkspacePath ? workspaceName(currentWorkspacePath) : '选择项目'}</span>
              </button>
            </div>
            <div className="composer-controls">
              <select
                aria-label="模型"
                value={selectedProfileId}
                onChange={(e) => useModelStore.setState({ selectedProfileId: e.target.value })}
              >
                <option value="">选择模型</option>
                {profiles.filter((p) => p.enabled).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <select
                aria-label="权限模式"
                value={permissionMode}
                onChange={(e) => setPermissionMode(e.target.value as PermissionMode)}
              >
                <option value="plan">只读</option>
                <option value="acceptEdits">工作区</option>
                <option value="dontAsk">完全访问</option>
              </select>
              <button
                className="send-button"
                type="button"
                disabled={!prompt.trim()}
                onClick={handleSubmit}
              >
                ↑
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
