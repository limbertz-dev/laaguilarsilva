import type { VehiculoInput } from '../../../shared/schemas/inputs'

export const vehiculosRepository = {
  list: () => window.api.vehiculos.listar(),
  create: (input: VehiculoInput) => window.api.vehiculos.crear(input),
  update: (vehicleId: number, input: VehiculoInput) =>
    window.api.vehiculos.actualizar(vehicleId, input),
  delete: (vehicleId: number) => window.api.vehiculos.eliminar(vehicleId)
}
