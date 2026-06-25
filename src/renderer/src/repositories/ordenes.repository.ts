import type { OrdenInput } from '../../../shared/schemas/inputs'

export const ordenesRepository = {
  list: () => window.api.ordenes.listar(),
  create: (input: OrdenInput) => window.api.ordenes.crear(input),
  update: (orderId: number, input: OrdenInput) => window.api.ordenes.actualizar(orderId, input),
  delete: (orderId: number) => window.api.ordenes.eliminar(orderId),
  start: (orderId: number) => window.api.ordenes.iniciar(orderId),
  markReady: (orderId: number) => window.api.ordenes.marcarLista(orderId),
  deliver: (orderId: number) => window.api.ordenes.entregar(orderId),
  cancel: (orderId: number) => window.api.ordenes.cancelar(orderId),
  revertStart: (orderId: number) => window.api.ordenes.revertirInicio(orderId)
}
