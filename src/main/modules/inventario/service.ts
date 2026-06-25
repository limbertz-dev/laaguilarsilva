import { getDatabase, transaction } from '../../database/connection'
import {
  compraInsumoInput,
  insumoInput,
  insumoUpdateInput,
  parseInput,
  type CompraInsumoInput,
  type InsumoInput,
  type InsumoUpdateInput
} from '../../../shared/schemas/inputs'
import type { Insumo } from '../../../shared/types/domain'
import { buildCompraInsumoConcepto, toCents, toId } from '../shared'

const insumoSelect = `SELECT id, nombre, tipo_paquete AS tipoPaquete, contenido,
              paquetes, paquetes_minimo AS paquetesMinimo, estado,
              eliminacion_programada_en AS eliminacionProgramadaEn
       FROM insumos`

export function listarInsumos(): Insumo[] {
  return getDatabase()
    .prepare(
      `${insumoSelect}
       WHERE eliminacion_programada_en IS NULL OR datetime(eliminacion_programada_en) > datetime('now')
       ORDER BY (eliminacion_programada_en IS NOT NULL), estado, nombre`
    )
    .all() as unknown as Insumo[]
}

export function crearInsumo(input: InsumoInput): Insumo {
  const data = parseInput(insumoInput, input)
  validarNombreInsumo(data.nombre)
  const result = getDatabase()
    .prepare(
      `INSERT INTO insumos (nombre, tipo_paquete, contenido, paquetes, paquetes_minimo)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(data.nombre, data.tipoPaquete, data.contenido, data.paquetes, data.paquetesMinimo)
  return getDatabase().prepare(`${insumoSelect} WHERE id = ?`).get(toId(result.lastInsertRowid)) as unknown as Insumo
}

export function actualizarInsumo(insumoId: number, input: InsumoUpdateInput): Insumo {
  const data = parseInput(insumoUpdateInput, input)
  validarNombreInsumo(data.nombre, insumoId)
  const result = getDatabase()
    .prepare(
      `UPDATE insumos
       SET nombre = ?, tipo_paquete = ?, contenido = ?, paquetes = ?, paquetes_minimo = ?
       WHERE id = ?`
    )
    .run(
      data.nombre,
      data.tipoPaquete,
      data.contenido,
      data.paquetes,
      data.paquetesMinimo,
      insumoId
    )
  if (result.changes === 0) throw new Error('Insumo no encontrado')

  return getDatabase().prepare(`${insumoSelect} WHERE id = ?`).get(insumoId) as unknown as Insumo
}

export function eliminarInsumo(insumoId: number): void {
  const result = getDatabase()
    .prepare(
      `UPDATE insumos
       SET estado = 'INACTIVO',
           eliminacion_programada_en = datetime('now', '+24 hours')
       WHERE id = ?`
    )
    .run(insumoId)
  if (result.changes === 0) throw new Error('Insumo no encontrado')
}

export function cambiarEstadoInsumo(insumoId: number, estado: 'ACTIVO' | 'INACTIVO'): void {
  const result = getDatabase()
    .prepare(
      `UPDATE insumos
       SET estado = ?,
           eliminacion_programada_en = CASE WHEN ? = 'ACTIVO' THEN NULL ELSE eliminacion_programada_en END
       WHERE id = ?`
    )
    .run(estado, estado, insumoId)
  if (result.changes === 0) throw new Error('Insumo no encontrado')
}

export function comprarInsumo(input: CompraInsumoInput): void {
  const data = parseInput(compraInsumoInput, input)
  transaction(() => {
    const insumo = getDatabase()
      .prepare('SELECT id, nombre FROM insumos WHERE id = ? AND estado = ?')
      .get(data.insumoId, 'ACTIVO') as { id: number; nombre: string } | undefined
    if (!insumo) throw new Error('Insumo activo no encontrado')

    const costoUnitario = toCents(data.costoUnitario)
    const total = data.cantidad * costoUnitario
    const compra = getDatabase()
      .prepare(
        `INSERT INTO compras_insumo
         (insumo_id, cantidad, costo_unitario_centavos, total_centavos)
         VALUES (?, ?, ?, ?)`
      )
      .run(insumo.id, data.cantidad, costoUnitario, total)

    getDatabase()
      .prepare('UPDATE insumos SET paquetes = paquetes + ? WHERE id = ?')
      .run(data.cantidad, insumo.id)

    getDatabase()
      .prepare(
        `INSERT INTO movimientos_caja
         (tipo, categoria, concepto, monto_centavos, origen, origen_id)
         VALUES ('EGRESO', 'INSUMOS', ?, ?, 'COMPRA_INSUMO', ?)`
      )
      .run(buildCompraInsumoConcepto(insumo.nombre), total, toId(compra.lastInsertRowid))
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