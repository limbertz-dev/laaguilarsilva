import { useOutletContext } from 'react-router-dom'
import type { AppLayoutContext } from '../layouts/AppLayout'

export function useAppFeedback(): AppLayoutContext {
  return useOutletContext<AppLayoutContext>()
}
