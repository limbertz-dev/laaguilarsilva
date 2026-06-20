import { getDatabase, transaction } from '../../database/connection'
import {
  compraInsumoInput,
  insumoInput,
  insumoUpdateInput,
  parseInput,
  unidadesEnteras,
  type CompraInsumoInput,
  type InsumoInput,
  type InsumoUpdateInput
} from '../../../shared/schemas/inputs'
import type { Insumo } from '../../../shared/types/domain'
import { toCents, toId } from '../shared'

export function listarInsumos(): Insumo[] {
  return getDatabase()
    .prepare(
      `SELECT id, nombre, unidad, stock_actual AS stockActual,
              stock_minimo AS stockMinimo, estado
       FROM insumos WHERE estado = 'ACTIVO' ORDER BY nombre`
    )
    .all() as unknown as Insumo[]
}

export function crearInsumo(input: InsumoInput): Insumo {
  const data = parseInput(insumoInput, input)
  validarNombreInsumo(data.nombre)
  const result = getDatabase()
    .prepare('INSERT INTO insumos (nombre, unidad, stock_minimo) VALUES (?, ?, ?)')
    .run(data.nombre, data.unidad, data.stockMinimo)
  return getDatabase()
    .prepare(
      `SELECT id, nombre, unidad, stock_actual AS stockActual,
              stock_minimo AS stockMinimo, estado
       FROM insumos WHERE id = ? AND estado = 'ACTIVO'`
    )
    .get(toId(result.lastInsertRowid)) as unknown as Insumo
}

export function actualizarInsumo(insumoId: number, input: InsumoUpdateInput): Insumo {
  const data = parseInput(insumoUpdateInput, input)
  validarNombreInsumo(data.nombre, insumoId)
  const result = getDatabase()
    .prepare(
      `UPDATE insumos
       SET nombre = ?, unidad = ?, stock_minimo = ?
       WHERE id = ? AND estado = 'ACTIVO'`
    )
    .run(data.nombre, data.unidad, data.stockMinimo, insumoId)
  if (result.changes === 0) throw new Error('Insumo no encontrado')

  return getDatabase()
    .prepare(
      `SELECT id, nombre, unidad, stock_actual AS stockActual,
              stock_minimo AS stockMinimo, estado
       FROM insumos WHERE id = ? AND estado = 'ACTIVO'`
    )
    .get(insumoId) as unknown as Insumo
}

export function eliminarInsumo(insumoId: number): void {
  const enUso = getDatabase()
    .prepare(
      `SELECT 1
       FROM servicio_insumos si
       JOIN servicios s ON s.id = si.servicio_id
       WHERE si.insumo_id = ? AND s.estado = 'ACTIVO'
       LIMIT 1`
    )
    .get(insumoId)
  if (enUso) throw new Error('No se puede eliminar: el insumo forma parte de un servicio activo')

  const result = getDatabase()
    .prepare("UPDATE insumos SET estado = 'INACTIVO' WHERE id = ? AND estado = 'ACTIVO'")
    .run(insumoId)
  if (result.changes === 0) throw new Error('Insumo activo no encontrado')
}

export function comprarInsumo(input: CompraInsumoInput): void {
  const data = parseInput(compraInsumoInput, input)
  transaction(() => {
    const insumo = getDatabase()
      .prepare('SELECT id, nombre, unidad FROM insumos WHERE id = ? AND estado = ?')
      .get(data.insumoId, 'ACTIVO') as
      | { id: number; nombre: string; unidad: string }
      | undefined
    if (!insumo) throw new Error('Insumo activo no encontrado')
    if (unidadesEnteras.has(insumo.unidad) && !Number.isInteger(data.cantidad)) {
      throw new Error(`La cantidad en ${insumo.unidad} debe ser un número entero`)
    }

    const costoUnitario = toCents(data.costoUnitario)
    const total = Math.round(data.cantidad * costoUnitario)
    const compra = getDatabase()
      .prepare(
        `INSERT INTO compras_insumo
         (insumo_id, cantidad, costo_unitario_centavos, total_centavos)
         VALUES (?, ?, ?, ?)`
      )
      .run(insumo.id, data.cantidad, costoUnitario, total)

    getDatabase()
      .prepare('UPDATE insumos SET stock_actual = stock_actual + ? WHERE id = ?')
      .run(data.cantidad, insumo.id)

    getDatabase()
      .prepare(
        `INSERT INTO movimientos_caja
         (tipo, categoria, concepto, monto_centavos, origen, origen_id)
         VALUES ('EGRESO', 'INSUMOS', ?, ?, 'COMPRA_INSUMO', ?)`
      )
      .run(`Compra de ${insumo.nombre}`, total, toId(compra.lastInsertRowid))
  })
}

function validarNombreInsumo(nombre: string, insumoId?: number): void {
  const existente =
    insumoId === undefined
      ? getDatabase().prepare('SELECT 1 FROM insumos WHERE lower(nombre) = lower(?)').get(nombre)
      : getDatabase()
          .prepare('SELECT 1 FROM insumos WHERE lower(nombre) = lower(?) AND id <> ?')
          .get(nombre, insumoId)
  if (existente) throw new Error(`Ya existe un insumo llamado "${nombre}"`)
}
