import { useEffect, useMemo, useState } from 'react'
import type {
  AgentDefinition,
  AgentEvent,
  AgentId,
  AgentSession,
  ModelProfile,
  ClaudeWorkflowProfile,
  PermissionMode,
  PluginDefinition,
  PluginStatus,
  Task,
  TaskEvent,
  TaskWithDetails,
  WorkflowStage,
  SessionWithEvents
} from '../../shared/contracts'
import kovaIcon from '../../../resources/kova-icon.svg'

type ViewId = 'today' | 'projects' | 'tasks' | 'agents' | 'plugins' | 'settings'
type ThemeMode = 'dark' | 'light'
type AccentId = 'violet' | 'blue' | 'green' | 'orange' | 'rose'
type TaskFilter = 'all' | 'running' | 'completed' | 'failed'

const eventLabels: Record<AgentEvent['type'], string> = {
  user_message: '你',
  agent_message: 'Agent',
  progress: '进度',
  tool: '工具',
  permission: '权限',
  system: '系统',
  error: '错误',
  completed: '完成'
}

const taskEventLabels: Record<TaskEvent['type'], string> = {
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

const accents: Array<{ id: AccentId; name: string; color: string }> = [
  { id: 'violet', name: '星云紫', color: '#7167ff' },
  { id: 'blue', name: '深海蓝', color: '#3984ff' },
  { id: 'green', name: '松石绿', color: '#25a97f' },
  { id: 'orange', name: '日落橙', color: '#e67836' },
  { id: 'rose', name: '珊瑚红', color: '#df5d7d' }
]

const pluginStatusLabels: Record<PluginStatus, string> = {
  ready: '运行就绪',
  detected: '运行待接入',
  missing: '缺少依赖',
  error: '依赖异常'
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}

function statusLabel(status: AgentSession['status']): string {
  return {
    idle: '空闲',
    running: '运行中',
    completed: '已完成',
    failed: '失败',
    cancelled: '已终止'
  }[status]
}

function workspaceName(path: string): string {
  return path.split('/').filter(Boolean).at(-1) ?? path
}

export function App(): React.JSX.Element {
  const [view, setView] = useState<ViewId>('today')
  const [agents, setAgents] = useState<AgentDefinition[]>([])
  const [plugins, setPlugins] = useState<PluginDefinition[]>([])
  const [pluginsScannedAt, setPluginsScannedAt] = useState('')
  const [scanningPlugins, setScanningPlugins] = useState(false)
  const [modelProfiles, setModelProfiles] = useState<ModelProfile[]>([])
  const [workflowProfiles, setWorkflowProfiles] = useState<ClaudeWorkflowProfile[]>([])
  const [sessions, setSessions] = useState<AgentSession[]>([])
  const [active, setActive] = useState<SessionWithEvents | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [activeTask, setActiveTask] = useState<TaskWithDetails | null>(null)
  const [workspace, setWorkspace] = useState('')
  const [agentId, setAgentId] = useState<AgentId>('claude')
  const [permissionMode, setPermissionMode] = useState<PermissionMode>('plan')
  const [workflowStage, setWorkflowStage] = useState<WorkflowStage>('development')
  const [claudeAgent, setClaudeAgent] = useState('claude')
  const [workflowProfileId, setWorkflowProfileId] = useState('')
  const [modelProfileId, setModelProfileId] = useState('')
  const [prompt, setPrompt] = useState('')
  const [showInspector, setShowInspector] = useState(false)
  const [error, setError] = useState('')
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all')
  const [expandedPluginId, setExpandedPluginId] = useState<string | null>(null)
  const [themeMode, setThemeMode] = useState<ThemeMode>(
    () => (localStorage.getItem('kova-theme') as ThemeMode | null) ?? 'light'
  )
  const [accent, setAccent] = useState<AccentId>(
    () => (localStorage.getItem('kova-accent') as AccentId | null) ?? 'violet'
  )

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === agentId),
    [agents, agentId]
  )

  const projects = useMemo(() => {
    const grouped = new Map<string, AgentSession[]>()
    sessions.filter((session) => session.agentId !== 'model').forEach((session) => {
      const current = grouped.get(session.workspace) ?? []
      current.push(session)
      grouped.set(session.workspace, current)
    })
    return [...grouped.entries()].map(([path, projectSessions]) => ({
      path,
      name: workspaceName(path),
      sessions: projectSessions
    }))
  }, [sessions])

  const runningCount = sessions.filter((session) => session.status === 'running').length
  const completedCount = sessions.filter((session) => session.status === 'completed').length
  const attentionCount = sessions.filter((session) => session.status === 'failed').length
  const attentionSessions = sessions.filter((session) => session.status === 'failed')
  const filteredSessions =
    taskFilter === 'all' ? sessions : sessions.filter((session) => session.status === taskFilter)

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode
    localStorage.setItem('kova-theme', themeMode)
  }, [themeMode])

  useEffect(() => {
    document.documentElement.dataset.accent = accent
    localStorage.setItem('kova-accent', accent)
  }, [accent])

  useEffect(() => {
    void Promise.all([window.kova.listAgents(), window.kova.listSessions(), window.kova.listPlugins(), window.kova.listModelProfiles(), window.kova.listWorkflowProfiles(), window.kova.listTasks()]).then(
      ([agentItems, sessionItems, pluginResult, modelItems, workflowItems, taskItems]) => {
        setAgents(agentItems)
        setSessions(sessionItems)
        setPlugins(pluginResult.plugins)
        setPluginsScannedAt(pluginResult.scannedAt)
        setModelProfiles(modelItems)
        setWorkflowProfiles(workflowItems)
        setTasks(taskItems)
        setWorkflowProfileId(workflowItems.find((item) => item.stage === 'development')?.id ?? '')
        setModelProfileId(modelItems[0]?.id ?? '')
        const preferred = agentItems.find((agent) => agent.id === 'claude' && agent.available)
        if (preferred) setAgentId(preferred.id)
      }
    ).catch((cause) => setError(`初始化失败：${cause instanceof Error ? cause.message : String(cause)}`))

    const unsubscribeAgent = window.kova.onAgentEvent((event) => {
      setActive((current) =>
        current?.session.id === event.sessionId
          ? {
              session: {
                ...current.session,
                status:
                  event.type === 'completed'
                    ? 'completed'
                    : event.type === 'error'
                      ? 'failed'
                      : current.session.status
              },
              events: current.events.some((item) => item.id === event.id) ? current.events : [...current.events, event]
            }
          : current
      )
      void refreshSessions()
    })
    const unsubscribeTask = window.kova.onTaskEvent((event) => {
      setActiveTask((current) =>
        current?.task.id === event.taskId
          ? {
              ...current,
              task: {
                ...current.task,
                status:
                  event.type === 'completed'
                    ? 'completed'
                    : event.type === 'error'
                      ? 'failed'
                      : current.task.status
              },
              events: current.events.some((item) => item.id === event.id)
                ? current.events
                : [...current.events, event]
            }
          : current
      )
      void refreshTasks()
    })
    return () => {
      unsubscribeAgent()
      unsubscribeTask()
    }
  }, [])

  async function refreshSessions(): Promise<void> {
    setSessions(await window.kova.listSessions())
  }

  async function refreshTasks(): Promise<void> {
    setTasks(await window.kova.listTasks())
  }

  async function rescanPlugins(): Promise<void> {
    setScanningPlugins(true)
    try {
      const result = await window.kova.rescanPlugins()
      setPlugins(result.plugins)
      setPluginsScannedAt(result.scannedAt)
      setAgents(await window.kova.listAgents())
    } finally {
      setScanningPlugins(false)
    }
  }

  async function selectSession(sessionId: string): Promise<void> {
    const next = await window.kova.getSession(sessionId)
    setActive(next)
    setActiveTask(null)
    setView('agents')
    if (next) {
      setWorkspace(next.session.workspace)
      setAgentId(next.session.agentId)
      setPermissionMode(next.session.permissionMode)
      setWorkflowStage(next.session.workflowStage ?? 'development')
      setClaudeAgent(next.session.claudeAgent ?? 'claude')
      setModelProfileId(next.session.modelProfileId ?? modelProfiles[0]?.id ?? '')
      const matchingWorkflow = workflowProfiles.find((item) => item.agentName === next.session.claudeAgent && item.stage === next.session.workflowStage)
      setWorkflowProfileId(matchingWorkflow?.id ?? '')
    }
  }

  async function selectTask(taskId: string): Promise<void> {
    const next = await window.kova.getTask(taskId)
    if (!next) return
    setActive(null)
    setActiveTask(next)
    setView('agents')
    setAgentId('model')
    setModelProfileId(next.task.modelProfileId)
    setPermissionMode(next.task.permissionMode)
    setWorkspace(next.workspace?.path ?? '')
  }

  async function chooseWorkspace(): Promise<void> {
    const chosen = await window.kova.chooseWorkspace()
    if (chosen) {
      setWorkspace(chosen)
      if (active) setActive(null)
      if (activeTask) setActiveTask(null)
    }
  }

  function newSession(): void {
    setActive(null)
    setActiveTask(null)
    setPrompt('')
    setError('')
    setShowInspector(false)
    setView('agents')
  }

  async function submit(): Promise<void> {
    const nextPrompt = prompt.trim()
    if (!nextPrompt) return
    if (!workspace) {
      setError('请先选择 Agent 工作目录。')
      return
    }
    if (agentId === 'model' && !modelProfileId) {
      setError('请先在设置中添加并选择模型配置。')
      return
    }

    setError('')
    setPrompt('')
    try {
      if (activeTask) {
        setError('新任务内核暂不支持追加指令，请先新建任务。')
        setPrompt(nextPrompt)
        return
      }
      if (active) {
        await window.kova.continueSession({ sessionId: active.session.id, prompt: nextPrompt })
        setActive(await window.kova.getSession(active.session.id))
      } else if (agentId === 'model') {
        const task = await window.kova.startTask({
          objective: nextPrompt,
          workspace,
          modelProfileId,
          allowedPluginIds: ['com.kova.claude-code'],
          permissionMode
        })
        setActiveTask((await window.kova.getTask(task.id)) ?? {
          task,
          runs: [],
          events: [],
          artifacts: []
        })
        await refreshTasks()
      } else {
        const session = await window.kova.startSession({
          agentId,
          workspace,
          prompt: nextPrompt,
          permissionMode
          ,workflowStage
          ,claudeAgent: agentId === 'claude' ? claudeAgent.trim() || undefined : undefined
          ,claudePromptPrefix: agentId === 'claude' ? workflowProfiles.find((item) => item.id === workflowProfileId)?.promptPrefix : undefined
        })
        setActive((await window.kova.getSession(session.id)) ?? { session, events: [] })
        await refreshSessions()
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError))
    }
  }

  async function cancel(): Promise<void> {
    if (activeTask) {
      await window.kova.cancelTask(activeTask.task.id)
      setActiveTask(await window.kova.getTask(activeTask.task.id))
      await refreshTasks()
      return
    }
    if (!active) return
    await window.kova.cancelSession(active.session.id)
    setActive(await window.kova.getSession(active.session.id))
    await refreshSessions()
  }

  async function renameActiveSession(): Promise<void> {
    if (!active) return
    await renameOneSession(active.session.id)
  }

  async function renameOneSession(sessionId: string): Promise<void> {
    const target = sessions.find((session) => session.id === sessionId)
    if (!target) return
    const title = window.prompt('修改任务名称', target.title)?.trim()
    if (!title || title === target.title) return

    const session = await window.kova.renameSession({ sessionId, title })
    if (active?.session.id === sessionId) setActive({ ...active, session })
    await refreshSessions()
  }

  async function deleteOneSession(sessionId: string): Promise<void> {
    const target = sessions.find((session) => session.id === sessionId)
    if (!window.confirm(`确定删除“${target?.title ?? '这个任务'}”及其对话记录吗？\n\n不会删除工作目录中的任何文件。`)) return

    await window.kova.deleteSession(sessionId)
    if (active?.session.id === sessionId) {
      setActive(null)
      setPrompt('')
    }
    await refreshSessions()
  }

  async function removeProjectRecords(path: string): Promise<void> {
    const projectSessions = sessions.filter((session) => session.workspace === path)
    if (!window.confirm(`确定从 Kova 中移除“${workspaceName(path)}”吗？\n\n将删除该项目的 ${projectSessions.length} 条任务和对话记录，但不会删除代码目录。`)) return

    await Promise.all(projectSessions.map((session) => window.kova.deleteSession(session.id)))
    if (active?.session.workspace === path) setActive(null)
    await refreshSessions()
  }

  const isRunning =
    active?.session.status === 'running' || activeTask?.task.status === 'running'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="window-drag" />
        <div className="brand">
          <span className="brand-mark"><img src={kovaIcon} alt="" /></span>
          <span>Kova</span>
        </div>
        <nav className="main-nav" aria-label="主导航">
          <button className={view === 'today' ? 'active' : ''} type="button" onClick={() => setView('today')}>
            今日
          </button>
          <button className={view === 'projects' ? 'active' : ''} type="button" onClick={() => setView('projects')}>
            项目
          </button>
          <button className={view === 'tasks' ? 'active' : ''} type="button" onClick={() => setView('tasks')}>
            任务
            {runningCount > 0 && <span className="nav-count">{runningCount}</span>}
          </button>
          <button className={view === 'agents' ? 'active' : ''} type="button" onClick={() => setView('agents')}>
            Agent
          </button>
          <button className={view === 'plugins' ? 'active' : ''} type="button" onClick={() => setView('plugins')}>
            扩展
          </button>
        </nav>

        <div className="sidebar-label">最近会话</div>
        <div className="session-list">
          {sessions.length === 0 && <p className="empty-copy">还没有会话</p>}
          {sessions.slice(0, 6).map((session) => (
            <div className={`session-nav-item ${active?.session.id === session.id && view === 'agents' ? 'active' : ''}`} key={session.id}>
              <button className="session-item" type="button" onClick={() => void selectSession(session.id)}>
                <span className={`status-pip ${session.status}`} />
                <span className="session-copy">
                  <strong>{session.title}</strong>
                  <small>{session.agentId} · {formatTime(session.updatedAt)}</small>
                </span>
              </button>
              <span className="session-nav-actions">
                <button type="button" aria-label={`重命名 ${session.title}`} onClick={() => void renameOneSession(session.id)}>重命名</button>
                <button type="button" aria-label={`删除 ${session.title}`} onClick={() => void deleteOneSession(session.id)}>删除</button>
              </span>
            </div>
          ))}
          {tasks.slice(0, 4).map((task) => (
            <div className={`session-nav-item ${activeTask?.task.id === task.id && view === 'agents' ? 'active' : ''}`} key={task.id}>
              <button className="session-item" type="button" onClick={() => void selectTask(task.id)}>
                <span className={`status-pip ${task.status}`} />
                <span className="session-copy">
                  <strong>{task.title}</strong>
                  <small>模型编排 · {formatTime(task.updatedAt)}</small>
                </span>
              </button>
            </div>
          ))}
        </div>
        <button
          className={`sidebar-action ${view === 'settings' ? 'active' : ''}`}
          type="button"
          onClick={() => setView('settings')}
        >
          设置
        </button>
      </aside>

      <section className="workspace-shell">
        {view === 'today' && (
          <main className="page-main">
            <PageHeader title="今日" description="你的开发任务、Agent 运行状态和待处理事项。" />
            <section className={`attention-panel ${attentionSessions.length === 0 ? 'clear' : ''}`}>
              <div className="attention-title">
                <span>⚠</span>
                <div>
                  <h2>等待你处理</h2>
                  <p>{attentionSessions.length === 0 ? '目前没有需要介入的异常任务。' : `${attentionSessions.length} 个任务需要你检查后继续。`}</p>
                </div>
              </div>
              {attentionSessions[0] && (
                <button type="button" onClick={() => void selectSession(attentionSessions[0].id)}>
                  查看“{attentionSessions[0].title}” →
                </button>
              )}
            </section>
            <div className="metric-grid">
              <MetricCard label="进行中" value={runningCount} detail="正在运行的 Agent 任务" />
              <MetricCard label="需要关注" value={attentionCount} detail="执行失败或需要处理" />
              <MetricCard label="已完成" value={completedCount} detail="历史完成会话" />
            </div>
            <div className="content-grid">
              <section className="panel">
                <div className="panel-heading">
                  <div><h2>当前任务</h2><p>最近更新的开发工作</p></div>
                  <button className="text-button" type="button" onClick={() => setView('tasks')}>查看全部</button>
                </div>
                <SessionTable sessions={sessions.slice(0, 5)} onSelect={selectSession} />
              </section>
              <section className="panel">
                <div className="panel-heading"><div><h2>Agent 状态</h2><p>本机可用的执行能力</p></div></div>
                <div className="agent-summary-list">
                  {agents.map((agent) => (
                    <div className="agent-summary" key={agent.id}>
                      <span className={`agent-logo agent-${agent.id}`}>{agent.id}</span>
                      <span><strong>{agent.name}</strong><small>{agent.version ?? '未安装'}</small></span>
                      <span className={`availability-badge ${agent.available ? 'ready' : ''}`}>
                        {agent.available ? '可用' : agent.version ? '待接入' : '不可用'}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </main>
        )}

        {view === 'projects' && (
          <main className="page-main">
            <PageHeader title="项目" description="项目按工作目录自动归集，拥有独立任务和 Agent 上下文。" />
            {projects.length === 0 ? (
              <EmptyState title="还没有项目" description="在 Agent 中选择工作目录并开始会话后，项目会自动出现在这里。" />
            ) : (
              <div className="project-grid">
                {projects.map((project) => (
                  <article className="panel project-card" key={project.path}>
                    <div className="project-icon">{project.name[0]}</div>
                    <div>
                      <h2>{project.name}</h2>
                      <p className="path-text">{project.path}</p>
                    </div>
                    <dl>
                      <div><dt>任务</dt><dd>{project.sessions.length}</dd></div>
                      <div><dt>运行中</dt><dd>{project.sessions.filter((item) => item.status === 'running').length}</dd></div>
                      <div><dt>最近活动</dt><dd>{formatTime(project.sessions[0].updatedAt)}</dd></div>
                    </dl>
                    <div className="project-actions">
                      <button className="secondary-button" type="button" onClick={() => void selectSession(project.sessions[0].id)}>
                        打开最近任务 →
                      </button>
                      <button className="delete-button" type="button" onClick={() => void removeProjectRecords(project.path)}>
                        移除记录
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </main>
        )}

        {view === 'tasks' && (
          <main className="page-main">
            <PageHeader title="任务" description="任务是需求、Agent 会话和最终结果的统一载体。" />
            <section className="panel">
              <div className="panel-heading">
                <div><h2>全部任务</h2><p>当前版本由 Agent 会话自动生成任务记录</p></div>
                <div className="filter-control" aria-label="任务筛选">
                  {([
                    ['all', '全部'],
                    ['running', '进行中'],
                    ['completed', '已完成'],
                    ['failed', '失败']
                  ] as Array<[TaskFilter, string]>).map(([id, label]) => (
                    <button className={taskFilter === id ? 'active' : ''} type="button" key={id} onClick={() => setTaskFilter(id)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <SessionTable sessions={filteredSessions} onSelect={selectSession} />
            </section>
          </main>
        )}

        {view === 'agents' && (
          <div className={`agent-layout ${showInspector ? '' : 'inspector-hidden'}`}>
            <main className="conversation">
              <header className="conversation-header">
                <div>
                  <h1>{activeTask?.task.title ?? active?.session.title ?? '新建 AI 任务'}</h1>
                  <p>{activeTask
                    ? `${modelProfiles.find((item) => item.id === activeTask.task.modelProfileId)?.name ?? '自定义模型'} · ${statusLabel(activeTask.task.status === 'waiting' || activeTask.task.status === 'queued' || activeTask.task.status === 'draft' ? 'idle' : activeTask.task.status)}`
                    : active
                      ? `${active.session.agentId === 'model' ? modelProfiles.find((item) => item.id === active.session.modelProfileId)?.name ?? '自定义模型' : active.session.agentId} · ${statusLabel(active.session.status)}`
                      : '选择模型或直接运行 CLI'}</p>
                </div>
                <div className="header-actions">
                  <button className="icon-button" type="button" aria-label="新建会话" title="新建会话" onClick={newSession}>
                    +
                  </button>
                  {isRunning && (
                    <button className="ghost-button danger" type="button" onClick={() => void cancel()}>
                      停止
                    </button>
                  )}
                  <button className="ghost-button" type="button" onClick={() => setShowInspector((visible) => !visible)}>
                    {showInspector ? '收起配置' : '显示配置'}
                  </button>
                </div>
              </header>

              <section className="event-stream" aria-live="polite">
                {!active && !activeTask && (
                  <div className="welcome">
                    <div className="welcome-icon">✦</div>
                    <h2>让模型调用本地能力开始工作</h2>
                    <p>选择自定义模型和工作目录，由模型规划并调用 Claude Code；也可以直接运行 CLI。</p>
                  </div>
                )}
                {active?.events.map((event) => (
                  <article className={`event event-${event.type}`} key={event.id}>
                    <div className="event-icon">
                      {event.type === 'error' ? '✕' :
                        event.type === 'completed' ? '✓' :
                        event.type === 'tool' ? '⌘' :
                        event.type === 'progress' ? '◌' :
                        event.type === 'user_message' ? '◆' :
                        '◇'}
                    </div>
                    <div className="event-content">
                      <div className="event-meta"><strong>{eventLabels[event.type]}</strong><time>{formatTime(event.createdAt)}</time></div>
                      <p>{event.text}</p>
                    </div>
                  </article>
                ))}
                {activeTask?.events.map((event) => (
                  <article className={`event event-${event.type}`} key={event.id}>
                    <div className="event-icon">
                      {event.type === 'error' ? '✕' :
                        event.type === 'completed' ? '✓' :
                        event.type === 'capability_call' || event.type === 'cli_output' ? '⌘' :
                        event.type === 'user_message' ? '◆' :
                        '◇'}
                    </div>
                    <div className="event-content">
                      <div className="event-meta"><strong>{taskEventLabels[event.type]}</strong><time>{formatTime(event.createdAt)}</time></div>
                      <p>{event.text}</p>
                    </div>
                  </article>
                ))}
              </section>

              <footer className="composer">
                {error && <div className="inline-error">⚠ {error}</div>}
                <div className="composer-box">
                  <textarea
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        void submit()
                      }
                    }}
                    placeholder={active || activeTask ? '继续描述任务…' : '描述你希望完成的任务…'}
                    rows={3}
                    aria-label="会话输入"
                  />
                  <button className="send-button" type="button" aria-label={isRunning ? '加入执行队列' : '发送'} title={isRunning ? '当前轮结束后自动继续' : '发送'} disabled={!prompt.trim()} onClick={() => void submit()}>
                    →
                  </button>
                </div>
                <p className="composer-hint">{isRunning ? 'Agent 正在运行 · 现在发送的指令会自动排队' : 'Enter 发送 · Shift + Enter 换行'}</p>
              </footer>
            </main>

            {showInspector && (
              <aside className="inspector">
                <div className="inspector-title"><h2>运行信息</h2></div>
                <label>
                  <span>Agent</span>
                  <select
                    value={agentId}
                    disabled={isRunning}
                    onChange={(event) => {
                      setAgentId(event.target.value as AgentId)
                      if (active) setActive(null)
                      if (activeTask) setActiveTask(null)
                    }}
                  >
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id} disabled={!agent.available}>
                        {agent.name}{agent.available ? '' : agent.version ? '（待接入）' : '（未安装）'}
                      </option>
                    ))}
                    <option value="model" disabled={modelProfiles.length === 0}>AI 编排（模型 + 插件）{modelProfiles.length ? '' : '（请先配置）'}</option>
                  </select>
                </label>
                {agentId !== 'model' && selectedAgent && (
                  <div className={`availability ${selectedAgent.available ? 'available' : ''}`}>
                    <span className="status-pip completed" />
                    <span>{selectedAgent.available ? selectedAgent.version : '当前电脑不可用'}</span>
                  </div>
                )}
                {agentId === 'model' && <label><span>编排模型</span><select value={modelProfileId} disabled={isRunning} onChange={(event) => { setModelProfileId(event.target.value); if (active) setActive(null); if (activeTask) setActiveTask(null) }}>{modelProfiles.map((model) => <option key={model.id} value={model.id}>{model.name} · {model.model}</option>)}</select></label>}
                <label>
                  <span>权限模式</span>
                  <select
                    value={permissionMode}
                    disabled={isRunning}
                    onChange={(event) => {
                      setPermissionMode(event.target.value as PermissionMode)
                      if (active) setActive(null)
                    }}
                  >
                    <option value="plan">规划（只读）</option>
                    <option value="dontAsk">严格（无法确认则拒绝）</option>
                    <option value="acceptEdits">允许项目内编辑</option>
                  </select>
                </label>
                {agentId === 'claude' && <>
                  <label><span>阶段 Agent</span><select value={workflowProfileId} disabled={isRunning} onChange={(event) => {
                    const selected = workflowProfiles.find((item) => item.id === event.target.value)
                    setWorkflowProfileId(event.target.value)
                    if (selected) { setWorkflowStage(selected.stage); setClaudeAgent(selected.agentName) }
                    if (active) setActive(null)
                  }}>{workflowProfiles.map((profile) => <option key={profile.id} value={profile.id}>{({ design: '设计', development: '开发', testing: '测试' })[profile.stage]} · {profile.name}</option>)}</select></label>
                  <label><span>Claude Agent</span><input className="inspector-input" value={claudeAgent} disabled={isRunning} onChange={(event) => setClaudeAgent(event.target.value)} placeholder="例如：developer" /></label>
                </>}
                <div className="field-group">
                  <span>工作目录</span>
                  <button className="workspace-button" type="button" disabled={isRunning} onClick={() => void chooseWorkspace()}>
                    <span>{workspace || '选择目录'}</span>
                  </button>
                </div>
                <div className="separator" />
                <dl className="run-details">
                  <div><dt>状态</dt><dd>{activeTask
                    ? statusLabel(activeTask.task.status === 'waiting' || activeTask.task.status === 'queued' || activeTask.task.status === 'draft' ? 'idle' : activeTask.task.status)
                    : active ? statusLabel(active.session.status) : '未开始'}</dd></div>
                  <div><dt>会话 ID</dt><dd>{active?.session.nativeSessionId?.slice(0, 8) ?? '—'}</dd></div>
                  <div><dt>事件数</dt><dd>{activeTask?.events.length ?? active?.events.length ?? 0}</dd></div>
                </dl>
                <div className="safety-note"><strong>安全边界</strong><p>客户端不会提供跳过全部权限的运行模式。</p></div>
              </aside>
            )}
          </div>
        )}

        {view === 'plugins' && (
          <main className="page-main">
            <div className="page-header">
              <div>
                <h1>CLI 能力</h1>
                <p>查看模型可以调用的本地 CLI 插件、依赖和权限范围。</p>
              </div>
              <button className="extension-action" type="button" disabled={scanningPlugins} onClick={() => void rescanPlugins()}>
                {scanningPlugins ? '检查中' : '检查依赖'}
              </button>
            </div>
            <div className="plugin-summary">
              <span>{plugins.length} 个已注册</span>
              <span>{plugins.filter((plugin) => plugin.status === 'ready').length} 个运行就绪</span>
              <span>{plugins.filter((plugin) => plugin.status !== 'ready').length} 个需要处理</span>
              {pluginsScannedAt && <time>最近依赖检查：{formatTime(pluginsScannedAt)}</time>}
            </div>
            <div className="plugin-list">
              {plugins.map((plugin) => (
                <article className="panel plugin-card" key={plugin.id}>
                  <div className="plugin-card-header">
                    <span className="plugin-icon">{plugin.name[0]}</span>
                    <div>
                      <h2>{plugin.name}</h2>
                      <p>{plugin.description}</p>
                    </div>
                    <span className={`plugin-status status-${plugin.status}`}>{pluginStatusLabels[plugin.status]}</span>
                  </div>
                  <button className="plugin-expand" type="button" aria-expanded={expandedPluginId === plugin.id} onClick={() => setExpandedPluginId((current) => current === plugin.id ? null : plugin.id)}>
                    {expandedPluginId === plugin.id ? '收起 Manifest 与依赖 ↑' : '查看 Manifest 与依赖 ↓'}
                  </button>
                  {expandedPluginId === plugin.id && <div className="plugin-expanded">
                  <dl className="plugin-details">
                    <div><dt>Manifest ID</dt><dd>{plugin.id}</dd></div>
                    <div><dt>插件版本</dt><dd>{plugin.pluginVersion}</dd></div>
                    <div><dt>依赖版本</dt><dd>{plugin.cliVersion ?? '无 CLI 依赖'}</dd></div>
                    <div><dt>依赖路径</dt><dd>{plugin.executablePath ?? '—'}</dd></div>
                    <div><dt>运行协议</dt><dd>{plugin.protocol}</dd></div>
                  </dl>
                  <div className="capability-list">
                    {plugin.capabilities.map((capability) => <span key={capability}>{capability}</span>)}
                  </div>
                  <div className="plugin-footer">
                    <span>依赖检查：{plugin.statusMessage}</span>
                    <span>文件：{plugin.permissions.filesystem === 'selected-workspace' ? '所选工作目录' : '不访问'} · 网络：{plugin.permissions.network ? '允许' : '禁用'}</span>
                  </div>
                  </div>}
                </article>
              ))}
            </div>
          </main>
        )}

        {view === 'settings' && (
          <main className="page-main settings-page">
            <div className="page-header"><div><h1>设置</h1><p>调整客户端外观和默认体验。</p></div></div>
            <section className="panel settings-section">
              <div><h2>外观</h2><p>皮肤设置保存在本机，下次启动会自动恢复。</p></div>
              <div className="setting-row">
                <div><strong>显示模式</strong><small>切换深色或浅色界面</small></div>
                <div className="segmented-control">
                  <button className={themeMode === 'dark' ? 'active' : ''} type="button" onClick={() => setThemeMode('dark')}>深色</button>
                  <button className={themeMode === 'light' ? 'active' : ''} type="button" onClick={() => setThemeMode('light')}>浅色</button>
                </div>
              </div>
              <div className="setting-row accent-setting">
                <div><strong>主题颜色</strong><small>用于按钮、选中状态和运行标识</small></div>
                <div className="accent-options">
                  {accents.map((item) => (
                    <button
                      key={item.id}
                      className={accent === item.id ? 'active' : ''}
                      type="button"
                      aria-label={item.name}
                      title={item.name}
                      style={{ '--swatch': item.color } as React.CSSProperties}
                      onClick={() => setAccent(item.id)}
                    />
                  ))}
                </div>
              </div>
            </section>
            <section className="panel settings-section">
              <div><h2>Agent 客户端</h2><p>当前检测到的本地 Agent。</p></div>
              <div className="agent-summary-list">
                {agents.map((agent) => (
                  <div className="agent-summary" key={agent.id}>
                    <span className={`agent-logo agent-${agent.id}`}>{agent.id}</span>
                    <span><strong>{agent.name}</strong><small>{agent.description}</small></span>
                    <span className={`availability-badge ${agent.available ? 'ready' : ''}`}>{agent.available ? '可用' : agent.version ? '待接入' : '未安装'}</span>
                  </div>
                ))}
              </div>
            </section>
            <ModelSettings
              models={modelProfiles}
              onSaved={(model) => {
                setModelProfiles((current) => [model, ...current])
                setModelProfileId((current) => current || model.id)
              }}
              onDeleted={(id) => {
                setModelProfiles((current) => current.filter((item) => item.id !== id))
                if (modelProfileId === id) setModelProfileId('')
              }}
            />
            <WorkflowSettings
              profiles={workflowProfiles}
              onSaved={(profile) => setWorkflowProfiles((current) => {
                const exists = current.some((item) => item.id === profile.id)
                return exists ? current.map((item) => item.id === profile.id ? profile : item) : [...current, profile]
              })}
              onDeleted={(id) => setWorkflowProfiles((current) => current.filter((item) => item.id !== id))}
            />
          </main>
        )}
      </section>
    </div>
  )
}

function PageHeader({
  title,
  description
}: {
  title: string
  description: string
}): React.JSX.Element {
  return (
    <div className="page-header">
      <div><h1>{title}</h1><p>{description}</p></div>
    </div>
  )
}

function ModelSettings({ models, onSaved, onDeleted }: { models: ModelProfile[]; onSaved: (model: ModelProfile) => void; onDeleted: (id: string) => void }): React.JSX.Element {
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1')
  const [model, setModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('你是一个严谨、清晰的 AI 助手。')
  const [error, setError] = useState('')

  async function save(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setError('')
    try {
      const saved = await window.kova.saveModelProfile({ name, baseUrl, model, apiKey, systemPrompt, temperature: 0.7 })
      onSaved(saved)
      setName(''); setModel(''); setApiKey('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  return (
    <section className="panel settings-section">
      <div><h2>自定义模型</h2><p>支持 OpenAI 兼容接口；配置后可像本地 Agent 一样创建和继续会话。</p></div>
      <form className="settings-form" onSubmit={(event) => void save(event)}>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="配置名称，例如：公司 GPT"/>
        <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="接口地址，例如：https://api.openai.com/v1"/>
        <input value={model} onChange={(event) => setModel(event.target.value)} placeholder="模型 ID"/>
        <input value={apiKey} type="password" onChange={(event) => setApiKey(event.target.value)} placeholder="API Key（仅保存在本机）"/>
        <textarea value={systemPrompt} onChange={(event) => setSystemPrompt(event.target.value)} rows={2} placeholder="系统提示词"/>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button" type="submit">保存模型</button>
      </form>
      <div className="config-list">{models.map((item) => <div key={item.id}><span><strong>{item.name}</strong><small>{item.model} · {item.baseUrl}</small></span><button className="delete-button" onClick={() => void window.kova.deleteModelProfile(item.id).then(() => onDeleted(item.id))}>删除</button></div>)}</div>
    </section>
  )
}

function WorkflowSettings({ profiles, onSaved, onDeleted }: { profiles: ClaudeWorkflowProfile[]; onSaved: (profile: ClaudeWorkflowProfile) => void; onDeleted: (id: string) => void }): React.JSX.Element {
  const [stage, setStage] = useState<WorkflowStage>('development')
  const [name, setName] = useState('')
  const [agentName, setAgentName] = useState('')
  const [prefix, setPrefix] = useState('')

  async function save(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    const saved = await window.kova.saveWorkflowProfile({ stage, name, agentName, promptPrefix: prefix })
    onSaved(saved)
    setName(''); setAgentName(''); setPrefix('')
  }

  return (
    <section className="panel settings-section">
      <div><h2>阶段 Agent</h2><p>把设计、开发、测试映射到不同的 <code>claude --agent</code>，并附加阶段提示词。</p></div>
      <form className="settings-form workflow-form" onSubmit={(event) => void save(event)}>
        <select value={stage} onChange={(event) => setStage(event.target.value as WorkflowStage)}><option value="design">设计</option><option value="development">开发</option><option value="testing">测试</option></select>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="配置名称"/>
        <input value={agentName} onChange={(event) => setAgentName(event.target.value)} placeholder="Claude Agent 名称"/>
        <textarea value={prefix} onChange={(event) => setPrefix(event.target.value)} rows={2} placeholder="阶段提示词前缀"/>
        <button className="primary-button" type="submit">添加阶段 Agent</button>
      </form>
      <div className="config-list">{profiles.map((item) => <div key={item.id}><span><strong>{({ design: '设计', development: '开发', testing: '测试' })[item.stage]} · {item.name}</strong><small>claude --agent {item.agentName}</small></span><button className="delete-button" onClick={() => void window.kova.deleteWorkflowProfile(item.id).then(() => onDeleted(item.id))}>删除</button></div>)}</div>
    </section>
  )
}

function MetricCard({ label, value, detail }: { label: string; value: number; detail: string }): React.JSX.Element {
  return (
    <article className="panel metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}

function SessionTable({
  sessions,
  onSelect
}: {
  sessions: AgentSession[]
  onSelect: (id: string) => Promise<void>
}): React.JSX.Element {
  if (sessions.length === 0) {
    return <div className="table-empty">暂无任务，创建第一个 Agent 任务后会显示在这里。</div>
  }

  return (
    <div className="task-table">
      {sessions.map((session) => (
        <div className="task-row" key={session.id}>
          <button className="task-open" type="button" onClick={() => void onSelect(session.id)}>
            <span className={`task-status-icon ${session.status}`}>
              {session.status === 'running' ? '◌' :
                session.status === 'completed' ? '✓' :
                session.status === 'failed' ? '✕' :
                '○'}
            </span>
            <span className="task-title"><strong>{session.title}</strong><small>{workspaceName(session.workspace)}</small></span>
            <span className="task-agent">{session.agentId}</span>
            <span className={`task-status ${session.status}`}>{statusLabel(session.status)}</span>
            <time>{formatTime(session.updatedAt)}</time>
            →
          </button>
        </div>
      ))}
    </div>
  )
}

function EmptyState({
  title,
  description,
  action
}: {
  title: string
  description: string
  action?: () => void
}): React.JSX.Element {
  return (
    <div className="empty-state">
      <span>◇</span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action && <button className="primary-button" type="button" onClick={action}>新建任务</button>}
    </div>
  )
}
