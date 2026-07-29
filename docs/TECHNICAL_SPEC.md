# Kova 技术规格

> 当前代码结构、运行时序、状态机与实现进度参见
> [`ARCHITECTURE.md`](./ARCHITECTURE.md)。本文主要描述目标产品与协议。

## 1. 产品定义

Kova 是一个由用户自定义模型驱动的个人 AI 工作台。

用户向 Kova 描述目标，模型负责理解目标、规划步骤和选择能力；插件负责把语义化能力转换为具体 CLI 或本地运行时调用，并将执行过程、结果和产物统一返回给 Kova。

```text
用户目标
  → 自定义模型理解与规划
  → 选择已授权的插件能力
  → CLI 或本地运行时执行
  → 统一事件与产物
  → 模型判断下一步或汇总结果
```

Claude Code 是 Kova 首个编码能力插件，不是 Kova Core 中写死的特殊 Agent 类型。未来可以使用相同协议接入 Codex CLI、Git、文档处理、浏览器自动化和其他个人工具。

## 2. 核心原则

### 2.1 模型是大脑，插件是执行能力

- Model Provider 负责推理、规划、选择能力和总结结果。
- Plugin 负责声明、验证和实现能力。
- CLI 只是插件的一种运行时，不直接暴露给上层业务。
- Kova Core 不解析任何特定 CLI 的专有协议。

### 2.2 任务是产品主线

Kova 的主要业务链路是：

1. 用户创建任务并选择工作区。
2. Kova 使用指定或默认模型理解任务。
3. 模型从已启用且已授权的能力中选择工具。
4. 插件执行 CLI，并产生标准事件和产物。
5. 模型根据执行结果继续、调整或结束任务。
6. 用户可以观察、介入、停止、重试和恢复。

### 2.3 本地优先

- 工作目录、任务记录和审计事件默认保存在本地。
- CLI 在用户设备上执行。
- 只有模型请求和显式声明需要网络的插件可以访问网络。
- API Key 等凭证必须保存到系统安全存储，不写入普通状态文件。

### 2.4 能力优先于工具名称

模型看到的是 `code.edit`、`code.test` 等稳定能力，而不是 `claude --print` 等实现细节。插件可以替换底层 CLI，而不改变任务模型和上层编排逻辑。

## 3. 产品边界

### 3.1 MVP 范围

- 配置 OpenAI Chat Completions 兼容模型。
- 选择本地工作目录创建任务。
- 模型规划并调用已授权能力。
- 通过标准插件运行 Claude Code CLI。
- 展示模型、插件、CLI、权限和结果事件。
- 支持停止、失败重试和 Claude 原生会话恢复。
- 保存任务、运行轮次、事件和产物索引。
- 管理插件状态、CLI 依赖和权限声明。

### 3.2 非 MVP 范围

- 云端团队协作和账号体系。
- 多人项目管理。
- 插件公开市场和商业结算。
- 无限制自主运行。
- 绕过 CLI 安全权限。
- 推送、部署或生产操作的默认授权。

### 3.3 Workflow 的位置

简报、代码审查、文件整理等场景不作为 Kova Core 的独立业务模块，而是 Workflow：

```text
Workflow
  = 触发条件
  + 提示模板
  + 允许使用的能力集合
  + 输出约束
```

例如“每日 AI 简报”可以组合 `feed.fetch`、`content.summarize` 和 `file.write`，由调度器创建普通 Task。Workflow 最终仍经过统一的 Task、Run、Capability 和 Event 链路。

## 4. 领域模型

### 4.1 Workspace

工作区代表一个受信任的本地目录。

```ts
interface Workspace {
  id: string
  name: string
  path: string
  defaultModelProfileId?: string
  enabledPluginIds: string[]
  createdAt: string
  updatedAt: string
}
```

工作区不是通过任务会话临时推导的展示分组，而是具有独立配置和授权边界的领域对象。

### 4.2 Task

Task 代表用户想完成的目标。

```ts
type TaskStatus =
  | 'draft'
  | 'queued'
  | 'running'
  | 'waiting'
  | 'completed'
  | 'failed'
  | 'cancelled'

interface Task {
  id: string
  title: string
  objective: string
  workspaceId?: string
  modelProfileId: string
  allowedPluginIds: string[]
  status: TaskStatus
  createdAt: string
  updatedAt: string
  completedAt?: string
}
```

### 4.3 Run

Run 是 Task 的一次执行轮次。重试、恢复和用户追加指令都可以产生新的 Run。

```ts
type RunStatus =
  | 'queued'
  | 'running'
  | 'waiting_permission'
  | 'completed'
  | 'failed'
  | 'cancelled'

interface Run {
  id: string
  taskId: string
  sequence: number
  trigger: 'user' | 'retry' | 'resume' | 'workflow'
  status: RunStatus
  startedAt?: string
  completedAt?: string
  error?: string
}
```

