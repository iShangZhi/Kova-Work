import { useEffect, useMemo, useState } from 'react'
import {
  ChevronRight,
  CirclePlus,
  Folder,
  FolderPlus,
  Settings,
  SquarePen,
  Trash2,
  X
} from 'lucide-react'
import type {
  AgentDefinition,
  ModelProfile,
  PermissionMode,
  PluginDefinition,
  PluginStatus,
  RegisteredCapability,
  Task,
  TaskEvent,
  TaskStatus,
  TaskWithDetails,
  Workspace
} from '../../shared/contracts'
import packageInfo from '../../../package.json'

type ViewId = 'today' | 'projects' | 'tasks' | 'agents' | 'plugins' | 'settings'
type ThemeMode = 'dark' | 'light'
type TaskFilter = 'all' | 'running' | 'completed' | 'failed'
type ActivityStatus = TaskStatus

interface ActivityItem {
  key: string
  id: string
  kind: 'task'
  title: string
  workspacePath: string
  workspaceLabel: string
  source: string
  status: ActivityStatus
  updatedAt: string
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

function statusLabel(status: ActivityStatus): string {
  return {
    draft: '草稿',
    queued: '排队中',
    idle: '空闲',
    running: '运行中',
    waiting: '等待中',
    completed: '已完成',
    failed: '失败',
    cancelled: '已终止'
  }[status]
}

function workspaceName(path: string): string {
  return path.split('/').filter(Boolean).at(-1) ?? path
}

export function App(): React.JSX.Element {
  const [view, setView] = useState<ViewId>('agents')
  const [agents, setAgents] = useState<AgentDefinition[]>([])
  const [plugins, setPlugins] = useState<PluginDefinition[]>([])
  const [pluginsScannedAt, setPluginsScannedAt] = useState('')
  const [scanningPlugins, setScanningPlugins] = useState(false)
  const [modelProfiles, setModelProfiles] = useState<ModelProfile[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [activeTask, setActiveTask] = useState<TaskWithDetails | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [capabilities, setCapabilities] = useState<RegisteredCapability[]>([])
  const [workspace, setWorkspace] = useState('')
  const [permissionMode, setPermissionMode] = useState<PermissionMode>('acceptEdits')
  const [modelProfileId, setModelProfileId] = useState('')
  const [prompt, setPrompt] = useState('')
  const [error, setError] = useState('')
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all')
  const [expandedPluginId, setExpandedPluginId] = useState<string | null>(null)
  const [projectsExpanded, setProjectsExpanded] = useState(true)
  const [expandedProjectPaths, setExpandedProjectPaths] = useState<string[]>([])
  const [recentExpanded, setRecentExpanded] = useState(true)
  const [showCreateProject, setShowCreateProject] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [projectSourceFolders, setProjectSourceFolders] = useState<string[]>([])
  const [projectError, setProjectError] = useState('')
  const [creatingProject, setCreatingProject] = useState(false)
  const [themeMode, setThemeMode] = useState<ThemeMode>(
    () => (localStorage.getItem('kova-theme') as ThemeMode | null) ?? 'light'
  )

  const activityItems = useMemo<ActivityItem[]>(() => {
    const workspaceById = new Map(workspaces.map((item) => [item.id, item]))
    const modelById = new Map(modelProfiles.map((item) => [item.id, item]))
    return tasks.map((task) => {
      const taskWorkspace = task.workspaceId ? workspaceById.get(task.workspaceId) : undefined
      const taskModel = modelById.get(task.modelProfileId)
      return {
        key: `task:${task.id}`,
        id: task.id,
        kind: 'task' as const,
        title: task.title,
        workspacePath: taskWorkspace?.path ?? '',
        workspaceLabel: taskWorkspace?.name ?? '未关联目录',
        source: taskModel?.name ?? 'AI 编排',
        status: task.status,
        updatedAt: task.updatedAt
      }
    }).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  }, [tasks, workspaces, modelProfiles])

  const projects = useMemo(() => {
    const grouped = new Map<string, { name: string; items: ActivityItem[] }>(
      workspaces.map((item) => [item.path, { name: item.name, items: [] }])
    )
    activityItems.filter((item) => item.workspacePath).forEach((item) => {
      const current = grouped.get(item.workspacePath) ?? {
        name: item.workspaceLabel,
        items: []
      }
      current.items.push(item)
      grouped.set(item.workspacePath, current)
    })
    return [...grouped.entries()].map(([path, project]) => ({
      path,
      name: project.name || workspaceName(path),
      items: project.items
    }))
  }, [activityItems, workspaces])

  const runningCount = activityItems.filter((item) => item.status === 'running').length
  const completedCount = activityItems.filter((item) => item.status === 'completed').length
  const attentionItems = activityItems.filter((item) => item.status === 'failed')
  const attentionCount = attentionItems.length
  const filteredActivities =
    taskFilter === 'all' ? activityItems : activityItems.filter((item) => item.status === taskFilter)
  const nativeCapabilities = capabilities.filter((item) => item.pluginId === 'com.kova.core-tools')

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode
    localStorage.setItem('kova-theme', themeMode)
  }, [themeMode])

