import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  ArrowLeft,
  BookOpen,
  Braces,
  BriefcaseBusiness,
  ChevronRight,
  CirclePlus,
  Cpu,
  Folder,
  FolderOpen,
  FolderPlus,
  Globe2,
  GraduationCap,
  Heart,
  MoreHorizontal,
  Palette,
  Pencil,
  Pin,
  PinOff,
  Search,
  Settings,
  ShieldCheck,
  SquarePen,
  SunMoon,
  Terminal,
  Trash2,
  Wrench,
  X
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type {
  AgentDefinition,
  ModelProfile,
  McpServerDefinition,
  PermissionMode,
  PluginDefinition,
  PluginStatus,
  RegisteredCapability,
  SkillDefinition,
  Task,
  TaskEvent,
  TaskStatus,
  TaskWithDetails,
  Workspace
} from '../../shared/contracts'
import packageInfo from '../../../package.json'

type ViewId = 'today' | 'projects' | 'tasks' | 'agents' | 'plugins' | 'settings'
type ThemeMode = 'dark' | 'light'
type SettingsSectionId = 'general' | 'models' | 'appearance' | 'extensions'
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

interface CapabilityEventGroup {
  type: 'capability_group'
  id: string
  events: TaskEvent[]
}

function groupConversationEvents(events: TaskEvent[]): Array<TaskEvent | CapabilityEventGroup> {
  const items: Array<TaskEvent | CapabilityEventGroup> = []
  for (const event of events) {
    if (event.type === 'completed') continue
    if (event.type === 'capability_call' || event.type === 'capability_result') {
      const previous = items.at(-1)
      if (previous?.type === 'capability_group') {
        previous.events.push(event)
      } else {
        items.push({ type: 'capability_group', id: `capability-group-${event.id}`, events: [event] })
      }
      continue
    }
    items.push(event)
  }
  return items
}

