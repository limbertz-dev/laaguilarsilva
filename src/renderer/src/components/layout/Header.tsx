import { useLocation } from 'react-router-dom'
import { navigationItems } from '../../routes/navigation'
import { AppIcon } from '../ui/AppIcon'

interface HeaderProps {
  menuOpen: boolean
  onMenuToggle: () => void
}

export function Header({ menuOpen, onMenuToggle }: HeaderProps): React.JSX.Element {
  const { pathname } = useLocation()
  const current = navigationItems.find((item) => item.path === pathname) ?? navigationItems[0]
  const today = new Intl.DateTimeFormat('es-BO', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date())

  return (
    <header className="app-header">
      <div className="app-header-leading">
        <button
          type="button"
          className="mobile-menu-toggle"
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={menuOpen}
          aria-controls="app-sidebar"
          onClick={onMenuToggle}
        >
          <AppIcon name="menu" size={22} />
        </button>
        <div>
          <h1>{current.title}</h1>
          <p>{current.description}</p>
        </div>
      </div>
      <div className="header-date">
        <AppIcon name="calendar" size={18} />
        <span>{today}</span>
      </div>
    </header>
  )
}
