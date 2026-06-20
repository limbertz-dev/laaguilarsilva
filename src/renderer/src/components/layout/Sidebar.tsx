import { NavLink } from 'react-router-dom'
import { navigationItems } from '../../routes/navigation'

export function Sidebar(): React.JSX.Element {
  return (
    <aside className="sidebar">
      <h1>LA Aguilar Silva</h1>
      <nav aria-label="Navegación principal">
        {navigationItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => (isActive ? 'active' : undefined)}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
