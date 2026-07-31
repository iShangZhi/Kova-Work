import {
  Archive,
  ChevronRight,
  CirclePlus,
  Cpu,
  Folder,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Settings,
  SquarePen,
  Trash2,
  X
} from 'lucide-react'
import { useState } from 'react'
import packageInfo from '../../../../../package.json'
import { ProjectGlyph } from '../../utils/icons'
import { workspaceName } from '../../utils/format'
import type { Task, Workspace } from '../../../../shared/contracts'
import type { ActivityItem } from '../shared/ActivityTable'

export type ViewId = 'chat' | 'tasks' | 'projects' | 'plugins' | 'settings'

interface SidebarProps {
  view: ViewId
  onNavigate: (view: ViewId) => void
  tasks: Task[]
  workspaces: Workspace[]
  activityItems: ActivityItem[]
  activeTaskId: string | null
  onNewTask: () => void
  onSelectTask: (taskId: string) => void
  onDeleteTask: (taskId: string) => void
  onTogglePinProject: (id: string) => void
  onRemoveProject: (id: string) => void
  onRevealPath: (path: string) => void
  onEditProject: (id: string) => void
  onOpenProject: (path: string) => void
}

export function Sidebar({
  view,
  onNavigate,
  tasks,
  workspaces,
  activityItems,
  activeTaskId,
  onNewTask,
  onSelectTask,
  onDeleteTask,
  onTogglePinProject,
  onRemoveProject,
  onRevealPath,
  onEditProject,
  onOpenProject
}: SidebarProps) {
  const [projectsExpanded, setProjectsExpanded] = useState(true)
  const [recentExpanded, setRecentExpanded] = useState(true)
  const [expandedPaths, setExpandedPaths] = useState<string[]>([])
  const [menuId, setMenuId] = useState<string | null>(null)

  const visibleWorkspaces = workspaces.filter((w) => !w.removedAt)

  // Group activity items by workspace path
  const projectGroups = (() => {
    const grouped = new Map<string, { name: string; items: ActivityItem[] }>(
      visibleWorkspaces.map((w) => [w.path, { name: w.name, items: [] }])
    )
    activityItems.filter((i) => !i.archived && grouped.has(i.workspacePath)).forEach((i) => {
      grouped.get(i.workspacePath)!.items.push(i)
    })
    return [...grouped.entries()].map(([path, g]) => {
      const ws = workspaces.find((w) => w.path === path)
      return { id: ws?.id ?? path, path, name: g.name || workspaceName(path), icon: ws?.icon, color: ws?.color, pinned: ws?.pinned, items: g.items }
    }).sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)))
  })()

  const visibleItems = activityItems.filter((i) => !i.archived)
  const archivedItems = activityItems.filter((i) => i.archived)

  function toggleProject(path: string) {
    const ws = workspaces.find((w) => w.path === path)
    onOpenProject(path)
    setExpandedPaths((c) => c.includes(path) ? c.filter((p) => p !== path) : [...c, path])
  }

  return (
    <aside className="sidebar">
      <div className="window-drag" />
      <div className="brand">
        <span>Kova</span>
        <small>v{packageInfo.version}</small>
      </div>

      <nav className="sidebar-primary-nav" aria-label="主要功能">
        <button
          className={`new-task-button ${view === 'chat' && !activeTaskId ? 'active' : ''}`}
          type="button"
          onClick={onNewTask}
        >
          <SquarePen aria-hidden="true" />
          <span>新建任务</span>
          <CirclePlus className="new-task-plus" aria-hidden="true" />
        </button>
        <button
          className={`sidebar-action sidebar-primary-action ${view === 'plugins' ? 'active' : ''}`}
          type="button"
          onClick={() => onNavigate('plugins')}
        >
          <Cpu aria-hidden="true" />
          <span>插件</span>
        </button>
      </nav>

      {/* Projects section */}
      <section className="sidebar-group project-group">
        <div className="sidebar-group-heading">
          <button className="sidebar-group-toggle" type="button" aria-expanded={projectsExpanded} onClick={() => setProjectsExpanded((e) => !e)}>
            <span>项目</span>
            <ChevronRight className={projectsExpanded ? 'expanded' : ''} aria-hidden="true" />
          </button>
          <button className="sidebar-group-add" type="button" aria-label="创建项目" title="创建项目">
            <CirclePlus aria-hidden="true" />
          </button>
        </div>
        {projectsExpanded && (
          <div className="project-nav-list">
            {projectGroups.length === 0 && <p className="empty-copy">还没有项目</p>}
            {projectGroups.slice(0, 6).map((p) => (
              <div className="project-nav-entry" key={p.path}>
                <div className="project-nav-row">
                  <button className="project-toggle" type="button" title={p.path}
                    aria-expanded={expandedPaths.includes(p.path)}
                    onClick={() => toggleProject(p.path)}>
                    <ChevronRight className={expandedPaths.includes(p.path) ? 'expanded' : ''} aria-hidden="true" />
                    <ProjectGlyph icon={p.icon} color={p.color} />
                    <span>{p.name}</span>
                  </button>
                  <span className="project-row-actions">
                    <button type="button" title="更多操作" onClick={() => setMenuId((c) => c === p.id ? null : p.id)}>
                      <MoreHorizontal aria-hidden="true" />
                    </button>
                    <button type="button" title="编辑项目" onClick={() => onEditProject(p.id)}>
                      <Pencil aria-hidden="true" />
                    </button>
                  </span>
                </div>
                {menuId === p.id && (
                  <div className="project-more-menu">
                    <button type="button" onClick={() => { onTogglePinProject(p.id); setMenuId(null) }}>
                      {p.pinned ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />}
                      <span>{p.pinned ? '取消置顶' : '置顶项目'}</span>
                    </button>
                    <button type="button" onClick={() => { setMenuId(null); onRevealPath(p.path) }}>
                      <FolderOpen aria-hidden="true" />
                      <span>在 Finder 中显示</span>
                    </button>
                    <button type="button" onClick={() => { setMenuId(null); onEditProject(p.id) }}>
                      <Settings aria-hidden="true" />
                      <span>编辑项目</span>
                    </button>
                    <button className="danger" type="button" onClick={() => { void onRemoveProject(p.id); setMenuId(null) }}>
                      <X aria-hidden="true" />
                      <span>移除</span>
                    </button>
                  </div>
                )}
                {expandedPaths.includes(p.path) && (
                  <div className="project-session-list">
                    {p.items.length === 0 && <p>暂无任务</p>}
                    {p.items.slice(0, 8).map((item) => (
                      <div className={`project-session-item ${activeTaskId === item.id ? 'active' : ''}`} key={item.key}>
                        <button type="button" title={item.title} onClick={() => onSelectTask(item.id)}>
                          <span className={`status-pip ${item.status}`} />
                          <span>{item.title}</span>
                        </button>
                        <button className="project-session-delete" type="button" aria-label={`删除 ${item.title}`}
                          disabled={item.status === 'running'}
                          onClick={() => onDeleteTask(item.id)}>
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

      {/* Recent section */}
      <section className="sidebar-group recent-group">
        <button className="sidebar-group-toggle" type="button" aria-expanded={recentExpanded} onClick={() => setRecentExpanded((e) => !e)}>
          <span>最近</span>
          <ChevronRight className={recentExpanded ? 'expanded' : ''} aria-hidden="true" />
        </button>
        {recentExpanded && (
          <div className="session-list">
            {visibleItems.length === 0 && <p className="empty-copy">还没有任务</p>}
            {visibleItems.slice(0, 10).map((item) => (
              <div key={item.key} className={`session-nav-item ${activeTaskId === item.id ? 'active' : ''}`}>
                <button className="session-item" type="button" onClick={() => onSelectTask(item.id)}>
                  <span className={`status-pip ${item.status}`} />
                  <span className="session-copy">
                    <strong>{item.title}</strong>
                    <small>{item.source} · {new Date(item.updatedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</small>
                  </span>
                </button>
                <span className="session-nav-actions">
                  <button type="button" aria-label={`删除 ${item.title}`}
                    disabled={item.status === 'running'}
                    onClick={() => onDeleteTask(item.id)}>
                    <Trash2 aria-hidden="true" />
                  </button>
                </span>
              </div>
            ))}
            {archivedItems.length > 0 && (
              <>
                <div className="archived-session-label"><Archive aria-hidden="true" /><span>已归档</span></div>
                {archivedItems.slice(0, 5).map((item) => (
                  <div key={item.key} className={`session-nav-item archived ${activeTaskId === item.id ? 'active' : ''}`}>
                    <button className="session-item" type="button" onClick={() => onSelectTask(item.id)}>
                      <Archive aria-hidden="true" />
                      <span className="session-copy">
                        <strong>{item.title}</strong>
                        <small>{new Date(item.updatedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</small>
                      </span>
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </section>

      <button
        className={`sidebar-action ${view === 'settings' ? 'active' : ''}`}
        type="button"
        onClick={() => onNavigate('settings')}
      >
        <Settings aria-hidden="true" />
        <span>设置</span>
      </button>
    </aside>
  )
}
