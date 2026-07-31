import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { Sidebar } from './components/layout/Sidebar'
import { TaskCreate } from './features/tasks/TaskCreate'
import { TaskDetail } from './features/tasks/TaskDetail'
import { useTaskStore } from './store/tasks'
import { useWorkspaceStore } from './store/workspaces'
import { useModelStore } from './store/models'
import { useUIStore } from './store/ui'
import './styles.css'

export function App() {
  const { tasks, activeTask, fetchTasks, selectTask, deleteTask, clearActiveTask } = useTaskStore()
  const { workspaces, fetchWorkspaces } = useWorkspaceStore()
  const { fetchProfiles } = useModelStore()
  const { themeMode } = useUIStore()

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode
  }, [themeMode])

  useEffect(() => {
    void Promise.all([
      fetchTasks(),
      fetchWorkspaces(),
      fetchProfiles()
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
            <Route path="/settings" element={<div>设置页面开发中...</div>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </section>
      </div>
    </BrowserRouter>
  )
}
