import type { ClienteConVehiculoInput, ClienteInput } from '../../../shared/schemas/inputs'

export const clientesRepository = {
  list: () => window.api.clientes.listar(),
  create: (input: ClienteInput) => window.api.clientes.crear(input),
  createWithVehicle: (input: ClienteConVehiculoInput) =>
    window.api.clientes.crearConVehiculo(input),
  update: (clientId: number, input: ClienteInput) =>
    window.api.clientes.actualizar(clientId, input),
  delete: (clientId: number) => window.api.clientes.eliminar(clientId),
  history: (clientId: number) => window.api.clientes.historial(clientId)
}
