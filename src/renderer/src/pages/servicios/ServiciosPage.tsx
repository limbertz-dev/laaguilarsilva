import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { Servicio } from '../../../../shared/types/domain'
import { AppSelect } from '../../components/ui/AppSelect'
import { DataTable } from '../../components/ui/DataTable'
import { Modal } from '../../components/ui/Modal'
import { useAppFeedback } from '../../hooks/useAppFeedback'
import { serviciosRepository } from '../../repositories/servicios.repository'
import { categoriasServicio } from '../../../../shared/schemas/inputs'
import { money } from '../../utils/format'
import { formNumber, formText } from '../../utils/form'

export function ServiciosPage(): React.JSX.Element {
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingService, setEditingService] = useState<Servicio | null>(null)
  const [serviceToDelete, setServiceToDelete] = useState<Servicio | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const { showMessage, clearMessage } = useAppFeedback()

  const load = useCallback(async () => setServicios(await serviciosRepository.list()), [])

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
        nombre: formText(data, 'nombre'),
        descripcion: formText(data, 'descripcion'),
        categoria: formText(data, 'categoria') as (typeof categoriasServicio)[number],
        precio: formNumber(data, 'precio')
      }
      if (editingService) {
        await serviciosRepository.update(editingService.id, input)
      } else {
        await serviciosRepository.create(input)
      }
      form.reset()
      setModalOpen(false)
      setEditingService(null)
      showMessage(editingService ? 'Servicio actualizado' : 'Servicio registrado')
      await load()
    } catch (error) {
      showMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setIsSaving(false)
    }
  }

  const closeModal = (): void => {
    setModalOpen(false)
    setEditingService(null)
  }

  const editService = (service: Servicio): void => {
    setEditingService(service)
    setModalOpen(true)
  }

  const changeServiceStatus = async (service: Servicio): Promise<void> => {
    const nextStatus = service.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO'
    const isCancellingDeletion = service.eliminacionProgramadaEn !== null
    try {
      clearMessage()
      await serviciosRepository.changeStatus(service.id, nextStatus)
      await load()
      showMessage(
        isCancellingDeletion
          ? 'Eliminación cancelada'
          : nextStatus === 'ACTIVO'
            ? 'Servicio activado'
            : 'Servicio inactivado'
      )
    } catch (error) {
      showMessage(error instanceof Error ? error.message : String(error))
    }
  }

  const deleteService = async (): Promise<void> => {
    if (!serviceToDelete || isDeleting) return
    setIsDeleting(true)
    try {
      clearMessage()
      await serviciosRepository.delete(serviceToDelete.id)
      setServiceToDelete(null)
      await load()
      showMessage('Servicio eliminado')
    } catch (error) {
      showMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <section>
      <div className="page-actions">
        <button
          onClick={() => {
            setEditingService(null)
            setModalOpen(true)
          }}
        >
          Nuevo servicio
        </button>
      </div>

      <Modal
        open={modalOpen}
        title={editingService ? 'Editar servicio' : 'Registrar servicio'}
        onClose={closeModal}
      >
        <form onSubmit={create}>
          <div className="field">
            <label htmlFor="servicio-nombre">Nombre *</label>
            <input
              id="servicio-nombre"
              name="nombre"
              defaultValue={editingService?.nombre}
              placeholder="Ej. Lavado premium"
              minLength={3}
              maxLength={60}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="servicio-descripcion">Descripción</label>
            <textarea
              id="servicio-descripcion"
              name="descripcion"
              defaultValue={editingService?.descripcion}
              placeholder="Detalle del servicio"
              maxLength={250}
              rows={3}
            />
          </div>
          <div className="field">
            <label htmlFor="servicio-categoria">Categoría</label>
            <AppSelect
              id="servicio-categoria"
              name="categoria"
              key={editingService?.id ?? 'nuevo-servicio'}
              defaultValue={editingService?.categoria ?? 'General'}
              options={categoriasServicio.map((category) => ({
                value: category,
                label: category
              }))}
            />
          </div>
          <div className="field">
            <label htmlFor="servicio-precio">Precio *</label>
            <input
              id="servicio-precio"
              name="precio"
              type="text"
              inputMode="decimal"
              defaultValue={editingService?.precio}
              placeholder="0.00"
              required
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="button-secondary" onClick={closeModal}>
              Cancelar
            </button>
            <button disabled={isSaving}>
              {isSaving ? 'Guardando...' : editingService ? 'Guardar cambios' : 'Guardar servicio'}
            </button>
          </div>
        </form>
      </Modal>

      <DataTable headers={['Servicio', 'Categoría', 'Precio', 'Estado', 'Acciones']}>
        {servicios.map((item) => (
          <tr
            key={item.id}
            className={item.eliminacionProgramadaEn ? 'service-pending-delete' : undefined}
          >
            <td>{item.nombre}</td>
            <td>{item.categoria}</td>
            <td>{money.format(item.precio)}</td>
            <td>
              <span className={`record-status ${item.estado.toLowerCase()}`}>
                {item.estado === 'ACTIVO' ? 'Activo' : 'Inactivo'}
              </span>
            </td>
            <td>
              <div className="actions">
                {item.eliminacionProgramadaEn ? (
                  <button onClick={() => changeServiceStatus(item)}>Cancelar eliminación</button>
                ) : (
                  <>
                    <button onClick={() => editService(item)}>Editar</button>
                    <button
                      className={item.estado === 'ACTIVO' ? 'button-secondary' : ''}
                      onClick={() => changeServiceStatus(item)}
                    >
                      {item.estado === 'ACTIVO' ? 'Inactivar' : 'Activar'}
                    </button>
                    <button className="danger" onClick={() => setServiceToDelete(item)}>
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
        open={serviceToDelete !== null}
        title="Eliminar servicio"
        onClose={() => {
          if (!isDeleting) setServiceToDelete(null)
        }}
      >
        <p>
          ¿Deseas eliminar este servicio
          {serviceToDelete ? ` "${serviceToDelete.nombre}"` : ''}?
        </p>
        <p className="form-help">
          El servicio quedará inactivo inmediatamente y se ocultará del catálogo después de 24
          horas. Durante ese tiempo se verá atenuado en esta tabla.
        </p>
        <div className="modal-actions">
          <button
            type="button"
            className="button-secondary"
            disabled={isDeleting}
            onClick={() => setServiceToDelete(null)}
          >
            Cancelar
          </button>
          <button type="button" className="danger" disabled={isDeleting} onClick={deleteService}>
            {isDeleting ? 'Eliminando...' : 'Eliminar'}
          </button>
        </div>
      </Modal>
    </section>
  )
}