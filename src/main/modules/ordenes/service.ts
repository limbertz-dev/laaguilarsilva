import { getDatabase, transaction } from '../../database/connection'
import { ordenInput, parseInput, type OrdenInput } from '../../../shared/schemas/inputs'
import type { OrdenResumen } from '../../../shared/types/domain'
import { buildCobroOrdenConcepto, fromCents, toCents, toId } from '../shared'

export { buildCobroOrdenConcepto } from '../shared'

type OrdenRow = Omit<OrdenResumen, 'total' | 'descuento' | 'servicioIds'> & {
  totalCentavos: number
  descuentoCentavos: number
  servicioIdsCsv: string
}

function mapOrden(row: OrdenRow): OrdenResumen {
  const { totalCentavos, descuentoCentavos, servicioIdsCsv, ...orden } = row
  return {
    ...orden,
    servicioIds: servicioIdsCsv ? servicioIdsCsv.split(',').map(Number) : [],
    descuento: fromCents(descuentoCentavos),
    total: fromCents(totalCentavos)
  }
}

const ordenSelect = `
  SELECT o.id, o.vehiculo_id AS vehiculoId,
         c.nombre AS cliente, v.placa,
         o.descuento_centavos AS descuentoCentavos,
         o.total_centavos AS totalCentavos, o.estado,
         o.estado_operativo AS estadoOperativo, o.metodo_pago AS metodoPago,
         COALESCE((
           SELECT GROUP_CONCAT(os.servicio_id)
           FROM orden_servicios os
           WHERE os.orden_id = o.id
         ), '') AS servicioIdsCsv,
         o.fecha_ingreso AS fechaIngreso, o.fecha_completada AS fechaCompletada
  FROM ordenes o
  JOIN vehiculos v ON v.id = o.vehiculo_id
  JOIN clientes c ON c.id = v.cliente_id
`

export function listarOrdenes(): OrdenResumen[] {
  const rows = getDatabase()
    .prepare(`${ordenSelect} ORDER BY o.fecha_ingreso DESC, o.id DESC`)
    .all() as unknown as OrdenRow[]
  return rows.map(mapOrden)
}

