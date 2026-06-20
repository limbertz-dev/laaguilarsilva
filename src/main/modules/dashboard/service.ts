import { getDatabase } from '../../database/connection'
import type {
  Dashboard,
  DashboardActividadDia,
  DashboardConsumo,
  DashboardRanking
} from '../../../shared/types/domain'
import { fromCents } from '../shared'

export function obtenerDashboard(): Dashboard {
  const db = getDatabase()
  const clientes = db.prepare('SELECT COUNT(*) AS total FROM clientes').get() as { total: number }
  const ordenes = db
    .prepare("SELECT COUNT(*) AS total FROM ordenes WHERE estado = 'PENDIENTE'")
    .get() as { total: number }
  const insumos = db
    .prepare(
      "SELECT COUNT(*) AS total FROM insumos WHERE estado = 'ACTIVO' AND stock_actual <= stock_minimo"
    )
    .get() as { total: number }
  const actividad = db
    .prepare(
      `SELECT COUNT(DISTINCT vehiculo_id) AS autos,
              COALESCE(SUM(total_centavos), 0) AS facturacion
       FROM ordenes
       WHERE estado = 'COMPLETADA'
         AND date(fecha_completada, 'localtime') = date('now', 'localtime')`
    )
    .get() as { autos: number; facturacion: number }
  const servicioMasVendido = db
    .prepare(
      `SELECT s.nombre, COUNT(*) AS cantidad
       FROM orden_servicios os
       JOIN ordenes o ON o.id = os.orden_id
       JOIN servicios s ON s.id = os.servicio_id
       WHERE o.estado = 'COMPLETADA'
         AND date(o.fecha_completada, 'localtime') = date('now', 'localtime')
       GROUP BY s.id, s.nombre
       ORDER BY cantidad DESC, s.nombre
       LIMIT 1`
    )
    .get() as { nombre: string; cantidad: number } | undefined
  const shampoo = db
    .prepare(
      `SELECT i.nombre, i.unidad, COALESCE(SUM(ci.cantidad), 0) AS cantidad
       FROM consumos_insumo ci
       JOIN insumos i ON i.id = ci.insumo_id
       WHERE lower(i.nombre) LIKE '%shampoo%'
         AND date(ci.fecha, 'localtime') = date('now', 'localtime')
       GROUP BY i.id, i.nombre, i.unidad
       ORDER BY cantidad DESC
       LIMIT 1`
    )
    .get() as { nombre: string; unidad: string; cantidad: number } | undefined
  const caja = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN tipo = 'INGRESO' THEN monto_centavos ELSE 0 END), 0) AS ingresos,
         COALESCE(SUM(CASE WHEN tipo = 'EGRESO' THEN monto_centavos ELSE 0 END), 0) AS egresos
       FROM movimientos_caja
       WHERE date(fecha, 'localtime') = date('now', 'localtime')`
    )
    .get() as { ingresos: number; egresos: number }
  const actividadRows = db
    .prepare(
      `WITH RECURSIVE dias(fecha) AS (
         SELECT date('now', 'localtime', '-6 days')
         UNION ALL
         SELECT date(fecha, '+1 day') FROM dias WHERE fecha < date('now', 'localtime')
       ),
       ordenes_dia AS (
         SELECT date(fecha_completada, 'localtime') AS fecha,
                COUNT(DISTINCT vehiculo_id) AS autos,
                SUM(total_centavos) AS facturacion
         FROM ordenes
         WHERE estado = 'COMPLETADA'
           AND date(fecha_completada, 'localtime') >= date('now', 'localtime', '-6 days')
         GROUP BY date(fecha_completada, 'localtime')
       ),
       caja_dia AS (
         SELECT date(fecha, 'localtime') AS fecha,
                SUM(CASE WHEN tipo = 'INGRESO' THEN monto_centavos ELSE 0 END) AS ingresos,
                SUM(CASE WHEN tipo = 'EGRESO' THEN monto_centavos ELSE 0 END) AS egresos
         FROM movimientos_caja
         WHERE date(fecha, 'localtime') >= date('now', 'localtime', '-6 days')
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
    .all() as unknown as {
    fecha: string
    autos: number
    facturacionCentavos: number
    ingresosCentavos: number
    egresosCentavos: number
  }[]
  const actividadSemanal: DashboardActividadDia[] = actividadRows.map((item) => ({
    fecha: item.fecha,
    etiqueta: new Intl.DateTimeFormat('es-BO', {
      weekday: 'short',
      timeZone: 'UTC'
    }).format(new Date(`${item.fecha}T12:00:00Z`)),
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
         AND date(o.fecha_completada, 'localtime') >= date('now', 'localtime', '-29 days')
       GROUP BY s.id, s.nombre
       ORDER BY cantidad DESC, s.nombre
       LIMIT 6`
    )
    .all() as unknown as DashboardRanking[]
  const consumoInsumos = db
    .prepare(
      `SELECT i.nombre, i.unidad, SUM(ci.cantidad) AS cantidad
       FROM consumos_insumo ci
       JOIN insumos i ON i.id = ci.insumo_id
       WHERE date(ci.fecha, 'localtime') >= date('now', 'localtime', '-29 days')
       GROUP BY i.id, i.nombre, i.unidad
       ORDER BY cantidad DESC, i.nombre
       LIMIT 6`
    )
    .all() as unknown as DashboardConsumo[]

  return {
    clientes: clientes.total,
    ordenesPendientes: ordenes.total,
    insumosCriticos: insumos.total,
    autosAtendidosHoy: actividad.autos,
    facturacionHoy: fromCents(actividad.facturacion),
    servicioMasVendido: servicioMasVendido ?? null,
    shampooConsumido: shampoo ?? null,
    ingresosHoy: fromCents(caja.ingresos),
    egresosHoy: fromCents(caja.egresos),
    resultadoHoy: fromCents(caja.ingresos - caja.egresos),
    actividadSemanal,
    serviciosVendidos,
    consumoInsumos
  }
}
