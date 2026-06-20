import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { Empleado } from '../../../../shared/types/domain'
import { DataTable } from '../../components/ui/DataTable'
import { Modal } from '../../components/ui/Modal'
import { useAppFeedback } from '../../hooks/useAppFeedback'
import { empleadosRepository } from '../../repositories/empleados.repository'
import { money } from '../../utils/format'
import { formNumber, formText } from '../../utils/form'
import { cargosEmpleado } from '../../../../shared/schemas/inputs'

export function EmpleadosPage(): React.JSX.Element {
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Empleado | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const { showMessage, clearMessage } = useAppFeedback()

  const load = useCallback(async () => setEmpleados(await empleadosRepository.list()), [])

  useEffect(() => {
    clearMessage()
    const timer = window.setTimeout(() => {
      load().catch((error) => showMessage(String(error)))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [clearMessage, load, showMessage])

  const create = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    if (isSaving) return
    setIsSaving(true)
    try {
      clearMessage()
      const input = {
        nombres: formText(data, 'nombres'),
        apellidos: formText(data, 'apellidos'),
        telefono: formText(data, 'telefono'),
        cargo: formText(data, 'cargo') as (typeof cargosEmpleado)[number],
        salario: formNumber(data, 'salario')
      }
      const repeatedPhone = empleados.some(
        (employee) =>
          employee.telefono === input.telefono && employee.id !== editingEmployee?.id
      )
      if (
        repeatedPhone &&
        !window.confirm('Ya existe otro empleado con este teléfono. ¿Deseas continuar?')
      ) {
        return
      }
      if (editingEmployee) {
        await empleadosRepository.update(editingEmployee.id, input)
      } else {
        await empleadosRepository.create(input)
      }
      form.reset()
      setModalOpen(false)
      setEditingEmployee(null)
      showMessage(editingEmployee ? 'Empleado actualizado' : 'Empleado registrado')
      await load()
    } catch (error) {
      showMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setIsSaving(false)
    }
  }

  const closeModal = (): void => {
    setModalOpen(false)
    setEditingEmployee(null)
  }

  const editEmployee = (employee: Empleado): void => {
    setEditingEmployee(employee)
    setModalOpen(true)
  }

  const deleteEmployee = async (employee: Empleado): Promise<void> => {
    if (!window.confirm(`¿Eliminar al empleado ${employee.nombres} ${employee.apellidos}?`)) return
    try {
      clearMessage()
      await empleadosRepository.delete(employee.id)
      await load()
      showMessage('Empleado eliminado')
    } catch (error) {
      showMessage(error instanceof Error ? error.message : String(error))
    }
  }

  const paySalary = async (employeeId: number): Promise<void> => {
    try {
      clearMessage()
      await empleadosRepository.paySalary(employeeId)
      showMessage('Salario registrado en caja')
    } catch (error) {
      showMessage(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <section>
      <div className="page-actions">
        <button
          onClick={() => {
            setEditingEmployee(null)
            setModalOpen(true)
          }}
        >
          Nuevo empleado
        </button>
      </div>

      <Modal
        open={modalOpen}
        title={editingEmployee ? 'Editar empleado' : 'Registrar empleado'}
        onClose={closeModal}
      >
        <form onSubmit={create}>
          <div className="field">
            <label htmlFor="empleado-nombres">Nombres *</label>
            <input
              id="empleado-nombres"
              name="nombres"
              defaultValue={editingEmployee?.nombres}
              minLength={2}
              maxLength={50}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="empleado-apellidos">Apellidos *</label>
            <input
              id="empleado-apellidos"
              name="apellidos"
              defaultValue={editingEmployee?.apellidos}
              minLength={2}
              maxLength={60}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="empleado-telefono">Teléfono *</label>
            <input
              id="empleado-telefono"
              name="telefono"
              defaultValue={editingEmployee?.telefono}
              inputMode="numeric"
              pattern="[0-9]{8}"
              maxLength={8}
              required
            />
            <small>Debe tener 8 dígitos; normalmente comienza con 6 o 7.</small>
          </div>
          <div className="field">
            <label htmlFor="empleado-cargo">Cargo *</label>
            <select
              id="empleado-cargo"
              name="cargo"
              defaultValue={editingEmployee?.cargo ?? 'Lavador'}
              required
            >
              {cargosEmpleado.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="empleado-salario">Salario *</label>
            <input
              id="empleado-salario"
              name="salario"
              type="text"
              inputMode="decimal"
              defaultValue={editingEmployee?.salario}
              placeholder="0.00"
              required
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="button-secondary" onClick={closeModal}>
              Cancelar
            </button>
            <button disabled={isSaving}>
              {isSaving
                ? 'Guardando...'
                : editingEmployee
                  ? 'Guardar cambios'
                  : 'Guardar empleado'}
            </button>
          </div>
        </form>
      </Modal>

      <DataTable
        headers={['Nombres', 'Apellidos', 'Teléfono', 'Cargo', 'Salario', 'Estado', 'Acciones']}
      >
        {empleados.map((item) => (
          <tr key={item.id}>
            <td>{item.nombres}</td>
            <td>{item.apellidos}</td>
            <td>{item.telefono}</td>
            <td>{item.cargo}</td>
            <td>{money.format(item.salario)}</td>
            <td>{item.estado}</td>
            <td>
              <div className="actions">
                <button onClick={() => editEmployee(item)}>Editar</button>
                <button onClick={() => paySalary(item.id)}>Pagar salario</button>
                <button className="danger" onClick={() => deleteEmployee(item)}>
                  Eliminar
                </button>
              </div>
            </td>
          </tr>
        ))}
      </DataTable>
    </section>
  )
}
