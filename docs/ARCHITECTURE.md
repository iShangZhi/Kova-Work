# Kova 架构文档

## 概述

Kova 是一个基于 Electron 的本地优先桌面应用，用于管理和编排 AI 编码代理。

## 技术栈

- **主进程**: Node.js + Electron + TypeScript
- **渲染进程**: React 18 + Zustand + React Router v6
- **构建工具**: Vite + Electron Vite
- **语言**: TypeScript

## 重构成果 ✅

### 前端架构重构 - 阶段一完成

**代码行数对比：**
- App.tsx: 2,226 行 → 80 行 (⬇️ 96.4%)
- 新增模块化组件: ~500 行
- 总体减少: 74%

**已实现：**
- ✅ Zustand 状态管理（tasks, workspaces, models, ui）
- ✅ React Router 路由系统
- ✅ 组件拆分（Sidebar, TaskCreate, TaskDetail）
- ✅ 工具函数提取（format.ts）
- ✅ TypeScript 零错误

详见 `docs/REFACTORING_PHASE1_REPORT.md`

## 项目结构

```
src/
├── main/                    # 主进程（待重构）
│   ├── core/
│   ├── plugins/
│   ├── storage.ts           # 687行，待拆分
│   └── index.ts
│
├── renderer/src/            # 渲染进程（已重构✅）
│   ├── components/
│   │   ├── ui/              # Button, Modal
│   │   └── layout/          # Sidebar
│   ├── features/
│   │   └── tasks/           # TaskCreate, TaskDetail
│   ├── store/               # Zustand stores
│   ├── utils/
│   └── App.tsx              # 80行，路由容器
│
├── shared/
│   └── contracts.ts         # IPC契约
└── preload/
```

## 后续路线图

### 阶段二：前端完善
- [ ] Settings 页面组件化
- [ ] Plugins 页面重构
- [ ] Projects 页面重构

### 阶段三：后端重构
- [ ] storage.ts 拆分为 Repository
- [ ] DDD 领域层
- [ ] 日志系统

### 阶段四：测试 + 工程化
- [ ] Vitest 测试框架
- [ ] ESLint + Prettier
- [ ] CI/CD
