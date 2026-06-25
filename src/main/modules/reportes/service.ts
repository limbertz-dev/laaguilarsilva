import { getDatabase } from '../../database/connection'
import {
  parseInput,
  reporteFiltroInput,
  type ReporteFiltroInput
} from '../../../shared/schemas/inputs'
import type { ReporteOrden, ReporteResumen, ReporteServicio } from '../../../shared/types/domain'
import { fromCents } from '../shared'

export function obtenerReporte(input: ReporteFiltroInput): ReporteResumen {
  const { desde, hasta } = parseInput(reporteFiltroInput, input)
  if (desde > hasta) throw new Error('La fecha inicial no puede ser posterior a la fecha final')

  const db = getDatabase()
  const rango = [desde, hasta]
  const actividad = db
    .prepare(
      `SELECT COUNT(DISTINCT vehiculo_id) AS autos,
              COALESCE(SUM(total_centavos), 0) AS facturacion
       FROM ordenes
       WHERE estado = 'COMPLETADA'
         AND date(fecha_completada, 'localtime') BETWEEN date(?) AND date(?)`
    )
    .get(...rango) as { autos: number; facturacion: number }
  const caja = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN tipo = 'INGRESO' THEN monto_centavos ELSE 0 END), 0) AS ingresos,
         COALESCE(SUM(CASE WHEN tipo = 'EGRESO' THEN monto_centavos ELSE 0 END), 0) AS egresos
       FROM movimientos_caja
       WHERE date(fecha, 'localtime') BETWEEN date(?) AND date(?)`
    )
    .get(...rango) as { ingresos: number; egresos: number }
  const serviciosRows = db
    .prepare(
      `SELECT s.nombre, COUNT(*) AS cantidad,
              COALESCE(SUM(os.precio_centavos), 0) AS facturacionCentavos
       FROM orden_servicios os
       JOIN ordenes o ON o.id = os.orden_id
       JOIN servicios s ON s.id = os.servicio_id
       WHERE o.estado = 'COMPLETADA'
         AND date(o.fecha_completada, 'localtime') BETWEEN date(?) AND date(?)
       GROUP BY s.id, s.nombre
       ORDER BY cantidad DESC, s.nombre`
    )
    .all(...rango) as unknown as {
    nombre: string
    cantidad: number
    facturacionCentavos: number
  }[]
  const ordenesRows = db
    .prepare(
      `SELECT o.id, o.fecha_completada AS fecha, c.nombre AS cliente, v.placa,
              GROUP_CONCAT(s.nombre, ', ') AS servicios,
              o.metodo_pago AS metodoPago,
              o.total_centavos AS totalCentavos
       FROM ordenes o
       JOIN vehiculos v ON v.id = o.vehiculo_id
       JOIN clientes c ON c.id = v.cliente_id
       JOIN orden_servicios os ON os.orden_id = o.id
       JOIN servicios s ON s.id = os.servicio_id
       WHERE o.estado = 'COMPLETADA'
         AND date(o.fecha_completada, 'localtime') BETWEEN date(?) AND date(?)
       GROUP BY o.id
       ORDER BY o.fecha_completada DESC, o.id DESC`
    )
    .all(...rango) as unknown as (Omit<ReporteOrden, 'total'> & { totalCentavos: number })[]

  const servicios: ReporteServicio[] = serviciosRows.map((item) => ({
    nombre: item.nombre,
    cantidad: item.cantidad,
    facturacion: fromCents(item.facturacionCentavos)
  }))
  const ordenes: ReporteOrden[] = ordenesRows.map(({ totalCentavos, ...orden }) => ({
    ...orden,
    total: fromCents(totalCentavos)
  }))

  return {
    desde,
    hasta,
    autosAtendidos: actividad.autos,
    facturacion: fromCents(actividad.facturacion),
    ingresos: fromCents(caja.ingresos),
    egresos: fromCents(caja.egresos),
    resultado: fromCents(caja.ingresos - caja.egresos),
    servicioMasVendido: servicios[0]?.nombre ?? null,
    servicios,
    ordenes
  }
}
