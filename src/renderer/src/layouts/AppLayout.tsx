import { useCallback, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { Sidebar } from '../components/layout/Sidebar'

export interface AppLayoutContext {
  showMessage: (message: string) => void
  clearMessage: () => void
}

export function AppLayout(): React.JSX.Element {
  const [message, setMessage] = useState('')
  const showMessage = useCallback((value: string) => setMessage(value), [])
  const clearMessage = useCallback(() => setMessage(''), [])
  const outletContext = useMemo(() => ({ showMessage, clearMessage }), [clearMessage, showMessage])

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-content">
        <Header />
        <main>
          {message && <div className="notice">{message}</div>}
          <Outlet context={outletContext} />
        </main>
      </div>
    </div>
  )
}