export function crearOrden(input: OrdenInput): OrdenResumen {
  const data = parseInput(ordenInput, input)
  const servicioIds = [...new Set(data.servicioIds)]

  return transaction(() => {
    const placeholders = servicioIds.map(() => '?').join(', ')
    const servicios = getDatabase()
      .prepare(
        `SELECT id, precio_centavos AS precioCentavos
         FROM servicios WHERE estado = 'ACTIVO' AND id IN (${placeholders})`
      )
      .all(...servicioIds) as unknown as { id: number; precioCentavos: number }[]
    if (servicios.length !== servicioIds.length) {
      throw new Error('Uno o más servicios no existen o están inactivos')
    }

    const subtotal = servicios.reduce((sum, servicio) => sum + servicio.precioCentavos, 0)
    const descuento = toCents(data.descuento)
    if (descuento > subtotal) throw new Error('El descuento no puede superar el subtotal')
    const total = subtotal - descuento

    const result = getDatabase()
      .prepare(
        `INSERT INTO ordenes
         (vehiculo_id, subtotal_centavos, descuento_centavos, total_centavos, metodo_pago)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(data.vehiculoId, subtotal, descuento, total, data.metodoPago)
    const ordenId = toId(result.lastInsertRowid)
    const insertService = getDatabase().prepare(
      `INSERT INTO orden_servicios (orden_id, servicio_id, precio_centavos)
       VALUES (?, ?, ?)`
    )
    servicios.forEach((servicio) =>
      insertService.run(ordenId, servicio.id, servicio.precioCentavos)
    )

    const row = getDatabase()
      .prepare(`${ordenSelect} WHERE o.id = ?`)
      .get(ordenId) as unknown as OrdenRow
    return mapOrden(row)
  })
}

export function actualizarOrden(ordenId: number, input: OrdenInput): OrdenResumen {
  const data = parseInput(ordenInput, input)
  const servicioIds = [...new Set(data.servicioIds)]

  return transaction(() => {
    const orden = getDatabase()
      .prepare('SELECT estado, estado_operativo AS estadoOperativo FROM ordenes WHERE id = ?')
      .get(ordenId) as { estado: string; estadoOperativo: string } | undefined
    if (!orden) throw new Error('Orden no encontrada')
    if (orden.estado !== 'PENDIENTE' || orden.estadoOperativo !== 'RECIBIDO') {
      throw new Error('Solo se pueden editar órdenes recién recibidas')
    }

    const placeholders = servicioIds.map(() => '?').join(', ')
    const servicios = getDatabase()
      .prepare(
        `SELECT id, precio_centavos AS precioCentavos
         FROM servicios WHERE estado = 'ACTIVO' AND id IN (${placeholders})`
      )
      .all(...servicioIds) as unknown as { id: number; precioCentavos: number }[]
    if (servicios.length !== servicioIds.length) {
      throw new Error('Uno o más servicios no existen o están inactivos')
    }

    const subtotal = servicios.reduce((sum, servicio) => sum + servicio.precioCentavos, 0)
    const descuento = toCents(data.descuento)
    if (descuento > subtotal) throw new Error('El descuento no puede superar el subtotal')

    getDatabase()
      .prepare(
        `UPDATE ordenes
         SET vehiculo_id = ?, subtotal_centavos = ?, descuento_centavos = ?,
             total_centavos = ?, metodo_pago = ?
         WHERE id = ?`
      )
      .run(
        data.vehiculoId,
        subtotal,
        descuento,
        subtotal - descuento,
        data.metodoPago,
        ordenId
      )

    getDatabase().prepare('DELETE FROM orden_servicios WHERE orden_id = ?').run(ordenId)
    const insertService = getDatabase().prepare(
      `INSERT INTO orden_servicios (orden_id, servicio_id, precio_centavos)
       VALUES (?, ?, ?)`
    )
    servicios.forEach((servicio) =>
      insertService.run(ordenId, servicio.id, servicio.precioCentavos)
    )

    const row = getDatabase()
      .prepare(`${ordenSelect} WHERE o.id = ?`)
      .get(ordenId) as unknown as OrdenRow
    return mapOrden(row)
  })
}

export function iniciarOrden(ordenId: number): void {
  const result = getDatabase()
    .prepare(
      `UPDATE ordenes SET estado_operativo = 'EN_PROCESO'
       WHERE id = ? AND estado = 'PENDIENTE' AND estado_operativo = 'RECIBIDO'`
    )
    .run(ordenId)
  if (result.changes === 0) throw new Error('Solo se puede iniciar una orden recibida')
}

export function marcarOrdenLista(ordenId: number): void {
  const result = getDatabase()
    .prepare(
      `UPDATE ordenes
       SET estado_operativo = 'LISTO'
       WHERE id = ? AND estado = 'PENDIENTE' AND estado_operativo = 'EN_PROCESO'`
    )
    .run(ordenId)
  if (result.changes === 0) {
    throw new Error('Solo se puede finalizar una orden que está en proceso')
  }
}

export function entregarOrden(ordenId: number): void {
  transaction(() => {
    const orden = getDatabase()
      .prepare(
        `SELECT o.id, o.total_centavos AS totalCentavos, o.estado,
                o.estado_operativo AS estadoOperativo, o.metodo_pago AS metodoPago,
                o.fecha_ingreso AS fechaIngreso, c.nombre AS cliente
         FROM ordenes o
         JOIN vehiculos v ON v.id = o.vehiculo_id
         JOIN clientes c ON c.id = v.cliente_id
         WHERE o.id = ?`
      )
      .get(ordenId) as
      | {
          id: number
          totalCentavos: number
          estado: string
          estadoOperativo: string
          metodoPago: string
          fechaIngreso: string
          cliente: string
        }
      | undefined
    if (!orden) throw new Error('Orden no encontrada')
    if (orden.estado !== 'PENDIENTE' || orden.estadoOperativo !== 'LISTO') {
      throw new Error('Solo se puede entregar una orden que está lista')
    }
    if (orden.totalCentavos <= 0) throw new Error('La orden no tiene un total cobrable')

    getDatabase()
      .prepare(
        `UPDATE ordenes
         SET estado = 'COMPLETADA', estado_operativo = 'ENTREGADO',
             fecha_completada = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .run(ordenId)

    getDatabase()
      .prepare(
        `INSERT INTO movimientos_caja
         (tipo, categoria, concepto, monto_centavos, metodo_pago, origen, origen_id)
         VALUES ('INGRESO', 'LAVADO', ?, ?, ?, 'ORDEN', ?)`
      )
      .run(
        buildCobroOrdenConcepto(orden.fechaIngreso, orden.cliente),
        orden.totalCentavos,
        orden.metodoPago,
        ordenId
      )
  })
}

export function revertirInicioOrden(ordenId: number): void {
  const result = getDatabase()
    .prepare(
      `UPDATE ordenes SET estado_operativo = 'RECIBIDO'
       WHERE id = ? AND estado = 'PENDIENTE' AND estado_operativo = 'EN_PROCESO'`
    )
    .run(ordenId)
  if (result.changes === 0) {
    throw new Error('Solo se puede cancelar el inicio de una orden en proceso')
  }
}

export function cancelarOrden(ordenId: number): void {
  revertirInicioOrden(ordenId)
}

export function eliminarOrden(ordenId: number): void {
  const result = getDatabase()
    .prepare(
      `DELETE FROM ordenes
       WHERE id = ?
         AND (
           estado = 'CANCELADA'
           OR (estado = 'PENDIENTE' AND estado_operativo IN ('RECIBIDO', 'EN_PROCESO'))
         )`
    )
    .run(ordenId)
  if (result.changes === 0) {
    throw new Error('No se puede eliminar una orden lista o entregada')
  }
}
