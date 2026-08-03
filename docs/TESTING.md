# Testing Guide

## 测试框架

Kova 使用 **Vitest** 作为测试框架。

### 为什么选择 Vitest？

- ⚡️ 极快的启动速度和热更新
- 🔧 与 Vite 无缝集成
- 📦 开箱即用的 TypeScript 支持
- 🎯 与 Jest 兼容的 API
- 📊 内置覆盖率报告

## 运行测试

```bash
# 运行所有测试（监听模式）
npm test

# 运行所有测试（单次运行）
npm run test:run

# 运行测试并生成覆盖率报告
npm run test:coverage

# 启动测试 UI 界面
npm run test:ui
```

## 测试结构

```
src/
├── main/                    # 主进程代码
│   └── domains/
│       └── task/
│           ├── TaskRepository.ts
│           └── TaskRepository.test.ts    # 测试文件
├── renderer/                # 渲染进程代码
│   └── src/
│       └── components/
│           ├── Button.tsx
│           └── Button.test.tsx           # 测试文件
├── shared/                  # 共享代码
│   ├── utils.ts
│   └── utils.test.ts                     # 测试文件
└── test/
    └── setup.ts             # 测试环境配置
```

## 编写测试

### 单元测试示例

```typescript
import { describe, it, expect } from 'vitest'

describe('formatDuration', () => {
  it('should format milliseconds correctly', () => {
    expect(formatDuration(1500)).toBe('1.5s')
  })

  it('should handle edge cases', () => {
    expect(formatDuration(0)).toBe('0ms')
    expect(formatDuration(-100)).toBe('0ms')
  })
})
```

### Repository 测试示例

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { TaskRepository } from './TaskRepository'

describe('TaskRepository', () => {
  let repository: TaskRepository

  beforeEach(() => {
    // 设置测试环境
    repository = new TaskRepository(mockStore)
  })

  it('should create a task', async () => {
    const task = await repository.create({
      prompt: 'Test task',
      workspaceId: 'ws-1'
    })

    expect(task.id).toBeDefined()
    expect(task.prompt).toBe('Test task')
  })
})
```

### 组件测试示例（未来）

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from './Button'

describe('Button', () => {
  it('should render with text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('should handle click events', async () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Click me</Button>)
    
    await userEvent.click(screen.getByText('Click me'))
    expect(handleClick).toHaveBeenCalledOnce()
  })
})
```

## Mock 对象

测试环境已经预配置了以下 mock 对象：

### Electron IPC Mock

```typescript
import { mockIpcRenderer } from '@/test/setup'

it('should call IPC', async () => {
  mockIpcRenderer.invoke.mockResolvedValue({ success: true })
  
  const result = await window.electron.ipcRenderer.invoke('some-channel')
  expect(result).toEqual({ success: true })
})
```

### Kova API Mock

```typescript
import { mockKovaApi } from '@/test/setup'

it('should list tasks', async () => {
  mockKovaApi.listTasks.mockResolvedValue([
    { id: 'task-1', prompt: 'Test' }
  ])
  
  const tasks = await window.kova.listTasks()
  expect(tasks).toHaveLength(1)
})
```

## 覆盖率报告

运行 `npm run test:coverage` 后，覆盖率报告会生成在：

- **终端输出** - 简要的覆盖率统计
- **coverage/index.html** - 详细的 HTML 报告

### 覆盖率目标

- **核心业务逻辑**: ≥80%
- **Repository 层**: ≥70%
- **工具函数**: ≥90%
- **UI 组件**: ≥60%（未来）

## 最佳实践

1. **遵循 AAA 模式**
   - **Arrange**: 准备测试数据
   - **Act**: 执行被测试的操作
   - **Assert**: 验证结果

2. **使用描述性的测试名称**
   ```typescript
   // ❌ 不好
   it('test 1', () => { ... })
   
   // ✅ 好
   it('should return empty array when no tasks exist', () => { ... })
   ```

3. **一个测试只验证一件事**
   ```typescript
   // ❌ 不好
   it('should create and update task', () => {
     const task = createTask()
     updateTask(task.id, { status: 'done' })
     // 测试了两件事
   })
   
   // ✅ 好
   it('should create task', () => { ... })
   it('should update task status', () => { ... })
   ```

4. **测试边界情况**
   - 空输入
   - null/undefined
   - 极大/极小值
   - 错误情况

5. **避免测试实现细节**
   - 测试行为，不是实现
   - 测试公共 API，不是私有方法

## 持续集成

TODO: 配置 GitHub Actions 在 PR 时自动运行测试

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:run
      - run: npm run test:coverage
```

## 调试测试

### VS Code 调试配置

在 `.vscode/launch.json` 中添加：

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Vitest Tests",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "test"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### 使用 Vitest UI

```bash
npm run test:ui
```

打开浏览器访问 UI 界面，可以：
- 可视化查看测试结果
- 过滤和搜索测试
- 查看覆盖率热图
- 调试单个测试

## 常见问题

### Q: 测试运行很慢？

A: 使用 `test.concurrent` 并行运行独立的测试：

```typescript
describe.concurrent('parallel tests', () => {
  it.concurrent('test 1', async () => { ... })
  it.concurrent('test 2', async () => { ... })
})
```

### Q: 如何跳过某个测试？

```typescript
it.skip('this test is not ready', () => { ... })
```

### Q: 如何只运行某个测试？

```typescript
it.only('run only this test', () => { ... })
```

## 参考资源

- [Vitest 官方文档](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Jest Matchers API](https://jestjs.io/docs/expect)
