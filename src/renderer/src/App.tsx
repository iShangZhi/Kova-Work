import { useEffect, useMemo, useState } from 'react'
import { Sidebar } from './components/layout/Sidebar'
import type { ViewId } from './components/layout/Sidebar'
import { TaskCreate } from './features/tasks/TaskCreate'
import { TaskDetail } from './features/tasks/TaskDetail'
import { TaskList } from './features/tasks/TaskList'
import { Plugins } from './features/plugins/Plugins'
import { ProjectList } from './features/workspaces/ProjectList'
import { Settings } from './features/settings/Settings'
import { useTaskStore } from './store/tasks'
import { useWorkspaceStore } from './store/workspaces'
import { useModelStore } from './store/models'
import { useUIStore } from './store/ui'
import type { ActivityItem } from './components/shared/ActivityTable'
import type {
  AgentDefinition,
  PluginDefinition,
  RegisteredCapability,
  SkillDefinition,
  McpServerDefinition
} from '../../shared/contracts'
import './styles.css'

export function App() {
  const { tasks, activeTask, fetchTasks, selectTask, deleteTask, clearActiveTask } = useTaskStore()
  const { workspaces, fetchWorkspaces, setCurrentWorkspace } = useWorkspaceStore()
  const { fetchProfiles, profiles } = useModelStore()
  const { themeMode } = useUIStore()

  const [view, setView] = useState<ViewId>('chat')
  const [agents, setAgents] = useState<AgentDefinition[]>([])
  const [plugins, setPlugins] = useState<PluginDefinition[]>([])
  const [capabilities, setCapabilities] = useState<RegisteredCapability[]>([])
  const [skills, setSkills] = useState<SkillDefinition[]>([])
  const [mcpServers, setMcpServers] = useState<McpServerDefinition[]>([])

  // --- Derived data ---
  const activityItems = useMemo<ActivityItem[]>(() => {
    const workspaceById = new Map(workspaces.map((w) => [w.id, w]))
    const modelById = new Map(profiles.map((m) => [m.id, m]))
    return tasks.map((task) => {
      const ws = task.workspaceId ? workspaceById.get(task.workspaceId) : undefined
      const model = modelById.get(task.modelProfileId)
      return {
        key: `task:${task.id}`,
        id: task.id,
        kind: 'task' as const,
        title: task.title,
        workspacePath: ws?.path ?? '',
        workspaceLabel: ws?.name ?? '未关联目录',
        source: model?.name ?? 'AI 编排',
        status: task.status,
        pinned: Boolean(task.pinned),
        archived: Boolean(task.archivedAt),
        updatedAt: task.updatedAt
      }
    }).sort((a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
    )
  }, [tasks, workspaces, profiles])

  // --- Derived: projects ---
  const projects = useMemo(() => {
    const visible = workspaces.filter((w) => !w.removedAt)
    const grouped = new Map(visible.map((w) => [w.path, { name: w.name, items: [] as ActivityItem[] }]))
    activityItems.filter((i) => !i.archived && grouped.has(i.workspacePath)).forEach((i) => {
      grouped.get(i.workspacePath)!.items.push(i)
    })
    return [...grouped.entries()].map(([path, g]) => {
      const ws = workspaces.find((w) => w.path === path)
      return { id: ws?.id ?? path, path, name: g.name || (path.split('/').filter(Boolean).at(-1) ?? path),
        icon: ws?.icon, color: ws?.color, pinned: ws?.pinned, items: g.items }
    }).sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)))
  }, [activityItems, workspaces])

  // --- Init ---
  useEffect(() => {
    document.documentElement.dataset.theme = themeMode
  }, [themeMode])

  useEffect(() => {
    void Promise.all([
      fetchTasks(),
      fetchWorkspaces(),
      fetchProfiles(),
      window.kova.listAgents().then(setAgents),
      window.kova.listPlugins().then((r) => setPlugins(r.plugins)),
      window.kova.listCapabilities().then(setCapabilities),
      window.kova.listSkills().then(setSkills),
      window.kova.listMcpServers().then(setMcpServers)
    ])
  }, [fetchTasks, fetchWorkspaces, fetchProfiles])

  // --- Task event subscription ---
  useEffect(() => {
    const unsub = window.kova.onTaskEvent((event) => {
      if (activeTask?.task.id === event.taskId) void selectTask(event.taskId)
      void fetchTasks()
    })
    return unsub
  }, [activeTask?.task.id, selectTask, fetchTasks])

  // --- Handlers ---
  function handleNewTask() {
    clearActiveTask()
    setView('chat')
  }

  async function handleSelectTask(taskId: string) {
    await selectTask(taskId)
    setView('chat')
  }

  async function handleDeleteTask(taskId: string) {
    const task = tasks.find((t) => t.id === taskId)
    if (task?.status === 'running') { alert('请先停止正在运行的任务，再删除记录。'); return }
    if (confirm(`确定删除"${task?.title ?? '这个任务'}"吗？`)) await deleteTask(taskId)
  }

  async function handleSelectActivity(item: ActivityItem) {
    await selectTask(item.id)
    setView('chat')
  }

  async function handleDeleteActivity(item: ActivityItem) {
    await handleDeleteTask(item.id)
  }

  function handleOpenProject(path: string) {
    const ws = workspaces.find((w) => w.path === path)
    setCurrentWorkspace(path)
    clearActiveTask()
    setView('chat')
  }

  async function handleTogglePinProject(id: string) {
    const ws = workspaces.find((w) => w.id === id)
    if (!ws) return
    const updated = await window.kova.updateWorkspace({ id: ws.id, pinned: !ws.pinned })
    fetchWorkspaces()
  }

  async function handleRemoveProject(id: string) {
    const ws = workspaces.find((w) => w.id === id)
    if (!ws || !confirm(`从项目列表移除"${ws.name}"吗？\n\n不会删除源码文件和历史会话。`)) return
    await window.kova.updateWorkspace({ id: ws.id, removed: true })
    fetchWorkspaces()
  }

  function handleRevealPath(path: string) {
    void window.kova.revealPath(path)
  }

  function handleEditProject(_id: string) {
    // TODO: integrate project edit modal
  }

  // --- Settings: full-page replacement (no main sidebar) ---
  if (view === 'settings') {
    return (
      <Settings
        plugins={plugins}
        capabilities={capabilities}
        skills={skills}
        mcpServers={mcpServers}
        onBack={() => setView('chat')}
        onPluginEnabled={async (id, enabled) => {
          const result = await window.kova.setPluginEnabled(id, enabled)
          setPlugins(result.plugins)
        }}
        onSkillEnabled={async (id, enabled) => {
          const updated = await window.kova.setSkillEnabled(id, enabled)
          setSkills((c) => c.map((s) => (s.id === id ? updated : s)))
        }}
        onSkillImported={(skill) => setSkills((c) => [skill, ...c.filter((s) => s.id !== skill.id)])}
      />
    )
  }

  // --- Main layout ---
  return (
    <div className="app-shell">
      <Sidebar
        view={view}
        onNavigate={setView}
        tasks={tasks}
        workspaces={workspaces}
        activityItems={activityItems}
        activeTaskId={activeTask?.task.id ?? null}
        onNewTask={handleNewTask}
        onSelectTask={handleSelectTask}
        onDeleteTask={handleDeleteTask}
        onTogglePinProject={handleTogglePinProject}
        onRemoveProject={handleRemoveProject}
        onRevealPath={handleRevealPath}
        onEditProject={handleEditProject}
        onOpenProject={handleOpenProject}
      />

      <section className="workspace-shell">
        {view === 'chat' && (
          activeTask ? <TaskDetail /> : <TaskCreate />
        )}
        {view === 'tasks' && (
          <TaskList items={activityItems} onSelect={handleSelectActivity} onDelete={handleDeleteActivity} />
        )}
        {view === 'projects' && (
          <ProjectList projects={projects} onSelectItem={handleSelectActivity} onOpenProject={handleOpenProject} />
        )}
        {view === 'plugins' && (
          <Plugins plugins={plugins} capabilities={capabilities} skills={skills} />
        )}
      </section>
    </div>
  )
}
