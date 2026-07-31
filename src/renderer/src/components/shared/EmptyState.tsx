interface EmptyStateProps {
  title: string
  description: string
  action?: () => void
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <span>◇</span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action && (
        <button className="primary-button" type="button" onClick={action}>
          新建任务
        </button>
      )}
    </div>
  )
}
