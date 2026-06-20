import type { AppApi } from './api.types'

declare global {
  interface Window {
    api: AppApi
  }
}
