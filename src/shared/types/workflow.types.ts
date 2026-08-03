// Workflow 相关类型定义

export type WorkflowStage = 'design' | 'development' | 'testing'

export interface ClaudeWorkflowProfile {
  id: string
  stage: WorkflowStage
  name: string
  agentName: string
  promptPrefix: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface SaveClaudeWorkflowProfileInput {
  id?: string
  stage: WorkflowStage
  name: string
  agentName: string
  promptPrefix: string
}
