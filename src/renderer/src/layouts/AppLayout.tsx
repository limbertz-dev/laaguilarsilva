import { useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { Sidebar } from '../components/layout/Sidebar'

export interface AppLayoutContext {
  showMessage: (message: string) => void
  clearMessage: () => void
}

export function AppLayout(): React.JSX.Element {
  const location = useLocation()
  const [message, setMessage] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const showMessage = useCallback((value: string) => setMessage(value), [])
  const clearMessage = useCallback(() => setMessage(''), [])
  const closeMenu = useCallback(() => setMenuOpen(false), [])
  const toggleMenu = useCallback(() => setMenuOpen((open) => !open), [])
  const outletContext = useMemo(() => ({ showMessage, clearMessage }), [clearMessage, showMessage])

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!menuOpen) return

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('keydown', closeOnEscape)
      document.body.style.overflow = originalOverflow
    }
  }, [menuOpen])

  return (
    <div className={`app-shell${menuOpen ? ' menu-open' : ''}`}>
      <button
        type="button"
        className="sidebar-backdrop"
        aria-label="Cerrar menú"
        tabIndex={menuOpen ? 0 : -1}
        onClick={closeMenu}
      />
      <Sidebar open={menuOpen} onNavigate={closeMenu} />
      <div className="app-content">
        <Header menuOpen={menuOpen} onMenuToggle={toggleMenu} />
        <main>
          {message && <div className="notice">{message}</div>}
          <div className="route-transition" key={location.pathname}>
            <Outlet context={outletContext} />
          </div>
        </main>
      </div>
    </div>
  )
}
