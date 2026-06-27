import type {
  CompraInsumoInput,
  InsumoInput,
  InsumoUpdateInput
} from '../../../shared/schemas/inputs'
import type { EstadoRegistro } from '../../../shared/types/domain'
import { api } from '../lib/api-client'

export const inventarioRepository = {
  list: () => api.inventario.listar(),
  create: (input: InsumoInput) => api.inventario.crear(input),
  update: (supplyId: number, input: InsumoUpdateInput) =>
    api.inventario.actualizar(supplyId, input),
  delete: (supplyId: number) => api.inventario.eliminar(supplyId),
  cambiarEstado: (supplyId: number, estado: EstadoRegistro) =>
    api.inventario.cambiarEstado(supplyId, estado),
  purchase: (input: CompraInsumoInput) => api.inventario.comprar(input)
}
