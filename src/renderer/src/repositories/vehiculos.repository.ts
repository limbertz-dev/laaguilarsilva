import type { VehiculoInput } from '../../../shared/schemas/inputs'
import { api } from '../lib/api-client'

export const vehiculosRepository = {
  list: () => api.vehiculos.listar(),
  create: (input: VehiculoInput) => api.vehiculos.crear(input),
  update: (vehicleId: number, input: VehiculoInput) =>
    api.vehiculos.actualizar(vehicleId, input),
  delete: (vehicleId: number) => api.vehiculos.eliminar(vehicleId),
  cancelarEliminacion: (vehicleId: number) => api.vehiculos.cancelarEliminacion(vehicleId)
}
