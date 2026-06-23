import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '../layouts/AppLayout'
import { CajaPage } from '../pages/caja/CajaPage'
import { ClientesPage } from '../pages/clientes/ClientesPage'
import { DashboardPage } from '../pages/dashboard/DashboardPage'
import { EmpleadosPage } from '../pages/empleados/EmpleadosPage'
import { InventarioPage } from '../pages/inventario/InventarioPage'
import { OrdenesPage } from '../pages/ordenes/OrdenesPage'
import { ServiciosPage } from '../pages/servicios/ServiciosPage'

export function AppRoutes(): React.JSX.Element {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/clientes" element={<ClientesPage />} />
        <Route path="/servicios" element={<ServiciosPage />} />
        <Route path="/ordenes" element={<OrdenesPage />} />
        <Route path="/caja" element={<CajaPage />} />
        <Route path="/inventario" element={<InventarioPage />} />
        <Route path="/empleados" element={<EmpleadosPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}
