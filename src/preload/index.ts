import { contextBridge, ipcRenderer } from 'electron'
import type { AppApi } from './api.types'

const api: AppApi = {
  dashboard: () => ipcRenderer.invoke('dashboard:obtener'),
  clientes: {
    listar: () => ipcRenderer.invoke('clientes:listar'),
    crear: (input) => ipcRenderer.invoke('clientes:crear', input),
    crearConVehiculo: (input) => ipcRenderer.invoke('clientes:crear-con-vehiculo', input),
    actualizar: (clienteId, input) => ipcRenderer.invoke('clientes:actualizar', clienteId, input),
    eliminar: (clienteId) => ipcRenderer.invoke('clientes:eliminar', clienteId),
    cancelarEliminacion: (clienteId) => ipcRenderer.invoke('clientes:cancelar-eliminacion', clienteId),
    historial: (clienteId) => ipcRenderer.invoke('clientes:historial', clienteId)
  },
  vehiculos: {
    listar: () => ipcRenderer.invoke('vehiculos:listar'),
    crear: (input) => ipcRenderer.invoke('vehiculos:crear', input),
    actualizar: (vehiculoId, input) =>
      ipcRenderer.invoke('vehiculos:actualizar', vehiculoId, input),
    eliminar: (vehiculoId) => ipcRenderer.invoke('vehiculos:eliminar', vehiculoId),
    cancelarEliminacion: (vehiculoId) => ipcRenderer.invoke('vehiculos:cancelar-eliminacion', vehiculoId)
  },
  servicios: {
    listar: () => ipcRenderer.invoke('servicios:listar'),
    crear: (input) => ipcRenderer.invoke('servicios:crear', input),
    actualizar: (servicioId, input) => ipcRenderer.invoke('servicios:actualizar', servicioId, input),
    cambiarEstado: (servicioId, estado) =>
      ipcRenderer.invoke('servicios:cambiar-estado', servicioId, estado),
    eliminar: (servicioId) => ipcRenderer.invoke('servicios:eliminar', servicioId)
  },
  empleados: {
    listar: () => ipcRenderer.invoke('empleados:listar'),
    crear: (input) => ipcRenderer.invoke('empleados:crear', input),
    actualizar: (empleadoId, input) => ipcRenderer.invoke('empleados:actualizar', empleadoId, input),
    eliminar: (empleadoId) => ipcRenderer.invoke('empleados:eliminar', empleadoId),
    cambiarEstado: (empleadoId, estado) =>
      ipcRenderer.invoke('empleados:cambiar-estado', empleadoId, estado),
    pagarSalario: (empleadoId) => ipcRenderer.invoke('empleados:pagar-salario', empleadoId)
  },
  inventario: {
    listar: () => ipcRenderer.invoke('inventario:listar'),
    crear: (input) => ipcRenderer.invoke('inventario:crear', input),
    actualizar: (insumoId, input) => ipcRenderer.invoke('inventario:actualizar', insumoId, input),
    eliminar: (insumoId) => ipcRenderer.invoke('inventario:eliminar', insumoId),
    cambiarEstado: (insumoId, estado) =>
      ipcRenderer.invoke('inventario:cambiar-estado', insumoId, estado),
    comprar: (input) => ipcRenderer.invoke('inventario:comprar', input)
  },
  ordenes: {
    listar: () => ipcRenderer.invoke('ordenes:listar'),
    crear: (input) => ipcRenderer.invoke('ordenes:crear', input),
    actualizar: (ordenId, input) => ipcRenderer.invoke('ordenes:actualizar', ordenId, input),
    eliminar: (ordenId) => ipcRenderer.invoke('ordenes:eliminar', ordenId),
    iniciar: (ordenId) => ipcRenderer.invoke('ordenes:iniciar', ordenId),
    marcarLista: (ordenId) => ipcRenderer.invoke('ordenes:marcar-lista', ordenId),
    entregar: (ordenId) => ipcRenderer.invoke('ordenes:entregar', ordenId),
    cancelar: (ordenId) => ipcRenderer.invoke('ordenes:cancelar', ordenId)
  },
  caja: {
    resumen: () => ipcRenderer.invoke('caja:resumen'),
    registrarEgreso: (input) => ipcRenderer.invoke('caja:registrar-egreso', input),
    registrarMovimiento: (input) => ipcRenderer.invoke('caja:registrar-movimiento', input)
  },
  reportes: {
    obtener: (filtro) => ipcRenderer.invoke('reportes:obtener', filtro),
    exportarPdf: (filtro) => ipcRenderer.invoke('reportes:exportar-pdf', filtro),
    exportarExcel: (filtro) => ipcRenderer.invoke('reportes:exportar-excel', filtro)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  Object.assign(window, { api })
}