### 4.4 Event

Event 是模型和插件执行过程的统一审计记录。

```ts
type EventType =
  | 'user_message'
  | 'model_message'
  | 'plan'
  | 'capability_call'
  | 'capability_result'
  | 'cli_output'
  | 'permission_request'
  | 'permission_result'
  | 'artifact'
  | 'system'
  | 'error'
  | 'completed'

interface TaskEvent {
  id: string
  taskId: string
  runId: string
  type: EventType
  text: string
  createdAt: string
  metadata?: Record<string, unknown>
}
```

### 4.5 Artifact

Artifact 是用户可以检查、打开或继续使用的任务产物。

```ts
type ArtifactType =
  | 'file'
  | 'code_change'
  | 'document'
  | 'test_report'
  | 'command_output'
  | 'image'
  | 'other'

interface Artifact {
  id: string
  taskId: string
  runId: string
  type: ArtifactType
  name: string
  path?: string
  mimeType?: string
  summary?: string
  metadata?: Record<string, unknown>
  createdAt: string
}
```

Artifact 默认只保存索引和元数据，不复制工作区中的源文件。

### 4.6 ModelProfile

ModelProfile 是任务的推理引擎配置，不属于 Agent 或 Plugin。

```ts
interface ModelProfile {
  id: string
  name: string
  provider: 'openai-compatible'
  baseUrl: string
  model: string
  credentialRef?: string
  systemPrompt?: string
  temperature?: number
  enabled: boolean
  createdAt: string
  updatedAt: string
}
```

`credentialRef` 指向 macOS Keychain 等系统安全存储中的凭证。

## 5. Capability 协议

### 5.1 CapabilityDefinition

插件通过 Manifest 声明模型可以调用的语义化能力。

```ts
interface CapabilityDefinition {
  id: string
  name: string
  description: string
  inputSchema: Record<string, unknown>
  outputSchema?: Record<string, unknown>
  risk: 'read' | 'write' | 'execute' | 'network'
  supportsStreaming: boolean
}
```

首个 Claude Code 插件可以声明：

- `code.inspect`
- `code.plan`
- `code.edit`
- `code.test`
- `code.review`

### 5.2 CapabilityCall

```ts
interface CapabilityCall {
  id: string
  taskId: string
  runId: string
  pluginId: string
  capabilityId: string
  arguments: Record<string, unknown>
}
```

### 5.3 CapabilityResult

```ts
interface CapabilityResult {
  callId: string
  status: 'completed' | 'failed' | 'cancelled'
  output?: Record<string, unknown>
  artifactIds?: string[]
  error?: string
}
```

模型只能调用当前 Task 允许、插件已就绪、且权限已经满足的能力。Core 必须验证调用，不能信任模型直接提供的 `pluginId`、文件路径或进程参数。

## 6. 插件系统

### 6.1 插件职责

一个插件包至少包含：

```text
plugin-directory/
  .kova-plugin/
    plugin.json
  runtime/
  README.md
```

插件负责：

- 声明 Capability。
- 声明本地依赖和兼容版本。
- 声明文件、进程和网络权限。
- 将 CapabilityCall 转换为 CLI 或本地运行时输入。
- 将专有输出转换成标准 Event、CapabilityResult 和 Artifact。
- 可选地保存和恢复原生会话标识。

### 6.2 Plugin Manifest

```ts
interface PluginManifest {
  manifestVersion: 1
  id: string
  name: string
  version: string
  description: string

  runtime: {
    kind: 'cli' | 'process'
    protocol: string
    entry?: string
  }

  capabilities: CapabilityDefinition[]

  dependencies?: {
    commands: Array<{
      name: string
      candidates: string[]
      versionArgs: string[]
      versionPattern?: string
    }>
  }

  permissions: {
    processes: string[]
    filesystem: 'none' | 'workspace'
    network: boolean
  }
}
```

### 6.3 插件状态

```ts
type PluginStatus =
  | 'installed'
  | 'missing_dependency'
  | 'incompatible'
  | 'ready'
  | 'disabled'
  | 'error'
```

扫描本机 CLI 只用于检查已经安装的插件是否可运行，不会把任意可执行文件自动变成插件。

### 6.4 插件运行接口

```ts
interface PluginRuntime {
  validate(context: PluginContext): Promise<void>
  execute(
    call: CapabilityCall,
    context: PluginContext,
    signal: AbortSignal,
    emit: (event: PluginRuntimeEvent) => Promise<void>
  ): Promise<CapabilityResult>
}
```

Core 向插件提供经过约束的 Context，插件不能直接获得完整应用状态。

## 7. Claude Code 插件

