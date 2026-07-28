import type { KovaApi } from '../../shared/contracts'

declare global {
  interface Window {
    kova: KovaApi
  }
}

export {}
