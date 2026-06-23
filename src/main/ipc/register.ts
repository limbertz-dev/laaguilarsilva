import { BrowserWindow, ipcMain } from 'electron'
import { obtenerDashboard } from '../modules/dashboard/service'
import {
  actualizarCliente,
  crearCliente,
  crearClienteConVehiculo,
  eliminarCliente,
  listarClientes,
  obtenerHistorialCliente,
  cancelarEliminacionCliente
} from '../modules/clientes/service'
import {
  actualizarVehiculo,
  crearVehiculo,
  eliminarVehiculo,
  listarVehiculos,
  cancelarEliminacionVehiculo
} from '../modules/vehiculos/service'
import {
  actualizarServicio,
  cambiarEstadoServicio,
  crearServicio,
  eliminarServicio,
  listarServicios
} from '../modules/servicios/service'
import {
  actualizarEmpleado,
  crearEmpleado,
  eliminarEmpleado,
  listarEmpleados,
  pagarSalario,
  cambiarEstadoEmpleado
} from '../modules/empleados/service'
import {
  actualizarInsumo,
  comprarInsumo,
  crearInsumo,
  eliminarInsumo,
  listarInsumos,
  cambiarEstadoInsumo
} from '../modules/inventario/service'
import {
  actualizarOrden,
  cancelarOrden,
  crearOrden,
  entregarOrden,
  eliminarOrden,
  iniciarOrden,
  marcarOrdenLista,
  listarOrdenes
} from '../modules/ordenes/service'
import {
  obtenerResumenCaja,
  registrarEgreso,
  registrarMovimiento
} from '../modules/caja/service'
import { exportarReporteExcel, exportarReportePdf } from '../modules/reportes/export'
import { obtenerReporte } from '../modules/reportes/service'

export function registerIpcHandlers(): void {
  ipcMain.handle('dashboard:obtener', () => obtenerDashboard())
  ipcMain.handle('clientes:listar', () => listarClientes())
  ipcMain.handle('clientes:crear', (_, input) => crearCliente(input))
  ipcMain.handle('clientes:crear-con-vehiculo', (_, input) => crearClienteConVehiculo(input))
  ipcMain.handle('clientes:actualizar', (_, id, input) => actualizarCliente(id, input))
  ipcMain.handle('clientes:eliminar', (_, id) => eliminarCliente(id))
  ipcMain.handle('clientes:cancelar-eliminacion', (_, id) => cancelarEliminacionCliente(id))
  ipcMain.handle('clientes:historial', (_, id) => obtenerHistorialCliente(id))
  ipcMain.handle('vehiculos:listar', () => listarVehiculos())
  ipcMain.handle('vehiculos:crear', (_, input) => crearVehiculo(input))
  ipcMain.handle('vehiculos:actualizar', (_, id, input) => actualizarVehiculo(id, input))
  ipcMain.handle('vehiculos:eliminar', (_, id) => eliminarVehiculo(id))
  ipcMain.handle('vehiculos:cancelar-eliminacion', (_, id) => cancelarEliminacionVehiculo(id))
  ipcMain.handle('servicios:listar', () => listarServicios())
  ipcMain.handle('servicios:crear', (_, input) => crearServicio(input))
  ipcMain.handle('servicios:actualizar', (_, id, input) => actualizarServicio(id, input))
  ipcMain.handle('servicios:cambiar-estado', (_, id, estado) =>
    cambiarEstadoServicio(id, estado)
  )
  ipcMain.handle('servicios:eliminar', (_, id) => eliminarServicio(id))
  ipcMain.handle('empleados:listar', () => listarEmpleados())
  ipcMain.handle('empleados:crear', (_, input) => crearEmpleado(input))
  ipcMain.handle('empleados:actualizar', (_, id, input) => actualizarEmpleado(id, input))
  ipcMain.handle('empleados:eliminar', (_, id) => eliminarEmpleado(id))
  ipcMain.handle('empleados:cambiar-estado', (_, id, estado) => cambiarEstadoEmpleado(id, estado))
  ipcMain.handle('empleados:pagar-salario', (_, id) => pagarSalario(id))
  ipcMain.handle('inventario:listar', () => listarInsumos())
  ipcMain.handle('inventario:crear', (_, input) => crearInsumo(input))
  ipcMain.handle('inventario:actualizar', (_, id, input) => actualizarInsumo(id, input))
  ipcMain.handle('inventario:eliminar', (_, id) => eliminarInsumo(id))
  ipcMain.handle('inventario:cambiar-estado', (_, id, estado) => cambiarEstadoInsumo(id, estado))
  ipcMain.handle('inventario:comprar', (_, input) => comprarInsumo(input))
  ipcMain.handle('ordenes:listar', () => listarOrdenes())
  ipcMain.handle('ordenes:crear', (_, input) => crearOrden(input))
  ipcMain.handle('ordenes:actualizar', (_, id, input) => actualizarOrden(id, input))
  ipcMain.handle('ordenes:eliminar', (_, id) => eliminarOrden(id))
  ipcMain.handle('ordenes:iniciar', (_, id) => iniciarOrden(id))
  ipcMain.handle('ordenes:marcar-lista', (_, id) => marcarOrdenLista(id))
  ipcMain.handle('ordenes:entregar', (_, id) => entregarOrden(id))
  ipcMain.handle('ordenes:cancelar', (_, id) => cancelarOrden(id))
  ipcMain.handle('caja:resumen', () => obtenerResumenCaja())
  ipcMain.handle('caja:registrar-egreso', (_, input) => registrarEgreso(input))
  ipcMain.handle('caja:registrar-movimiento', (_, input) => registrarMovimiento(input))
  ipcMain.handle('reportes:obtener', (_, input) => obtenerReporte(input))
  ipcMain.handle('reportes:exportar-pdf', async (event, input) => {
    const report = obtenerReporte(input)
    return exportarReportePdf(report, BrowserWindow.fromWebContents(event.sender) ?? undefined)
  })
  ipcMain.handle('reportes:exportar-excel', async (event, input) => {
    const report = obtenerReporte(input)
    return exportarReporteExcel(report, BrowserWindow.fromWebContents(event.sender) ?? undefined)
  })
}
