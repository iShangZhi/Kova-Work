import type {
  CapabilityDefinition,
  CapabilityResult
} from '../../shared/contracts'

export interface NativeToolContext {
  workspace: string
  signal: AbortSignal
}

export interface NativeTool {
  definition: CapabilityDefinition
  execute(
    argumentsValue: Record<string, unknown>,
    context: NativeToolContext
  ): Promise<Record<string, unknown>>
}

export interface NativeToolExecutionResult extends CapabilityResult {
  output?: Record<string, unknown>
}
