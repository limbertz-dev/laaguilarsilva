import type { ServicioInput } from '../../../shared/schemas/inputs'

export const serviciosRepository = {
  list: () => window.api.servicios.listar(),
  create: (input: ServicioInput) => window.api.servicios.crear(input),
  update: (serviceId: number, input: ServicioInput) =>
    window.api.servicios.actualizar(serviceId, input),
  changeStatus: (serviceId: number, status: 'ACTIVO' | 'INACTIVO') =>
    window.api.servicios.cambiarEstado(serviceId, status),
  delete: (serviceId: number) => window.api.servicios.eliminar(serviceId)
}
