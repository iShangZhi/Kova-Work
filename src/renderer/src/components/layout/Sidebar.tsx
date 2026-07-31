import type React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Archive,
  ChevronRight,
  CirclePlus,
  Cpu,
  Settings,
  SquarePen,
  Trash2
} from 'lucide-react'
import packageInfo from '../../../../../package.json'
import type { Task, Workspace } from '../../../../shared/contracts'

interface SidebarProps {
  tasks: Task[]
  workspaces: Workspace[]
  onNewTask: () => void
  onSelectTask: (taskId: string) => void
  onDeleteTask: (taskId: string) => void
  activeTaskId: string | null
}

export function Sidebar({ tasks, workspaces, onNewTask, onSelectTask, onDeleteTask, activeTaskId }: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <aside className="sidebar">
      <div className="window-drag" />
      <div className="brand">
        <span>Kova</span>
        <small>v{packageInfo.version}</small>
      </div>

      <nav className="sidebar-primary-nav" aria-label="主要功能">
        <button
          className={`new-task-button ${location.pathname === '/' ? 'active' : ''}`}
          type="button"
          onClick={onNewTask}
        >
          <SquarePen aria-hidden="true" />
          <span>新建任务</span>
          <CirclePlus className="new-task-plus" aria-hidden="true" />
        </button>
        <button
          className={`sidebar-action sidebar-primary-action ${location.pathname === '/plugins' ? 'active' : ''}`}
          type="button"
          onClick={() => navigate('/plugins')}
        >
          <Cpu aria-hidden="true" />
          <span>插件</span>
        </button>
      </nav>

      <section className="sidebar-group recent-group">
        <button className="sidebar-group-toggle" type="button" aria-expanded={true}>
          <span>最近</span>
          <ChevronRight className="expanded" aria-hidden="true" />
        </button>
        <div className="session-list">
          {tasks.slice(0, 10).map((task) => (
            <div
              key={task.id}
              className={`session-nav-item ${activeTaskId === task.id ? 'active' : ''}`}
            >
              <button className="session-item" type="button" onClick={() => onSelectTask(task.id)}>
                <span className={`status-pip ${task.status}`} />
                <span className="session-copy">
                  <strong>{task.title}</strong>
                  <small>{new Date(task.updatedAt).toLocaleString('zh-CN')}</small>
                </span>
              </button>
              <span className="session-nav-actions">
                <button
                  type="button"
                  aria-label={`删除 ${task.title}`}
                  disabled={task.status === 'running'}
                  onClick={() => onDeleteTask(task.id)}
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </span>
            </div>
          ))}
        </div>
      </section>

      <button
        className="sidebar-action"
        type="button"
        onClick={() => navigate('/settings')}
      >
        <Settings aria-hidden="true" />
        <span>设置</span>
      </button>
    </aside>
  )
}
