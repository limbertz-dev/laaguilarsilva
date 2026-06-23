import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type {
  Insumo,
  OrdenResumen,
  Servicio,
  Vehiculo
} from '../../../../shared/types/domain'
import { DataTable } from '../../components/ui/DataTable'
import { AppIcon } from '../../components/ui/AppIcon'
import { DatePicker } from '../../components/ui/DatePicker'
import { Modal } from '../../components/ui/Modal'
import { useAppFeedback } from '../../hooks/useAppFeedback'
import { inventarioRepository } from '../../repositories/inventario.repository'
import { ordenesRepository } from '../../repositories/ordenes.repository'
import { serviciosRepository } from '../../repositories/servicios.repository'
import { vehiculosRepository } from '../../repositories/vehiculos.repository'
import { money } from '../../utils/format'
import { formNumber, formText, parseDecimal } from '../../utils/form'
import { dateKey } from '../../utils/date'

function parseDatabaseDate(value: string): Date {
  return new Date(`${value.replace(' ', 'T')}Z`)
}

function localDateKey(value: string): string {
  const date = parseDatabaseDate(value)
  return dateKey(date)
}

export function OrdenesPage(): React.JSX.Element {
  const [ordenes, setOrdenes] = useState<OrdenResumen[]>([])
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState<OrdenResumen | null>(null)
  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([])
  const [discount, setDiscount] = useState(0)
  const [dateFilter, setDateFilter] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [orderToDelete, setOrderToDelete] = useState<OrdenResumen | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const { showMessage, clearMessage } = useAppFeedback()

  const load = useCallback(async () => {
    const [orders, vehicles, services, supplies] = await Promise.all([
      ordenesRepository.list(),
      vehiculosRepository.list(),
      serviciosRepository.list(),
      inventarioRepository.list()
    ])
    setOrdenes(orders)
    setVehiculos(vehicles)
    setServicios(services.filter((service) => service.estado === 'ACTIVO'))
    setInsumos(supplies)
  }, [])

  useEffect(() => {
    clearMessage()
    const timer = window.setTimeout(() => {
      load().catch((error) => showMessage(String(error)))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [clearMessage, load, showMessage])

  const subtotal = useMemo(
    () =>
      servicios
        .filter((service) => selectedServiceIds.includes(service.id))
        .reduce((total, service) => total + service.precio, 0),
    [selectedServiceIds, servicios]
  )
  const total = Math.max(0, subtotal - discount)
  const requiredSupplies = useMemo(() => {
    const quantities = new Map<number, number>()
    servicios
      .filter((service) => selectedServiceIds.includes(service.id))
      .flatMap((service) => service.insumos)
      .forEach((item) => {
        quantities.set(item.insumoId, (quantities.get(item.insumoId) ?? 0) + item.cantidad)
      })
    return [...quantities.entries()].map(([insumoId, cantidad]) => {
      const supply = insumos.find((item) => item.id === insumoId)
      return {
        insumoId,
        nombre: supply?.nombre ?? 'Insumo no disponible',
        unidad: supply?.unidad ?? '',
        cantidad,
        stockActual: supply?.stockActual ?? 0,
        suficiente: Boolean(supply && supply.stockActual >= cantidad)
      }
    })
  }, [insumos, selectedServiceIds, servicios])
  const filteredOrders = useMemo(
    () =>
      dateFilter
        ? ordenes.filter((order) => localDateKey(order.fechaIngreso) === dateFilter)
        : ordenes,
    [dateFilter, ordenes]
  )
  const prerequisitesReady = vehiculos.length > 0 && servicios.length > 0

  const closeModal = (): void => {
    setModalOpen(false)
    setEditingOrder(null)
    setSelectedServiceIds([])
    setDiscount(0)
  }

  const newOrder = (): void => {
    setEditingOrder(null)
    setSelectedServiceIds([])
    setDiscount(0)
    setModalOpen(true)
  }

  const editOrder = (order: OrdenResumen): void => {
    setEditingOrder(order)
    setSelectedServiceIds(order.servicioIds)
    setDiscount(order.descuento)
    setModalOpen(true)
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
        vehiculoId: formNumber(data, 'vehiculoId'),
        servicioIds: selectedServiceIds,
        descuento: formNumber(data, 'descuento'),
        metodoPago: formText(data, 'metodoPago') as 'EFECTIVO' | 'QR' | 'TRANSFERENCIA'
      }
      if (editingOrder) {
        await ordenesRepository.update(editingOrder.id, input)
      } else {
        await ordenesRepository.create(input)
      }
      form.reset()
      closeModal()
      showMessage(editingOrder ? 'Orden actualizada' : 'Orden creada')
      await load()
    } catch (error) {
      showMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setIsSaving(false)
    }
  }

  const updateStatus = async (
    operation: () => Promise<void>,
    successMessage: string
  ): Promise<void> => {
    try {
      clearMessage()
      await operation()
      await load()
      showMessage(successMessage)
    } catch (error) {
      showMessage(error instanceof Error ? error.message : String(error))
    }
  }

  const deleteOrder = async (): Promise<void> => {
    if (!orderToDelete || isDeleting) return
    setIsDeleting(true)
    try {
      clearMessage()
      await ordenesRepository.delete(orderToDelete.id)
      setOrderToDelete(null)
      await load()
      showMessage('Orden eliminada')
    } catch (error) {
      showMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <section>
      <div className="page-actions">
        <button disabled={!prerequisitesReady} onClick={newOrder}>
          Nueva orden
        </button>
        {!prerequisitesReady && (
          <span className="form-help">
            Para crear una orden necesitas al menos un vehículo y un servicio.
          </span>
        )}
      </div>

      <div className="order-date-filter">
        <div className="order-date-filter-heading">
          <span className="order-date-filter-icon">
            <AppIcon name="calendar" size={21} />
          </span>
          <span>
            <strong>Filtrar órdenes por día</strong>
            <small>Selecciona una fecha para consultar su actividad.</small>
          </span>
        </div>
        <div className="order-date-filter-controls">
          <DatePicker
            value={dateFilter}
            onChange={setDateFilter}
            label="Fecha seleccionada"
          />
          <span className="order-date-result">
            <strong>{filteredOrders.length}</strong>
            <span>orden(es)</span>
          </span>
        </div>
      </div>

      <Modal
        open={modalOpen}
        title={editingOrder ? `Editar orden #${editingOrder.id}` : 'Crear orden de lavado'}
        onClose={closeModal}
      >
        <form onSubmit={create}>
          <div className="field">
            <label htmlFor="orden-vehiculo">Vehículo *</label>
            <select
              id="orden-vehiculo"
              name="vehiculoId"
              defaultValue={editingOrder?.vehiculoId ?? ''}
              required
            >
              <option value="">Seleccionar vehículo</option>
              {vehiculos.filter((item) => item.estado === 'ACTIVO').map((item) => (
                <option key={item.id} value={item.id}>
                  {item.placa} — {item.marca} {item.modelo}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="orden-metodo-pago">Método de pago *</label>
            <select
              id="orden-metodo-pago"
              name="metodoPago"
              defaultValue={editingOrder?.metodoPago ?? 'EFECTIVO'}
              required
            >
              <option value="EFECTIVO">Efectivo</option>
              <option value="QR">QR</option>
              <option value="TRANSFERENCIA">Transferencia</option>
            </select>
          </div>
          <fieldset className="order-services-fieldset">
            <legend>
              <span className="order-services-heading">
                <span className="order-services-heading-icon">
                  <AppIcon name="services" size={20} />
                </span>
                <span>
                  <strong>Servicios</strong>
                  <small>Puedes seleccionar uno o varios.</small>
                </span>
              </span>
              <span className="order-services-count">
                {selectedServiceIds.length} seleccionado(s)
              </span>
            </legend>
            <div className="order-services-grid">
              {servicios.map((item) => {
                const selected = selectedServiceIds.includes(item.id)

                return (
                  <button
                    className={`order-service-card ${selected ? 'selected' : ''}`}
                    type="button"
                    role="checkbox"
                    aria-checked={selected}
                    key={item.id}
                    onClick={() =>
                      setSelectedServiceIds((current) =>
                        current.includes(item.id)
                          ? current.filter((serviceId) => serviceId !== item.id)
                          : [...current, item.id]
                      )
                    }
                  >
                    <span className="order-service-icon">
                      <AppIcon name="services" size={19} />
                    </span>
                    <span className="order-service-copy">
                      <strong>{item.nombre}</strong>
                      <small>{item.categoria}</small>
                    </span>
                    <span className="order-service-price">{money.format(item.precio)}</span>
                    <span className="order-service-check" aria-hidden="true">
                      {selected ? '✓' : ''}
                    </span>
                  </button>
                )
              })}
            </div>
          </fieldset>
          {selectedServiceIds.length > 0 && (
            <div className="order-supplies">
              <strong>Insumos requeridos</strong>
              {requiredSupplies.length > 0 ? (
                requiredSupplies.map((item) => (
                  <div
                    className={item.suficiente ? 'available' : 'insufficient'}
                    key={item.insumoId}
                  >
                    <span>{item.nombre}</span>
                    <span>
                      Requiere {item.cantidad} {item.unidad} · Disponible {item.stockActual}{' '}
                      {item.unidad}
                    </span>
                  </div>
                ))
              ) : (
                <span className="form-help">Los servicios seleccionados no consumen insumos.</span>
              )}
              {requiredSupplies.some((item) => !item.suficiente) && (
                <small className="stock-warning">
                  Falta stock. Puedes guardar la orden, pero no marcarla como lista hasta reponerlo.
                </small>
              )}
            </div>
          )}
          <div className="field">
            <label htmlFor="orden-descuento">Descuento</label>
            <input
              id="orden-descuento"
              name="descuento"
              type="text"
              inputMode="decimal"
              value={discount}
              onChange={(event) => setDiscount(parseDecimal(event.currentTarget.value) || 0)}
            />
            <small>El descuento no puede superar el subtotal.</small>
          </div>
          <div className="test-summary" aria-label="Resumen de importes">
            <span>
              Subtotal
              <strong>{money.format(subtotal)}</strong>
            </span>
            <span>
              Descuento
              <strong>{money.format(discount)}</strong>
            </span>
            <span>
              Total
              <strong>{money.format(total)}</strong>
            </span>
          </div>
          <div className="modal-actions">
            <button type="button" className="button-secondary" onClick={closeModal}>
              Cancelar
            </button>
            <button
              disabled={isSaving || selectedServiceIds.length === 0 || discount > subtotal}
            >
              {isSaving ? 'Guardando...' : editingOrder ? 'Guardar cambios' : 'Crear orden'}
            </button>
          </div>
        </form>
      </Modal>

      <DataTable
        headers={[
          'Fecha',
          'Cliente',
          'Placa',
          'Pago',
          'Total',
          'Estado',
          'Acciones'
        ]}
      >
        {filteredOrders.map((item) => (
          <tr key={item.id}>
            <td>{parseDatabaseDate(item.fechaIngreso).toLocaleString()}</td>
            <td>{item.cliente}</td>
            <td>{item.placa}</td>
            <td>{item.metodoPago}</td>
            <td>{money.format(item.total)}</td>
            <td>
              <span className={`order-status ${item.estadoOperativo.toLowerCase()}`}>
                {item.estadoOperativo.replace('_', ' ')}
              </span>
            </td>
            <td>
              {item.estadoOperativo === 'RECIBIDO' && (
                <div className="actions">
                  <button onClick={() => editOrder(item)}>Editar</button>
                  <button
                    onClick={() =>
                      updateStatus(() => ordenesRepository.start(item.id), 'Orden en proceso')
                    }
                  >
                    Iniciar
                  </button>
                  <button
                    className="danger"
                    onClick={() =>
                      updateStatus(() => ordenesRepository.cancel(item.id), 'Orden cancelada')
                    }
                  >
                    Cancelar
                  </button>
                  <button className="danger" onClick={() => setOrderToDelete(item)}>
                    Eliminar
                  </button>
                </div>
              )}
              {item.estadoOperativo === 'EN_PROCESO' && (
                <div className="actions">
                  <button
                    onClick={() =>
                      updateStatus(
                        () => ordenesRepository.markReady(item.id),
                        'Vehículo listo para entregar'
                      )
                    }
                  >
                    Marcar listo
                  </button>
                  <button
                    className="danger"
                    onClick={() =>
                      updateStatus(() => ordenesRepository.cancel(item.id), 'Orden cancelada')
                    }
                  >
                    Cancelar
                  </button>
                </div>
              )}
              {item.estadoOperativo === 'LISTO' && (
                <button
                  onClick={() =>
                    updateStatus(
                      () => ordenesRepository.deliver(item.id),
                      'Vehículo entregado y cobrado'
                    )
                  }
                >
                  Entregar y cobrar
                </button>
              )}
              {item.estadoOperativo === 'CANCELADO' && (
                <button className="danger" onClick={() => setOrderToDelete(item)}>
                  Eliminar
                </button>
              )}
            </td>
          </tr>
        ))}
      </DataTable>

      <Modal
        open={orderToDelete !== null}
        title="Eliminar orden"
        onClose={() => {
          if (!isDeleting) setOrderToDelete(null)
        }}
      >
        <p>
          ¿Deseas eliminar definitivamente la orden
          {orderToDelete ? ` #${orderToDelete.id}` : ''}?
        </p>
        <p className="form-help">Esta acción no se puede deshacer.</p>
        <div className="modal-actions">
          <button
            type="button"
            className="button-secondary"
            disabled={isDeleting}
            onClick={() => setOrderToDelete(null)}
          >
            Cancelar
          </button>
          <button type="button" className="danger" disabled={isDeleting} onClick={deleteOrder}>
            {isDeleting ? 'Eliminando...' : 'Eliminar'}
          </button>
        </div>
      </Modal>
    </section>
  )
}
