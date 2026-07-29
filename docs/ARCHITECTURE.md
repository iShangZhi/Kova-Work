# Kova 当前架构

本文描述当前代码真实结构、运行边界和后续收口方向。产品目标与完整协议参见
[`TECHNICAL_SPEC.md`](./TECHNICAL_SPEC.md)。

## 1. 系统上下文

```mermaid
flowchart LR
    User["用户"] --> Desktop["Kova Desktop"]
    Desktop --> Model["第三方模型服务"]
    Desktop --> Workspace["本地工作区"]
    Desktop --> Claude["Claude Code CLI"]
    Desktop -. "规划接入" .-> MCP["MCP Server"]
    Desktop -. "规划接入" .-> Skill["Skill / Workflow"]
```

Kova 是本地优先的个人 AI 工作台。模型负责决策，本地 Capability 负责执行；Renderer
不能直接访问文件系统、凭证或启动进程。

## 2. Electron 容器与组件

```mermaid
flowchart TB
    subgraph Renderer["Renderer（非信任 UI）"]
        UI["React UI"]
    end

    subgraph Bridge["Preload"]
        API["类型化 KovaApi"]
    end

    subgraph Main["Main / Core（信任边界）"]
        IPC["IPC Handlers"]
        TM["TaskManager"]
        MO["ModelOrchestrator"]
        MR["ModelProviderRegistry"]
        CR["CapabilityRegistry"]
        NT["NativeToolRegistry"]
        PM["PluginManager"]
        SM["Legacy SessionManager"]
        Store["SessionStore"]
    end

    UI --> API --> IPC
    IPC --> TM --> MO
    MO --> MR --> RemoteModel["OpenAI-Compatible API"]
    MO --> CR
    CR --> NT --> LocalFiles["Workspace / Git"]
    CR --> PM --> ClaudeCLI["Claude Code CLI"]
    IPC --> SM --> PM
    TM --> Store
    SM --> Store
```

`TaskManager → ModelOrchestrator → CapabilityRegistry` 是目标主链。`SessionManager` 是迁移期
保留的旧链路，后续应只读迁移历史数据并停止创建新 Session。

## 3. Task 领域关系

```mermaid
erDiagram
    WORKSPACE ||--o{ TASK : contains
    MODEL_PROFILE ||--o{ TASK : drives
    TASK ||--|{ TASK_RUN : executes
    TASK_RUN ||--o{ TASK_EVENT : emits
    TASK_RUN ||--o{ ARTIFACT : produces

    TASK {
      string id
      string objective
      string status
      string modelProfileId
      string workspaceId
    }
    TASK_RUN {
      string id
      number sequence
      string trigger
      string status
    }
    TASK_EVENT {
      string id
      string type
      string text
    }
    ARTIFACT {
      string id
      string type
      string path
    }
```

一个 Task 可以通过首次执行、追加指令和失败重试生成多个 Run。Event 只追加到对应 Run，
Task 状态由当前或最新 Run 推导。

## 4. Task 状态机

```mermaid
stateDiagram-v2
    [*] --> running: 创建任务
    completed --> running: 追加指令
    failed --> running: 重试或追加指令
    cancelled --> running: 重试或追加指令
    running --> completed: 模型完成
    running --> failed: 模型或能力失败
    running --> cancelled: 用户停止
    running --> waiting: 等待授权（规划）
    waiting --> running: 用户批准（规划）
    waiting --> cancelled: 用户拒绝（规划）
```

当前已经实现 `running/completed/failed/cancelled`、多 Run、追加指令和失败重试。
`waiting` 与交互式权限审批仍是下一阶段工作。

## 5. 模型能力调用时序

```mermaid
sequenceDiagram
    actor User as 用户
    participant UI as Renderer
    participant Task as TaskManager
    participant Model as ModelOrchestrator
    participant Provider as Model Provider
    participant Registry as CapabilityRegistry
    participant Tool as Native Tool / Plugin

    User->>UI: 创建或继续任务
    UI->>Task: start / continue / retry
    Task->>Task: 创建 Run 和 user/system Event
    Task->>Model: run(task, run, instruction)
    Model->>Provider: 历史上下文 + 当前指令 + Tools
    Provider-->>Model: 文本或 tool_calls
    Model->>Registry: 校验并执行 CapabilityCall
    Registry->>Tool: 受限执行上下文
    Tool-->>Registry: CapabilityResult
    Registry-->>Model: 标准结果
    Model->>Provider: 继续推理
    Provider-->>Model: 最终结果
    Model-->>Task: 完成
    Task-->>UI: TaskEvent
```

## 6. 权限与信任边界

```mermaid
flowchart LR
    Request["模型请求"] --> AllowTask{"Task 允许插件？"}
    AllowTask -->|否| Reject["拒绝并审计"]
    AllowTask -->|是| AllowWorkspace{"Workspace 已授权？"}
    AllowWorkspace -->|否| Reject
    AllowWorkspace -->|是| Risk{"风险级别"}
    Risk -->|read| Execute["受工作区边界约束执行"]
    Risk -->|write / execute / network| Policy{"权限策略或用户批准"}
    Policy -->|拒绝| Reject
    Policy -->|批准| Execute
```

当前已实现插件范围、工作区范围、Capability 风险和只读路径边界。交互式批准、逐次审批、
授权记忆和高风险动作策略尚未完成。

## 7. 实现状态

| 子系统 | 当前状态 | 下一步 |
| --- | --- | --- |
| Model Provider | OpenAI-Compatible Provider 可运行 | 连接测试、能力探测、流式输出 |
| Task / Run | 多 Run、继续、重试、停止 | 等待授权、恢复策略、分页 |
| Native Tools | list/read/search/git.status | Diff、结构化代码索引、受控写入 |
| Plugin | Claude Code 可运行 | Manifest 加载、启停、安装与授权 |
| MCP / Skill | 仅配置与存储 | 注册为 Capability / Workflow |
| Artifact | 类型和索引已定义 | 自动采集 Diff、测试报告与文件 |
| Persistence | 原子写 JSON | SQLite 追加事件与迁移 |
| Credential | 普通状态字段 | macOS Keychain |
| UI | 工作台、任务、能力、设置 | 权限卡、Run/Artifact 面板、工作区管理 |
| Tests | 构建与桌面验收 | 单元、集成、迁移和端到端测试 |

## 8. 收口顺序

1. 完成交互式权限审批和 `waiting` 状态。
2. 将 Claude Capability 从 Core 硬编码迁移到 Manifest 驱动插件。
3. 接入 Artifact、文件变更和测试结果。
4. 使用 SQLite 与 Keychain 替换 JSON 和明文凭证。
5. 将 MCP、Skill 和 Workflow 纳入统一 Task 执行链。
6. 停止创建 Legacy Session，并完成历史数据只读迁移。
