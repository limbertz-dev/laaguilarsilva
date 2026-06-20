import { getDatabase } from '../../database/connection'
import {
  egresoInput,
  movimientoManualInput,
  parseInput,
  type EgresoInput,
  type MovimientoManualInput
} from '../../../shared/schemas/inputs'
import type { MovimientoCaja, ResumenCaja } from '../../../shared/types/domain'
import { fromCents, toCents } from '../shared'

type MovimientoRow = Omit<MovimientoCaja, 'monto' | 'saldo'> & { montoCentavos: number }

export function obtenerResumenCaja(): ResumenCaja {
  const rows = getDatabase()
    .prepare(
      `SELECT id, fecha, tipo, categoria, concepto, monto_centavos AS montoCentavos,
              metodo_pago AS metodoPago
       FROM movimientos_caja ORDER BY fecha, id`
    )
    .all() as unknown as MovimientoRow[]

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
    }
  })

  return {
    ingresos: fromCents(ingresosCentavos),
    egresos: fromCents(egresosCentavos),
    utilidad: fromCents(ingresosCentavos - egresosCentavos),
    movimientos: movimientos.reverse()
  }
}

export function registrarEgreso(input: EgresoInput): void {
  const data = parseInput(egresoInput, input)
  getDatabase()
    .prepare(
      `INSERT INTO movimientos_caja
       (tipo, categoria, concepto, monto_centavos, origen, origen_id)
       VALUES ('EGRESO', ?, ?, ?, 'EGRESO_MANUAL', NULL)`
    )
    .run(data.categoria.toUpperCase(), data.concepto, toCents(data.monto))
}

export function registrarMovimiento(input: MovimientoManualInput): void {
  const data = parseInput(movimientoManualInput, input)
  getDatabase()
    .prepare(
      `INSERT INTO movimientos_caja
       (tipo, categoria, concepto, monto_centavos, origen, origen_id)
       VALUES (?, ?, ?, ?, 'MOVIMIENTO_MANUAL', NULL)`
    )
    .run(data.tipo, data.categoria.toUpperCase(), data.concepto, toCents(data.monto))
}
