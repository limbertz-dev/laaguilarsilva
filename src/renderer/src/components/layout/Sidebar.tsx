import { NavLink } from 'react-router-dom'
import { navigationItems } from '../../routes/navigation'
import { AppIcon } from '../ui/AppIcon'

interface SidebarProps {
  open?: boolean
  onNavigate?: () => void
}

export function Sidebar({ open = false, onNavigate }: SidebarProps): React.JSX.Element {
  return (
    <aside id="app-sidebar" className={`sidebar${open ? ' open' : ''}`}>
      <div className="sidebar-brand">
        <span className="brand-icon">
          <AppIcon name="car" size={27} />
        </span>
        <div>
          <strong>LA Aguilar Silva</strong>
          <small>Gestión de autolavado</small>
        </div>
      </div>
      <nav aria-label="Navegación principal">
        {navigationItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => (isActive ? 'active' : undefined)}
            onClick={onNavigate}
          >
            <AppIcon name={item.icon} size={21} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        <span className="sidebar-avatar">LA</span>
        <div>
          <strong>LA Aguilar Silva</strong>
          <small>Versión 1.0</small>
        </div>
      </div>
    </aside>
  )
}
