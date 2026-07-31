import { useState } from 'react'
import { PageHeader } from '../../components/shared/PageHeader'
import { ActivityTable } from '../../components/shared/ActivityTable'
import type { ActivityItem } from '../../components/shared/ActivityTable'

type TaskFilter = 'all' | 'running' | 'completed' | 'failed' | 'archived'

interface TaskListProps {
  items: ActivityItem[]
  onSelect: (item: ActivityItem) => Promise<void>
  onDelete: (item: ActivityItem) => Promise<void>
}

export function TaskList({ items, onSelect, onDelete }: TaskListProps) {
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all')

  const filteredActivities = taskFilter === 'archived'
    ? items.filter((item) => item.archived)
    : items.filter((item) => !item.archived && (taskFilter === 'all' || item.status === taskFilter))

  return (
    <main className="page-main">
      <PageHeader title="任务" description="任务是需求、Agent 会话和最终结果的统一载体。" />
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>全部任务</h2>
            <p>模型编排任务与本地 Agent 会话统一显示</p>
          </div>
          <div className="filter-control" aria-label="任务筛选">
            {([
              ['all', '全部'],
              ['running', '进行中'],
              ['completed', '已完成'],
              ['failed', '失败'],
              ['archived', '已归档']
            ] as Array<[TaskFilter, string]>).map(([id, label]) => (
              <button
                className={taskFilter === id ? 'active' : ''}
                type="button"
                key={id}
                onClick={() => setTaskFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <ActivityTable items={filteredActivities} onSelect={onSelect} onDelete={onDelete} />
      </section>
    </main>
  )
}
