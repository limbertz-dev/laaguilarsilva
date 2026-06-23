import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { Servicio } from '../../../../shared/types/domain'
import { DataTable } from '../../components/ui/DataTable'
import { AppIcon } from '../../components/ui/AppIcon'
import { Modal } from '../../components/ui/Modal'
import { useAppFeedback } from '../../hooks/useAppFeedback'
import { serviciosRepository } from '../../repositories/servicios.repository'
import { inventarioRepository } from '../../repositories/inventario.repository'
import type { Insumo } from '../../../../shared/types/domain'
import { categoriasServicio } from '../../../../shared/schemas/inputs'
import { money } from '../../utils/format'
import { formNumber, formText, parseDecimal } from '../../utils/form'

export function ServiciosPage(): React.JSX.Element {
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingService, setEditingService] = useState<Servicio | null>(null)
  const [serviceToDelete, setServiceToDelete] = useState<Servicio | null>(null)
  const [recipe, setRecipe] = useState<Record<number, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const { showMessage, clearMessage } = useAppFeedback()

  const load = useCallback(async () => {
    const [services, supplies] = await Promise.all([
      serviciosRepository.list(),
      inventarioRepository.list()
    ])
    setServicios(services)
    setInsumos(supplies)
  }, [])

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
      const recipeEntries = Object.entries(recipe).filter(([, quantity]) => quantity.trim() !== '')
      if (recipeEntries.some(([, quantity]) => !Number.isFinite(parseDecimal(quantity)))) {
        throw new Error('El consumo de insumos debe ser un número válido')
      }
      if (recipeEntries.some(([, quantity]) => parseDecimal(quantity) < 0)) {
        throw new Error('El consumo de insumos no puede ser negativo')
      }
      const input = {
        nombre: formText(data, 'nombre'),
        descripcion: formText(data, 'descripcion'),
        categoria: formText(data, 'categoria') as (typeof categoriasServicio)[number],
        precio: formNumber(data, 'precio'),
        insumos: recipeEntries
          .filter(([, quantity]) => parseDecimal(quantity) > 0)
          .map(([insumoId, quantity]) => ({
            insumoId: Number(insumoId),
            cantidad: parseDecimal(quantity)
          }))
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
    setRecipe({})
  }

  const editService = (service: Servicio): void => {
    setEditingService(service)
    setRecipe(
      Object.fromEntries(service.insumos.map((item) => [item.insumoId, String(item.cantidad)]))
    )
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
            setRecipe({})
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
          <fieldset className="recipe-fieldset">
            <legend>
              <span className="recipe-heading-icon">
                <AppIcon name="inventory" size={20} />
              </span>
              <span>
                <strong>Consumo de insumos</strong>
                <small>Define cuánto se utiliza al completar una orden.</small>
              </span>
            </legend>
            {insumos.length === 0 ? (
              <span className="form-help">Primero registre insumos en Inventario.</span>
            ) : (
              <div className="recipe-grid">
                {insumos.map((supply) => {
                  const quantity = recipe[supply.id] ?? ''
                  const isActive = parseDecimal(quantity) > 0

                  return (
                    <label className={`recipe-item ${isActive ? 'active' : ''}`} key={supply.id}>
                      <span className="recipe-item-copy">
                        <strong>{supply.nombre}</strong>
                        <small>
                          Disponible: {supply.stockActual} {supply.unidad}
                        </small>
                      </span>
                      <span className="recipe-quantity">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={quantity}
                          placeholder="0"
                          aria-label={`Cantidad de ${supply.nombre} en ${supply.unidad}`}
                          onChange={(event) => {
                            const value = event.currentTarget.value
                            setRecipe((current) => ({
                              ...current,
                              [supply.id]: value
                            }))
                          }}
                        />
                        <span>{supply.unidad}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
          </fieldset>
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
            <select
              id="servicio-categoria"
              name="categoria"
              defaultValue={editingService?.categoria ?? 'General'}
            >
              {categoriasServicio.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
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

      <DataTable headers={['Servicio', 'Categoría', 'Precio', 'Consumo', 'Estado', 'Acciones']}>
        {servicios.map((item) => (
          <tr
            key={item.id}
            className={item.eliminacionProgramadaEn ? 'service-pending-delete' : undefined}
          >
            <td>{item.nombre}</td>
            <td>{item.categoria}</td>
            <td>{money.format(item.precio)}</td>
            <td>
              {item.insumos.length > 0
                ? item.insumos
                    .map((supply) => `${supply.cantidad} ${supply.unidad} ${supply.nombre}`)
                    .join(', ')
                : 'Sin receta'}
            </td>
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
