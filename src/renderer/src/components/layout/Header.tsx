import { useLocation } from 'react-router-dom'
import { navigationItems } from '../../routes/navigation'

export function Header(): React.JSX.Element {
  const { pathname } = useLocation()
  const current = navigationItems.find((item) => item.path === pathname) ?? navigationItems[0]

  return (
    <header className="app-header">
      <div>
        <h1>{current.title}</h1>
        <p>{current.description}</p>
      </div>
    </header>
  )
}
