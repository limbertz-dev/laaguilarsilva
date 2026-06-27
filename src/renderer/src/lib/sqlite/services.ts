import type {
  Cliente, ClienteHistorial, Dashboard, DashboardActividadDia,
  DashboardInventario, DashboardRanking, Empleado, EstadoRegistro,
  Insumo, MovimientoCaja, OrdenResumen, ReporteOrden,
  ReporteResumen, ReporteServicio, ResumenCaja, Servicio, Vehiculo
} from '../../../../shared/types/domain'
import type {
  ClienteConVehiculoInput, ClienteInput, CompraInsumoInput,
  EgresoInput, EmpleadoInput, InsumoInput, InsumoUpdateInput,
  MovimientoManualInput, OrdenInput, ReporteFiltroInput,
  ServicioInput, VehiculoInput
} from '../../../../shared/schemas/inputs'
import {
  clienteConVehiculoInput, clienteInput, compraInsumoInput,
  egresoInput, empleadoInput, insumoInput, insumoUpdateInput,
  movimientoManualInput, ordenInput, reporteFiltroInput,
  parseInput, servicioInput, vehiculoInput
} from '../../../../shared/schemas/inputs'
import type { AppApi } from '../../../../shared/contracts/api'
import { all, fromCents, get, initDatabase, run, toCents, toId, transaction } from './connection'

const CONCEPTO_MAX_LENGTH = 120

