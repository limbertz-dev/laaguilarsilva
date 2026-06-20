import type { EmpleadoInput } from '../../../shared/schemas/inputs'

export const empleadosRepository = {
  list: () => window.api.empleados.listar(),
  create: (input: EmpleadoInput) => window.api.empleados.crear(input),
  update: (employeeId: number, input: EmpleadoInput) =>
    window.api.empleados.actualizar(employeeId, input),
  delete: (employeeId: number) => window.api.empleados.eliminar(employeeId),
  paySalary: (employeeId: number) => window.api.empleados.pagarSalario(employeeId)
}
