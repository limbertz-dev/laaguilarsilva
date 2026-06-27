import type {
  CompraInsumoInput,
  InsumoInput,
  InsumoUpdateInput
} from '../../../shared/schemas/inputs'
import type { EstadoRegistro } from '../../../shared/types/domain'

export const inventarioRepository = {
  list: () => window.api.inventario.listar(),
  create: (input: InsumoInput) => window.api.inventario.crear(input),
  update: (supplyId: number, input: InsumoUpdateInput) =>
    window.api.inventario.actualizar(supplyId, input),
  delete: (supplyId: number) => window.api.inventario.eliminar(supplyId),
  cambiarEstado: (supplyId: number, estado: EstadoRegistro) =>
    window.api.inventario.cambiarEstado(supplyId, estado),
  purchase: (input: CompraInsumoInput) => window.api.inventario.comprar(input)
}
