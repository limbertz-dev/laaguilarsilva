import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type {
  Empleado,
  Insumo,
  OrdenResumen,
  Servicio,
  Vehiculo
} from '../../../../shared/types/domain'
import { DataTable } from '../../components/ui/DataTable'
import { Modal } from '../../components/ui/Modal'
import { useAppFeedback } from '../../hooks/useAppFeedback'
import { empleadosRepository } from '../../repositories/empleados.repository'
import { inventarioRepository } from '../../repositories/inventario.repository'
import { ordenesRepository } from '../../repositories/ordenes.repository'
import { serviciosRepository } from '../../repositories/servicios.repository'
import { vehiculosRepository } from '../../repositories/vehiculos.repository'
import { money } from '../../utils/format'
import { formNumber, formText, parseDecimal } from '../../utils/form'

function parseDatabaseDate(value: string): Date {
  return new Date(`${value.replace(' ', 'T')}Z`)
}

function localDateKey(value: string): string {
  const date = parseDatabaseDate(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function OrdenesPage(): React.JSX.Element {
  const [ordenes, setOrdenes] = useState<OrdenResumen[]>([])
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([])
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState<OrdenResumen | null>(null)
  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([])
  const [discount, setDiscount] = useState(0)
  const [dateFilter, setDateFilter] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const { showMessage, clearMessage } = useAppFeedback()

  const load = useCallback(async () => {
    const [orders, vehicles, employees, services, supplies] = await Promise.all([
      ordenesRepository.list(),
      vehiculosRepository.list(),
      empleadosRepository.list(),
      serviciosRepository.list(),
      inventarioRepository.list()
    ])
    setOrdenes(orders)
    setVehiculos(vehicles)
    setEmpleados(employees)
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
  const prerequisitesReady =
    vehiculos.length > 0 && empleados.length > 0 && servicios.length > 0

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
        empleadoId: formNumber(data, 'empleadoId'),
        servicioIds: data.getAll('servicioIds').map(Number),
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

  const deleteOrder = async (order: OrdenResumen): Promise<void> => {
    if (!window.confirm(`¿Eliminar definitivamente la orden #${order.id}?`)) return
    try {
      clearMessage()
      await ordenesRepository.delete(order.id)
      await load()
      showMessage('Orden eliminada')
    } catch (error) {
      showMessage(error instanceof Error ? error.message : String(error))
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
            Para crear una orden necesitas al menos un vehículo, empleado y servicio.
          </span>
        )}
      </div>

      <div className="filter-bar">
        <div className="field">
          <label htmlFor="orden-fecha-filtro">Filtrar por día</label>
          <input
            id="orden-fecha-filtro"
            type="date"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.currentTarget.value)}
          />
        </div>
        <button type="button" className="button-secondary" onClick={() => setDateFilter('')}>
          Mostrar todos
        </button>
        <span className="form-help">{filteredOrders.length} orden(es)</span>
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
              {vehiculos.map((item) => (
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
          <div className="field">
            <label htmlFor="orden-empleado">Empleado responsable *</label>
            <select
              id="orden-empleado"
              name="empleadoId"
              defaultValue={editingOrder?.empleadoId ?? ''}
              required
            >
              <option value="">Seleccionar empleado</option>
              {empleados.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nombres} {item.apellidos}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="orden-servicios">Servicios * (puedes seleccionar varios)</label>
            <select
              id="orden-servicios"
              name="servicioIds"
              multiple
              required
              value={selectedServiceIds.map(String)}
              onChange={(event) =>
                setSelectedServiceIds(
                  Array.from(event.currentTarget.selectedOptions, (option) => Number(option.value))
                )
              }
            >
              {servicios.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nombre} — {money.format(item.precio)}
                </option>
              ))}
            </select>
            <small>Usa Ctrl + clic para elegir más de un servicio.</small>
          </div>
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
          '#',
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
            <td>{item.id}</td>
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
                  <button className="danger" onClick={() => deleteOrder(item)}>
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
                <button className="danger" onClick={() => deleteOrder(item)}>
                  Eliminar
                </button>
              )}
            </td>
          </tr>
        ))}
      </DataTable>
    </section>
  )
}
