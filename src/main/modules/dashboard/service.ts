import { getDatabase } from '../../database/connection'
import {
  parseInput,
  reporteFiltroInput,
  type ReporteFiltroInput
} from '../../../shared/schemas/inputs'
import type {
  Dashboard,
  DashboardActividadDia,
  DashboardInventario,
  DashboardRanking
} from '../../../shared/types/domain'
import { fromCents } from '../shared'

function countDaysInclusive(desde: string, hasta: string): number {
  const start = new Date(`${desde}T12:00:00Z`)
  const end = new Date(`${hasta}T12:00:00Z`)
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
}

function formatActividadEtiqueta(fecha: string, dayCount: number): string {
  const date = new Date(`${fecha}T12:00:00Z`)

  if (dayCount > 14) {
    return String(date.getUTCDate())
  }

  if (dayCount === 1) {
    return new Intl.DateTimeFormat('es-BO', {
      day: '2-digit',
      month: 'short',
      timeZone: 'UTC'
    }).format(date)
  }

  return new Intl.DateTimeFormat('es-BO', { weekday: 'short', timeZone: 'UTC' })
    .format(date)
    .replace(/\.$/, '')
}

export function obtenerDashboard(input: ReporteFiltroInput): Dashboard {
  const { desde, hasta } = parseInput(reporteFiltroInput, input)
  if (desde > hasta) throw new Error('La fecha inicial no puede ser posterior a la fecha final')

  const dayCount = countDaysInclusive(desde, hasta)
  const db = getDatabase()
  const rango = [desde, hasta]

  const clientes = db.prepare('SELECT COUNT(*) AS total FROM clientes').get() as { total: number }
  const ordenes = db
    .prepare("SELECT COUNT(*) AS total FROM ordenes WHERE estado = 'PENDIENTE'")
    .get() as { total: number }
  const insumos = db
    .prepare(
      "SELECT COUNT(*) AS total FROM insumos WHERE estado = 'ACTIVO' AND paquetes <= paquetes_minimo"
    )
    .get() as { total: number }
  const actividad = db
    .prepare(
      `SELECT COUNT(DISTINCT vehiculo_id) AS autos,
              COALESCE(SUM(total_centavos), 0) AS facturacion
       FROM ordenes
       WHERE estado = 'COMPLETADA'
         AND date(fecha_completada, 'localtime') BETWEEN date(?) AND date(?)`
    )
    .get(...rango) as { autos: number; facturacion: number }
  const servicioMasVendido = db
    .prepare(
      `SELECT s.nombre, COUNT(*) AS cantidad
       FROM orden_servicios os
       JOIN ordenes o ON o.id = os.orden_id
       JOIN servicios s ON s.id = os.servicio_id
       WHERE o.estado = 'COMPLETADA'
         AND date(o.fecha_completada, 'localtime') BETWEEN date(?) AND date(?)
       GROUP BY s.id, s.nombre
       ORDER BY cantidad DESC, s.nombre
       LIMIT 1`
    )
    .get(...rango) as { nombre: string; cantidad: number } | undefined
  const insumoMasBajo = db
    .prepare(
      `SELECT nombre, paquetes, tipo_paquete AS tipoPaquete
       FROM insumos
       WHERE estado = 'ACTIVO'
       ORDER BY paquetes ASC, nombre
       LIMIT 1`
    )
    .get() as { nombre: string; paquetes: number; tipoPaquete: string } | undefined
  const caja = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN tipo = 'INGRESO' THEN monto_centavos ELSE 0 END), 0) AS ingresos,
         COALESCE(SUM(CASE WHEN tipo = 'EGRESO' THEN monto_centavos ELSE 0 END), 0) AS egresos
       FROM movimientos_caja
       WHERE date(fecha, 'localtime') BETWEEN date(?) AND date(?)`
    )
    .get(...rango) as { ingresos: number; egresos: number }
  const actividadRows = db
    .prepare(
      `WITH RECURSIVE dias(fecha) AS (
         SELECT date(?)
         UNION ALL
         SELECT date(fecha, '+1 day') FROM dias WHERE fecha < date(?)
       ),
       ordenes_dia AS (
         SELECT date(fecha_completada, 'localtime') AS fecha,
                COUNT(DISTINCT vehiculo_id) AS autos,
                SUM(total_centavos) AS facturacion
         FROM ordenes
         WHERE estado = 'COMPLETADA'
           AND date(fecha_completada, 'localtime') BETWEEN date(?) AND date(?)
         GROUP BY date(fecha_completada, 'localtime')
       ),
       caja_dia AS (
         SELECT date(fecha, 'localtime') AS fecha,
                SUM(CASE WHEN tipo = 'INGRESO' THEN monto_centavos ELSE 0 END) AS ingresos,
                SUM(CASE WHEN tipo = 'EGRESO' THEN monto_centavos ELSE 0 END) AS egresos
         FROM movimientos_caja
         WHERE date(fecha, 'localtime') BETWEEN date(?) AND date(?)
         GROUP BY date(fecha, 'localtime')
       )
       SELECT dias.fecha,
              COALESCE(ordenes_dia.autos, 0) AS autos,
              COALESCE(ordenes_dia.facturacion, 0) AS facturacionCentavos,
              COALESCE(caja_dia.ingresos, 0) AS ingresosCentavos,
              COALESCE(caja_dia.egresos, 0) AS egresosCentavos
       FROM dias
       LEFT JOIN ordenes_dia ON ordenes_dia.fecha = dias.fecha
       LEFT JOIN caja_dia ON caja_dia.fecha = dias.fecha
       ORDER BY dias.fecha`
    )
    .all(desde, hasta, ...rango, ...rango) as unknown as {
    fecha: string
    autos: number
    facturacionCentavos: number
    ingresosCentavos: number
    egresosCentavos: number
  }[]
  const actividadSemanal: DashboardActividadDia[] = actividadRows.map((item) => ({
    fecha: item.fecha,
    etiqueta: formatActividadEtiqueta(item.fecha, dayCount),
    autos: item.autos,
    facturacion: fromCents(item.facturacionCentavos),
    ingresos: fromCents(item.ingresosCentavos),
    egresos: fromCents(item.egresosCentavos)
  }))
  const serviciosVendidos = db
    .prepare(
      `SELECT s.nombre, COUNT(*) AS cantidad
       FROM orden_servicios os
       JOIN ordenes o ON o.id = os.orden_id
       JOIN servicios s ON s.id = os.servicio_id
       WHERE o.estado = 'COMPLETADA'
         AND date(o.fecha_completada, 'localtime') BETWEEN date(?) AND date(?)
       GROUP BY s.id, s.nombre
       ORDER BY cantidad DESC, s.nombre
       LIMIT 6`
    )
    .all(...rango) as unknown as DashboardRanking[]
  const inventarioActual = db
    .prepare(
      `SELECT nombre, paquetes, tipo_paquete AS tipoPaquete, contenido
       FROM insumos
       WHERE estado = 'ACTIVO'
       ORDER BY paquetes ASC, nombre
       LIMIT 6`
    )
    .all() as unknown as DashboardInventario[]

  return {
    desde,
    hasta,
    clientes: clientes.total,
    ordenesPendientes: ordenes.total,
    insumosCriticos: insumos.total,
    autosAtendidosHoy: actividad.autos,
    facturacionHoy: fromCents(actividad.facturacion),
    servicioMasVendido: servicioMasVendido ?? null,
    insumoMasBajo: insumoMasBajo ?? null,
    ingresosHoy: fromCents(caja.ingresos),
    egresosHoy: fromCents(caja.egresos),
    resultadoHoy: fromCents(caja.ingresos - caja.egresos),
    actividadSemanal,
    serviciosVendidos,
    inventarioActual
  }
}