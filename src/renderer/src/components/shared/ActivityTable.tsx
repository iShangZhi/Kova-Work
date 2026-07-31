import { Trash2 } from 'lucide-react'
import { formatTime, statusLabel } from '../../utils/format'
import type { TaskStatus } from '../../../../shared/contracts'

export interface ActivityItem {
  key: string
  id: string
  kind: 'task'
  title: string
  workspacePath: string
  workspaceLabel: string
  source: string
  status: TaskStatus
  pinned: boolean
  archived: boolean
  updatedAt: string
}

interface ActivityTableProps {
  items: ActivityItem[]
  onSelect: (item: ActivityItem) => Promise<void>
  onDelete: (item: ActivityItem) => Promise<void>
}

export function ActivityTable({ items, onSelect, onDelete }: ActivityTableProps) {
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
            <span className="task-title">
              <strong>{item.title}</strong>
              <small>{item.workspaceLabel}</small>
            </span>
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
