import type {
  CompraInsumoInput,
  InsumoInput,
  InsumoUpdateInput
} from '../../../shared/schemas/inputs'

export const inventarioRepository = {
  list: () => window.api.inventario.listar(),
  create: (input: InsumoInput) => window.api.inventario.crear(input),
  update: (supplyId: number, input: InsumoUpdateInput) =>
    window.api.inventario.actualizar(supplyId, input),
  delete: (supplyId: number) => window.api.inventario.eliminar(supplyId),
  purchase: (input: CompraInsumoInput) => window.api.inventario.comprar(input)
}
