import type { EmpleadoInput } from '../../../shared/schemas/inputs'
import type { EstadoRegistro } from '../../../shared/types/domain'
import { api } from '../lib/api-client'

export const empleadosRepository = {
  list: () => api.empleados.listar(),
  create: (input: EmpleadoInput) => api.empleados.crear(input),
  update: (employeeId: number, input: EmpleadoInput) =>
    api.empleados.actualizar(employeeId, input),
  delete: (employeeId: number) => api.empleados.eliminar(employeeId),
  cambiarEstado: (employeeId: number, estado: EstadoRegistro) =>
    api.empleados.cambiarEstado(employeeId, estado),
  paySalary: (employeeId: number) => api.empleados.pagarSalario(employeeId)
}