const pluginStatusLabels: Record<PluginStatus, string> = {
  ready: '运行就绪',
  detected: '运行待接入',
  missing: '缺少依赖',
  disabled: '已停用',
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

const projectIconOptions: Array<{ id: string; label: string; icon: LucideIcon }> = [
  { id: 'braces', label: '代码', icon: Braces },
  { id: 'folder', label: '文件夹', icon: Folder },
  { id: 'terminal', label: '终端', icon: Terminal },
  { id: 'book', label: '文档', icon: BookOpen },
  { id: 'study', label: '学习', icon: GraduationCap },
  { id: 'design', label: '设计', icon: Palette },
  { id: 'work', label: '工作', icon: BriefcaseBusiness },
  { id: 'tools', label: '工具', icon: Wrench },
  { id: 'heart', label: '收藏', icon: Heart },
  { id: 'web', label: '网站', icon: Globe2 }
]

const projectColorOptions = ['#34363a', '#ef4444', '#f97316', '#f5b800', '#16a34a', '#1687f8', '#8b5cf6', '#ec4899']

function ProjectGlyph({ icon = 'braces', color }: { icon?: string; color?: string }): React.JSX.Element {
  const Icon = projectIconOptions.find((item) => item.id === icon)?.icon ?? Braces
  return <Icon aria-hidden="true" style={color ? { color } : undefined} />
}

export function App(): React.JSX.Element {
  const [view, setView] = useState<ViewId>('agents')
  const [agents, setAgents] = useState<AgentDefinition[]>([])
  const [plugins, setPlugins] = useState<PluginDefinition[]>([])
  const [pluginsScannedAt, setPluginsScannedAt] = useState('')
  const [scanningPlugins, setScanningPlugins] = useState(false)
  const [skills, setSkills] = useState<SkillDefinition[]>([])
  const [mcpServers, setMcpServers] = useState<McpServerDefinition[]>([])
  const [skillQuery, setSkillQuery] = useState('')
  const [skillScope, setSkillScope] = useState<'all' | 'personal' | 'system'>('all')
  const [modelProfiles, setModelProfiles] = useState<ModelProfile[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [activeTask, setActiveTask] = useState<TaskWithDetails | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [capabilities, setCapabilities] = useState<RegisteredCapability[]>([])
  const [workspace, setWorkspace] = useState('')
  const [defaultPermissionMode, setDefaultPermissionMode] = useState<PermissionMode>(
    () => (localStorage.getItem('kova-default-permission') as PermissionMode | null) ?? 'acceptEdits'
  )
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(
    () => (localStorage.getItem('kova-default-permission') as PermissionMode | null) ?? 'acceptEdits'
  )
  const [defaultModelProfileId, setDefaultModelProfileId] = useState(
    () => localStorage.getItem('kova-default-model') ?? ''
  )
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
  const [projectMenuId, setProjectMenuId] = useState<string | null>(null)
  const [editingProject, setEditingProject] = useState<Workspace | null>(null)
  const [editProjectName, setEditProjectName] = useState('')
  const [editProjectSourceFolders, setEditProjectSourceFolders] = useState<string[]>([])
  const [editProjectIcon, setEditProjectIcon] = useState('braces')
  const [editProjectColor, setEditProjectColor] = useState(projectColorOptions[0])
  const [editProjectEnabledPluginIds, setEditProjectEnabledPluginIds] = useState<string[]>([])
  const [showProjectIconPicker, setShowProjectIconPicker] = useState(false)
  const [savingProject, setSavingProject] = useState(false)
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
    const visibleWorkspaces = workspaces.filter((item) => !item.removedAt)
    const grouped = new Map<string, { workspace?: Workspace; name: string; items: ActivityItem[] }>(
      visibleWorkspaces.map((item) => [item.path, { workspace: item, name: item.name, items: [] }])
    )
    activityItems.filter((item) => grouped.has(item.workspacePath)).forEach((item) => {
      const current = grouped.get(item.workspacePath)!
      current.items.push(item)
      grouped.set(item.workspacePath, current)
    })
    return [...grouped.entries()].map(([path, project]) => ({
      id: project.workspace?.id ?? path,
      path,
      name: project.name || workspaceName(path),
      icon: project.workspace?.icon,
      color: project.workspace?.color,
      pinned: project.workspace?.pinned,
      items: project.items
    })).sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)))
  }, [activityItems, workspaces])

  const runningCount = activityItems.filter((item) => item.status === 'running').length
  const completedCount = activityItems.filter((item) => item.status === 'completed').length
  const attentionItems = activityItems.filter((item) => item.status === 'failed')
  const attentionCount = attentionItems.length
  const filteredActivities =
    taskFilter === 'all' ? activityItems : activityItems.filter((item) => item.status === taskFilter)
  const nativeCapabilities = capabilities.filter((item) => item.pluginId === 'com.kova.core-tools')
  const visibleSkills = useMemo(() => {
    const pluginById = new Map(plugins.map((plugin) => [plugin.id, plugin]))
    const capabilitySkills = capabilities.map((capability) => {
      const plugin = pluginById.get(capability.pluginId)
      return {
        id: `capability:${capability.pluginId}:${capability.id}`,
        name: capability.name,
        description: capability.description,
        source: 'system' as const,
        enabled: capability.pluginId === 'com.kova.core-tools' || Boolean(plugin?.enabled),
        available: capability.available,
        badge: capability.pluginId === 'com.kova.core-tools' ? 'K' : plugin?.name.slice(0, 1) ?? '✦'
      }
    })
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
    return [...capabilitySkills, ...personalSkills].filter((skill) =>
      (skillScope === 'all' || skill.source === skillScope) &&
      (!query || `${skill.name} ${skill.description}`.toLowerCase().includes(query))
    )
  }, [capabilities, plugins, skills, skillQuery, skillScope])

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode
    localStorage.setItem('kova-theme', themeMode)
  }, [themeMode])

  useEffect(() => {
    localStorage.setItem('kova-default-permission', defaultPermissionMode)
  }, [defaultPermissionMode])

  useEffect(() => {
    if (defaultModelProfileId) localStorage.setItem('kova-default-model', defaultModelProfileId)
    else localStorage.removeItem('kova-default-model')
  }, [defaultModelProfileId])

  useEffect(() => {
    if (!projectMenuId) return
    const closeMenu = (event: PointerEvent): void => {
      const target = event.target
      if (target instanceof Element && (target.closest('.project-more-menu') || target.closest('.project-row-actions'))) return
      setProjectMenuId(null)
    }
    window.addEventListener('pointerdown', closeMenu)
    return () => window.removeEventListener('pointerdown', closeMenu)
  }, [projectMenuId])

  useEffect(() => {
    void Promise.all([
      window.kova.listAgents(),
      window.kova.listPlugins(),
      window.kova.listModelProfiles(),
      window.kova.listTasks(),
      window.kova.listWorkspaces(),
      window.kova.listCapabilities(),
      window.kova.listSkills(),
      window.kova.listMcpServers()
    ]).then(
      ([agentItems, pluginResult, modelItems, taskItems, workspaceItems, capabilityItems, skillItems, mcpItems]) => {
        setAgents(agentItems)
        setPlugins(pluginResult.plugins)
        setPluginsScannedAt(pluginResult.scannedAt)
        setModelProfiles(modelItems)
        setTasks(taskItems)
        setWorkspaces(workspaceItems)
        setCapabilities(capabilityItems)
        setSkills(skillItems)
        setMcpServers(mcpItems)
        const projectDefault = workspaceItems.find((item) => item.path === workspace)?.defaultModelProfileId
        const savedDefault = modelItems.find((item) => item.id === defaultModelProfileId)?.id
        setModelProfileId(
          projectDefault && modelItems.some((item) => item.id === projectDefault)
            ? projectDefault
            : savedDefault ?? modelItems[0]?.id ?? ''
        )
        if (!savedDefault && modelItems[0]) setDefaultModelProfileId(modelItems[0].id)
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
      setCapabilities(await window.kova.listCapabilities())
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

  function openEditProject(projectId: string): void {
    const project = workspaces.find((item) => item.id === projectId)
    if (!project) return
    setEditingProject(project)
    setEditProjectName(project.name)
    setEditProjectSourceFolders(project.sourceFolders ?? [project.path])
    setEditProjectIcon(project.icon ?? 'braces')
    setEditProjectColor(project.color ?? projectColorOptions[0])
    setEditProjectEnabledPluginIds(project.enabledPluginIds)
    setProjectError('')
    setProjectMenuId(null)
    setShowProjectIconPicker(false)
  }

  function closeEditProject(): void {
    if (savingProject) return
    setEditingProject(null)
    setProjectError('')
    setShowProjectIconPicker(false)
  }

  async function addEditProjectSourceFolder(): Promise<void> {
    const chosen = await window.kova.chooseWorkspace()
    if (!chosen) return
    setEditProjectSourceFolders((current) => current.includes(chosen) ? current : [...current, chosen])
    setProjectError('')
  }

  async function saveEditedProject(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    if (!editingProject) return
    setSavingProject(true)
    setProjectError('')
    try {
      const updated = await window.kova.updateWorkspace({
        id: editingProject.id,
        name: editProjectName,
        sourceFolders: editProjectSourceFolders,
        icon: editProjectIcon,
        color: editProjectColor,
        enabledPluginIds: editProjectEnabledPluginIds
      })
      setWorkspaces((current) => current.map((item) => item.id === updated.id ? updated : item))
      if (workspace === editingProject.path) setWorkspace(updated.path)
      setExpandedProjectPaths((current) =>
        current.map((path) => path === editingProject.path ? updated.path : path)
      )
      setEditingProject(null)
      setShowProjectIconPicker(false)
    } catch (cause) {
      setProjectError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setSavingProject(false)
    }
  }

  async function togglePluginEnabled(pluginId: string, enabled: boolean): Promise<void> {
    setScanningPlugins(true)
    try {
      const result = await window.kova.setPluginEnabled(pluginId, enabled)
      setPlugins(result.plugins)
      setPluginsScannedAt(result.scannedAt)
      setAgents(await window.kova.listAgents())
      setCapabilities(await window.kova.listCapabilities())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setScanningPlugins(false)
    }
  }

  async function togglePinnedProject(projectId: string): Promise<void> {
    const project = workspaces.find((item) => item.id === projectId)
    if (!project) return
    const updated = await window.kova.updateWorkspace({ id: project.id, pinned: !project.pinned })
    setWorkspaces((current) => current.map((item) => item.id === updated.id ? updated : item))
    setProjectMenuId(null)
  }

  async function removeProject(projectId: string): Promise<void> {
    const project = workspaces.find((item) => item.id === projectId)
    if (!project) return
    if (!window.confirm(`从项目列表移除“${project.name}”吗？\n\n不会删除源码文件和历史会话。`)) return
    const updated = await window.kova.updateWorkspace({ id: project.id, removed: true })
    setWorkspaces((current) => current.map((item) => item.id === updated.id ? updated : item))
    setExpandedProjectPaths((current) => current.filter((path) => path !== project.path))
    if (workspace === project.path && !activeTask) setWorkspace('')
    setProjectMenuId(null)
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
    const project = workspaces.find((item) => item.path === path)
    setWorkspace(path)
    if (project?.defaultModelProfileId && modelProfiles.some((item) => item.id === project.defaultModelProfileId)) {
      setModelProfileId(project.defaultModelProfileId)
    }
    setExpandedProjectPaths((current) =>
      current.includes(path) ? current.filter((item) => item !== path) : [...current, path]
    )
  }

  function newSession(): void {
    setActiveTask(null)
    setPermissionMode(defaultPermissionMode)
    setPrompt('')
    setError('')
    setView('agents')
  }

  async function chooseTaskWorkspace(): Promise<void> {
    if (activeTask) return
    const chosen = await window.kova.chooseWorkspace()
    if (!chosen) return
    setWorkspace(chosen)
    const project = workspaces.find((item) => item.path === chosen)
    if (project?.defaultModelProfileId && modelProfiles.some((item) => item.id === project.defaultModelProfileId)) {
      setModelProfileId(project.defaultModelProfileId)
    }
    setError('')
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

  if (view === 'settings') {
    return (
      <SettingsView
        models={modelProfiles}
        defaultModelProfileId={defaultModelProfileId}
        themeMode={themeMode}
        defaultPermissionMode={defaultPermissionMode}
        onBack={() => setView('agents')}
        onThemeChange={setThemeMode}
        onDefaultPermissionChange={setDefaultPermissionMode}
        onDefaultModelChange={(id) => {
          setDefaultModelProfileId(id)
          setModelProfileId(id)
        }}
        onModelSaved={(model) => {
          setModelProfiles((current) => {
            const exists = current.some((item) => item.id === model.id)
            return exists
              ? current.map((item) => item.id === model.id ? model : item)
              : [model, ...current]
          })
          setModelProfileId((current) => current || model.id)
          setDefaultModelProfileId((current) => current || model.id)
        }}
        onModelDeleted={(id) => {
          setModelProfiles((current) => current.filter((item) => item.id !== id))
          if (modelProfileId === id) setModelProfileId('')
          if (defaultModelProfileId === id) setDefaultModelProfileId('')
        }}
        plugins={plugins}
        capabilities={capabilities}
        skills={skills}
        mcpServers={mcpServers}
        onPluginEnabled={(id, enabled) => togglePluginEnabled(id, enabled)}
        onSkillEnabled={async (id, enabled) => {
          const updated = await window.kova.setSkillEnabled(id, enabled)
          setSkills((current) => current.map((item) => item.id === id ? updated : item))
        }}
        onSkillImported={(skill) => setSkills((current) => [skill, ...current.filter((item) => item.id !== skill.id)])}
      />
    )
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="window-drag" />
        <div className="brand">
          <span>Kova</span>
          <small>v{packageInfo.version}</small>
        </div>
        <nav className="sidebar-primary-nav" aria-label="主要功能">
          <button
            className={`new-task-button ${view === 'agents' && !activeTask ? 'active' : ''}`}
            type="button"
            onClick={newSession}
          >
            <SquarePen aria-hidden="true" />
            <span>新建任务</span>
            <CirclePlus className="new-task-plus" aria-hidden="true" />
          </button>
          <button
            className={`sidebar-action sidebar-primary-action ${view === 'plugins' ? 'active' : ''}`}
            type="button"
            onClick={() => setView('plugins')}
          >
            <Cpu aria-hidden="true" />
            <span>插件</span>
          </button>
        </nav>

        <section className="sidebar-group project-group">
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
                      <ProjectGlyph icon={project.icon} color={project.color} />
                      <span>{project.name}</span>
                    </button>
                    <span className="project-row-actions">
                      <button
                        type="button"
                        title="更多操作"
                        aria-label={`${project.name} 更多操作`}
                        onClick={() => setProjectMenuId((current) => current === project.id ? null : project.id)}
                      >
                        <MoreHorizontal aria-hidden="true" />
                      </button>
                      <button type="button" title="编辑项目" aria-label={`编辑 ${project.name}`} onClick={() => openEditProject(project.id)}>
                        <Pencil aria-hidden="true" />
                      </button>
                    </span>
                  </div>
                  {projectMenuId === project.id && (
                    <div className="project-more-menu">
                      <button type="button" onClick={() => void togglePinnedProject(project.id)}>
                        {project.pinned ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />}
                        <span>{project.pinned ? '取消置顶' : '置顶项目'}</span>
                      </button>
                      <button type="button" onClick={() => {
                        setProjectMenuId(null)
                        void window.kova.revealPath(project.path)
                      }}>
                        <FolderOpen aria-hidden="true" />
                        <span>在 Finder 中显示</span>
                      </button>
                      <button type="button" onClick={() => openEditProject(project.id)}>
                        <Settings aria-hidden="true" />
                        <span>编辑项目</span>
                      </button>
                      <button className="danger" type="button" onClick={() => void removeProject(project.id)}>
                        <X aria-hidden="true" />
                        <span>移除</span>
                      </button>
                    </div>
                  )}
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
                  <div className="project-hover-card" role="tooltip">
                    <div className="project-hover-title">
                      <span><ProjectGlyph icon={project.icon} color={project.color} /><strong>{project.name}</strong></span>
                      <button
                        className={project.pinned ? 'active' : ''}
                        type="button"
                        title={project.pinned ? '取消置顶' : '置顶项目'}
                        onClick={() => void togglePinnedProject(project.id)}
                      >
                        <Pin aria-hidden="true" />
                      </button>
                    </div>
                    <p>{project.items.length} 个任务 · {project.items.filter((item) => item.status === 'failed' || item.status === 'waiting').length} 个待处理</p>
                    <div className="project-hover-path"><FolderOpen aria-hidden="true" /><span>{project.path}</span></div>
                    <button type="button" onClick={() => openEditProject(project.id)}>
                      <Settings aria-hidden="true" />
                      <span>编辑项目</span>
                    </button>
                  </div>
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
          className="sidebar-action"
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
                <h1>{activeTask?.task.title ?? '新建任务'}</h1>
                <div className="header-actions">
                  <button className="icon-button" type="button" aria-label="更多操作" title="更多操作">
                    <MoreHorizontal aria-hidden="true" />
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
                {groupConversationEvents(activeTask?.events ?? []).map((item) => (
                  item.type === 'capability_group'
                    ? <CapabilityEventGroupView group={item} key={item.id} />
                    : (
                      <article className={`event event-${item.type}`} key={item.id}>
                        {item.type !== 'user_message' && item.type !== 'model_message' && (
                          <div className="event-icon">
                            {item.type === 'error' ? '✕' :
                              item.type === 'cli_output' ? '⌘' :
                              '◇'}
                          </div>
                        )}
                        <div className="event-content">
                          {item.type !== 'user_message' && (
                            <div className="event-meta">
                              <strong>{item.type === 'model_message' ? '已处理' : taskEventLabels[item.type]}</strong>
                              <time>{formatTime(item.createdAt)}</time>
                            </div>
                          )}
                          <TaskEventBody event={item} />
                        </div>
                      </article>
                    )
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
                    placeholder={isActiveTaskRunning ? '任务运行中…' : '随心输入'}
                    rows={2}
                    aria-label="会话输入"
                  />
                  <div className="composer-toolbar">
                    <div className="composer-context">
                      <button
                        className="composer-context-button"
                        type="button"
                        title={workspace || '选择项目目录'}
                        disabled={Boolean(activeTask)}
                        onClick={() => void chooseTaskWorkspace()}
                      >
                        <FolderOpen aria-hidden="true" />
                        <span>{workspace ? workspaceName(workspace) : '选择项目'}</span>
                      </button>
                    </div>
                    <div className="composer-controls">
                      <select
                        aria-label="模型"
                        title="模型"
                        value={modelProfileId}
                        disabled={Boolean(activeTask)}
                        onChange={(event) => setModelProfileId(event.target.value)}
                      >
                        <option value="">选择模型</option>
                        {modelProfiles.filter((item) => item.enabled).map((item) => (
                          <option value={item.id} key={item.id}>{item.name}</option>
                        ))}
                      </select>
                      <select
                        aria-label="权限模式"
                        title="权限模式"
                        value={permissionMode}
                        disabled={Boolean(activeTask)}
                        onChange={(event) => setPermissionMode(event.target.value as PermissionMode)}
                      >
                        <option value="read_only">只读</option>
                        <option value="workspace_write">工作区</option>
                        <option value="full_access">完全访问</option>
                      </select>
                      <button className="send-button" type="button" aria-label="发送" title="发送" disabled={!prompt.trim() || isActiveTaskRunning} onClick={() => void submit()}>
                        ↑
                      </button>
                    </div>
                  </div>
                </div>
              </footer>
            </main>
          </div>
        )}

        {view === 'plugins' && (
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
                onChange={(event) => setSkillQuery(event.target.value)}
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
                      <i className={skill.enabled && skill.available ? 'ready' : ''} aria-label={skill.enabled && skill.available ? '已启用' : '不可用'}>
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
              {([
                ['all', '全部'],
                ['personal', '个人'],
                ['system', '系统']
              ] as Array<[typeof skillScope, string]>).map(([id, label]) => (
                <button className={skillScope === id ? 'active' : ''} type="button" key={id} onClick={() => setSkillScope(id)}>
                  {label}
                </button>
              ))}
            </div>
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
      {editingProject && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeEditProject()
        }}>
          <form className="create-project-modal edit-project-modal" onSubmit={(event) => void saveEditedProject(event)}>
            <div className="create-project-title">
              <h2>编辑项目</h2>
              <button type="button" aria-label="关闭" onClick={closeEditProject}>
                <X aria-hidden="true" />
              </button>
            </div>
            <div className="project-name-field edit-project-name-field">
              <button
                className="project-icon-trigger"
                type="button"
                aria-label="选择项目图标和颜色"
                aria-expanded={showProjectIconPicker}
                onClick={() => setShowProjectIconPicker((visible) => !visible)}
              >
                <ProjectGlyph icon={editProjectIcon} color={editProjectColor} />
              </button>
              <input
                autoFocus
                value={editProjectName}
                onChange={(event) => setEditProjectName(event.target.value)}
                placeholder="项目名称"
                aria-label="项目名称"
              />
              {showProjectIconPicker && (
                <div className="project-icon-picker">
                  <div className="project-color-grid" aria-label="项目颜色">
                    {projectColorOptions.map((color) => (
                      <button
                        className={editProjectColor === color ? 'active' : ''}
                        type="button"
                        key={color}
                        title={color}
                        aria-label={`选择颜色 ${color}`}
                        style={{ '--project-swatch': color } as React.CSSProperties}
                        onClick={() => setEditProjectColor(color)}
                      />
                    ))}
                  </div>
                  <div className="project-icon-grid" aria-label="项目图标">
                    {projectIconOptions.map((option) => {
                      const Icon = option.icon
                      return (
                        <button
                          className={editProjectIcon === option.id ? 'active' : ''}
                          type="button"
                          key={option.id}
                          title={option.label}
                          aria-label={`选择${option.label}图标`}
                          onClick={() => setEditProjectIcon(option.id)}
                        >
                          <Icon aria-hidden="true" />
                        </button>
                      )
                    })}
                  </div>
                  <button className="project-icon-picker-done" type="button" onClick={() => setShowProjectIconPicker(false)}>完成</button>
                </div>
              )}
            </div>
            <div className="project-source-field">
              <span>Source folders</span>
              <div className="edit-source-folder-list">
                {editProjectSourceFolders.map((folder) => (
                  <div key={folder}>
                    <Folder aria-hidden="true" />
                    <span title={folder}>{workspaceName(folder)}</span>
                    <button
                      type="button"
                      aria-label={`移除 ${folder}`}
                      disabled={editProjectSourceFolders.length === 1}
                      title={editProjectSourceFolders.length === 1 ? '项目至少需要一个源码目录' : '移除文件夹'}
                      onClick={() => setEditProjectSourceFolders((current) => current.filter((item) => item !== folder))}
                    >
                      <X aria-hidden="true" />
                    </button>
                  </div>
                ))}
                <button className="edit-add-source-folder" type="button" onClick={() => void addEditProjectSourceFolder()}>
                  <FolderPlus aria-hidden="true" />
                  <span>添加文件夹</span>
                </button>
              </div>
            </div>
            {projectError && <p className="project-form-error">{projectError}</p>}
            <div className="create-project-actions edit-project-actions">
              <button className="project-remove-button" type="button" disabled={savingProject} onClick={() => {
                const projectId = editingProject.id
                closeEditProject()
                void removeProject(projectId)
              }}>移除项目</button>
              <span />
              <button className="project-cancel-button" type="button" disabled={savingProject} onClick={closeEditProject}>取消</button>
              <button className="project-submit-button" type="submit" disabled={savingProject || !editProjectName.trim() || editProjectSourceFolders.length === 0}>
                {savingProject ? '保存中…' : '保存'}
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

function SettingsView({
  models,
  defaultModelProfileId,
  themeMode,
  defaultPermissionMode,
  onBack,
  onThemeChange,
  onDefaultPermissionChange,
  onDefaultModelChange,
  onModelSaved,
  onModelDeleted,
  plugins,
  capabilities,
  skills,
  mcpServers,
  onPluginEnabled,
  onSkillEnabled,
  onSkillImported
}: {
  models: ModelProfile[]
  defaultModelProfileId: string
  themeMode: ThemeMode
  defaultPermissionMode: PermissionMode
  onBack: () => void
  onThemeChange: (theme: ThemeMode) => void
  onDefaultPermissionChange: (mode: PermissionMode) => void
  onDefaultModelChange: (id: string) => void
  onModelSaved: (model: ModelProfile) => void
  onModelDeleted: (id: string) => void
  plugins: PluginDefinition[]
  capabilities: RegisteredCapability[]
  skills: SkillDefinition[]
  mcpServers: McpServerDefinition[]
  onPluginEnabled: (id: string, enabled: boolean) => Promise<void>
  onSkillEnabled: (id: string, enabled: boolean) => Promise<void>
  onSkillImported: (skill: SkillDefinition) => void
}): React.JSX.Element {
  const [section, setSection] = useState<SettingsSectionId>('general')
  const [query, setQuery] = useState('')
  const sections: Array<{
    id: SettingsSectionId
    label: string
    keywords: string
    icon: typeof ShieldCheck
  }> = [
    { id: 'general', label: '常规', keywords: '常规 权限 默认 permission', icon: ShieldCheck },
    { id: 'models', label: '模型', keywords: '模型 deepseek api key', icon: Cpu },
    { id: 'appearance', label: '外观', keywords: '外观 深色 浅色 主题', icon: SunMoon },
    { id: 'extensions', label: '插件', keywords: '插件 技能 MCP 应用 扩展', icon: Wrench }
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
            onChange={(event) => setQuery(event.target.value)}
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
                    onClick={() => onDefaultPermissionChange(mode)}
                  >
                    <span><strong>{title}</strong><small>{description}</small></span>
                    <i aria-hidden="true" />
                  </button>
                ))}
              </section>
            </>
          )}

          {section === 'models' && (
            <ModelSettings
              models={models}
              defaultModelProfileId={defaultModelProfileId}
              onDefaultChange={onDefaultModelChange}
              onSaved={onModelSaved}
              onDeleted={onModelDeleted}
            />
          )}

          {section === 'appearance' && (
            <>
              <h2>主题</h2>
              <section className="settings-card">
                <div className="settings-control-row">
                  <span><strong>显示模式</strong><small>选择 Kova 的界面外观。</small></span>
                  <div className="segmented-control">
                    <button className={themeMode === 'dark' ? 'active' : ''} type="button" onClick={() => onThemeChange('dark')}>深色</button>
                    <button className={themeMode === 'light' ? 'active' : ''} type="button" onClick={() => onThemeChange('light')}>浅色</button>
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

function ExtensionSettings({
  plugins,
  capabilities,
  skills,
  mcpServers,
  onPluginEnabled,
  onSkillEnabled,
  onSkillImported
}: {
  plugins: PluginDefinition[]
  capabilities: RegisteredCapability[]
  skills: SkillDefinition[]
  mcpServers: McpServerDefinition[]
  onPluginEnabled: (id: string, enabled: boolean) => Promise<void>
  onSkillEnabled: (id: string, enabled: boolean) => Promise<void>
  onSkillImported: (skill: SkillDefinition) => void
}): React.JSX.Element {
  const [tab, setTab] = useState<'plugins' | 'apps' | 'mcp' | 'skills'>('plugins')
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const normalizedQuery = query.trim().toLowerCase()
  const matches = (name: string, description: string): boolean =>
    !normalizedQuery || `${name} ${description}`.toLowerCase().includes(normalizedQuery)

  async function importLocalSkill(): Promise<void> {
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
          <button className={tab === 'plugins' ? 'active' : ''} type="button" onClick={() => setTab('plugins')}>插件 <span>{plugins.length}</span></button>
          <button className={tab === 'apps' ? 'active' : ''} type="button" onClick={() => setTab('apps')}>应用 <span>0</span></button>
          <button className={tab === 'mcp' ? 'active' : ''} type="button" onClick={() => setTab('mcp')}>MCP <span>{mcpServers.length}</span></button>
          <button className={tab === 'skills' ? 'active' : ''} type="button" onClick={() => setTab('skills')}>技能 <span>{capabilities.length + skills.length}</span></button>
        </div>
        <label className="extension-settings-search">
          <Search aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索插件" aria-label="搜索扩展" />
        </label>
      </div>

      {tab === 'plugins' && (
        <section className="settings-extension-list">
          {plugins.filter((plugin) => matches(plugin.name, plugin.description)).map((plugin) => (
            <div key={plugin.id}>
              <span className="settings-extension-icon">{plugin.name.slice(0, 1)}</span>
              <span><strong>{plugin.name}</strong><small>{plugin.description}</small></span>
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
              ><span /></button>
            </div>
          ))}
        </section>
      )}

      {tab === 'apps' && <p className="settings-empty extension-settings-empty">尚未连接应用。应用连接将在下一阶段接入。</p>}

      {tab === 'mcp' && (
        <section className="settings-extension-list">
          {mcpServers.length === 0 && <p className="settings-empty">还没有 MCP 配置。</p>}
          {mcpServers.filter((server) => matches(server.name, server.url ?? server.command ?? '')).map((server) => (
            <div key={server.id}>
              <span className="settings-extension-icon">M</span>
              <span><strong>{server.name}</strong><small>{server.transport === 'http' ? server.url : [server.command, ...(server.args ?? [])].filter(Boolean).join(' ')}</small></span>
              <em>已配置</em>
            </div>
          ))}
        </section>
      )}

      {tab === 'skills' && (
        <>
          <div className="settings-section-title extension-skill-title">
            <h2>已安装技能</h2>
            <button type="button" onClick={() => void importLocalSkill()}>导入技能</button>
          </div>
          <section className="settings-extension-list">
            {capabilities.filter((capability) => matches(capability.name, capability.description)).map((capability) => (
              <div key={`${capability.pluginId}:${capability.id}`}>
                <span className="settings-extension-icon">K</span>
                <span><strong>{capability.name}</strong><small>{capability.description}</small></span>
                <em>{capability.available ? '系统' : '不可用'}</em>
                <span className="extension-check">✓</span>
              </div>
            ))}
            {skills.filter((skill) => matches(skill.name, skill.description)).map((skill) => (
              <div key={skill.id}>
                <span className="settings-extension-icon">✦</span>
                <span><strong>{skill.name}</strong><small>{skill.description}</small></span>
                <em>个人</em>
                <button
                  className={`toggle-switch ${skill.enabled ? 'on' : ''}`}
                  type="button"
                  role="switch"
                  aria-checked={skill.enabled}
                  onClick={() => void onSkillEnabled(skill.id, !skill.enabled)}
                ><span /></button>
              </div>
            ))}
          </section>
        </>
      )}
    </>
  )
}

function ModelSettings({
  models,
  defaultModelProfileId,
  onDefaultChange,
  onSaved,
  onDeleted
}: {
  models: ModelProfile[]
  defaultModelProfileId: string
  onDefaultChange: (id: string) => void
  onSaved: (model: ModelProfile) => void
  onDeleted: (id: string) => void
}): React.JSX.Element {
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

  function resetForm(): void {
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

  function addModel(): void {
    resetForm()
    setShowForm(true)
  }

  function editModel(profile: ModelProfile): void {
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

  async function save(event: React.FormEvent): Promise<void> {
    event.preventDefault()
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
      const saved = await window.kova.saveModelProfile({
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
      onSaved(saved)
      resetForm()
      setShowForm(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  async function testModel(profile: ModelProfile): Promise<void> {
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

  return (
    <>
      <div className="settings-section-title">
        <h2>模型配置</h2>
        <button type="button" onClick={addModel}>添加模型</button>
      </div>
      <section className="model-profile-list">
        {models.length === 0 && <p className="settings-empty">还没有模型配置。</p>}
        {models.map((item) => (
          <article className="settings-card model-profile-card" key={item.id}>
            <div className="model-profile-main">
              <span>
                <strong>{item.name}</strong>
                <small>{item.model} · {item.baseUrl}</small>
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
                <button type="button" onClick={() => onDefaultChange(item.id)}>设为默认</button>
              )}
              <button type="button" disabled={testingId === item.id || !item.enabled} onClick={() => void testModel(item)}>
                {testingId === item.id ? '测试中…' : '测试连接'}
              </button>
              <button type="button" onClick={() => editModel(item)}>编辑</button>
              <button
                className="danger"
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
          </article>
        ))}
      </section>
      {showForm && (
        <>
          <h2>{editingId ? '编辑模型' : '添加模型'}</h2>
          <form className="settings-card model-editor" onSubmit={(event) => void save(event)}>
            <label><span>配置名称</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：DeepSeek"/></label>
            <label><span>API 地址</span><input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.deepseek.com"/></label>
            <label><span>模型 ID</span><input value={model} onChange={(event) => setModel(event.target.value)} placeholder="模型 ID"/></label>
            <label>
              <span>API Key</span>
              <input
                value={apiKey}
                type="password"
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={editingId ? '留空则保留现有密钥' : '输入 API Key'}
              />
            </label>
            <label><span>温度</span><input value={temperature} type="number" min="0" max="2" step="0.1" onChange={(event) => setTemperature(event.target.value)}/></label>
            <label><span>请求超时（秒）</span><input value={timeoutSeconds} type="number" min="1" max="1800" onChange={(event) => setTimeoutSeconds(event.target.value)}/></label>
            <label className="model-system-prompt"><span>系统提示词</span><textarea value={systemPrompt} rows={3} onChange={(event) => setSystemPrompt(event.target.value)} placeholder="可选"/></label>
            <label className="model-enabled"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)}/><span>启用此模型</span></label>
            {error && <p className="form-error">{error}</p>}
            <div className="model-editor-actions">
              <button type="button" onClick={() => { resetForm(); setShowForm(false) }}>取消</button>
              <button className="primary-button" type="submit">{editingId ? '保存修改' : '添加模型'}</button>
            </div>
          </form>
        </>
      )}
    </>
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

function CapabilityEventGroupView({ group }: { group: CapabilityEventGroup }): React.JSX.Element {
  const calls = group.events.filter((event) => event.type === 'capability_call')
  const results = group.events.filter((event) => event.type === 'capability_result')
  const failedCount = results.filter((event) => {
    const result = event.metadata?.result as { status?: string } | undefined
    return result?.status && result.status !== 'completed'
  }).length
  const summary = calls.length === 1
    ? calls[0].text.replace(/^调用\s*/, '')
    : `执行了 ${calls.length} 次本地操作`

  return (
    <details className={`capability-group ${failedCount ? 'has-error' : ''}`}>
      <summary>
        <span className="capability-group-icon"><Terminal aria-hidden="true" /></span>
        <span>{summary}</span>
        <small>{failedCount ? `${failedCount} 项失败` : '已完成'}</small>
        <ChevronRight aria-hidden="true" />
      </summary>
      <div className="capability-group-list">
        {calls.map((call, index) => {
          const result = results[index]
          const resultData = result?.metadata?.result as { status?: string; error?: string } | undefined
          const failed = Boolean(resultData?.status && resultData.status !== 'completed')
          return (
            <div className={failed ? 'failed' : ''} key={call.id} title={resultData?.error}>
              <span>{call.text.replace(/^调用\s*/, '')}</span>
              <small>{failed ? '失败' : '完成'}</small>
            </div>
          )
        })}
      </div>
    </details>
  )
}

function TaskEventBody({ event }: { event: TaskEvent }): React.JSX.Element {
  const call = event.type === 'capability_call' ? event.metadata?.call : undefined
  const result = event.type === 'capability_result' ? event.metadata?.result : undefined
  const details = call ?? result

  return (
    <>
      {event.type === 'model_message' ? (
        <div className="event-markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{event.text}</ReactMarkdown>
        </div>
      ) : (
        <p>{event.type === 'completed' ? '任务已完成' : event.text}</p>
      )}
      {details && (
        <details className="event-details">
          <summary>
            {call ? '查看调用参数' : '查看执行结果'}
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