Claude Code 是首个标准 CLI 插件。

### 7.1 依赖检测

- 查找 `claude` 可执行文件。
- 执行 `claude --version`。
- 校验版本输出与插件兼容规则。
- 保存解析后的绝对路径。

### 7.2 调用策略

```text
claude
  --print
  --verbose
  --output-format stream-json
  --permission-mode <mode>
  [--resume <native-session-id>]
  [--agent <agent-name>]
  <prompt>
```

参数必须通过数组传递，禁止拼接 Shell 命令。

### 7.3 协议转换

Claude 专有 `stream-json` 只存在于插件内部。插件需要转换：

- 初始化事件 → `system`
- Assistant 内容 → `model_message` 或 `capability_result`
- 工具调用 → `cli_output` 或插件内部事件
- 失败结果 → `error`
- 文件修改和测试报告 → `artifact`

Claude 原生 `session_id` 保存到插件运行状态中，用于恢复执行，不作为 Kova Task ID。

## 8. 模型编排

### 8.1 ModelOrchestrator

ModelOrchestrator 是 Core 的智能编排层，负责：

1. 加载 Task、Workspace 和最近事件。
2. 获取当前允许使用的 CapabilityDefinition。
3. 向模型发送任务上下文和工具定义。
4. 接收模型的能力调用请求。
5. 交给 CapabilityRegistry 验证和执行。
6. 把执行结果返回模型。
7. 直到模型完成、等待用户、失败或达到运行限制。

### 8.2 运行限制

每个 Run 必须配置保护边界：

- 最大能力调用次数。
- 最大运行时长。
- 最大连续失败次数。
- 最大模型上下文事件数。
- 需要人工确认的风险级别。

达到限制后，Run 进入 `waiting` 或 `failed`，不能无限自主循环。

### 8.3 普通对话

不调用插件的模型对话仍然是一个 Task。它只是本次 Run 没有产生 CapabilityCall，而不是一种特殊的 `model` Agent。

## 9. 权限模型

### 9.1 权限层级

权限同时受以下范围约束：

1. 插件 Manifest 声明的最大权限。
2. Workspace 授予插件的权限。
3. Task 本次允许使用的插件。
4. Capability 风险级别。
5. 用户针对具体调用的批准结果。

有效权限取所有层级的交集。

### 9.2 默认策略

- 工作区外文件访问默认禁止。
- 读取操作可以由用户预授权。
- 写文件、执行命令和网络操作至少需要明确策略。
- 推送、部署、删除大量文件和生产操作必须逐次确认。
- 不提供 `bypassPermissions`。
- 每次审批和执行都生成审计事件。

### 9.3 凭证

- API Key、OAuth Token 不进入普通 JSON 或 SQLite 字段。
- Core 通过 `credentialRef` 从系统安全存储读取。
- Renderer 和插件只能获取使用结果，默认不能读取凭证明文。

## 10. 进程与应用边界

### 10.1 Renderer

- 负责界面和短期展示状态。
- 不直接访问文件系统、系统凭证或启动进程。
- 不解析任何 CLI 原始协议。

### 10.2 Preload

- 暴露最小化、类型化 IPC API。
- 对输入进行基础结构校验。
- 不暴露通用文件系统、Shell 或任意 IPC 调用。

### 10.3 Main / Core

- 管理窗口和 IPC。
- 管理 Task、Run 和状态机。
- 执行模型编排。
- 加载和验证插件。
- 执行权限判断。
- 管理 CLI 进程、持久化和系统凭证。

### 10.4 Plugin Runtime

- 只接收当前调用所需的受限上下文。
- 将 Capability 转换成 CLI 操作。
- 解析原生协议。
- 不能绕过 Core 的权限和审计层。

## 11. 持久化

### 11.1 目标存储

使用 SQLite 保存：

- Workspace
- Task
- Run
- Event
- Artifact
- ModelProfile（不含凭证明文）
- Plugin 安装记录和授权
- Workflow

Keychain 保存模型和连接器凭证。

### 11.2 状态恢复

应用启动时必须检查遗留的 `running` 状态：

- 如果对应进程不存在，Run 标记为 `failed` 或 `interrupted`。
- 如果插件支持原生恢复，用户可以创建新的 `resume` Run。
- Task 状态由最新 Run 重新计算，不能永久停留在虚假的运行中状态。

### 11.3 事件写入

事件使用追加写入，不应在每个事件产生时重写完整应用状态。任务列表和详情采用分页查询，避免一次加载所有事件。

## 12. UI 信息架构

### 12.1 一级导航

- **工作台**：运行中、等待处理、最近任务和快捷创建。
- **任务**：查看、筛选、恢复和重试全部个人任务。
- **工作区**：管理本地目录、默认模型和允许的插件。
- **能力**：查看已安装插件、能力、依赖和授权状态。
- **设置**：模型、权限、数据、外观和高级配置。

