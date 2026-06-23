import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { Insumo } from '../../../../shared/types/domain'
import { DataTable } from '../../components/ui/DataTable'
import { Modal } from '../../components/ui/Modal'
import { useAppFeedback } from '../../hooks/useAppFeedback'
import { inventarioRepository } from '../../repositories/inventario.repository'
import { formNumber, formText } from '../../utils/form'
import { unidadesMedida } from '../../../../shared/schemas/inputs'

export function InventarioPage(): React.JSX.Element {
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [activeModal, setActiveModal] = useState<'insumo' | 'compra' | null>(null)
  const [editingSupply, setEditingSupply] = useState<Insumo | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [supplyToDelete, setSupplyToDelete] = useState<Insumo | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const { showMessage, clearMessage } = useAppFeedback()

  const load = useCallback(async () => setInsumos(await inventarioRepository.list()), [])

  const visibleSupplies = useMemo(
    () =>
      [...insumos].sort((left, right) => {
        const leftPending = left.eliminacionProgramadaEn !== null
        const rightPending = right.eliminacionProgramadaEn !== null
        if (leftPending !== rightPending) return leftPending ? 1 : -1
        if (left.estado !== right.estado) return left.estado === 'ACTIVO' ? -1 : 1
        return left.nombre.localeCompare(right.nombre, 'es')
      }),
    [insumos]
  )

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
        unidad: formText(data, 'unidad') as (typeof unidadesMedida)[number],
        stockMinimo: formNumber(data, 'stockMinimo')
      }
      if (editingSupply) {
        await inventarioRepository.update(editingSupply.id, input)
      } else {
        await inventarioRepository.create(input)
      }
      form.reset()
      setActiveModal(null)
      setEditingSupply(null)
      showMessage(editingSupply ? 'Insumo actualizado' : 'Insumo registrado')
      await load()
    } catch (error) {
      showMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setIsSaving(false)
    }
  }

  const closeSupplyModal = (): void => {
    setActiveModal(null)
    setEditingSupply(null)
  }

  const editSupply = (supply: Insumo): void => {
    setEditingSupply(supply)
    setActiveModal('insumo')
  }

  const deleteSupply = async (): Promise<void> => {
    if (!supplyToDelete || isDeleting) return
    setIsDeleting(true)
    try {
      clearMessage()
      await inventarioRepository.delete(supplyToDelete.id)
      setSupplyToDelete(null)
      await load()
      showMessage('Insumo eliminado')
    } catch (error) {
      showMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setIsDeleting(false)
    }
  }

  const changeSupplyStatus = async (supply: Insumo): Promise<void> => {
    const nextStatus = supply.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO'
    const isCancellingDeletion = supply.eliminacionProgramadaEn !== null
    try {
      clearMessage()
      await inventarioRepository.cambiarEstado(supply.id, nextStatus)
      await load()
      showMessage(
        isCancellingDeletion
          ? 'Eliminación cancelada'
          : nextStatus === 'ACTIVO'
            ? 'Insumo activado'
            : 'Insumo inactivado'
      )
    } catch (error) {
      showMessage(error instanceof Error ? error.message : String(error))
    }
  }

  const purchase = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    if (isConfirming) return
    setIsConfirming(true)
    try {
      clearMessage()
      await inventarioRepository.purchase({
        insumoId: formNumber(data, 'insumoId'),
        cantidad: formNumber(data, 'cantidad'),
        costoUnitario: formNumber(data, 'costoUnitario')
      })
      form.reset()
      setActiveModal(null)
      showMessage('Compra registrada en inventario y caja')
      await load()
    } catch (error) {
      showMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <section>
      <div className="page-actions">
        <button
          onClick={() => {
            setEditingSupply(null)
            setActiveModal('insumo')
          }}
        >
          Nuevo insumo
        </button>
        <button className="button-secondary" onClick={() => setActiveModal('compra')}>
          Registrar compra
        </button>
      </div>

      <Modal
        open={activeModal === 'insumo'}
        title={editingSupply ? 'Editar insumo' : 'Registrar insumo'}
        onClose={closeSupplyModal}
      >
        <form onSubmit={create}>
          <div className="field">
            <label htmlFor="insumo-nombre">Nombre *</label>
            <input
              id="insumo-nombre"
              name="nombre"
              defaultValue={editingSupply?.nombre}
              placeholder="Ej. Detergente concentrado"
              minLength={3}
              maxLength={60}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="insumo-unidad">Unidad de medida *</label>
            <select id="insumo-unidad" name="unidad" defaultValue={editingSupply?.unidad}>
              {unidadesMedida.map((unidad) => (
                <option key={unidad} value={unidad}>
                  {unidad}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="insumo-minimo">Stock mínimo *</label>
            <input
              id="insumo-minimo"
              name="stockMinimo"
              type="text"
              inputMode="decimal"
              defaultValue={editingSupply?.stockMinimo}
              placeholder="0"
              required
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="button-secondary" onClick={closeSupplyModal}>
              Cancelar
            </button>
            <button disabled={isSaving}>
              {isSaving ? 'Guardando...' : editingSupply ? 'Guardar cambios' : 'Guardar insumo'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={activeModal === 'compra'}
        title="Registrar compra"
        onClose={() => setActiveModal(null)}
      >
        <form onSubmit={purchase}>
          <div className="field">
            <label htmlFor="compra-insumo">Insumo *</label>
            <select id="compra-insumo" name="insumoId" required>
              {visibleSupplies
                .filter((item) => item.estado === 'ACTIVO' && !item.eliminacionProgramadaEn)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombre} ({item.unidad})
                  </option>
                ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="compra-cantidad">Cantidad *</label>
            <input
              id="compra-cantidad"
              name="cantidad"
              type="text"
              inputMode="decimal"
              defaultValue="1"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="compra-costo">Costo unitario *</label>
            <input
              id="compra-costo"
              name="costoUnitario"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              required
            />
          </div>
          <p className="form-help">
            La compra aumenta el stock y registra automáticamente un egreso en caja.
          </p>
          <div className="modal-actions">
            <button type="button" className="button-secondary" onClick={() => setActiveModal(null)}>
              Cancelar
            </button>
            <button disabled={isConfirming}>
              {isConfirming ? 'Confirmando...' : 'Confirmar compra'}
            </button>
          </div>
        </form>
      </Modal>

      <DataTable headers={['Insumo', 'Stock', 'Mínimo', 'Estado', 'Acciones']}>
        {visibleSupplies.map((item) => (
          <tr
            key={item.id}
            className={item.eliminacionProgramadaEn ? 'service-pending-delete' : undefined}
          >
            <td>{item.nombre}</td>
            <td>
              {item.stockActual} {item.unidad}
            </td>
            <td>{item.stockMinimo}</td>
            <td>
              {item.eliminacionProgramadaEn
                ? 'ELIMINANDO'
                : item.stockActual <= item.stockMinimo
                  ? 'CRÍTICO'
                  : 'OK'}
            </td>
            <td>
              <div className="actions">
                {item.eliminacionProgramadaEn ? (
                  <button onClick={() => changeSupplyStatus(item)}>Cancelar eliminación</button>
                ) : (
                  <>
                    <button onClick={() => editSupply(item)}>Editar</button>
                    <button
                      className={item.estado === 'ACTIVO' ? 'button-secondary' : ''}
                      onClick={() => changeSupplyStatus(item)}
                    >
                      {item.estado === 'ACTIVO' ? 'Inactivar' : 'Activar'}
                    </button>
                    <button className="danger" onClick={() => setSupplyToDelete(item)}>
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
        open={supplyToDelete !== null}
        title="Eliminar insumo"
        onClose={() => {
          if (!isDeleting) setSupplyToDelete(null)
        }}
      >
        <p>
          ¿Deseas eliminar el insumo
          {supplyToDelete ? ` "${supplyToDelete.nombre}"` : ''}?
        </p>
        <p className="form-help">
          El insumo quedará inactivo inmediatamente y se ocultará del inventario después de 24
          horas. Durante ese tiempo se verá atenuado en esta tabla.
        </p>
        <div className="modal-actions">
          <button
            type="button"
            className="button-secondary"
            disabled={isDeleting}
            onClick={() => setSupplyToDelete(null)}
          >
            Cancelar
          </button>
          <button type="button" className="danger" disabled={isDeleting} onClick={deleteSupply}>
            {isDeleting ? 'Eliminando...' : 'Eliminar'}
          </button>
        </div>
      </Modal>
    </section>
  )
}
