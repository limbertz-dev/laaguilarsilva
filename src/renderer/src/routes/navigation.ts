export interface NavigationItem {
  path: string
  label: string
  title: string
  description: string
}

export const navigationItems: NavigationItem[] = [
  {
    path: '/dashboard',
    label: 'Resumen',
    title: 'Resumen operativo',
    description: 'Indicadores generales del lavadero'
  },
  {
    path: '/clientes',
    label: 'Clientes y vehículos',
    title: 'Clientes y vehículos',
    description: 'Registro de clientes y sus vehículos'
  },
  {
    path: '/servicios',
    label: 'Servicios',
    title: 'Servicios',
    description: 'Catálogo y precios de servicios'
  },
  {
    path: '/ordenes',
    label: 'Órdenes',
    title: 'Órdenes de lavado',
    description: 'Creación y seguimiento de órdenes'
  },
  {
    path: '/caja',
    label: 'Caja y reportes',
    title: 'Caja y reportes',
    description: 'Movimientos, resultados y exportación de reportes'
  },
  {
    path: '/inventario',
    label: 'Inventario',
    title: 'Inventario',
    description: 'Control de insumos y compras'
  },
  {
    path: '/empleados',
    label: 'Empleados',
    title: 'Empleados',
    description: 'Personal y pagos de salarios'
  }
]
