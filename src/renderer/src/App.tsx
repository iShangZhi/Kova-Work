import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Sidebar } from './components/layout/Sidebar'
import { TaskCreate } from './features/tasks/TaskCreate'
import { TaskDetail } from './features/tasks/TaskDetail'
import { Settings } from './features/settings/Settings'
import { useTaskStore } from './store/tasks'
import { useWorkspaceStore } from './store/workspaces'
import { useModelStore } from './store/models'
import { useUIStore } from './store/ui'
import type { PluginDefinition, RegisteredCapability, SkillDefinition, McpServerDefinition } from '../../shared/contracts'
import './styles.css'

export function App() {
  const { tasks, activeTask, fetchTasks, selectTask, deleteTask, clearActiveTask } = useTaskStore()
  const { workspaces, fetchWorkspaces } = useWorkspaceStore()
  const { fetchProfiles } = useModelStore()
  const { themeMode } = useUIStore()
  const [plugins, setPlugins] = useState<PluginDefinition[]>([])
  const [capabilities, setCapabilities] = useState<RegisteredCapability[]>([])
  const [skills, setSkills] = useState<SkillDefinition[]>([])
  const [mcpServers, setMcpServers] = useState<McpServerDefinition[]>([])

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode
  }, [themeMode])

  useEffect(() => {
    void Promise.all([
      fetchTasks(),
      fetchWorkspaces(),
      fetchProfiles(),
      window.kova.listPlugins().then((result) => setPlugins(result.plugins)),
      window.kova.listCapabilities().then(setCapabilities),
      window.kova.listSkills().then(setSkills),
      window.kova.listMcpServers().then(setMcpServers)
    ])
  }, [fetchTasks, fetchWorkspaces, fetchProfiles])

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
            <Route path="/" element={activeTask ? <TaskDetail /> : <TaskCreate />} />
            <Route path="/tasks/:id" element={<TaskDetail />} />
            <Route path="/plugins" element={<div>插件页面开发中...</div>} />
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
                  onSkillImported={(skill) => setSkills((current) => [skill, ...current.filter((s) => s.id !== skill.id)])}
                />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </section>
      </div>
    </BrowserRouter>
  )
}