### 12.2 新建任务

```text
目标         用户想完成什么
工作区       可选的本地目录
模型         默认使用工作区或全局模型
能力范围     自动选择或手动限制插件
权限模式     只读、询问、允许工作区修改
```

用户不必先选择 Claude Code。默认由模型根据任务和已启用能力决定；高级用户可以锁定某个插件。

### 12.3 任务详情

任务详情包含：

- 任务目标和当前状态。
- 模型消息和用户消息。
- 模型计划。
- 插件和 CLI 调用。
- 权限请求。
- Run 历史。
- 产物和文件变更。
- 停止、继续、重试和恢复操作。

## 13. 当前实现差距

现有 MVP 已经具备：

- Electron Renderer、Preload、Main 的安全分层。
- Claude Code CLI 检测和 `stream-json` 适配。
- Claude 原生会话恢复。
- 统一 AgentEvent 的雏形。
- 会话停止和追加指令队列。
- OpenAI 兼容模型调用。
- 本地状态持久化。

需要纠正的核心差距：

1. 当前 `model` 与 `claude` 是并列 Agent，目标架构中模型应驱动插件。
2. 当前 `Session` 同时承担 Task、Run 和 Conversation，需要拆分。
3. 当前插件只注册 Agent Adapter，没有语义化 Capability。
4. MCP 和 Skill 只保存配置，尚未进入任务执行链路。
5. 原有硬编码简报业务已从 Core 和 UI 移除；如需恢复，应以 Workflow 实现。
6. API Key 明文保存在 JSON 中，需要迁移到 Keychain。
7. 每条事件都会重写完整 JSON，需要迁移到 SQLite 追加写入。
8. 应用重启后没有修复遗留运行状态。

## 14. 迁移路线

### 阶段一：修正核心抽象

1. 引入 Workspace、Task、Run、Artifact。
2. 保留现有 Event 数据，但增加 `runId` 并调整事件类型。
3. 将 ModelProfile 从 Agent 分支中独立。
4. 定义 CapabilityDefinition、CapabilityCall 和 CapabilityResult。
5. 建立 CapabilityRegistry 和最小 ModelOrchestrator。
6. 为旧 Session 数据提供一次性迁移。

验收标准：

- 用户创建 Task 后，模型能够发起一次标准 CapabilityCall。
- Core 能验证能力、执行插件并把结果返回模型。
- Task 可以正确完成、失败、停止和恢复。

### 阶段二：标准化 Claude Code 插件

1. 将现有 ClaudeAdapter 移入独立插件目录。
2. 使用 Plugin Manifest 声明依赖、能力和权限。
3. 将 Claude 原始事件转换为统一 Event 和 Artifact。
4. 支持插件启停、依赖重检和工作区授权。

验收标准：

- Kova Core 不再包含 `agentId === 'claude'` 分支。
- 移除 Claude 插件后 Core 仍可正常启动。
- 安装并启用插件后，模型可以调用编码能力。

### 阶段三：持久化与安全

1. 使用 SQLite 替换单文件 JSON。
2. 使用 Keychain 保存 API Key。
3. 实现启动状态修复和 Run 恢复。
4. 增加分页、事件追加写入和存储迁移测试。

### 阶段四：Workflow 与更多插件

1. 如需重新提供每日简报，将其实现为 Workflow 示例，不再进入 Core。
2. 接入第二个 CLI 插件，验证协议通用性。
3. 将 Skill 定义为可导入的 Workflow/提示资源包。
4. 将 MCP 工具通过适配层注册为 Capability。

## 15. 首批测试范围

- Capability 输入 Schema 校验。
- 插件权限不能超过 Manifest 声明。
- 工作区外路径拒绝。
- CLI 参数使用数组传递。
- Claude JSON 事件归一化。
- 任务停止与子进程终止。
- 模型多步能力调用和运行上限。
- 插件失败后的 Task/Run 状态。
- 应用重启后的运行状态修复。
- SQLite 迁移和事件顺序。
- Keychain 凭证不进入普通持久化。

## 16. 架构决策摘要

- Kova 是个人 AI 工作台，不是单一 Coding Agent 客户端。
- Model Provider 是智能编排核心，不是 Agent 类型。
- Plugin 是能力交付和 CLI 集成的唯一扩展单元。
- Capability 是模型与插件之间的稳定协议。
- Task 是用户目标，Run 是一次执行，Event 是过程，Artifact 是产物。
- Claude Code 是首个标准插件，不在 Core 中特殊处理。
- 简报等垂直场景使用 Workflow 组合能力，不进入 Core。
- 所有执行必须受到本地工作区、权限、审计和运行上限约束。
