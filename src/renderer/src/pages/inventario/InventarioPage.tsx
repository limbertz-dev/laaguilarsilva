import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { Insumo } from '../../../../shared/types/domain'
import { AppSelect } from '../../components/ui/AppSelect'
import { DataTable } from '../../components/ui/DataTable'
import { Modal } from '../../components/ui/Modal'
import { useAppFeedback } from '../../hooks/useAppFeedback'
import { inventarioRepository } from '../../repositories/inventario.repository'
import { formNumber, formText } from '../../utils/form'
import { tiposPaquete } from '../../../../shared/schemas/inputs'

function formatPaquetes(cantidad: number, tipo: string): string {
  const label = cantidad === 1 ? tipo.toLowerCase() : `${tipo.toLowerCase()}s`
  return `${cantidad} ${label}`
}

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
  const purchaseSupplies = useMemo(
    () =>
      visibleSupplies.filter((item) => item.estado === 'ACTIVO' && !item.eliminacionProgramadaEn),
    [visibleSupplies]
  )
  const purchaseSupplyOptions = useMemo(
    () =>
      purchaseSupplies.map((item) => ({
        value: String(item.id),
        label: `${item.nombre} (${formatPaquetes(item.paquetes, item.tipoPaquete)})`
      })),
    [purchaseSupplies]
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
        tipoPaquete: formText(data, 'tipoPaquete') as (typeof tiposPaquete)[number],
        contenido: formText(data, 'contenido'),
        paquetes: formNumber(data, 'paquetes'),
        paquetesMinimo: formNumber(data, 'paquetesMinimo')
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

  const cancelDeletion = async (supply: Insumo): Promise<void> => {
    try {
      clearMessage()
      await inventarioRepository.cambiarEstado(supply.id, 'ACTIVO')
      await load()
      showMessage('Eliminación cancelada')
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
              placeholder="Ej. Jabón en polvo"
              minLength={3}
              maxLength={60}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="insumo-paquete">Tipo de paquete *</label>
            <AppSelect
              id="insumo-paquete"
              name="tipoPaquete"
              key={editingSupply?.id ?? 'nuevo-insumo'}
              defaultValue={editingSupply?.tipoPaquete ?? 'Bolsa'}
              options={tiposPaquete.map((tipo) => ({ value: tipo, label: tipo }))}
            />
          </div>
          <div className="field">
            <label htmlFor="insumo-contenido">Contenido por paquete *</label>
            <input
              id="insumo-contenido"
              name="contenido"
              defaultValue={editingSupply?.contenido}
              placeholder="Ej. 1 kg, 500 ml, 50 unidades"
              maxLength={40}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="insumo-paquetes">Paquetes disponibles *</label>
            <input
              id="insumo-paquetes"
              name="paquetes"
              type="text"
              inputMode="numeric"
              defaultValue={editingSupply?.paquetes ?? 0}
              placeholder="0"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="insumo-minimo">Mínimo de paquetes *</label>
            <input
              id="insumo-minimo"
              name="paquetesMinimo"
              type="text"
              inputMode="numeric"
              defaultValue={editingSupply?.paquetesMinimo ?? 0}
              placeholder="0"
              required
            />
          </div>
          <p className="form-help">
            Registre cuántos paquetes quedan disponibles. Actualícelos manualmente cuando se
            consuman.
          </p>
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
            <AppSelect
              id="compra-insumo"
              name="insumoId"
              key={purchaseSupplyOptions.map((item) => item.value).join('-')}
              defaultValue={purchaseSupplyOptions[0]?.value ?? ''}
              required
              options={purchaseSupplyOptions}
            />
          </div>
          <div className="field">
            <label htmlFor="compra-cantidad">Paquetes comprados *</label>
            <input
              id="compra-cantidad"
              name="cantidad"
              type="text"
              inputMode="numeric"
              defaultValue="1"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="compra-costo">Costo por paquete *</label>
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
            La compra suma paquetes al inventario y registra automáticamente un egreso en caja.
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

      <DataTable headers={['Insumo', 'Paquetes', 'Contenido', 'Mínimo', 'Estado', 'Acciones']}>
        {visibleSupplies.map((item) => (
          <tr
            key={item.id}
            className={item.eliminacionProgramadaEn ? 'service-pending-delete' : undefined}
          >
            <td>{item.nombre}</td>
            <td>{formatPaquetes(item.paquetes, item.tipoPaquete)}</td>
            <td>{item.contenido}</td>
            <td>{item.paquetesMinimo}</td>
            <td>
              {item.eliminacionProgramadaEn ? (
                <span className="record-status inactivo">Eliminando</span>
              ) : item.paquetes <= item.paquetesMinimo ? (
                <span className="record-status stock-critico">Crítico</span>
              ) : (
                <span className="record-status stock-ok">Ok</span>
              )}
            </td>
            <td>
              <div className="actions">
                {item.eliminacionProgramadaEn ? (
                  <button onClick={() => cancelDeletion(item)}>Cancelar eliminación</button>
                ) : (
                  <>
                    <button onClick={() => editSupply(item)}>Editar</button>
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