function formatMovimientoFechaHora(value: string | Date = new Date()): string {
  const fecha = typeof value === 'string' ? new Date(value) : value
  return fecha.toLocaleString('es-BO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function buildConceptoConFecha(prefix: string, suffix: string): string {
  const maxSuffix = Math.max(1, CONCEPTO_MAX_LENGTH - prefix.length)
  const suffixVisible = suffix.length > maxSuffix ? `${suffix.slice(0, maxSuffix - 1)}\u2026` : suffix
  return `${prefix}${suffixVisible}`
}

function buildCobroOrdenConcepto(fechaIngreso: string, cliente: string): string {
  return buildConceptoConFecha(`Cobro de orden del ${formatMovimientoFechaHora(fechaIngreso)} al cliente `, cliente)
}

function buildPagoSalarioConcepto(nombreEmpleado: string, fecha: string | Date = new Date()): string {
  return buildConceptoConFecha(`Pago de salario del ${formatMovimientoFechaHora(fecha)} a `, nombreEmpleado)
}

function buildCompraInsumoConcepto(nombreInsumo: string, fecha: string | Date = new Date()): string {
  return buildConceptoConFecha(`Compra del ${formatMovimientoFechaHora(fecha)} de `, nombreInsumo)
}

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

function countDaysInclusive(desde: string, hasta: string): number {
  const start = new Date(`${desde}T12:00:00Z`)
  const end = new Date(`${hasta}T12:00:00Z`)
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
}

function formatActividadEtiqueta(fecha: string, dayCount: number): string {
  const date = new Date(`${fecha}T12:00:00Z`)
  if (dayCount > 14) return String(date.getUTCDate())
  if (dayCount === 1) {
    return new Intl.DateTimeFormat('es-BO', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(date)
  }
  return new Intl.DateTimeFormat('es-BO', { weekday: 'short', timeZone: 'UTC' }).format(date).replace(/\.$/, '')
}

export async function createSqliteApi(): Promise<AppApi> {
  await initDatabase()

  return {
    dashboard: async (input: ReporteFiltroInput): Promise<Dashboard> => {
      const { desde, hasta } = parseInput(reporteFiltroInput, input)
      if (desde > hasta) throw new Error('La fecha inicial no puede ser posterior a la fecha final')
      const dayCount = countDaysInclusive(desde, hasta)
      const rango = [desde, hasta]

      const clientesCount = get<{ total: number }>('SELECT COUNT(*) AS total FROM clientes')!
      const ordenesPend = get<{ total: number }>("SELECT COUNT(*) AS total FROM ordenes WHERE estado = 'PENDIENTE'")!
      const insumosCount = get<{ total: number }>("SELECT COUNT(*) AS total FROM insumos WHERE estado = 'ACTIVO' AND paquetes <= paquetes_minimo")!
      const actividad = get<{ autos: number; facturacion: number }>(
        `SELECT COUNT(DISTINCT vehiculo_id) AS autos,
                COALESCE(SUM(total_centavos), 0) AS facturacion
         FROM ordenes
         WHERE estado = 'COMPLETADA'
           AND date(fecha_completada) BETWEEN date(?) AND date(?)`,
        ...rango
      )!
      const servicioMasVendido = get<{ nombre: string; cantidad: number }>(
        `SELECT s.nombre, COUNT(*) AS cantidad
         FROM orden_servicios os
         JOIN ordenes o ON o.id = os.orden_id
         JOIN servicios s ON s.id = os.servicio_id
         WHERE o.estado = 'COMPLETADA'
           AND date(o.fecha_completada) BETWEEN date(?) AND date(?)
         GROUP BY s.id, s.nombre
         ORDER BY cantidad DESC, s.nombre
         LIMIT 1`,
        ...rango
      )
      const insumoMasBajo = get<{ nombre: string; paquetes: number; tipoPaquete: string }>(
        `SELECT nombre, paquetes, tipo_paquete AS tipoPaquete
         FROM insumos WHERE estado = 'ACTIVO'
         ORDER BY paquetes ASC, nombre LIMIT 1`
      )
      const caja = get<{ ingresos: number; egresos: number }>(
        `SELECT
           COALESCE(SUM(CASE WHEN tipo = 'INGRESO' THEN monto_centavos ELSE 0 END), 0) AS ingresos,
           COALESCE(SUM(CASE WHEN tipo = 'EGRESO' THEN monto_centavos ELSE 0 END), 0) AS egresos
         FROM movimientos_caja
         WHERE date(fecha) BETWEEN date(?) AND date(?)`,
        ...rango
      )!

      const actividadRows = all<{ fecha: string; autos: number; facturacionCentavos: number; ingresosCentavos: number; egresosCentavos: number }>(
        `WITH RECURSIVE dias(fecha) AS (
           SELECT date(?)
           UNION ALL
           SELECT date(fecha, '+1 day') FROM dias WHERE fecha < date(?)
         ),
         ordenes_dia AS (
           SELECT date(fecha_completada) AS fecha,
                  COUNT(DISTINCT vehiculo_id) AS autos,
                  SUM(total_centavos) AS facturacion
           FROM ordenes
           WHERE estado = 'COMPLETADA'
             AND date(fecha_completada) BETWEEN date(?) AND date(?)
           GROUP BY date(fecha_completada)
         ),
         caja_dia AS (
           SELECT date(fecha) AS fecha,
                  SUM(CASE WHEN tipo = 'INGRESO' THEN monto_centavos ELSE 0 END) AS ingresos,
                  SUM(CASE WHEN tipo = 'EGRESO' THEN monto_centavos ELSE 0 END) AS egresos
           FROM movimientos_caja
           WHERE date(fecha) BETWEEN date(?) AND date(?)
           GROUP BY date(fecha)
         )
         SELECT dias.fecha,
                COALESCE(ordenes_dia.autos, 0) AS autos,
                COALESCE(ordenes_dia.facturacion, 0) AS facturacionCentavos,
                COALESCE(caja_dia.ingresos, 0) AS ingresosCentavos,
                COALESCE(caja_dia.egresos, 0) AS egresosCentavos
         FROM dias
         LEFT JOIN ordenes_dia ON ordenes_dia.fecha = dias.fecha
         LEFT JOIN caja_dia ON caja_dia.fecha = dias.fecha
         ORDER BY dias.fecha`,
        desde, hasta, ...rango, ...rango
      )

      const actividadSemanal: DashboardActividadDia[] = actividadRows.map((item) => ({
        fecha: item.fecha,
        etiqueta: formatActividadEtiqueta(item.fecha, dayCount),
        autos: item.autos,
        facturacion: fromCents(item.facturacionCentavos),
        ingresos: fromCents(item.ingresosCentavos),
        egresos: fromCents(item.egresosCentavos)
      }))

      const serviciosVendidos = all<DashboardRanking>(
        `SELECT s.nombre, COUNT(*) AS cantidad
         FROM orden_servicios os
         JOIN ordenes o ON o.id = os.orden_id
         JOIN servicios s ON s.id = os.servicio_id
         WHERE o.estado = 'COMPLETADA'
           AND date(o.fecha_completada) BETWEEN date(?) AND date(?)
         GROUP BY s.id, s.nombre
         ORDER BY cantidad DESC, s.nombre
         LIMIT 6`,
        ...rango
      )

      const inventarioActual = all<DashboardInventario>(
        `SELECT nombre, paquetes, tipo_paquete AS tipoPaquete, contenido
         FROM insumos WHERE estado = 'ACTIVO'
         ORDER BY paquetes ASC, nombre LIMIT 6`
      )

      return {
        desde, hasta,
        clientes: clientesCount.total,
        ordenesPendientes: ordenesPend.total,
        insumosCriticos: insumosCount.total,
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
    },

    clientes: {
      listar: async (): Promise<Cliente[]> =>
        all<Cliente>(
          `SELECT id, nombre, telefono, creado_en AS creadoEn, estado,
                  eliminacion_programada_en AS eliminacionProgramadaEn
           FROM clientes
           WHERE eliminacion_programada_en IS NULL OR datetime(eliminacion_programada_en) > datetime('now')
           ORDER BY estado, nombre`
        ),

      crear: async (input: ClienteInput): Promise<Cliente> => {
        const data = parseInput(clienteInput, input)
        const result = run('INSERT INTO clientes (nombre, telefono) VALUES (?, ?)', data.nombre, data.telefono)
        return get<Cliente>(
          `SELECT id, nombre, telefono, creado_en AS creadoEn, estado,
                  eliminacion_programada_en AS eliminacionProgramadaEn
           FROM clientes WHERE id = ?`,
          toId(result.lastInsertRowid)
        )!
      },

      crearConVehiculo: async (input: ClienteConVehiculoInput): Promise<Cliente> =>
        transaction(() => {
          const data = parseInput(clienteConVehiculoInput, input)
          const result = run('INSERT INTO clientes (nombre, telefono) VALUES (?, ?)', data.nombre, data.telefono)
          const clienteId = toId(result.lastInsertRowid)

          if (data.vehiculo) {
            const placaExistente = get('SELECT 1 FROM vehiculos WHERE placa = ?', data.vehiculo.placa)
            if (placaExistente) throw new Error(`Ya existe un vehículo con la placa ${data.vehiculo.placa}`)
            run(
              `INSERT INTO vehiculos (cliente_id, placa, marca, modelo, color, tipo, observaciones)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              clienteId, data.vehiculo.placa, data.vehiculo.marca, data.vehiculo.modelo,
              data.vehiculo.color, data.vehiculo.tipo, data.vehiculo.observaciones
            )
          }

          return get<Cliente>(
            `SELECT id, nombre, telefono, creado_en AS creadoEn, estado,
                    eliminacion_programada_en AS eliminacionProgramadaEn
             FROM clientes WHERE id = ?`,
            clienteId
          )!
        }),

      actualizar: async (clienteId: number, input: ClienteInput): Promise<Cliente> => {
        const data = parseInput(clienteInput, input)
        const result = run('UPDATE clientes SET nombre = ?, telefono = ? WHERE id = ?', data.nombre, data.telefono, clienteId)
        if (result.changes === 0) throw new Error('Cliente no encontrado')
        return get<Cliente>(
          `SELECT id, nombre, telefono, creado_en AS creadoEn, estado,
                  eliminacion_programada_en AS eliminacionProgramadaEn
           FROM clientes WHERE id = ?`,
          clienteId
        )!
      },

      eliminar: async (clienteId: number): Promise<void> => {
        run("UPDATE vehiculos SET estado = 'INACTIVO' WHERE cliente_id = ? AND estado = 'ACTIVO'", clienteId)
        const result = run(
          `UPDATE clientes SET estado = 'INACTIVO',
           eliminacion_programada_en = datetime('now', '+24 hours')
           WHERE id = ?`,
          clienteId
        )
        if (result.changes === 0) throw new Error('Cliente no encontrado')
      },

      cancelarEliminacion: async (clienteId: number): Promise<void> => {
        run("UPDATE vehiculos SET estado = 'ACTIVO' WHERE cliente_id = ? AND estado = 'INACTIVO' AND eliminacion_programada_en IS NULL", clienteId)
        const result = run(
          "UPDATE clientes SET estado = 'ACTIVO', eliminacion_programada_en = NULL WHERE id = ?",
          clienteId
        )
        if (result.changes === 0) throw new Error('Cliente no encontrado')
      },

      historial: async (clienteId: number): Promise<ClienteHistorial> => {
        const cliente = get('SELECT 1 FROM clientes WHERE id = ?', clienteId)
        if (!cliente) throw new Error('Cliente no encontrado')

        const row = get<{ visitas: number; totalGastadoCentavos: number; ultimaVisita: string | null }>(
          `SELECT COUNT(o.id) AS visitas,
                  COALESCE(SUM(o.total_centavos), 0) AS totalGastadoCentavos,
                  MAX(o.fecha_completada) AS ultimaVisita
           FROM ordenes o
           JOIN vehiculos v ON v.id = o.vehiculo_id
           WHERE v.cliente_id = ? AND o.estado = 'COMPLETADA'`,
          clienteId
        )!

        return {
          visitas: row.visitas,
          totalGastado: fromCents(row.totalGastadoCentavos),
          ultimaVisita: row.ultimaVisita
        }
      }
    },

    vehiculos: {
      listar: async (): Promise<Vehiculo[]> =>
        all<Vehiculo>(
          `SELECT id, cliente_id AS clienteId, placa, marca, modelo, color, tipo, observaciones, estado,
                  eliminacion_programada_en AS eliminacionProgramadaEn
           FROM vehiculos
           WHERE eliminacion_programada_en IS NULL OR datetime(eliminacion_programada_en) > datetime('now')
           ORDER BY placa`
        ),

      crear: async (input: VehiculoInput): Promise<Vehiculo> => {
        const data = parseInput(vehiculoInput, input)
        const cliente = get('SELECT 1 FROM clientes WHERE id = ?', data.clienteId)
        if (!cliente) throw new Error('Cliente propietario no encontrado')

        const placaExistente = get('SELECT 1 FROM vehiculos WHERE placa = ?', data.placa)
        if (placaExistente) throw new Error(`Ya existe un vehículo con la placa ${data.placa}`)

        const result = run(
          `INSERT INTO vehiculos (cliente_id, placa, marca, modelo, color, tipo, observaciones)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          data.clienteId, data.placa, data.marca, data.modelo, data.color, data.tipo, data.observaciones
        )
        return get<Vehiculo>(
          `SELECT id, cliente_id AS clienteId, placa, marca, modelo, color, tipo, observaciones, estado,
                  eliminacion_programada_en AS eliminacionProgramadaEn
           FROM vehiculos WHERE id = ?`,
          toId(result.lastInsertRowid)
        )!
      },

      actualizar: async (vehiculoId: number, input: VehiculoInput): Promise<Vehiculo> => {
        const data = parseInput(vehiculoInput, input)
        const cliente = get('SELECT 1 FROM clientes WHERE id = ?', data.clienteId)
        if (!cliente) throw new Error('Cliente propietario no encontrado')

        const placaExistente = get('SELECT 1 FROM vehiculos WHERE placa = ? AND id <> ?', data.placa, vehiculoId)
        if (placaExistente) throw new Error(`Ya existe un vehículo con la placa ${data.placa}`)

        const result = run(
          `UPDATE vehiculos SET cliente_id = ?, placa = ?, marca = ?, modelo = ?, color = ?, tipo = ?, observaciones = ?
           WHERE id = ?`,
          data.clienteId, data.placa, data.marca, data.modelo, data.color, data.tipo, data.observaciones, vehiculoId
        )
        if (result.changes === 0) throw new Error('Vehículo no encontrado')

        return get<Vehiculo>(
          `SELECT id, cliente_id AS clienteId, placa, marca, modelo, color, tipo, observaciones, estado,
                  eliminacion_programada_en AS eliminacionProgramadaEn
           FROM vehiculos WHERE id = ?`,
          vehiculoId
        )!
      },

      eliminar: async (vehiculoId: number): Promise<void> => {
        const result = run(
          `UPDATE vehiculos SET estado = 'INACTIVO',
           eliminacion_programada_en = datetime('now', '+24 hours')
           WHERE id = ?`,
          vehiculoId
        )
        if (result.changes === 0) throw new Error('Vehículo no encontrado')
      },

      cancelarEliminacion: async (vehiculoId: number): Promise<void> => {
        const result = run(
          "UPDATE vehiculos SET estado = 'ACTIVO', eliminacion_programada_en = NULL WHERE id = ?",
          vehiculoId
        )
        if (result.changes === 0) throw new Error('Vehículo no encontrado')
      }
    },

    servicios: {
      listar: async (): Promise<Servicio[]> => {
        type ServicioRow = Omit<Servicio, 'precio'> & { precioCentavos: number }
        const rows = all<ServicioRow>(
          `SELECT id, nombre, descripcion, categoria, precio_centavos AS precioCentavos, estado,
                  eliminacion_programada_en AS eliminacionProgramadaEn
           FROM servicios
           WHERE eliminacion_programada_en IS NULL OR datetime(eliminacion_programada_en) > datetime('now')
           ORDER BY estado, nombre`
        )
        return rows.map(({ precioCentavos, ...r }) => ({ ...r, precio: fromCents(precioCentavos) }))
      },

      crear: async (input: ServicioInput): Promise<Servicio> => {
        const data = parseInput(servicioInput, input)
        const nombreExistente = get('SELECT 1 FROM servicios WHERE lower(nombre) = lower(?)', data.nombre)
        if (nombreExistente) throw new Error(`Ya existe un servicio llamado "${data.nombre}"`)

        const result = run(
          'INSERT INTO servicios (nombre, descripcion, categoria, precio_centavos) VALUES (?, ?, ?, ?)',
          data.nombre, data.descripcion, data.categoria, toCents(data.precio)
        )
        const row = get<{ precioCentavos: number } & Omit<Servicio, 'precio'>>(
          `SELECT id, nombre, descripcion, categoria, precio_centavos AS precioCentavos, estado,
                  eliminacion_programada_en AS eliminacionProgramadaEn
           FROM servicios WHERE id = ?`,
          toId(result.lastInsertRowid)
        )!
        const { precioCentavos, ...rest } = row
        return { ...rest, precio: fromCents(precioCentavos) }
      },

      actualizar: async (servicioId: number, input: ServicioInput): Promise<Servicio> => {
        const data = parseInput(servicioInput, input)
        const nombreExistente = get('SELECT 1 FROM servicios WHERE lower(nombre) = lower(?) AND id <> ?', data.nombre, servicioId)
        if (nombreExistente) throw new Error(`Ya existe un servicio llamado "${data.nombre}"`)

        const result = run(
          `UPDATE servicios SET nombre = ?, descripcion = ?, categoria = ?, precio_centavos = ?,
           eliminacion_programada_en = NULL WHERE id = ?`,
          data.nombre, data.descripcion, data.categoria, toCents(data.precio), servicioId
        )
        if (result.changes === 0) throw new Error('Servicio no encontrado')

        const row = get<{ precioCentavos: number } & Omit<Servicio, 'precio'>>(
          `SELECT id, nombre, descripcion, categoria, precio_centavos AS precioCentavos, estado,
                  eliminacion_programada_en AS eliminacionProgramadaEn
           FROM servicios WHERE id = ?`,
          servicioId
        )!
        const { precioCentavos, ...rest } = row
        return { ...rest, precio: fromCents(precioCentavos) }
      },

      cambiarEstado: async (servicioId: number, estado: EstadoRegistro): Promise<void> => {
        const result = run(
          `UPDATE servicios SET estado = ?,
           eliminacion_programada_en = CASE WHEN ? = 'ACTIVO' THEN NULL ELSE eliminacion_programada_en END
           WHERE id = ? AND (estado <> ? OR (? = 'ACTIVO' AND eliminacion_programada_en IS NOT NULL))`,
          estado, estado, servicioId, estado, estado
        )
        if (result.changes === 0) throw new Error('Servicio no encontrado o sin cambios')
      },

      eliminar: async (servicioId: number): Promise<void> => {
        const result = run(
          `UPDATE servicios SET estado = 'INACTIVO',
           eliminacion_programada_en = datetime('now', '+24 hours')
           WHERE id = ?`,
          servicioId
        )
        if (result.changes === 0) throw new Error('Servicio no encontrado')
      }
    },

    empleados: {
      listar: async (): Promise<Empleado[]> => {
        type EmpleadoRow = Omit<Empleado, 'salario'> & { salarioCentavos: number }
        const rows = all<EmpleadoRow>(
          `SELECT id, nombres, apellidos, telefono, cargo,
                  salario_centavos AS salarioCentavos,
                  tipo_pago AS tipoPago, estado,
                  eliminacion_programada_en AS eliminacionProgramadaEn
           FROM empleados
           WHERE eliminacion_programada_en IS NULL OR datetime(eliminacion_programada_en) > datetime('now')
           ORDER BY estado, apellidos, nombres`
        )
        return rows.map(({ salarioCentavos, ...r }) => ({ ...r, salario: fromCents(salarioCentavos) }))
      },

      crear: async (input: EmpleadoInput): Promise<Empleado> => {
        const data = parseInput(empleadoInput, input)
        const result = run(
          'INSERT INTO empleados (nombres, apellidos, telefono, cargo, salario_centavos, tipo_pago) VALUES (?, ?, ?, ?, ?, ?)',
          data.nombres, data.apellidos, data.telefono, data.cargo, toCents(data.salario), data.tipoPago
        )
        const row = get<{ salarioCentavos: number } & Omit<Empleado, 'salario'>>(
          `SELECT id, nombres, apellidos, telefono, cargo,
                  salario_centavos AS salarioCentavos,
                  tipo_pago AS tipoPago, estado,
                  eliminacion_programada_en AS eliminacionProgramadaEn
           FROM empleados WHERE id = ?`,
          toId(result.lastInsertRowid)
        )!
        const { salarioCentavos, ...rest } = row
        return { ...rest, salario: fromCents(salarioCentavos) }
      },

      actualizar: async (empleadoId: number, input: EmpleadoInput): Promise<Empleado> => {
        const data = parseInput(empleadoInput, input)
        const result = run(
          'UPDATE empleados SET nombres = ?, apellidos = ?, telefono = ?, cargo = ?, salario_centavos = ?, tipo_pago = ? WHERE id = ?',
          data.nombres, data.apellidos, data.telefono, data.cargo, toCents(data.salario), data.tipoPago, empleadoId
        )
        if (result.changes === 0) throw new Error('Empleado no encontrado')

        const row = get<{ salarioCentavos: number } & Omit<Empleado, 'salario'>>(
          `SELECT id, nombres, apellidos, telefono, cargo,
                  salario_centavos AS salarioCentavos,
                  tipo_pago AS tipoPago, estado,
                  eliminacion_programada_en AS eliminacionProgramadaEn
           FROM empleados WHERE id = ?`,
          empleadoId
        )!
        const { salarioCentavos, ...rest } = row
        return { ...rest, salario: fromCents(salarioCentavos) }
      },

      eliminar: async (empleadoId: number): Promise<void> => {
        const result = run(
          `UPDATE empleados SET estado = 'INACTIVO',
           eliminacion_programada_en = datetime('now', '+24 hours')
           WHERE id = ?`,
          empleadoId
        )
        if (result.changes === 0) throw new Error('Empleado no encontrado')
      },

      cambiarEstado: async (empleadoId: number, estado: EstadoRegistro): Promise<void> => {
        const result = run(
          `UPDATE empleados SET estado = ?,
           eliminacion_programada_en = CASE WHEN ? = 'ACTIVO' THEN NULL ELSE eliminacion_programada_en END
           WHERE id = ?`,
          estado, estado, empleadoId
        )
        if (result.changes === 0) throw new Error('Empleado no encontrado')
      },

      pagarSalario: async (empleadoId: number): Promise<void> => {
        transaction(() => {
          const empleado = get<{ id: number; nombres: string; apellidos: string; salarioCentavos: number; tipoPago: string }>(
            `SELECT id, nombres, apellidos, salario_centavos AS salarioCentavos, tipo_pago AS tipoPago
             FROM empleados WHERE id = ? AND estado = 'ACTIVO'`,
            empleadoId
          )
          if (!empleado) throw new Error('Empleado activo no encontrado')
          if (empleado.salarioCentavos <= 0) throw new Error('El salario debe ser mayor que cero')

          const periodMap: Record<string, string> = {
            'Día': '-1 day',
            'Semana': '-7 days',
            'Quincena': '-15 days',
            'Mes': '-30 days'
          }
          const period = periodMap[empleado.tipoPago]
          if (period) {
            const lastPayment = get(
              `SELECT 1 FROM movimientos_caja
               WHERE origen = 'PAGO_SALARIO'
                 AND origen_id = ?
                 AND fecha > datetime('now', ?)`,
              empleado.id, period
            )
            if (lastPayment) {
              throw new Error(`El salario de ${empleado.nombres} ${empleado.apellidos} ya fue pagado en este período`)
            }
          }

          run(
            `INSERT INTO movimientos_caja (tipo, categoria, concepto, monto_centavos, origen, origen_id)
             VALUES ('EGRESO', 'NÓMINA', ?, ?, 'PAGO_SALARIO', ?)`,
            buildPagoSalarioConcepto(`${empleado.nombres} ${empleado.apellidos}`),
            empleado.salarioCentavos,
            empleado.id
          )
        })
      }
    },

    inventario: {
      listar: async (): Promise<Insumo[]> =>
        all<Insumo>(
          `SELECT id, nombre, tipo_paquete AS tipoPaquete, contenido,
                  paquetes, paquetes_minimo AS paquetesMinimo, estado,
                  eliminacion_programada_en AS eliminacionProgramadaEn
           FROM insumos
           WHERE eliminacion_programada_en IS NULL OR datetime(eliminacion_programada_en) > datetime('now')
           ORDER BY (eliminacion_programada_en IS NOT NULL), estado, nombre`
        ),

      crear: async (input: InsumoInput): Promise<Insumo> => {
        const data = parseInput(insumoInput, input)
        const existente = get('SELECT 1 FROM insumos WHERE lower(nombre) = lower(?)', data.nombre)
        if (existente) throw new Error(`Ya existe un insumo llamado "${data.nombre}"`)

        const result = run(
          'INSERT INTO insumos (nombre, tipo_paquete, contenido, paquetes, paquetes_minimo) VALUES (?, ?, ?, ?, ?)',
          data.nombre, data.tipoPaquete, data.contenido, data.paquetes, data.paquetesMinimo
        )
        return get<Insumo>(
          `SELECT id, nombre, tipo_paquete AS tipoPaquete, contenido,
                  paquetes, paquetes_minimo AS paquetesMinimo, estado,
                  eliminacion_programada_en AS eliminacionProgramadaEn
           FROM insumos WHERE id = ?`,
          toId(result.lastInsertRowid)
        )!
      },

      actualizar: async (insumoId: number, input: InsumoUpdateInput): Promise<Insumo> => {
        const data = parseInput(insumoUpdateInput, input)
        const existente = get('SELECT 1 FROM insumos WHERE lower(nombre) = lower(?) AND id <> ?', data.nombre, insumoId)
        if (existente) throw new Error(`Ya existe un insumo llamado "${data.nombre}"`)

        const result = run(
          'UPDATE insumos SET nombre = ?, tipo_paquete = ?, contenido = ?, paquetes = ?, paquetes_minimo = ? WHERE id = ?',
          data.nombre, data.tipoPaquete, data.contenido, data.paquetes, data.paquetesMinimo, insumoId
        )
        if (result.changes === 0) throw new Error('Insumo no encontrado')

        return get<Insumo>(
          `SELECT id, nombre, tipo_paquete AS tipoPaquete, contenido,
                  paquetes, paquetes_minimo AS paquetesMinimo, estado,
                  eliminacion_programada_en AS eliminacionProgramadaEn
           FROM insumos WHERE id = ?`,
          insumoId
        )!
      },

      eliminar: async (insumoId: number): Promise<void> => {
        const result = run(
          `UPDATE insumos SET estado = 'INACTIVO',
           eliminacion_programada_en = datetime('now', '+24 hours')
           WHERE id = ?`,
          insumoId
        )
        if (result.changes === 0) throw new Error('Insumo no encontrado')
      },

      cambiarEstado: async (insumoId: number, estado: EstadoRegistro): Promise<void> => {
        const result = run(
          `UPDATE insumos SET estado = ?,
           eliminacion_programada_en = CASE WHEN ? = 'ACTIVO' THEN NULL ELSE eliminacion_programada_en END
           WHERE id = ?`,
          estado, estado, insumoId
        )
        if (result.changes === 0) throw new Error('Insumo no encontrado')
      },

      comprar: async (input: CompraInsumoInput): Promise<void> => {
        transaction(() => {
          const data = parseInput(compraInsumoInput, input)
          const insumo = get<{ id: number; nombre: string }>(
            'SELECT id, nombre FROM insumos WHERE id = ? AND estado = ?',
            data.insumoId, 'ACTIVO'
          )
          if (!insumo) throw new Error('Insumo activo no encontrado')

          const costoUnitario = toCents(data.costoUnitario)
          const total = data.cantidad * costoUnitario

          const compra = run(
            'INSERT INTO compras_insumo (insumo_id, cantidad, costo_unitario_centavos, total_centavos) VALUES (?, ?, ?, ?)',
            insumo.id, data.cantidad, costoUnitario, total
          )

          run('UPDATE insumos SET paquetes = paquetes + ? WHERE id = ?', data.cantidad, insumo.id)

          run(
            `INSERT INTO movimientos_caja (tipo, categoria, concepto, monto_centavos, origen, origen_id)
             VALUES ('EGRESO', 'INSUMOS', ?, ?, 'COMPRA_INSUMO', ?)`,
            buildCompraInsumoConcepto(insumo.nombre),
            total,
            toId(compra.lastInsertRowid)
          )
        })
      }
    },

    ordenes: {
      listar: async (): Promise<OrdenResumen[]> => {
        const rows = all<OrdenRow>(`${ordenSelect} ORDER BY o.fecha_ingreso DESC, o.id DESC`)
        return rows.map(mapOrden)
      },

      crear: async (input: OrdenInput): Promise<OrdenResumen> => {
        const data = parseInput(ordenInput, input)
        const servicioIds = [...new Set(data.servicioIds)]

        return transaction(() => {
          const placeholders = servicioIds.map(() => '?').join(', ')
          const servicios = all<{ id: number; precioCentavos: number }>(
            `SELECT id, precio_centavos AS precioCentavos
             FROM servicios WHERE estado = 'ACTIVO' AND id IN (${placeholders})`,
            ...servicioIds
          )
          if (servicios.length !== servicioIds.length) {
            throw new Error('Uno o más servicios no existen o están inactivos')
          }

          const subtotal = servicios.reduce((sum, s) => sum + s.precioCentavos, 0)
          const descuento = toCents(data.descuento)
          if (descuento > subtotal) throw new Error('El descuento no puede superar el subtotal')
          const total = subtotal - descuento

          const result = run(
            'INSERT INTO ordenes (vehiculo_id, subtotal_centavos, descuento_centavos, total_centavos, metodo_pago) VALUES (?, ?, ?, ?, ?)',
            data.vehiculoId, subtotal, descuento, total, data.metodoPago
          )
          const ordenId = toId(result.lastInsertRowid)

          servicios.forEach((servicio) => {
            run('INSERT INTO orden_servicios (orden_id, servicio_id, precio_centavos) VALUES (?, ?, ?)',
              ordenId, servicio.id, servicio.precioCentavos
            )
          })

          const row = get<OrdenRow>(`${ordenSelect} WHERE o.id = ?`, ordenId)!
          return mapOrden(row)
        })
      },

      actualizar: async (ordenId: number, input: OrdenInput): Promise<OrdenResumen> => {
        const data = parseInput(ordenInput, input)
        const servicioIds = [...new Set(data.servicioIds)]

        return transaction(() => {
          const orden = get<{ estado: string; estadoOperativo: string }>(
            "SELECT estado, estado_operativo AS estadoOperativo FROM ordenes WHERE id = ?",
            ordenId
          )
          if (!orden) throw new Error('Orden no encontrada')
          if (orden.estado !== 'PENDIENTE' || orden.estadoOperativo !== 'RECIBIDO') {
            throw new Error('Solo se pueden editar órdenes recién recibidas')
          }

          const placeholders = servicioIds.map(() => '?').join(', ')
          const servicios = all<{ id: number; precioCentavos: number }>(
            `SELECT id, precio_centavos AS precioCentavos
             FROM servicios WHERE estado = 'ACTIVO' AND id IN (${placeholders})`,
            ...servicioIds
          )
          if (servicios.length !== servicioIds.length) {
            throw new Error('Uno o más servicios no existen o están inactivos')
          }

          const subtotal = servicios.reduce((sum, s) => sum + s.precioCentavos, 0)
          const descuento = toCents(data.descuento)
          if (descuento > subtotal) throw new Error('El descuento no puede superar el subtotal')

          run(
            'UPDATE ordenes SET vehiculo_id = ?, subtotal_centavos = ?, descuento_centavos = ?, total_centavos = ?, metodo_pago = ? WHERE id = ?',
            data.vehiculoId, subtotal, descuento, subtotal - descuento, data.metodoPago, ordenId
          )

          run('DELETE FROM orden_servicios WHERE orden_id = ?', ordenId)
          servicios.forEach((servicio) => {
            run('INSERT INTO orden_servicios (orden_id, servicio_id, precio_centavos) VALUES (?, ?, ?)',
              ordenId, servicio.id, servicio.precioCentavos
            )
          })

          const row = get<OrdenRow>(`${ordenSelect} WHERE o.id = ?`, ordenId)!
          return mapOrden(row)
        })
      },

      eliminar: async (ordenId: number): Promise<void> => {
        const result = run(
          `DELETE FROM ordenes
           WHERE id = ?
             AND (
               estado = 'CANCELADA'
               OR (estado = 'PENDIENTE' AND estado_operativo IN ('RECIBIDO', 'EN_PROCESO'))
             )`,
          ordenId
        )
        if (result.changes === 0) {
          throw new Error('No se puede eliminar una orden lista o entregada')
        }
      },

      iniciar: async (ordenId: number): Promise<void> => {
        const result = run(
          `UPDATE ordenes SET estado_operativo = 'EN_PROCESO'
           WHERE id = ? AND estado = 'PENDIENTE' AND estado_operativo = 'RECIBIDO'`,
          ordenId
        )
        if (result.changes === 0) throw new Error('Solo se puede iniciar una orden recibida')
      },

      marcarLista: async (ordenId: number): Promise<void> => {
        const result = run(
          `UPDATE ordenes SET estado_operativo = 'LISTO'
           WHERE id = ? AND estado = 'PENDIENTE' AND estado_operativo = 'EN_PROCESO'`,
          ordenId
        )
        if (result.changes === 0) throw new Error('Solo se puede finalizar una orden que está en proceso')
      },

      entregar: async (ordenId: number): Promise<void> => {
        transaction(() => {
          const orden = get<{
            id: number; totalCentavos: number; estado: string; estadoOperativo: string;
            metodoPago: string; fechaIngreso: string; cliente: string
          }>(
            `SELECT o.id, o.total_centavos AS totalCentavos, o.estado,
                    o.estado_operativo AS estadoOperativo, o.metodo_pago AS metodoPago,
                    o.fecha_ingreso AS fechaIngreso, c.nombre AS cliente
             FROM ordenes o
             JOIN vehiculos v ON v.id = o.vehiculo_id
             JOIN clientes c ON c.id = v.cliente_id
             WHERE o.id = ?`,
            ordenId
          )
          if (!orden) throw new Error('Orden no encontrada')
          if (orden.estado !== 'PENDIENTE' || orden.estadoOperativo !== 'LISTO') {
            throw new Error('Solo se puede entregar una orden que está lista')
          }
          if (orden.totalCentavos <= 0) throw new Error('La orden no tiene un total cobrable')

          run(
            `UPDATE ordenes SET estado = 'COMPLETADA', estado_operativo = 'ENTREGADO',
             fecha_completada = datetime('now', 'localtime')
             WHERE id = ?`,
            ordenId
          )

          run(
            `INSERT INTO movimientos_caja (tipo, categoria, concepto, monto_centavos, metodo_pago, origen, origen_id)
             VALUES ('INGRESO', 'LAVADO', ?, ?, ?, 'ORDEN', ?)`,
            buildCobroOrdenConcepto(orden.fechaIngreso, orden.cliente),
            orden.totalCentavos,
            orden.metodoPago,
            ordenId
          )
        })
      },

      cancelar: async (ordenId: number): Promise<void> => {
        const result = run(
          `UPDATE ordenes SET estado_operativo = 'RECIBIDO'
           WHERE id = ? AND estado = 'PENDIENTE' AND estado_operativo = 'EN_PROCESO'`,
          ordenId
        )
        if (result.changes === 0) {
          throw new Error('Solo se puede cancelar el inicio de una orden en proceso')
        }
      },

      revertirInicio: async (ordenId: number): Promise<void> => {
        const result = run(
          `UPDATE ordenes SET estado_operativo = 'RECIBIDO'
           WHERE id = ? AND estado = 'PENDIENTE' AND estado_operativo = 'EN_PROCESO'`,
          ordenId
        )
        if (result.changes === 0) {
          throw new Error('Solo se puede cancelar el inicio de una orden en proceso')
        }
      }
    },

    caja: {
      resumen: async (): Promise<ResumenCaja> => {
        const rows = all<{ id: number; fecha: string; tipo: string; categoria: string; concepto: string; montoCentavos: number; metodoPago: string | null }>(
          `SELECT id, fecha, tipo, categoria, concepto, monto_centavos AS montoCentavos,
                  metodo_pago AS metodoPago
           FROM movimientos_caja ORDER BY fecha, id`
        )

        let saldoCentavos = 0
        let ingresosCentavos = 0
        let egresosCentavos = 0
        const movimientos = rows.map((row) => {
          if (row.tipo === 'INGRESO') {
            ingresosCentavos += row.montoCentavos
            saldoCentavos += row.montoCentavos
          } else {
            egresosCentavos += row.montoCentavos
            saldoCentavos -= row.montoCentavos
          }
          return {
            ...row,
            monto: fromCents(row.montoCentavos),
            saldo: fromCents(saldoCentavos)
          } as MovimientoCaja
        })

        return {
          ingresos: fromCents(ingresosCentavos),
          egresos: fromCents(egresosCentavos),
          utilidad: fromCents(ingresosCentavos - egresosCentavos),
          movimientos: movimientos.reverse()
        }
      },

      registrarEgreso: async (input: EgresoInput): Promise<void> => {
        const data = parseInput(egresoInput, input)
        run(
          `INSERT INTO movimientos_caja (tipo, categoria, concepto, monto_centavos, origen, origen_id)
           VALUES ('EGRESO', ?, ?, ?, 'EGRESO_MANUAL', NULL)`,
          data.categoria.toUpperCase(), data.concepto, toCents(data.monto)
        )
      },

      registrarMovimiento: async (input: MovimientoManualInput): Promise<void> => {
        const data = parseInput(movimientoManualInput, input)
        run(
          `INSERT INTO movimientos_caja (tipo, categoria, concepto, monto_centavos, origen, origen_id)
           VALUES (?, ?, ?, ?, 'MOVIMIENTO_MANUAL', NULL)`,
          data.tipo, data.categoria.toUpperCase(), data.concepto, toCents(data.monto)
        )
      }
    },

    reportes: {
      obtener: async (input: ReporteFiltroInput): Promise<ReporteResumen> => {
        const { desde, hasta } = parseInput(reporteFiltroInput, input)
        if (desde > hasta) throw new Error('La fecha inicial no puede ser posterior a la fecha final')

        const rango = [desde, hasta]

        const actividad = get<{ autos: number; facturacion: number }>(
          `SELECT COUNT(DISTINCT vehiculo_id) AS autos,
                  COALESCE(SUM(total_centavos), 0) AS facturacion
           FROM ordenes
           WHERE estado = 'COMPLETADA'
             AND date(fecha_completada) BETWEEN date(?) AND date(?)`,
          ...rango
        )!

        const caja = get<{ ingresos: number; egresos: number }>(
          `SELECT
             COALESCE(SUM(CASE WHEN tipo = 'INGRESO' THEN monto_centavos ELSE 0 END), 0) AS ingresos,
             COALESCE(SUM(CASE WHEN tipo = 'EGRESO' THEN monto_centavos ELSE 0 END), 0) AS egresos
           FROM movimientos_caja
           WHERE date(fecha) BETWEEN date(?) AND date(?)`,
          ...rango
        )!

        const serviciosRows = all<{ nombre: string; cantidad: number; facturacionCentavos: number }>(
          `SELECT s.nombre, COUNT(*) AS cantidad,
                  COALESCE(SUM(os.precio_centavos), 0) AS facturacionCentavos
           FROM orden_servicios os
           JOIN ordenes o ON o.id = os.orden_id
           JOIN servicios s ON s.id = os.servicio_id
           WHERE o.estado = 'COMPLETADA'
             AND date(o.fecha_completada) BETWEEN date(?) AND date(?)
           GROUP BY s.id, s.nombre
           ORDER BY cantidad DESC, s.nombre`,
          ...rango
        )

        const ordenesRows = all<{
          id: number; fecha: string; cliente: string; placa: string;
          servicios: string; metodoPago: string; totalCentavos: number
        }>(
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
             AND date(o.fecha_completada) BETWEEN date(?) AND date(?)
           GROUP BY o.id
           ORDER BY o.fecha_completada DESC, o.id DESC`,
          ...rango
        )

        const servicios: ReporteServicio[] = serviciosRows.map((item) => ({
          nombre: item.nombre,
          cantidad: item.cantidad,
          facturacion: fromCents(item.facturacionCentavos)
        }))

        const ordenes: ReporteOrden[] = ordenesRows.map(
          ({ totalCentavos, ...orden }) =>
            ({
              ...orden,
              total: fromCents(totalCentavos)
            }) as ReporteOrden
        )

        return {
          desde, hasta,
          autosAtendidos: actividad.autos,
          facturacion: fromCents(actividad.facturacion),
          ingresos: fromCents(caja.ingresos),
          egresos: fromCents(caja.egresos),
          resultado: fromCents(caja.ingresos - caja.egresos),
          servicioMasVendido: servicios[0]?.nombre ?? null,
          servicios,
          ordenes
        }
      },

      exportarPdf: async (): Promise<string | null> => null,
      exportarExcel: async (): Promise<string | null> => null
    }
  }
}
