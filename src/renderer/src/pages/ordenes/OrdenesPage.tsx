import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { Cliente, OrdenResumen, Servicio, Vehiculo } from '../../../../shared/types/domain'
import { AppIcon } from '../../components/ui/AppIcon'
import { AppSelect } from '../../components/ui/AppSelect'
import { DataTable } from '../../components/ui/DataTable'
import { DatePicker } from '../../components/ui/DatePicker'
import { Modal } from '../../components/ui/Modal'
import { VehicleSearchPicker } from '../../components/ui/VehicleSearchPicker'
import { useAppFeedback } from '../../hooks/useAppFeedback'
import { clientesRepository } from '../../repositories/clientes.repository'
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
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState<OrdenResumen | null>(null)
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([])
  const [discount, setDiscount] = useState(0)
  const [dateFilter, setDateFilter] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [orderToDelete, setOrderToDelete] = useState<OrdenResumen | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const { showMessage, clearMessage } = useAppFeedback()

  const load = useCallback(async () => {
    const [orders, clients, vehicles, services] = await Promise.all([
      ordenesRepository.list(),
      clientesRepository.list(),
      vehiculosRepository.list(),
      serviciosRepository.list()
    ])
    setOrdenes(orders)
    setClientes(clients)
    setVehiculos(vehicles)
    setServicios(services.filter((service) => service.estado === 'ACTIVO'))
  }, [])

  const clientNames = useMemo(
    () => Object.fromEntries(clientes.map((client) => [client.id, client.nombre])),
    [clientes]
  )

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
    setSelectedVehicleId('')
    setSelectedServiceIds([])
    setDiscount(0)
  }

  const newOrder = (): void => {
    setEditingOrder(null)
    setSelectedVehicleId('')
    setSelectedServiceIds([])
    setDiscount(0)
    setModalOpen(true)
  }

  const editOrder = (order: OrdenResumen): void => {
    setEditingOrder(order)
    setSelectedVehicleId(String(order.vehiculoId))
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
      const vehiculoId = Number(selectedVehicleId)
      if (!vehiculoId) {
        showMessage('Selecciona un vehículo para continuar')
        return
      }
      const input = {
        vehiculoId,
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
            <VehicleSearchPicker
              id="orden-vehiculo"
              name="vehiculoId"
              key={editingOrder?.id ?? 'nueva-orden'}
              value={selectedVehicleId}
              onChange={setSelectedVehicleId}
              vehicles={vehiculos}
              clientNames={clientNames}
              required
              placeholder="Escribe la placa del vehículo"
            />
            <small>Busca por placa. Se muestran hasta 10 coincidencias.</small>
          </div>
          <div className="field">
            <label htmlFor="orden-metodo-pago">Método de pago *</label>
            <AppSelect
              id="orden-metodo-pago"
              name="metodoPago"
              key={`pago-${editingOrder?.id ?? 'nueva-orden'}`}
              defaultValue={editingOrder?.metodoPago ?? 'EFECTIVO'}
              required
              options={[
                { value: 'EFECTIVO', label: 'Efectivo' },
                { value: 'QR', label: 'QR' },
                { value: 'TRANSFERENCIA', label: 'Transferencia' }
              ]}
            />
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
                      <AppIcon name="services" size={15} />
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
              disabled={
                isSaving ||
                !selectedVehicleId ||
                selectedServiceIds.length === 0 ||
                discount > subtotal
              }
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
                      updateStatus(
                        () => ordenesRepository.revertStart(item.id),
                        'Orden devuelta a recibido'
                      )
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
