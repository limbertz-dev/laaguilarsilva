import { platform } from './platform'

export async function wipeCapacitorData(): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = []

  if (platform !== 'capacitor') {
    try {
      localStorage.clear()
      sessionStorage.clear()
    } catch (e) {
      errors.push(String(e))
    }
    return { ok: errors.length === 0, errors }
  }

  try {
    localStorage.clear()
    sessionStorage.clear()
  } catch (e) {
    errors.push(`WebStorage: ${String(e)}`)
  }

  try {
    const { Preferences } = await import('@capacitor/preferences')
    await Preferences.clear()
  } catch (e) {
    errors.push(`Preferences: ${String(e)}`)
  }

  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    try {
      await Filesystem.rmdir({ path: '', directory: Directory.Data, recursive: true })
    } catch {
      await Filesystem.rmdir({ path: '.', directory: Directory.Data, recursive: true })
    }
  } catch (e) {
    errors.push(`Filesystem: ${String(e)}`)
  }

  return { ok: errors.length === 0, errors }
}
