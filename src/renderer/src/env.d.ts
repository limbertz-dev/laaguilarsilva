/// <reference types="vite/client" />

import type { AppApi } from '../../shared/contracts/api'

declare global {
  interface Window {
    api: AppApi
    Capacitor?: {
      isNativePlatform: () => boolean
      platform: string
    }
  }
}
