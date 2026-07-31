import { create } from 'zustand'
import type { ModelProfile, SaveModelProfileInput } from '../../../shared/contracts'

interface ModelState {
  profiles: ModelProfile[]
  selectedProfileId: string
  defaultProfileId: string
  isLoading: boolean

  fetchProfiles: () => Promise<void>
  saveProfile: (input: SaveModelProfileInput) => Promise<ModelProfile>
  deleteProfile: (id: string) => Promise<void>
  setSelectedProfile: (id: string) => void
  setDefaultProfile: (id: string) => void
}

export const useModelStore = create<ModelState>((set, get) => ({
  profiles: [],
  selectedProfileId: localStorage.getItem('kova-default-model') ?? '',
  defaultProfileId: localStorage.getItem('kova-default-model') ?? '',
  isLoading: false,

  fetchProfiles: async () => {
    set({ isLoading: true })
    try {
      const profiles = await window.kova.listModelProfiles()
      set({ profiles, isLoading: false })

      const { defaultProfileId, selectedProfileId } = get()
      if (!profiles.find((p) => p.id === defaultProfileId) && profiles[0]) {
        set({ defaultProfileId: profiles[0].id, selectedProfileId: profiles[0].id })
      }
    } catch (error) {
      console.error('Failed to fetch model profiles:', error)
      set({ isLoading: false })
    }
  },

  saveProfile: async (input: SaveModelProfileInput) => {
    const profile = await window.kova.saveModelProfile(input)
    set((state) => ({
      profiles: state.profiles.some((p) => p.id === profile.id)
        ? state.profiles.map((p) => (p.id === profile.id ? profile : p))
        : [profile, ...state.profiles]
    }))
    return profile
  },

  deleteProfile: async (id: string) => {
    await window.kova.deleteModelProfile(id)
    set((state) => ({
      profiles: state.profiles.filter((p) => p.id !== id),
      selectedProfileId: state.selectedProfileId === id ? '' : state.selectedProfileId,
      defaultProfileId: state.defaultProfileId === id ? '' : state.defaultProfileId
    }))
  },

  setSelectedProfile: (id: string) => set({ selectedProfileId: id }),

  setDefaultProfile: (id: string) => {
    set({ defaultProfileId: id, selectedProfileId: id })
    localStorage.setItem('kova-default-model', id)
  }
}))
