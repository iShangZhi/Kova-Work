import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { Sidebar } from './components/layout/Sidebar'
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

  const [agents, setAgents] = useState<AgentDefinition[]>([])
  const [plugins, setPlugins] = useState<PluginDefinition[]>([])
  const [capabilities, setCapabilities] = useState<RegisteredCapability[]>([])
  const [skills, setSkills] = useState<SkillDefinition[]>([])
  const [mcpServers, setMcpServers] = useState<McpServerDefinition[]>([])

  // --- Derived: activity items (tasks → UI rows) ---
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

  const visibleItems = activityItems.filter((i) => !i.archived)

  // --- Derived: projects (workspaces → project cards) ---
  const projects = useMemo(() => {
    const visibleWorkspaces = workspaces.filter((w) => !w.removedAt)
    const grouped = new Map<string, { name: string; items: ActivityItem[] }>(
      visibleWorkspaces.map((w) => [w.path, { name: w.name, items: [] }])
    )
    visibleItems.filter((i) => grouped.has(i.workspacePath)).forEach((i) => {
      grouped.get(i.workspacePath)!.items.push(i)
    })
    return [...grouped.entries()].map(([path, g]) => {
      const ws = workspaces.find((w) => w.path === path)
      return {
        id: ws?.id ?? path,
        path,
        name: g.name || (path.split('/').filter(Boolean).at(-1) ?? path),
        icon: ws?.icon,
        color: ws?.color,
        pinned: ws?.pinned,
        items: g.items
      }
    }).sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)))
  }, [visibleItems, workspaces])

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
      if (activeTask?.task.id === event.taskId) {
        // Refresh the active task when events arrive
        void selectTask(event.taskId)
      }
      void fetchTasks()
    })
    return unsub
  }, [activeTask?.task.id, selectTask, fetchTasks])

  // --- Handlers ---
  function handleNewTask() {
    clearActiveTask()
  }

  async function handleSelectTask(taskId: string) {
    await selectTask(taskId)
  }

  async function handleDeleteTask(taskId: string) {
    const task = tasks.find((t) => t.id === taskId)
    if (task?.status === 'running') {
      alert('请先停止正在运行的任务，再删除记录。')
      return
    }
    if (confirm(`确定删除"${task?.title ?? '这个任务'}"吗？`)) {
      await deleteTask(taskId)
    }
  }

  async function handleSelectActivity(item: ActivityItem) {
    await selectTask(item.id)
  }

  async function handleDeleteActivity(item: ActivityItem) {
    await handleDeleteTask(item.id)
  }

  function handleOpenProject(path: string) {
    const ws = workspaces.find((w) => w.path === path)
    setCurrentWorkspace(path)
    clearActiveTask()
  }

  return (
    <BrowserRouter>
      <div className="app-shell">
        <Sidebar
          tasks={tasks}
          workspaces={workspaces}
          onNewTask={handleNewTask}
          onSelectTask={handleSelectTask}
          onDeleteTask={handleDeleteTask}
          activeTaskId={activeTask?.task.id ?? null}
        />
        <section className="workspace-shell">
          <Routes>
            {/* Home – agent chat or task create */}
            <Route
              path="/"
              element={activeTask ? <TaskDetail /> : <TaskCreate />}
            />
            <Route path="/tasks/:id" element={<TaskDetail />} />

            {/* Tasks list */}
            <Route
              path="/tasks"
              element={
                <TaskList
                  items={activityItems}
                  onSelect={handleSelectActivity}
                  onDelete={handleDeleteActivity}
                />
              }
            />

            {/* Projects */}
            <Route
              path="/projects"
              element={
                <ProjectList
                  projects={projects}
                  onSelectItem={handleSelectActivity}
                  onOpenProject={handleOpenProject}
                />
              }
            />

            {/* Plugins / Skills */}
            <Route
              path="/plugins"
              element={<Plugins plugins={plugins} capabilities={capabilities} skills={skills} />}
            />

            {/* Settings */}
            <Route
              path="/settings"
              element={
                <Settings
                  plugins={plugins}
                  capabilities={capabilities}
                  skills={skills}
                  mcpServers={mcpServers}
                  onPluginEnabled={async (id, enabled) => {
                    const result = await window.kova.setPluginEnabled(id, enabled)
                    setPlugins(result.plugins)
                  }}
                  onSkillEnabled={async (id, enabled) => {
                    const updated = await window.kova.setSkillEnabled(id, enabled)
                    setSkills((current) => current.map((s) => (s.id === id ? updated : s)))
                  }}
                  onSkillImported={(skill) =>
                    setSkills((current) => [skill, ...current.filter((s) => s.id !== skill.id)])
                  }
                />
              }
            />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </section>
      </div>
    </BrowserRouter>
  )
}
