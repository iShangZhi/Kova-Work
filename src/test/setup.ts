import { beforeEach, afterEach, vi } from 'vitest'

// Mock Electron APIs
global.window = global.window || {}

// Mock IPC
const mockIpcRenderer = {
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn()
}

// @ts-expect-error - mocking electron
global.window.electron = {
  ipcRenderer: mockIpcRenderer
}

// Mock Kova API
const mockKovaApi = {
  // Task APIs
  listTasks: vi.fn(),
  startTask: vi.fn(),
  continueTask: vi.fn(),
  getTask: vi.fn(),
  stopTask: vi.fn(),
  deleteTask: vi.fn(),

  // Workspace APIs
  listWorkspaces: vi.fn(),
  createWorkspace: vi.fn(),
  updateWorkspace: vi.fn(),
  deleteWorkspace: vi.fn(),
  getCurrentWorkspace: vi.fn(),

  // Model APIs
  listModelProfiles: vi.fn(),
  saveModelProfile: vi.fn(),
  deleteModelProfile: vi.fn(),

  // Session APIs
  listAgents: vi.fn(),
  startSession: vi.fn(),
  sendUserMessage: vi.fn(),

  // Plugin APIs
  listPlugins: vi.fn(),
  installPlugin: vi.fn(),

  // Event subscription
  onTaskEvent: vi.fn(),
  onSessionEvent: vi.fn()
}

// @ts-expect-error - mocking kova api
global.window.kova = mockKovaApi

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks()
})

// Cleanup after each test
afterEach(() => {
  vi.restoreAllMocks()
})

export { mockIpcRenderer, mockKovaApi }
