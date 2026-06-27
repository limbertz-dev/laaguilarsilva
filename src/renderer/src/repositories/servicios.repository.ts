import type { ServicioInput } from '../../../shared/schemas/inputs'
import { api } from '../lib/api-client'

export const serviciosRepository = {
  list: () => api.servicios.listar(),
  create: (input: ServicioInput) => api.servicios.crear(input),
  update: (serviceId: number, input: ServicioInput) =>
    api.servicios.actualizar(serviceId, input),
  changeStatus: (serviceId: number, status: 'ACTIVO' | 'INACTIVO') =>
    api.servicios.cambiarEstado(serviceId, status),
  delete: (serviceId: number) => api.servicios.eliminar(serviceId)
}
