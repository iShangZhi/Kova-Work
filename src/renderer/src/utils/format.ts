export function formatTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}

export function workspaceName(path: string): string {
  return path.split('/').filter(Boolean).at(-1) ?? path
}

export function statusLabel(status: string): string {
  return {
    draft: '草稿',
    queued: '排队中',
    idle: '空闲',
    running: '运行中',
    waiting: '等待中',
    completed: '已完成',
    failed: '失败',
    cancelled: '已终止'
  }[status] ?? status
}
