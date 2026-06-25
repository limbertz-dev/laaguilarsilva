import { getDatabase } from '../../database/connection'
import { parseInput, servicioInput, type ServicioInput } from '../../../shared/schemas/inputs'
import type { Servicio } from '../../../shared/types/domain'
import { fromCents, toCents, toId } from '../shared'

type ServicioRow = Omit<Servicio, 'precio'> & { precioCentavos: number }

function mapServicio(row: ServicioRow): Servicio {
  return {
    ...row,
    precio: fromCents(row.precioCentavos)
  }
}

export function listarServicios(): Servicio[] {
  const rows = getDatabase()
    .prepare(
      `SELECT id, nombre, descripcion, categoria, precio_centavos AS precioCentavos, estado,
              eliminacion_programada_en AS eliminacionProgramadaEn
       FROM servicios
       WHERE eliminacion_programada_en IS NULL OR datetime(eliminacion_programada_en) > datetime('now')
       ORDER BY estado, nombre`
    )
    .all() as unknown as ServicioRow[]
  return rows.map(mapServicio)
}

export function crearServicio(input: ServicioInput): Servicio {
  const data = parseInput(servicioInput, input)
  validarNombreDisponible(data.nombre)
  const result = getDatabase()
    .prepare(
      `INSERT INTO servicios (nombre, descripcion, categoria, precio_centavos)
       VALUES (?, ?, ?, ?)`
    )
    .run(data.nombre, data.descripcion, data.categoria, toCents(data.precio))
  const servicioId = toId(result.lastInsertRowid)
  const row = getDatabase()
    .prepare(
      `SELECT id, nombre, descripcion, categoria, precio_centavos AS precioCentavos, estado,
              eliminacion_programada_en AS eliminacionProgramadaEn
       FROM servicios WHERE id = ?`
    )
    .get(servicioId) as unknown as ServicioRow
  return mapServicio(row)
}

export function actualizarServicio(servicioId: number, input: ServicioInput): Servicio {
  const data = parseInput(servicioInput, input)
  validarNombreDisponible(data.nombre, servicioId)
  const result = getDatabase()
    .prepare(
      `UPDATE servicios
       SET nombre = ?, descripcion = ?, categoria = ?, precio_centavos = ?,
           eliminacion_programada_en = NULL
       WHERE id = ?`
    )
    .run(data.nombre, data.descripcion, data.categoria, toCents(data.precio), servicioId)
  if (result.changes === 0) throw new Error('Servicio no encontrado')

  const row = getDatabase()
    .prepare(
      `SELECT id, nombre, descripcion, categoria, precio_centavos AS precioCentavos, estado,
              eliminacion_programada_en AS eliminacionProgramadaEn
       FROM servicios WHERE id = ?`
    )
    .get(servicioId) as unknown as ServicioRow
  return mapServicio(row)
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
  const result = getDatabase()
    .prepare(
      `UPDATE servicios
       SET estado = 'INACTIVO',
           eliminacion_programada_en = datetime('now', '+24 hours')
       WHERE id = ?`
    )
    .run(servicioId)
  if (result.changes === 0) throw new Error('Servicio no encontrado')
}

export function cambiarEstadoServicio(servicioId: number, estado: 'ACTIVO' | 'INACTIVO'): void {
  const result = getDatabase()
    .prepare(
      `UPDATE servicios
       SET estado = ?,
           eliminacion_programada_en = CASE WHEN ? = 'ACTIVO' THEN NULL ELSE eliminacion_programada_en END
       WHERE id = ? AND (estado <> ? OR (? = 'ACTIVO' AND eliminacion_programada_en IS NOT NULL))`
    )
    .run(estado, estado, servicioId, estado, estado)
  if (result.changes === 0) throw new Error('Servicio no encontrado o sin cambios')
}