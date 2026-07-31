import { useEffect, useState } from 'react'
import { FolderOpen } from 'lucide-react'
import { useTaskStore } from '../../store/tasks'
import { useWorkspaceStore } from '../../store/workspaces'
import { useModelStore } from '../../store/models'
import { useUIStore } from '../../store/ui'
import type { PermissionMode, TaskEvent } from '../../../../shared/contracts'
import { formatTime } from '../../utils/format'

export function TaskDetail() {
  const { activeTask, continueTask, cancelTask, retryTask, setError } = useTaskStore()
  const { currentWorkspacePath } = useWorkspaceStore()
  const { selectedProfileId, profiles } = useModelStore()
  const { defaultPermissionMode } = useUIStore()
  const [prompt, setPrompt] = useState('')
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(defaultPermissionMode)

  useEffect(() => {
    const unsubscribe = window.kova.onTaskEvent((event) => {
      // Handle task events in real-time
      if (activeTask?.task.id === event.taskId) {
        // Refresh task details
        useTaskStore.getState().selectTask(event.taskId)
      }
    })
    return unsubscribe
  }, [activeTask?.task.id])

  const isRunning = activeTask?.task.status === 'running'

  async function handleSubmit() {
    if (!activeTask || !prompt.trim()) return

    setError(null)
    const userPrompt = prompt.trim()
    setPrompt('')

    try {
      await continueTask({ taskId: activeTask.task.id, prompt: userPrompt })
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error))
    }
  }

  async function handleRetry() {
    if (!activeTask) return
    try {
      await retryTask(activeTask.task.id)
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error))
    }
  }

  async function handleCancel() {
    if (!activeTask) return
    await cancelTask(activeTask.task.id)
  }

  if (!activeTask) {
    return (
      <div className="conversation">
        <div className="welcome">
          <div className="welcome-icon">✦</div>
          <h2>开始新任务</h2>
          <p>描述你想完成的工作。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="conversation">
      <header className="conversation-header">
        <h1>{activeTask.task.title}</h1>
        <div className="header-actions">
          {isRunning && (
            <button className="ghost-button danger" type="button" onClick={handleCancel}>
              停止
            </button>
          )}
          {(activeTask.task.status === 'failed' || activeTask.task.status === 'cancelled') && (
            <button className="ghost-button" type="button" onClick={handleRetry}>
              重试
            </button>
          )}
        </div>
      </header>

      <section className="event-stream" aria-live="polite">
        {activeTask.events.map((event) => (
          <EventItem key={event.id} event={event} />
        ))}
      </section>

      <footer className="composer">
        <div className="composer-box">
          <textarea
            value={prompt}
            disabled={isRunning}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleSubmit()
              }
            }}
            placeholder={isRunning ? '任务运行中…' : '随心输入'}
            rows={2}
            aria-label="会话输入"
          />
          <div className="composer-toolbar">
            <div className="composer-context">
              <button className="composer-context-button" type="button" disabled>
                <FolderOpen aria-hidden="true" />
                <span>{activeTask.workspace?.name ?? '未关联'}</span>
              </button>
            </div>
            <div className="composer-controls">
              <select
                aria-label="模型"
                value={selectedProfileId}
                disabled
              >
                {profiles.filter((p) => p.enabled).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <select
                aria-label="权限模式"
                value={permissionMode}
                disabled
                onChange={(e) => setPermissionMode(e.target.value as PermissionMode)}
              >
                <option value="plan">只读</option>
                <option value="acceptEdits">工作区</option>
                <option value="dontAsk">完全访问</option>
              </select>
              <button
                className="send-button"
                type="button"
                disabled={!prompt.trim() || isRunning}
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

function EventItem({ event }: { event: TaskEvent }) {
  const eventLabels: Record<TaskEvent['type'], string> = {
    user_message: '你',
    model_message: '模型',
    plan: '计划',
    capability_call: '调用能力',
    capability_result: '能力结果',
    cli_output: 'CLI',
    permission_request: '权限请求',
    permission_result: '权限结果',
    artifact: '产物',
    system: '系统',
    error: '错误',
    completed: '完成'
  }

  return (
    <article className={`event event-${event.type}`}>
      {event.type !== 'user_message' && event.type !== 'model_message' && (
        <div className="event-icon">
          {event.type === 'error' ? '✕' : event.type === 'cli_output' ? '⌘' : '◇'}
        </div>
      )}
      <div className="event-content">
        {event.type !== 'user_message' && (
          <div className="event-meta">
            <strong>{event.type === 'model_message' ? '已处理' : eventLabels[event.type]}</strong>
            <time>{formatTime(event.createdAt)}</time>
          </div>
        )}
        <p>{event.type === 'completed' ? '任务已完成' : event.text}</p>
      </div>
    </article>
  )
}
