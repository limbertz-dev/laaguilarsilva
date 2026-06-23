export interface NavigationItem {
  path: string
  label: string
  title: string
  description: string
  icon: string
}

export const navigationItems: NavigationItem[] = [
  {
    path: '/dashboard',
    label: 'Resumen',
    title: 'Resumen operativo',
    description: 'Indicadores generales del lavadero',
    icon: 'dashboard'
  },
  {
    path: '/clientes',
    label: 'Clientes y vehículos',
    title: 'Clientes y vehículos',
    description: 'Registro de clientes y sus vehículos',
    icon: 'users'
  },
  {
    path: '/servicios',
    label: 'Servicios',
    title: 'Servicios',
    description: 'Catálogo y precios de servicios',
    icon: 'services'
  },
  {
    path: '/ordenes',
    label: 'Órdenes',
    title: 'Órdenes de lavado',
    description: 'Creación y seguimiento de órdenes',
    icon: 'orders'
  },
  {
    path: '/caja',
    label: 'Caja y reportes',
    title: 'Caja y reportes',
    description: 'Movimientos, resultados y exportación de reportes',
    icon: 'finance'
  },
  {
    path: '/inventario',
    label: 'Inventario',
    title: 'Inventario',
    description: 'Control de insumos y compras',
    icon: 'inventory'
  },
  {
    path: '/empleados',
    label: 'Empleados',
    title: 'Empleados',
    description: 'Personal y pagos de salarios',
    icon: 'employee'
  }
]
