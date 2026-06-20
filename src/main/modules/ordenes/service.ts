import { getDatabase, transaction } from '../../database/connection'
import { ordenInput, parseInput, type OrdenInput } from '../../../shared/schemas/inputs'
import type { OrdenResumen } from '../../../shared/types/domain'
import { fromCents, toCents, toId } from '../shared'

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
  SELECT o.id, o.vehiculo_id AS vehiculoId, o.empleado_id AS empleadoId,
         c.nombre AS cliente, v.placa,
         e.nombres || ' ' || e.apellidos AS empleado,
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
  JOIN empleados e ON e.id = o.empleado_id
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
    const empleado = getDatabase()
      .prepare("SELECT id FROM empleados WHERE id = ? AND estado = 'ACTIVO'")
      .get(data.empleadoId)
    if (!empleado) throw new Error('Empleado activo no encontrado')

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
         (vehiculo_id, empleado_id, subtotal_centavos, descuento_centavos,
          total_centavos, metodo_pago)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        data.vehiculoId,
        data.empleadoId,
        subtotal,
        descuento,
        total,
        data.metodoPago
      )
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

    const empleado = getDatabase()
      .prepare("SELECT id FROM empleados WHERE id = ? AND estado = 'ACTIVO'")
      .get(data.empleadoId)
    if (!empleado) throw new Error('Empleado activo no encontrado')

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
         SET vehiculo_id = ?, empleado_id = ?, subtotal_centavos = ?,
             descuento_centavos = ?, total_centavos = ?, metodo_pago = ?
         WHERE id = ?`
      )
      .run(
        data.vehiculoId,
        data.empleadoId,
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
  transaction(() => {
    const orden = getDatabase()
      .prepare(
        `SELECT id, total_centavos AS totalCentavos, estado, estado_operativo AS estadoOperativo
         FROM ordenes WHERE id = ?`
      )
      .get(ordenId) as
      | { id: number; totalCentavos: number; estado: string; estadoOperativo: string }
      | undefined
    if (!orden) throw new Error('Orden no encontrada')
    if (orden.estado !== 'PENDIENTE' || orden.estadoOperativo !== 'EN_PROCESO') {
      throw new Error('Solo se puede finalizar una orden que está en proceso')
    }

    const consumos = getDatabase()
      .prepare(
        `SELECT os.servicio_id AS servicioId, si.insumo_id AS insumoId,
                si.cantidad, i.nombre, i.unidad, i.stock_actual AS stockActual
         FROM orden_servicios os
         JOIN servicio_insumos si ON si.servicio_id = os.servicio_id
         JOIN insumos i ON i.id = si.insumo_id
         WHERE os.orden_id = ?`
      )
      .all(ordenId) as unknown as {
      servicioId: number
      insumoId: number
      cantidad: number
      nombre: string
      unidad: string
      stockActual: number
    }[]

    const requeridos = new Map<
      number,
      { nombre: string; unidad: string; cantidad: number; stock: number }
    >()
    consumos.forEach((consumo) => {
      const actual = requeridos.get(consumo.insumoId)
      requeridos.set(consumo.insumoId, {
        nombre: consumo.nombre,
        unidad: consumo.unidad,
        cantidad: (actual?.cantidad ?? 0) + consumo.cantidad,
        stock: consumo.stockActual
      })
    })
    requeridos.forEach((requerido) => {
      if (requerido.stock < requerido.cantidad) {
        throw new Error(
          `Stock insuficiente de ${requerido.nombre}: se requieren ${requerido.cantidad} ${requerido.unidad}`
        )
      }
    })

    getDatabase()
      .prepare(
        `UPDATE ordenes
         SET estado_operativo = 'LISTO'
         WHERE id = ?`
      )
      .run(ordenId)

    const descontar = getDatabase().prepare(
      'UPDATE insumos SET stock_actual = stock_actual - ? WHERE id = ?'
    )
    requeridos.forEach((requerido, insumoId) => {
      descontar.run(requerido.cantidad, insumoId)
    })
    const registrarConsumo = getDatabase().prepare(
      `INSERT INTO consumos_insumo (orden_id, servicio_id, insumo_id, cantidad)
       VALUES (?, ?, ?, ?)`
    )
    consumos.forEach((consumo) => {
      registrarConsumo.run(ordenId, consumo.servicioId, consumo.insumoId, consumo.cantidad)
    })
  })
}

export function entregarOrden(ordenId: number): void {
  transaction(() => {
    const orden = getDatabase()
      .prepare(
        `SELECT id, total_centavos AS totalCentavos, estado,
                estado_operativo AS estadoOperativo, metodo_pago AS metodoPago
         FROM ordenes WHERE id = ?`
      )
      .get(ordenId) as
      | {
          id: number
          totalCentavos: number
          estado: string
          estadoOperativo: string
          metodoPago: string
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
      .run(`Cobro de orden #${ordenId}`, orden.totalCentavos, orden.metodoPago, ordenId)
  })
}

export function cancelarOrden(ordenId: number): void {
  const result = getDatabase()
    .prepare(
      `UPDATE ordenes SET estado = 'CANCELADA', estado_operativo = 'CANCELADO'
       WHERE id = ? AND estado = 'PENDIENTE'
         AND estado_operativo IN ('RECIBIDO', 'EN_PROCESO')`
    )
    .run(ordenId)
  if (result.changes === 0) throw new Error('No se puede cancelar una orden lista o entregada')
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