  useEffect(() => {
    void Promise.all([
      window.kova.listAgents(),
      window.kova.listPlugins(),
      window.kova.listModelProfiles(),
      window.kova.listTasks(),
      window.kova.listWorkspaces(),
      window.kova.listCapabilities()
    ]).then(
      ([agentItems, pluginResult, modelItems, taskItems, workspaceItems, capabilityItems]) => {
        setAgents(agentItems)
        setPlugins(pluginResult.plugins)
        setPluginsScannedAt(pluginResult.scannedAt)
        setModelProfiles(modelItems)
        setTasks(taskItems)
        setWorkspaces(workspaceItems)
        setCapabilities(capabilityItems)
        const projectDefault = workspaceItems.find((item) => item.path === workspace)?.defaultModelProfileId
        setModelProfileId(
          projectDefault && modelItems.some((item) => item.id === projectDefault)
            ? projectDefault
            : modelItems[0]?.id ?? ''
        )
      }
    ).catch((cause) => setError(`初始化失败：${cause instanceof Error ? cause.message : String(cause)}`))

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
      if (event.type === 'completed' || event.type === 'error') {
        void window.kova.getTask(event.taskId).then((next) => {
          if (!next) return
          setActiveTask((current) => current?.task.id === event.taskId ? next : current)
        })
      }
      void refreshTasks()
    })
    return () => {
      unsubscribeTask()
    }
  }, [])

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

  async function selectTask(taskId: string): Promise<void> {
    const next = await window.kova.getTask(taskId)
    if (!next) return
    setActiveTask(next)
    setView('agents')
    setModelProfileId(next.task.modelProfileId)
    setPermissionMode(next.task.permissionMode)
    setWorkspace(next.workspace?.path ?? '')
  }

  async function selectActivity(item: ActivityItem): Promise<void> {
    await selectTask(item.id)
  }

  function openCreateProject(): void {
    setProjectName('')
    setProjectSourceFolders([])
    setProjectError('')
    setShowCreateProject(true)
  }

  function closeCreateProject(): void {
    if (creatingProject) return
    setShowCreateProject(false)
    setProjectError('')
  }

  async function addProjectSourceFolder(): Promise<void> {
    const chosen = await window.kova.chooseWorkspace()
    if (!chosen) return
    setProjectSourceFolders((current) => current.includes(chosen) ? current : [...current, chosen])
    setProjectName((current) => current || workspaceName(chosen))
    setProjectError('')
  }

  async function createProject(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    if (!projectName.trim()) {
      setProjectError('请输入项目名称')
      return
    }
    if (projectSourceFolders.length === 0) {
      setProjectError('请至少添加一个源码目录')
      return
    }

    setCreatingProject(true)
    setProjectError('')
    try {
      const created = await window.kova.createWorkspace({
        name: projectName.trim(),
        sourceFolders: projectSourceFolders,
        defaultModelProfileId: modelProfileId || undefined
      })
      setWorkspaces((current) => [created, ...current.filter((item) => item.id !== created.id)])
      setWorkspace(created.path)
      setProjectsExpanded(true)
      setExpandedProjectPaths((current) => current.includes(created.path) ? current : [...current, created.path])
      setShowCreateProject(false)
      newSession()
    } catch (cause) {
      setProjectError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setCreatingProject(false)
    }
  }

  function openProject(path: string): void {
    const project = workspaces.find((item) => item.path === path)
    setWorkspace(path)
    if (project?.defaultModelProfileId && modelProfiles.some((item) => item.id === project.defaultModelProfileId)) {
      setModelProfileId(project.defaultModelProfileId)
    }
    setExpandedProjectPaths((current) => current.includes(path) ? current : [...current, path])
    newSession()
  }

  function toggleProject(path: string): void {
    setExpandedProjectPaths((current) =>
      current.includes(path) ? current.filter((item) => item !== path) : [...current, path]
    )
  }

  function newSession(): void {
    setActiveTask(null)
    setPermissionMode('acceptEdits')
    setPrompt('')
    setError('')
    setView('agents')
  }

  async function submit(): Promise<void> {
    const nextPrompt = prompt.trim()
    if (!nextPrompt) return
    if (!workspace) {
      setError('请先选择 Agent 工作目录。')
      return
    }
    if (!modelProfileId) {
      setError('请先在设置中添加并选择模型配置。')
      return
    }

    setError('')
    setPrompt('')
    try {
      if (activeTask) {
        await window.kova.continueTask({ taskId: activeTask.task.id, prompt: nextPrompt })
        setActiveTask(await window.kova.getTask(activeTask.task.id))
        await refreshTasks()
        return
      }
      const task = await window.kova.startTask({
        objective: nextPrompt,
        workspace,
        modelProfileId,
        allowedPluginIds: [],
        permissionMode
      })
      setActiveTask((await window.kova.getTask(task.id)) ?? {
        task,
        runs: [],
        events: [],
        artifacts: []
      })
      await refreshTasks()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError))
    }
  }

  async function retryActiveTask(): Promise<void> {
    if (!activeTask) return
    setError('')
    try {
      await window.kova.retryTask(activeTask.task.id)
      setActiveTask(await window.kova.getTask(activeTask.task.id))
      await refreshTasks()
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : String(retryError))
    }
  }

  async function cancel(): Promise<void> {
    if (!activeTask) return
    await window.kova.cancelTask(activeTask.task.id)
    setActiveTask(await window.kova.getTask(activeTask.task.id))
    await refreshTasks()
  }

  async function deleteOneTask(taskId: string): Promise<void> {
    const target = tasks.find((task) => task.id === taskId)
    if (target?.status === 'running') {
      window.alert('请先停止正在运行的任务，再删除记录。')
      return
    }
    if (!window.confirm(`确定删除“${target?.title ?? '这个任务'}”吗？\n\n将删除该任务的全部运行轮次、事件和产物索引，不会删除工作目录中的文件。`)) return

    try {
      await window.kova.deleteTask(taskId)
      if (activeTask?.task.id === taskId) {
        setActiveTask(null)
        setPrompt('')
      }
      await refreshTasks()
    } catch (deleteError) {
      window.alert(deleteError instanceof Error ? deleteError.message : String(deleteError))
    }
  }

  async function deleteActivity(item: ActivityItem): Promise<void> {
    await deleteOneTask(item.id)
  }

  const isRunning = activeTask?.task.status === 'running'
  const isActiveTaskRunning = activeTask?.task.status === 'running'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="window-drag" />
        <div className="brand">
          <span>Kova</span>
          <small>v{packageInfo.version}</small>
        </div>
        <button
          className={`new-task-button ${view === 'agents' && !activeTask ? 'active' : ''}`}
          type="button"
          onClick={newSession}
        >
          <SquarePen aria-hidden="true" />
          <span>新建任务</span>
          <CirclePlus className="new-task-plus" aria-hidden="true" />
        </button>

        <section className="sidebar-group">
          <div className="sidebar-group-heading">
            <button className="sidebar-group-toggle" type="button" aria-expanded={projectsExpanded} onClick={() => setProjectsExpanded((expanded) => !expanded)}>
              <span>项目</span>
              <ChevronRight className={projectsExpanded ? 'expanded' : ''} aria-hidden="true" />
            </button>
            <button className="sidebar-group-add" type="button" aria-label="创建项目" title="创建项目" onClick={openCreateProject}>
              <CirclePlus aria-hidden="true" />
            </button>
          </div>
          {projectsExpanded && (
            <div className="project-nav-list">
              {projects.length === 0 && <p className="empty-copy">还没有项目</p>}
              {projects.slice(0, 6).map((project) => (
                <div className="project-nav-entry" key={project.path}>
                  <div className="project-nav-row">
                    <button
                      className="project-toggle"
                      type="button"
                      title={project.path}
                      aria-expanded={expandedProjectPaths.includes(project.path)}
                      onClick={() => toggleProject(project.path)}
                    >
                      <ChevronRight className={expandedProjectPaths.includes(project.path) ? 'expanded' : ''} aria-hidden="true" />
                      <Folder aria-hidden="true" />
                      <span>{project.name}</span>
                    </button>
                    <button
                      className="project-new-task"
                      type="button"
                      title={`在 ${project.name} 中新建任务`}
                      aria-label={`在 ${project.name} 中新建任务`}
                      onClick={() => openProject(project.path)}
                    >
                      <CirclePlus aria-hidden="true" />
                    </button>
                  </div>
                  {expandedProjectPaths.includes(project.path) && (
                    <div className="project-session-list">
                      {project.items.length === 0 && <p>暂无任务</p>}
                      {project.items.slice(0, 8).map((item) => (
                        <div
                          className={`project-session-item ${activeTask?.task.id === item.id ? 'active' : ''}`}
                          key={item.key}
                        >
                          <button type="button" title={item.title} onClick={() => void selectActivity(item)}>
                            <span className={`status-pip ${item.status}`} />
                            <span>{item.title}</span>
                          </button>
                          <button
                            className="project-session-delete"
                            type="button"
                            aria-label={`删除 ${item.title}`}
                            title={item.status === 'running' ? '请先停止任务' : '删除记录'}
                            disabled={item.status === 'running'}
                            onClick={() => void deleteActivity(item)}
                          >
                            <Trash2 aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="sidebar-group recent-group">
          <button className="sidebar-group-toggle" type="button" aria-expanded={recentExpanded} onClick={() => setRecentExpanded((expanded) => !expanded)}>
            <span>最近</span>
            <ChevronRight className={recentExpanded ? 'expanded' : ''} aria-hidden="true" />
          </button>
          {recentExpanded && (
            <div className="session-list">
              {activityItems.length === 0 && <p className="empty-copy">还没有任务</p>}
              {activityItems.slice(0, 10).map((item) => (
                <div
                  className={`session-nav-item ${
                    view === 'agents' &&
                    activeTask?.task.id === item.id
                      ? 'active'
                      : ''
                  }`}
                  key={item.key}
                >
                  <button className="session-item" type="button" onClick={() => void selectActivity(item)}>
                    <span className={`status-pip ${item.status}`} />
                    <span className="session-copy">
                      <strong>{item.title}</strong>
                      <small>{item.source} · {formatTime(item.updatedAt)}</small>
                    </span>
                  </button>
                  <span className="session-nav-actions">
                    <button
                      type="button"
                      aria-label={`删除 ${item.title}`}
                      title={item.status === 'running' ? '请先停止任务' : '删除记录'}
                      disabled={item.status === 'running'}
                      onClick={() => void deleteActivity(item)}
                    >
                      <Trash2 aria-hidden="true" />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
        <button
          className={`sidebar-action ${view === 'settings' ? 'active' : ''}`}
          type="button"
          onClick={() => setView('settings')}
        >
          <Settings aria-hidden="true" />
          <span>设置</span>
        </button>
      </aside>

      <section className="workspace-shell">
        {view === 'today' && (
          <main className="page-main">
            <PageHeader title="今日" description="你的开发任务、Agent 运行状态和待处理事项。" />
            <section className={`attention-panel ${attentionItems.length === 0 ? 'clear' : ''}`}>
              <div className="attention-title">
                <span>⚠</span>
                <div>
                  <h2>等待你处理</h2>
                  <p>{attentionItems.length === 0 ? '目前没有需要介入的异常任务。' : `${attentionItems.length} 个任务需要你检查后继续。`}</p>
                </div>
              </div>
              {attentionItems[0] && (
                <button type="button" onClick={() => void selectActivity(attentionItems[0])}>
                  查看“{attentionItems[0].title}” →
                </button>
              )}
            </section>
            <div className="metric-grid">
              <MetricCard label="进行中" value={runningCount} detail="正在运行的 Agent 任务" />
              <MetricCard label="需要关注" value={attentionCount} detail="执行失败或需要处理" />
              <MetricCard label="已完成" value={completedCount} detail="历史完成任务" />
            </div>
            <div className="content-grid">
              <section className="panel">
                <div className="panel-heading">
                  <div><h2>当前任务</h2><p>最近更新的开发工作</p></div>
                  <button className="text-button" type="button" onClick={() => setView('tasks')}>查看全部</button>
                </div>
                <ActivityTable items={activityItems.slice(0, 5)} onSelect={selectActivity} onDelete={deleteActivity} />
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
                      <div><dt>任务</dt><dd>{project.items.length}</dd></div>
                      <div><dt>运行中</dt><dd>{project.items.filter((item) => item.status === 'running').length}</dd></div>
                      <div><dt>最近活动</dt><dd>{project.items[0] ? formatTime(project.items[0].updatedAt) : '暂无'}</dd></div>
                    </dl>
                    <div className="project-actions">
                      <button className="secondary-button" type="button" onClick={() => {
                        if (project.items[0]) void selectActivity(project.items[0])
                        else openProject(project.path)
                      }}>
                        {project.items[0] ? '打开最近任务 →' : '在项目中新建任务 →'}
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
                <div><h2>全部任务</h2><p>模型编排任务与本地 Agent 会话统一显示</p></div>
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
              <ActivityTable items={filteredActivities} onSelect={selectActivity} onDelete={deleteActivity} />
            </section>
          </main>
        )}

        {view === 'agents' && (
          <div className="agent-layout">
            <main className="conversation">
              <header className="conversation-header">
                <div>
                  <h1>{activeTask?.task.title ?? '新建 AI 任务'}</h1>
                  <p>{activeTask
                    ? `${modelProfiles.find((item) => item.id === activeTask.task.modelProfileId)?.name ?? '自定义模型'} · ${statusLabel(activeTask.task.status)}`
                    : workspace ? `${workspaceName(workspace)} · 新任务` : '选择项目，然后描述任务目标'}</p>
                </div>
                <div className="header-actions">
                  <button className="icon-button" type="button" aria-label="新建任务" title="新建任务" onClick={newSession}>
                    +
                  </button>
                  {isRunning && (
                    <button className="ghost-button danger" type="button" onClick={() => void cancel()}>
                      停止
                    </button>
                  )}
                  {activeTask &&
                    (activeTask.task.status === 'failed' || activeTask.task.status === 'cancelled') && (
                    <button className="ghost-button" type="button" onClick={() => void retryActiveTask()}>
                      重试
                    </button>
                  )}
                </div>
              </header>

              <section className="event-stream" aria-live="polite">
                {!activeTask && (
                  <div className="welcome">
                    <div className="welcome-icon">✦</div>
                    <h2>开始新任务</h2>
                    <p>描述你想完成的工作。</p>
                  </div>
                )}
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
                      <TaskEventBody event={event} />
                    </div>
                  </article>
                ))}
              </section>

              <footer className="composer">
                {error && <div className="inline-error">⚠ {error}</div>}
                <div className="composer-box">
                  <textarea
                    value={prompt}
                    disabled={isActiveTaskRunning}
                    onChange={(event) => setPrompt(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        void submit()
                      }
                    }}
                    placeholder={isActiveTaskRunning ? '任务运行中…' : activeTask ? '继续描述任务…' : '描述你希望完成的任务…'}
                    rows={3}
                    aria-label="会话输入"
                  />
                  <button className="send-button" type="button" aria-label="发送" title="发送" disabled={!prompt.trim() || isActiveTaskRunning} onClick={() => void submit()}>
                    →
                  </button>
                </div>
                <p className="composer-hint">{isActiveTaskRunning
                  ? '任务正在运行，可停止后再追加指令'
                  : !activeTask && workspace
                    ? `当前项目：${workspaceName(workspace)} · Enter 发送`
                    : 'Enter 发送 · Shift + Enter 换行'}</p>
              </footer>
            </main>
          </div>
        )}

        {view === 'plugins' && (
          <main className="page-main">
            <div className="page-header">
              <div>
                <h1>能力与扩展</h1>
                <p>查看模型可调用的 Kova 原生工具、CLI 插件和权限范围。</p>
              </div>
              <button className="extension-action" type="button" disabled={scanningPlugins} onClick={() => void rescanPlugins()}>
                {scanningPlugins ? '检查中' : '检查依赖'}
              </button>
            </div>
            <div className="plugin-summary">
              <span>{nativeCapabilities.length + plugins.length} 个能力组与扩展</span>
              <span>{nativeCapabilities.length} 个原生工具</span>
              <span>{plugins.filter((plugin) => plugin.status === 'ready').length} 个运行就绪</span>
              <span>{plugins.filter((plugin) => plugin.status !== 'ready').length} 个需要处理</span>
              {pluginsScannedAt && <time>最近依赖检查：{formatTime(pluginsScannedAt)}</time>}
            </div>
            <div className="plugin-list">
              <article className="panel plugin-card core-tools-card">
                <div className="plugin-card-header">
                  <span className="plugin-icon">K</span>
                  <div>
                    <h2>Kova Core Tools</h2>
                    <p>内置只读工作区能力，不依赖外部 CLI，并受项目目录边界保护。</p>
                  </div>
                  <span className="plugin-status status-ready">运行就绪</span>
                </div>
                <div className="native-capability-grid">
                  {nativeCapabilities.map((capability) => (
                    <div className="native-capability" key={capability.id}>
                      <span>
                        <strong>{capability.name}</strong>
                        <small>{capability.id}</small>
                      </span>
                      <p>{capability.description}</p>
                      <span className={`risk-badge risk-${capability.risk}`}>{capability.risk === 'read' ? '只读' : capability.risk}</span>
                    </div>
                  ))}
                </div>
              </article>
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
            <div className="page-header"><div><h1>设置</h1></div></div>
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
            <section className="panel settings-section">
              <div><h2>外观</h2></div>
              <div className="setting-row">
                <div><strong>显示模式</strong></div>
                <div className="segmented-control">
                  <button className={themeMode === 'dark' ? 'active' : ''} type="button" onClick={() => setThemeMode('dark')}>深色</button>
                  <button className={themeMode === 'light' ? 'active' : ''} type="button" onClick={() => setThemeMode('light')}>浅色</button>
                </div>
              </div>
            </section>
          </main>
        )}
      </section>
      {showCreateProject && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeCreateProject()
        }}>
          <form className="create-project-modal" onSubmit={(event) => void createProject(event)}>
            <div className="create-project-title">
              <h2>创建项目</h2>
              <button type="button" aria-label="关闭" onClick={closeCreateProject}>
                <X aria-hidden="true" />
              </button>
            </div>
            <label className="project-name-field">
              <Folder aria-hidden="true" />
              <input
                autoFocus
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="项目名称"
                aria-label="项目名称"
              />
            </label>
            <div className="project-source-field">
              <span>Source folders</span>
              <button className="source-folder-picker" type="button" onClick={() => void addProjectSourceFolder()}>
                <FolderPlus aria-hidden="true" />
                <strong>添加 Kova 可读取和编辑的文件夹</strong>
              </button>
              {projectSourceFolders.length > 0 && (
                <div className="source-folder-list">
                  {projectSourceFolders.map((folder) => (
                    <div key={folder}>
                      <Folder aria-hidden="true" />
                      <span title={folder}>{folder}</span>
                      <button
                        type="button"
                        aria-label={`移除 ${folder}`}
                        onClick={() => setProjectSourceFolders((current) => current.filter((item) => item !== folder))}
                      >
                        <X aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {projectError && <p className="project-form-error">{projectError}</p>}
            <div className="create-project-actions">
              <button className="project-cancel-button" type="button" disabled={creatingProject} onClick={closeCreateProject}>取消</button>
              <button className="project-submit-button" type="submit" disabled={creatingProject || !projectName.trim() || projectSourceFolders.length === 0}>
                {creatingProject ? '创建中…' : '创建项目'}
              </button>
            </div>
          </form>
        </div>
      )}
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
  const [baseUrl, setBaseUrl] = useState('https://api.deepseek.com')
  const [model, setModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState('')

  async function save(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setError('')
    try {
      const saved = await window.kova.saveModelProfile({ name, baseUrl, model, apiKey, temperature: 0.2 })
      onSaved(saved)
      setName(''); setModel(''); setApiKey('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  return (
    <section className="panel settings-section">
      <div><h2>模型</h2><p>配置用于执行任务的第三方模型。</p></div>
      <div className="config-list">
        {models.length === 0 && <p className="settings-empty">还没有模型配置。</p>}
        {models.map((item) => (
          <div key={item.id}>
            <span><strong>{item.name}</strong><small>{item.model} · {item.baseUrl}</small></span>
            <button
              className="delete-button"
              type="button"
              onClick={() => {
                if (window.confirm(`确定删除模型配置“${item.name}”吗？`)) {
                  void window.kova.deleteModelProfile(item.id).then(() => onDeleted(item.id))
                }
              }}
            >
              删除
            </button>
          </div>
        ))}
      </div>
      <form className="settings-form" onSubmit={(event) => void save(event)}>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="配置名称"/>
        <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="API 地址"/>
        <input value={model} onChange={(event) => setModel(event.target.value)} placeholder="模型 ID"/>
        <input value={apiKey} type="password" onChange={(event) => setApiKey(event.target.value)} placeholder="API Key（仅保存在本机）"/>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button" type="submit">添加模型</button>
      </form>
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

function ActivityTable({
  items,
  onSelect,
  onDelete
}: {
  items: ActivityItem[]
  onSelect: (item: ActivityItem) => Promise<void>
  onDelete: (item: ActivityItem) => Promise<void>
}): React.JSX.Element {
  if (items.length === 0) {
    return <div className="table-empty">暂无任务，创建第一个 AI 任务后会显示在这里。</div>
  }

  return (
    <div className="task-table">
      {items.map((item) => (
        <div className="task-row" key={item.key}>
          <button className="task-open" type="button" onClick={() => void onSelect(item)}>
            <span className={`task-status-icon ${item.status}`}>
              {item.status === 'running' ? '◌' :
                item.status === 'completed' ? '✓' :
                item.status === 'failed' ? '✕' :
                '○'}
            </span>
            <span className="task-title"><strong>{item.title}</strong><small>{item.workspaceLabel}</small></span>
            <span className="task-agent">{item.source}</span>
            <span className={`task-status ${item.status}`}>{statusLabel(item.status)}</span>
            <time>{formatTime(item.updatedAt)}</time>
            →
          </button>
          <button
            className="task-delete"
            type="button"
            aria-label={`删除 ${item.title}`}
            title={item.status === 'running' ? '请先停止任务' : '删除记录'}
            disabled={item.status === 'running'}
            onClick={() => void onDelete(item)}
          >
            <Trash2 aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  )
}

function TaskEventBody({ event }: { event: TaskEvent }): React.JSX.Element {
  const call = event.type === 'capability_call' ? event.metadata?.call : undefined
  const result = event.type === 'capability_result' ? event.metadata?.result : undefined
  const modelInfo = event.type === 'model_message'
    ? {
        provider: event.metadata?.provider,
        model: event.metadata?.model,
        usage: event.metadata?.usage
      }
    : undefined
  const details = call ?? result ?? modelInfo

  return (
    <>
      <p>{event.text}</p>
      {details && (
        <details className="event-details">
          <summary>
            {call ? '查看调用参数' : result ? '查看执行结果' : '查看模型信息'}
          </summary>
          <pre>{JSON.stringify(details, null, 2)}</pre>
        </details>
      )}
    </>
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
