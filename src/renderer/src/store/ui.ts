import { create } from 'zustand'

type ThemeMode = 'dark' | 'light'
type PermissionMode = 'plan' | 'dontAsk' | 'acceptEdits'

interface UIState {
  themeMode: ThemeMode
  defaultPermissionMode: PermissionMode

  setThemeMode: (mode: ThemeMode) => void
  setDefaultPermissionMode: (mode: PermissionMode) => void
}

export const useUIStore = create<UIState>((set) => ({
  themeMode: (localStorage.getItem('kova-theme') as ThemeMode) ?? 'light',
  defaultPermissionMode: (localStorage.getItem('kova-default-permission') as PermissionMode) ?? 'acceptEdits',

  setThemeMode: (mode: ThemeMode) => {
    document.documentElement.dataset.theme = mode
    localStorage.setItem('kova-theme', mode)
    set({ themeMode: mode })
  },

  setDefaultPermissionMode: (mode: PermissionMode) => {
    localStorage.setItem('kova-default-permission', mode)
    set({ defaultPermissionMode: mode })
  }
}))
