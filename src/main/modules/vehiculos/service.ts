import { getDatabase } from '../../database/connection'
import { parseInput, vehiculoInput, type VehiculoInput } from '../../../shared/schemas/inputs'
import type { Vehiculo } from '../../../shared/types/domain'
import { toId } from '../shared'

export function listarVehiculos(): Vehiculo[] {
  return getDatabase()
    .prepare(
      `SELECT id, cliente_id AS clienteId, placa, marca, modelo, color, tipo, observaciones
              FROM vehiculos ORDER BY placa`
    )
    .all() as unknown as Vehiculo[]
}

export function crearVehiculo(input: VehiculoInput): Vehiculo {
  const data = parseInput(vehiculoInput, input)
  validarCliente(data.clienteId)
  validarPlacaDisponible(data.placa)
  const result = getDatabase()
    .prepare(
      `INSERT INTO vehiculos
       (cliente_id, placa, marca, modelo, color, tipo, observaciones)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      data.clienteId,
      data.placa,
      data.marca,
      data.modelo,
      data.color,
      data.tipo,
      data.observaciones
    )
  return getDatabase()
    .prepare(
      `SELECT id, cliente_id AS clienteId, placa, marca, modelo, color, tipo, observaciones
       FROM vehiculos WHERE id = ?`
    )
    .get(toId(result.lastInsertRowid)) as unknown as Vehiculo
}

export function actualizarVehiculo(vehiculoId: number, input: VehiculoInput): Vehiculo {
  const data = parseInput(vehiculoInput, input)
  validarCliente(data.clienteId)
  validarPlacaDisponible(data.placa, vehiculoId)

  const result = getDatabase()
    .prepare(
      `UPDATE vehiculos
       SET cliente_id = ?, placa = ?, marca = ?, modelo = ?, color = ?, tipo = ?,
           observaciones = ?
       WHERE id = ?`
    )
    .run(
      data.clienteId,
      data.placa,
      data.marca,
      data.modelo,
      data.color,
      data.tipo,
      data.observaciones,
      vehiculoId
    )
  if (result.changes === 0) throw new Error('Vehículo no encontrado')

  return getDatabase()
    .prepare(
      `SELECT id, cliente_id AS clienteId, placa, marca, modelo, color, tipo, observaciones
       FROM vehiculos WHERE id = ?`
    )
    .get(vehiculoId) as unknown as Vehiculo
}

export function eliminarVehiculo(vehiculoId: number): void {
  const orden = getDatabase()
    .prepare('SELECT 1 FROM ordenes WHERE vehiculo_id = ? LIMIT 1')
    .get(vehiculoId)
  if (orden) {
    throw new Error('No se puede eliminar: el vehículo tiene órdenes registradas')
  }

  const result = getDatabase().prepare('DELETE FROM vehiculos WHERE id = ?').run(vehiculoId)
  if (result.changes === 0) throw new Error('Vehículo no encontrado')
}

function validarCliente(clienteId: number): void {
  const cliente = getDatabase().prepare('SELECT 1 FROM clientes WHERE id = ?').get(clienteId)
  if (!cliente) throw new Error('Cliente propietario no encontrado')
}

function validarPlacaDisponible(placa: string, vehiculoId?: number): void {
  const existente =
    vehiculoId === undefined
      ? getDatabase().prepare('SELECT 1 FROM vehiculos WHERE placa = ?').get(placa)
      : getDatabase()
          .prepare('SELECT 1 FROM vehiculos WHERE placa = ? AND id <> ?')
          .get(placa, vehiculoId)
  if (existente) throw new Error(`Ya existe un vehículo con la placa ${placa}`)
}
