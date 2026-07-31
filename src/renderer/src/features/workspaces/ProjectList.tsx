import { PageHeader } from '../../components/shared/PageHeader'
import { EmptyState } from '../../components/shared/EmptyState'
import type { ActivityItem } from '../../components/shared/ActivityTable'

interface ProjectData {
  id: string
  path: string
  name: string
  icon?: string
  color?: string
  pinned?: boolean
  items: ActivityItem[]
}

interface ProjectListProps {
  projects: ProjectData[]
  onSelectItem: (item: ActivityItem) => void
  onOpenProject: (path: string) => void
}

export function ProjectList({ projects, onSelectItem, onOpenProject }: ProjectListProps) {
  return (
    <main className="page-main">
      <PageHeader title="项目" description="项目按工作目录自动归集，拥有独立任务和 Agent 上下文。" />
      {projects.length === 0 ? (
        <EmptyState
          title="还没有项目"
          description="在 Agent 中选择工作目录并开始会话后，项目会自动出现在这里。"
        />
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
                <div><dt>运行中</dt><dd>{project.items.filter((i) => i.status === 'running').length}</dd></div>
                <div><dt>最近活动</dt><dd>{project.items[0] ? new Date(project.items[0].updatedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '暂无'}</dd></div>
              </dl>
              <div className="project-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    if (project.items[0]) onSelectItem(project.items[0])
                    else onOpenProject(project.path)
                  }}
                >
                  {project.items[0] ? '打开最近任务 →' : '在项目中新建任务 →'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
