import { getDatabase, transaction } from '../../database/connection'
import {
  clienteConVehiculoInput,
  clienteInput,
  parseInput,
  type ClienteConVehiculoInput,
  type ClienteInput
} from '../../../shared/schemas/inputs'
import type { Cliente, ClienteHistorial } from '../../../shared/types/domain'
import { fromCents, toId } from '../shared'

export function listarClientes(): Cliente[] {
  return getDatabase()
    .prepare('SELECT id, nombre, telefono, creado_en AS creadoEn FROM clientes ORDER BY nombre')
    .all() as unknown as Cliente[]
}

export function crearCliente(input: ClienteInput): Cliente {
  const data = parseInput(clienteInput, input)
  const result = getDatabase()
    .prepare('INSERT INTO clientes (nombre, telefono) VALUES (?, ?)')
    .run(data.nombre, data.telefono)
  return getDatabase()
    .prepare('SELECT id, nombre, telefono, creado_en AS creadoEn FROM clientes WHERE id = ?')
    .get(toId(result.lastInsertRowid)) as unknown as Cliente
}

export function crearClienteConVehiculo(input: ClienteConVehiculoInput): Cliente {
  const data = parseInput(clienteConVehiculoInput, input)

  return transaction(() => {
    const result = getDatabase()
      .prepare('INSERT INTO clientes (nombre, telefono) VALUES (?, ?)')
      .run(data.nombre, data.telefono)
    const clienteId = toId(result.lastInsertRowid)

    if (data.vehiculo) {
      const placaExistente = getDatabase()
        .prepare('SELECT 1 FROM vehiculos WHERE placa = ?')
        .get(data.vehiculo.placa)
      if (placaExistente) {
        throw new Error(`Ya existe un vehículo con la placa ${data.vehiculo.placa}`)
      }

      getDatabase()
        .prepare(
          `INSERT INTO vehiculos
           (cliente_id, placa, marca, modelo, color, tipo, observaciones)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          clienteId,
          data.vehiculo.placa,
          data.vehiculo.marca,
          data.vehiculo.modelo,
          data.vehiculo.color,
          data.vehiculo.tipo,
          data.vehiculo.observaciones
        )
    }

    return getDatabase()
      .prepare('SELECT id, nombre, telefono, creado_en AS creadoEn FROM clientes WHERE id = ?')
      .get(clienteId) as unknown as Cliente
  })
}

export function actualizarCliente(clienteId: number, input: ClienteInput): Cliente {
  const data = parseInput(clienteInput, input)
  const result = getDatabase()
    .prepare('UPDATE clientes SET nombre = ?, telefono = ? WHERE id = ?')
    .run(data.nombre, data.telefono, clienteId)
  if (result.changes === 0) throw new Error('Cliente no encontrado')

  return getDatabase()
    .prepare('SELECT id, nombre, telefono, creado_en AS creadoEn FROM clientes WHERE id = ?')
    .get(clienteId) as unknown as Cliente
}

export function eliminarCliente(clienteId: number): void {
  const vehiculo = getDatabase()
    .prepare('SELECT 1 FROM vehiculos WHERE cliente_id = ? LIMIT 1')
    .get(clienteId)
  if (vehiculo) {
    throw new Error('No se puede eliminar: el cliente tiene vehículos registrados')
  }

  const result = getDatabase().prepare('DELETE FROM clientes WHERE id = ?').run(clienteId)
  if (result.changes === 0) throw new Error('Cliente no encontrado')
}

export function obtenerHistorialCliente(clienteId: number): ClienteHistorial {
  const cliente = getDatabase().prepare('SELECT 1 FROM clientes WHERE id = ?').get(clienteId)
  if (!cliente) throw new Error('Cliente no encontrado')

  const row = getDatabase()
    .prepare(
      `SELECT COUNT(o.id) AS visitas,
              COALESCE(SUM(o.total_centavos), 0) AS totalGastadoCentavos,
              MAX(o.fecha_completada) AS ultimaVisita
       FROM ordenes o
       JOIN vehiculos v ON v.id = o.vehiculo_id
       WHERE v.cliente_id = ? AND o.estado = 'COMPLETADA'`
    )
    .get(clienteId) as {
    visitas: number
    totalGastadoCentavos: number
    ultimaVisita: string | null
  }

  return {
    visitas: row.visitas,
    totalGastado: fromCents(row.totalGastadoCentavos),
    ultimaVisita: row.ultimaVisita
  }
}
