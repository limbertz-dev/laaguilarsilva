import type { OrdenInput } from '../../../shared/schemas/inputs'
import { api } from '../lib/api-client'

export const ordenesRepository = {
  list: () => api.ordenes.listar(),
  create: (input: OrdenInput) => api.ordenes.crear(input),
  update: (orderId: number, input: OrdenInput) => api.ordenes.actualizar(orderId, input),
  delete: (orderId: number) => api.ordenes.eliminar(orderId),
  start: (orderId: number) => api.ordenes.iniciar(orderId),
  markReady: (orderId: number) => api.ordenes.marcarLista(orderId),
  deliver: (orderId: number) => api.ordenes.entregar(orderId),
  cancel: (orderId: number) => api.ordenes.cancelar(orderId),
  revertStart: (orderId: number) => api.ordenes.revertirInicio(orderId)
}
