import { useLocation } from 'react-router-dom'
import { navigationItems } from '../../routes/navigation'
import { AppIcon } from '../ui/AppIcon'

export function Header(): React.JSX.Element {
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
      <div>
        <h1>{current.title}</h1>
        <p>{current.description}</p>
      </div>
      <div className="header-date">
        <AppIcon name="calendar" size={18} />
        <span>{today}</span>
      </div>
    </header>
  )
}
