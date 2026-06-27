export type Platform = 'electron' | 'capacitor' | 'web'

export function detectPlatform(): Platform {
  if (typeof window !== 'undefined' && window.api) {
    return 'electron'
  }
  if (typeof (window as unknown as Record<string, unknown>).Capacitor !== 'undefined') {
    return 'capacitor'
  }
  return 'web'
}

export const platform = detectPlatform()
