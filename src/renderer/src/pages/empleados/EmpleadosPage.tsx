import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { Empleado } from '../../../../shared/types/domain'
import { AppSelect } from '../../components/ui/AppSelect'
import { DataTable } from '../../components/ui/DataTable'
import { Modal } from '../../components/ui/Modal'
import { useAppFeedback } from '../../hooks/useAppFeedback'
import { empleadosRepository } from '../../repositories/empleados.repository'
import { money } from '../../utils/format'
import { formNumber, formText } from '../../utils/form'
import { cargosEmpleado, tipoPagoEmpleado } from '../../../../shared/schemas/inputs'

type EmployeeFormInput = {
  nombres: string
  apellidos: string
  telefono: string
  cargo: (typeof cargosEmpleado)[number]
  salario: number
  tipoPago: (typeof tipoPagoEmpleado)[number]
}

export function EmpleadosPage(): React.JSX.Element {
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Empleado | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [employeeToDelete, setEmployeeToDelete] = useState<Empleado | null>(null)
  const [duplicatePhoneInput, setDuplicatePhoneInput] = useState<EmployeeFormInput | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [employeeToPay, setEmployeeToPay] = useState<Empleado | null>(null)
  const [isPaying, setIsPaying] = useState(false)
  const { showMessage, clearMessage } = useAppFeedback()

  const load = useCallback(async () => setEmpleados(await empleadosRepository.list()), [])

  useEffect(() => {
    clearMessage()
    const timer = window.setTimeout(() => {
      load().catch((error) => showMessage(String(error)))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [clearMessage, load, showMessage])

  const persistEmployee = async (input: EmployeeFormInput): Promise<void> => {
    if (editingEmployee) {
      await empleadosRepository.update(editingEmployee.id, input)
    } else {
      await empleadosRepository.create(input)
    }
    setModalOpen(false)
    setEditingEmployee(null)
    showMessage(editingEmployee ? 'Empleado actualizado' : 'Empleado registrado')
    await load()
  }

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
        salario: formNumber(data, 'salario'),
        tipoPago: formText(data, 'tipoPago') as (typeof tipoPagoEmpleado)[number]
      }
      const repeatedPhone = empleados.some(
        (employee) => employee.telefono === input.telefono && employee.id !== editingEmployee?.id
      )
      if (repeatedPhone) {
        setDuplicatePhoneInput(input)
        return
      }
      await persistEmployee(input)
      form.reset()
    } catch (error) {
      showMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setIsSaving(false)
    }
  }

  const confirmDuplicatePhone = async (): Promise<void> => {
    if (!duplicatePhoneInput || isSaving) return
    setIsSaving(true)
    try {
      clearMessage()
      await persistEmployee(duplicatePhoneInput)
      setDuplicatePhoneInput(null)
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

  const deleteEmployee = async (): Promise<void> => {
    if (!employeeToDelete || isDeleting) return
    setIsDeleting(true)
    try {
      clearMessage()
      await empleadosRepository.delete(employeeToDelete.id)
      setEmployeeToDelete(null)
      await load()
      showMessage('Empleado eliminado')
    } catch (error) {
      showMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setIsDeleting(false)
    }
  }

  const changeEmployeeStatus = async (employee: Empleado): Promise<void> => {
    const nextStatus = employee.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO'
    const isCancellingDeletion = employee.eliminacionProgramadaEn !== null
    try {
      clearMessage()
      await empleadosRepository.cambiarEstado(employee.id, nextStatus)
      await load()
      showMessage(
        isCancellingDeletion
          ? 'Eliminación cancelada'
          : nextStatus === 'ACTIVO'
            ? 'Empleado activado'
            : 'Empleado inactivado'
      )
    } catch (error) {
      showMessage(error instanceof Error ? error.message : String(error))
    }
  }

  const confirmPaySalary = async (): Promise<void> => {
    if (!employeeToPay || isPaying) return
    setIsPaying(true)
    try {
      clearMessage()
      await empleadosRepository.paySalary(employeeToPay.id)
      setEmployeeToPay(null)
      showMessage('Salario registrado en caja')
    } catch (error) {
      showMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setIsPaying(false)
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
              placeholder="Ej. Juan"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="empleado-apellidos">Apellidos *</label>
            <input
              id="empleado-apellidos"
              name="apellidos"
              defaultValue={editingEmployee?.apellidos}
              placeholder="Ej. Pérez"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="empleado-telefono">Teléfono *</label>
            <input
              id="empleado-telefono"
              name="telefono"
              type="tel"
              defaultValue={editingEmployee?.telefono}
              placeholder="Ej. 70000000"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="empleado-cargo">Cargo *</label>
            <AppSelect
              id="empleado-cargo"
              name="cargo"
              key={editingEmployee?.id ?? 'nuevo-empleado'}
              defaultValue={editingEmployee?.cargo ?? 'Lavador'}
              required
              options={cargosEmpleado.map((cargo) => ({ value: cargo, label: cargo }))}
            />
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
          <div className="field">
            <label htmlFor="empleado-tipo-pago">Tipo de pago *</label>
            <AppSelect
              id="empleado-tipo-pago"
              name="tipoPago"
              key={`pago-${editingEmployee?.id ?? 'nuevo-empleado'}`}
              defaultValue={editingEmployee?.tipoPago ?? 'Mes'}
              required
              options={tipoPagoEmpleado.map((tipo) => ({
                value: tipo,
                label:
                  tipo === 'Día'
                    ? 'Por día'
                    : tipo === 'Semana'
                      ? 'Por semana'
                      : tipo === 'Quincena'
                        ? 'Por quincena'
                        : 'Por mes'
              }))}
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="button-secondary" onClick={closeModal}>
              Cancelar
            </button>
            <button disabled={isSaving}>
              {isSaving ? 'Guardando...' : editingEmployee ? 'Guardar cambios' : 'Guardar empleado'}
            </button>
          </div>
        </form>
      </Modal>

      <DataTable
        headers={['Nombres', 'Apellidos', 'Teléfono', 'Cargo', 'Salario', 'Acciones']}
      >
        {empleados.map((item) => (
          <tr
            key={item.id}
            className={item.eliminacionProgramadaEn ? 'service-pending-delete' : undefined}
          >
            <td>{item.nombres}</td>
            <td>{item.apellidos}</td>
            <td>{item.telefono}</td>
            <td>{item.cargo}</td>
            <td>{money.format(item.salario)}</td>
            <td>
              <div className="actions">
                {item.eliminacionProgramadaEn ? (
                  <button onClick={() => changeEmployeeStatus(item)}>Cancelar eliminación</button>
                ) : (
                  <>
                    <button onClick={() => editEmployee(item)}>Editar</button>
                    <button onClick={() => setEmployeeToPay(item)}>Pagar salario</button>
                    <button className="danger" onClick={() => setEmployeeToDelete(item)}>
                      Eliminar
                    </button>
                  </>
                )}
              </div>
            </td>
          </tr>
        ))}
      </DataTable>

      <Modal
        open={duplicatePhoneInput !== null}
        title="Teléfono duplicado"
        onClose={() => {
          if (!isSaving) setDuplicatePhoneInput(null)
        }}
      >
        <p>Ya existe otro empleado con este teléfono. ¿Deseas continuar?</p>
        <div className="modal-actions">
          <button
            type="button"
            className="button-secondary"
            disabled={isSaving}
            onClick={() => setDuplicatePhoneInput(null)}
          >
            Cancelar
          </button>
          <button type="button" disabled={isSaving} onClick={confirmDuplicatePhone}>
            {isSaving ? 'Guardando...' : 'Continuar'}
          </button>
        </div>
      </Modal>

      <Modal
        open={employeeToDelete !== null}
        title="Eliminar empleado"
        onClose={() => {
          if (!isDeleting) setEmployeeToDelete(null)
        }}
      >
        <p>
          ¿Deseas eliminar al empleado
          {employeeToDelete ? ` "${employeeToDelete.nombres} ${employeeToDelete.apellidos}"` : ''}?
        </p>
        <p className="form-help">
          El empleado quedará inactivo inmediatamente y se ocultará después de 24 horas. Durante ese
          tiempo se verá atenuado en esta tabla.
        </p>
        <div className="modal-actions">
          <button
            type="button"
            className="button-secondary"
            disabled={isDeleting}
            onClick={() => setEmployeeToDelete(null)}
          >
            Cancelar
          </button>
          <button type="button" className="danger" disabled={isDeleting} onClick={deleteEmployee}>
            {isDeleting ? 'Eliminando...' : 'Eliminar'}
          </button>
        </div>
      </Modal>

      <Modal
        open={employeeToPay !== null}
        title="Pagar salario"
        onClose={() => {
          if (!isPaying) setEmployeeToPay(null)
        }}
      >
        <p>
          ¿Estás seguro de pagar el salario a
          {employeeToPay ? ` "${employeeToPay.nombres} ${employeeToPay.apellidos}"` : ''}?
        </p>
        <div className="modal-actions">
          <button
            type="button"
            className="button-secondary"
            disabled={isPaying}
            onClick={() => setEmployeeToPay(null)}
          >
            Cancelar
          </button>
          <button type="button" disabled={isPaying} onClick={confirmPaySalary}>
            {isPaying ? 'Pagando...' : 'Pagar'}
          </button>
        </div>
      </Modal>
    </section>
  )
}
