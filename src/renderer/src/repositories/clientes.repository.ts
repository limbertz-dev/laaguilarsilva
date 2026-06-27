import type { ClienteConVehiculoInput, ClienteInput } from '../../../shared/schemas/inputs'
import { api } from '../lib/api-client'

export const clientesRepository = {
  list: () => api.clientes.listar(),
  create: (input: ClienteInput) => api.clientes.crear(input),
  createWithVehicle: (input: ClienteConVehiculoInput) =>
    api.clientes.crearConVehiculo(input),
  update: (clientId: number, input: ClienteInput) =>
    api.clientes.actualizar(clientId, input),
  delete: (clientId: number) => api.clientes.eliminar(clientId),
  cancelarEliminacion: (clientId: number) => api.clientes.cancelarEliminacion(clientId),
  history: (clientId: number) => api.clientes.historial(clientId)
}
