import { useEffect } from 'react'
import { platform } from '../lib/platform'

export function useStatusBarTheme(): void {
  useEffect(() => {
    if (platform !== 'capacitor') return

    void (async () => {
      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar')
        await StatusBar.setStyle({ style: Style.Light })
      } catch {
      }
    })()
  }, [])
}
