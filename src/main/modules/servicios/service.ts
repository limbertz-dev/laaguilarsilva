import { getDatabase, transaction } from '../../database/connection'
import {
  parseInput,
  servicioInput,
  unidadesEnteras,
  type ServicioInput
} from '../../../shared/schemas/inputs'
import type { Servicio, ServicioInsumo } from '../../../shared/types/domain'
import { fromCents, toCents, toId } from '../shared'

type ServicioRow = Omit<Servicio, 'precio'> & { precioCentavos: number }

function mapServicio(row: ServicioRow): Servicio {
  return {
    ...row,
    precio: fromCents(row.precioCentavos),
    insumos: listarReceta(row.id)
  }
}

function listarReceta(servicioId: number): ServicioInsumo[] {
  return getDatabase()
    .prepare(
      `SELECT si.insumo_id AS insumoId, i.nombre, i.unidad, si.cantidad
       FROM servicio_insumos si
       JOIN insumos i ON i.id = si.insumo_id
       WHERE si.servicio_id = ?
       ORDER BY i.nombre`
    )
    .all(servicioId) as unknown as ServicioInsumo[]
}

function guardarReceta(servicioId: number, insumos: ServicioInput['insumos']): void {
  const receta = insumos ?? []
  const ids = receta.map((item) => item.insumoId)
  if (new Set(ids).size !== ids.length) throw new Error('Un insumo está repetido en la receta')

  if (ids.length > 0) {
    const placeholders = ids.map(() => '?').join(', ')
    const existentes = getDatabase()
      .prepare(
        `SELECT id, unidad FROM insumos
         WHERE estado = 'ACTIVO' AND id IN (${placeholders})`
      )
      .all(...ids) as unknown as { id: number; unidad: string }[]
    if (existentes.length !== ids.length) {
      throw new Error('Uno o más insumos de la receta no existen o están inactivos')
    }
    receta.forEach((item) => {
      const supply = existentes.find((existing) => existing.id === item.insumoId)
      if (supply && unidadesEnteras.has(supply.unidad) && !Number.isInteger(item.cantidad)) {
        throw new Error(`El consumo en ${supply.unidad} debe ser un número entero`)
      }
    })
  }

  getDatabase().prepare('DELETE FROM servicio_insumos WHERE servicio_id = ?').run(servicioId)
  const insertar = getDatabase().prepare(
    'INSERT INTO servicio_insumos (servicio_id, insumo_id, cantidad) VALUES (?, ?, ?)'
  )
  receta.forEach((item) => insertar.run(servicioId, item.insumoId, item.cantidad))
}

export function listarServicios(): Servicio[] {
  const rows = getDatabase()
    .prepare(
      `SELECT id, nombre, descripcion, categoria, precio_centavos AS precioCentavos, estado
       FROM servicios WHERE estado = 'ACTIVO' ORDER BY nombre`
    )
    .all() as unknown as ServicioRow[]
  return rows.map(mapServicio)
}

export function crearServicio(input: ServicioInput): Servicio {
  const data = parseInput(servicioInput, input)
  validarNombreDisponible(data.nombre)
  return transaction(() => {
    const result = getDatabase()
      .prepare(
        `INSERT INTO servicios (nombre, descripcion, categoria, precio_centavos)
         VALUES (?, ?, ?, ?)`
      )
      .run(data.nombre, data.descripcion, data.categoria, toCents(data.precio))
    const servicioId = toId(result.lastInsertRowid)
    guardarReceta(servicioId, data.insumos)
    const row = getDatabase()
      .prepare(
        `SELECT id, nombre, descripcion, categoria, precio_centavos AS precioCentavos, estado
         FROM servicios WHERE id = ?`
      )
      .get(servicioId) as unknown as ServicioRow
    return mapServicio(row)
  })
}

export function actualizarServicio(servicioId: number, input: ServicioInput): Servicio {
  const data = parseInput(servicioInput, input)
  validarNombreDisponible(data.nombre, servicioId)
  return transaction(() => {
    const result = getDatabase()
      .prepare(
        `UPDATE servicios
         SET nombre = ?, descripcion = ?, categoria = ?, precio_centavos = ?
         WHERE id = ? AND estado = 'ACTIVO'`
      )
      .run(data.nombre, data.descripcion, data.categoria, toCents(data.precio), servicioId)
    if (result.changes === 0) throw new Error('Servicio no encontrado')

    guardarReceta(servicioId, data.insumos)
    const row = getDatabase()
      .prepare(
        `SELECT id, nombre, descripcion, categoria, precio_centavos AS precioCentavos, estado
         FROM servicios WHERE id = ?`
      )
      .get(servicioId) as unknown as ServicioRow
    return mapServicio(row)
  })
}

function validarNombreDisponible(nombre: string, servicioId?: number): void {
  const existente =
    servicioId === undefined
      ? getDatabase()
          .prepare('SELECT 1 FROM servicios WHERE lower(nombre) = lower(?)')
          .get(nombre)
      : getDatabase()
          .prepare('SELECT 1 FROM servicios WHERE lower(nombre) = lower(?) AND id <> ?')
          .get(nombre, servicioId)
  if (existente) throw new Error(`Ya existe un servicio llamado "${nombre}"`)
}

export function eliminarServicio(servicioId: number): void {
  const pendiente = getDatabase()
    .prepare(
      `SELECT 1
       FROM orden_servicios os
       JOIN ordenes o ON o.id = os.orden_id
       WHERE os.servicio_id = ? AND o.estado = 'PENDIENTE'
       LIMIT 1`
    )
    .get(servicioId)
  if (pendiente) throw new Error('No se puede eliminar: el servicio está en una orden pendiente')

  const result = getDatabase()
    .prepare("UPDATE servicios SET estado = 'INACTIVO' WHERE id = ? AND estado = 'ACTIVO'")
    .run(servicioId)
  if (result.changes === 0) throw new Error('Servicio activo no encontrado')
}
