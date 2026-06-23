import { getDatabase, transaction } from '../../database/connection'
import { empleadoInput, parseInput, type EmpleadoInput } from '../../../shared/schemas/inputs'
import type { Empleado } from '../../../shared/types/domain'
import { fromCents, toCents, toId } from '../shared'

type EmpleadoRow = Omit<Empleado, 'salario'> & { salarioCentavos: number }

function mapEmpleado(row: EmpleadoRow): Empleado {
  return { ...row, salario: fromCents(row.salarioCentavos) }
}

export function listarEmpleados(): Empleado[] {
  const rows = getDatabase()
    .prepare(
      `SELECT id, nombres, apellidos, telefono, cargo,
              salario_centavos AS salarioCentavos, estado,
              eliminacion_programada_en AS eliminacionProgramadaEn
       FROM empleados
       WHERE eliminacion_programada_en IS NULL OR datetime(eliminacion_programada_en) > datetime('now')
       ORDER BY apellidos, nombres`
    )
    .all() as unknown as EmpleadoRow[]
  return rows.map(mapEmpleado)
}

export function crearEmpleado(input: EmpleadoInput): Empleado {
  const data = parseInput(empleadoInput, input)
  const result = getDatabase()
    .prepare(
      `INSERT INTO empleados (nombres, apellidos, telefono, cargo, salario_centavos)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(data.nombres, data.apellidos, data.telefono, data.cargo, toCents(data.salario))
  const row = getDatabase()
    .prepare(
      `SELECT id, nombres, apellidos, telefono, cargo,
              salario_centavos AS salarioCentavos, estado,
              eliminacion_programada_en AS eliminacionProgramadaEn
       FROM empleados WHERE id = ?`
    )
    .get(toId(result.lastInsertRowid)) as unknown as EmpleadoRow
  return mapEmpleado(row)
}

export function eliminarEmpleado(empleadoId: number): void {
  const result = getDatabase()
    .prepare(
      `UPDATE empleados
       SET estado = 'INACTIVO',
           eliminacion_programada_en = datetime('now', '+24 hours')
       WHERE id = ?`
    )
    .run(empleadoId)
  if (result.changes === 0) throw new Error('Empleado no encontrado')
}

export function cambiarEstadoEmpleado(
  empleadoId: number,
  estado: 'ACTIVO' | 'INACTIVO'
): void {
  const result = getDatabase()
    .prepare(
      `UPDATE empleados
       SET estado = ?,
           eliminacion_programada_en = CASE WHEN ? = 'ACTIVO' THEN NULL ELSE eliminacion_programada_en END
       WHERE id = ?`
    )
    .run(estado, estado, empleadoId)
  if (result.changes === 0) throw new Error('Empleado no encontrado')
}

export function actualizarEmpleado(empleadoId: number, input: EmpleadoInput): Empleado {
  const data = parseInput(empleadoInput, input)
  const result = getDatabase()
    .prepare(
      `UPDATE empleados
       SET nombres = ?, apellidos = ?, telefono = ?, cargo = ?, salario_centavos = ?
       WHERE id = ?`
    )
    .run(
      data.nombres,
      data.apellidos,
      data.telefono,
      data.cargo,
      toCents(data.salario),
      empleadoId
    )
  if (result.changes === 0) throw new Error('Empleado no encontrado')

  const row = getDatabase()
    .prepare(
      `SELECT id, nombres, apellidos, telefono, cargo,
              salario_centavos AS salarioCentavos, estado,
              eliminacion_programada_en AS eliminacionProgramadaEn
       FROM empleados WHERE id = ?`
    )
    .get(empleadoId) as unknown as EmpleadoRow
  return mapEmpleado(row)
}

export function pagarSalario(empleadoId: number): void {
  transaction(() => {
    const empleado = getDatabase()
      .prepare(
        `SELECT id, nombres, apellidos, salario_centavos AS salarioCentavos
         FROM empleados WHERE id = ? AND estado = 'ACTIVO'`
      )
      .get(empleadoId) as
      | { id: number; nombres: string; apellidos: string; salarioCentavos: number }
      | undefined
    if (!empleado) throw new Error('Empleado activo no encontrado')
    if (empleado.salarioCentavos <= 0) throw new Error('El salario debe ser mayor que cero')

    getDatabase()
      .prepare(
        `INSERT INTO movimientos_caja
         (tipo, categoria, concepto, monto_centavos, origen, origen_id)
         VALUES ('EGRESO', 'NÓMINA', ?, ?, 'PAGO_SALARIO', NULL)`
      )
      .run(`Pago de salario - ${empleado.nombres} ${empleado.apellidos}`, empleado.salarioCentavos)
  })
}
