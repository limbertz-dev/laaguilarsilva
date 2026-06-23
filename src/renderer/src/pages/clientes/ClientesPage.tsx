import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { Cliente, ClienteHistorial, Vehiculo } from '../../../../shared/types/domain'
import { DataTable } from '../../components/ui/DataTable'
import { Modal } from '../../components/ui/Modal'
import { useAppFeedback } from '../../hooks/useAppFeedback'
import { clientesRepository } from '../../repositories/clientes.repository'
import { vehiculosRepository } from '../../repositories/vehiculos.repository'
import { money } from '../../utils/format'
import { formNumber, formText } from '../../utils/form'
import { tiposVehiculo } from '../../../../shared/schemas/inputs'

type ActiveModal = 'cliente' | 'vehiculo' | 'detalleVehiculo' | null

export function ClientesPage(): React.JSX.Element {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([])
  const [activeModal, setActiveModal] = useState<ActiveModal>(null)
  const [editingClient, setEditingClient] = useState<Cliente | null>(null)
  const [registerVehicleWithClient, setRegisterVehicleWithClient] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehiculo | null>(null)
  const [selectedVehicle, setSelectedVehicle] = useState<Vehiculo | null>(null)
  const [clientHistories, setClientHistories] = useState<Record<number, ClienteHistorial>>({})
  const [clientFilter, setClientFilter] = useState('')
  const [vehicleFilter, setVehicleFilter] = useState('')
  const [vehiclePresence, setVehiclePresence] = useState('TODOS')
  const [vehicleOwnerId, setVehicleOwnerId] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [clientToDelete, setClientToDelete] = useState<Cliente | null>(null)
  const [isDeletingClient, setIsDeletingClient] = useState(false)
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehiculo | null>(null)
  const [isDeletingVehicle, setIsDeletingVehicle] = useState(false)
  const { showMessage, clearMessage } = useAppFeedback()

  const load = useCallback(async () => {
    const [clients, vehicles] = await Promise.all([
      clientesRepository.list(),
      vehiculosRepository.list()
    ])
    const histories = await Promise.all(
      clients.map(
        async (client) => [client.id, await clientesRepository.history(client.id)] as const
      )
    )
    setClientes(clients)
    setVehiculos(vehicles)
    setClientHistories(Object.fromEntries(histories))
  }, [])

  useEffect(() => {
    clearMessage()
    const timer = window.setTimeout(() => {
      load().catch((error) => showMessage(String(error)))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [clearMessage, load, showMessage])

  const filteredClients = useMemo(() => {
    const clientQuery = clientFilter.trim().toLocaleLowerCase()
    const vehicleQuery = vehicleFilter.trim().toLocaleLowerCase()

    return clientes.filter((client) => {
      const clientVehicles = vehiculos.filter((vehicle) => vehicle.clienteId === client.id)
      const matchesClient =
        !clientQuery ||
        client.nombre.toLocaleLowerCase().includes(clientQuery) ||
        client.telefono.toLocaleLowerCase().includes(clientQuery)
      const matchesVehicle =
        !vehicleQuery ||
        clientVehicles.some((vehicle) =>
          [vehicle.placa, vehicle.marca, vehicle.modelo, vehicle.color, vehicle.tipo].some(
            (value) => value.toLocaleLowerCase().includes(vehicleQuery)
          )
        )
      const matchesPresence =
        vehiclePresence === 'TODOS' ||
        (vehiclePresence === 'CON_VEHICULOS' && clientVehicles.length > 0) ||
        (vehiclePresence === 'SIN_VEHICULOS' && clientVehicles.length === 0)

      return matchesClient && matchesVehicle && matchesPresence
    })
  }, [clientFilter, clientes, vehicleFilter, vehiclePresence, vehiculos])

  const visibleVehicleCount = useMemo(
    () =>
      filteredClients.reduce(
        (total, client) =>
          total + vehiculos.filter((vehicle) => vehicle.clienteId === client.id).length,
        0
      ),
    [filteredClients, vehiculos]
  )

  const saveClient = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    if (isSaving) return
    setIsSaving(true)
    try {
      clearMessage()
      const input = {
        nombre: formText(data, 'nombre'),
        telefono: formText(data, 'telefono')
      }
      if (editingClient) {
        await clientesRepository.update(editingClient.id, input)
      } else {
        await clientesRepository.createWithVehicle({
          ...input,
          vehiculo: registerVehicleWithClient
            ? {
                placa: formText(data, 'vehiculoPlaca'),
                marca: formText(data, 'vehiculoMarca'),
                modelo: formText(data, 'vehiculoModelo'),
                color: formText(data, 'vehiculoColor'),
                tipo: formText(data, 'vehiculoTipo') as (typeof tiposVehiculo)[number],
                observaciones: formText(data, 'vehiculoObservaciones')
              }
            : undefined
        })
      }
      form.reset()
      closeClientModal()
      showMessage(editingClient ? 'Cliente actualizado' : 'Cliente registrado')
      await load()
    } catch (error) {
      showMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setIsSaving(false)
    }
  }

  const saveVehicle = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    if (isSaving) return
    setIsSaving(true)
    try {
      clearMessage()
      const input = {
        clienteId: formNumber(data, 'clienteId'),
        placa: formText(data, 'placa'),
        marca: formText(data, 'marca'),
        modelo: formText(data, 'modelo'),
        color: formText(data, 'color'),
        tipo: formText(data, 'tipo') as (typeof tiposVehiculo)[number],
        observaciones: formText(data, 'observaciones')
      }
      if (editingVehicle) {
        await vehiculosRepository.update(editingVehicle.id, input)
      } else {
        await vehiculosRepository.create(input)
      }
      form.reset()
      closeVehicleModal()
      showMessage(editingVehicle ? 'Vehículo actualizado' : 'Vehículo registrado')
      await load()
    } catch (error) {
      showMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setIsSaving(false)
    }
  }

  const openClientModal = (client?: Cliente): void => {
    setEditingClient(client ?? null)
    setRegisterVehicleWithClient(false)
    setActiveModal('cliente')
  }

  const closeClientModal = (): void => {
    setActiveModal(null)
    setEditingClient(null)
    setRegisterVehicleWithClient(false)
  }

  const openVehicleModal = (clientId?: number): void => {
    setEditingVehicle(null)
    setVehicleOwnerId(clientId ? String(clientId) : '')
    setActiveModal('vehiculo')
  }

  const editVehicle = (vehicle: Vehiculo): void => {
    setSelectedVehicle(null)
    setEditingVehicle(vehicle)
    setVehicleOwnerId(String(vehicle.clienteId))
    setActiveModal('vehiculo')
  }

  const viewVehicle = (vehicle: Vehiculo): void => {
    setSelectedVehicle(vehicle)
    setActiveModal('detalleVehiculo')
  }

  const closeVehicleDetails = (): void => {
    setActiveModal(null)
    setSelectedVehicle(null)
  }

  const closeVehicleModal = (): void => {
    setActiveModal(null)
    setEditingVehicle(null)
    setVehicleOwnerId('')
  }

  const deleteClient = (client: Cliente): void => {
    setClientToDelete(client)
  }

  const deleteClientConfirmed = async (): Promise<void> => {
    if (!clientToDelete || isDeletingClient) return
    setIsDeletingClient(true)
    try {
      clearMessage()
      await clientesRepository.delete(clientToDelete.id)
      setClientToDelete(null)
      await load()
      showMessage('Cliente en proceso de eliminación')
    } catch (error) {
      showMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setIsDeletingClient(false)
    }
  }

  const cancelClientDeletion = async (client: Cliente): Promise<void> => {
    try {
      clearMessage()
      await clientesRepository.cancelarEliminacion(client.id)
      await load()
      showMessage('Eliminación de cliente cancelada')
    } catch (error) {
      showMessage(error instanceof Error ? error.message : String(error))
    }
  }

  const deleteVehicle = (vehicle: Vehiculo): void => {
    setVehicleToDelete(vehicle)
  }

  const deleteVehicleConfirmed = async (): Promise<void> => {
    if (!vehicleToDelete || isDeletingVehicle) return
    setIsDeletingVehicle(true)
    try {
      clearMessage()
      await vehiculosRepository.delete(vehicleToDelete.id)
      setVehicleToDelete(null)
      await load()
      showMessage('Vehículo en proceso de eliminación')
    } catch (error) {
      showMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setIsDeletingVehicle(false)
    }
  }

  const cancelVehicleDeletion = async (vehicle: Vehiculo): Promise<void> => {
    try {
      clearMessage()
      await vehiculosRepository.cancelarEliminacion(vehicle.id)
      await load()
      showMessage('Eliminación de vehículo cancelada')
    } catch (error) {
      showMessage(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <section>
      <div className="page-actions">
        <button onClick={() => openClientModal()}>Nuevo cliente</button>
      </div>

      <div className="filter-bar client-filter-bar">
        <div className="field">
          <label htmlFor="cliente-filtro">Cliente o teléfono</label>
          <input
            id="cliente-filtro"
            value={clientFilter}
            placeholder="Buscar nombre o teléfono"
            onChange={(event) => setClientFilter(event.currentTarget.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="vehiculo-filtro">Datos del vehículo</label>
          <input
            id="vehiculo-filtro"
            value={vehicleFilter}
            placeholder="Placa, marca, modelo, color o tipo"
            onChange={(event) => setVehicleFilter(event.currentTarget.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="vehiculo-presencia">Vehículos registrados</label>
          <select
            id="vehiculo-presencia"
            value={vehiclePresence}
            onChange={(event) => setVehiclePresence(event.currentTarget.value)}
          >
            <option value="TODOS">Todos los clientes</option>
            <option value="CON_VEHICULOS">Con vehículos</option>
            <option value="SIN_VEHICULOS">Sin vehículos</option>
          </select>
        </div>
        <button
          type="button"
          className="button-secondary"
          onClick={() => {
            setClientFilter('')
            setVehicleFilter('')
            setVehiclePresence('TODOS')
          }}
        >
          Limpiar filtros
        </button>
        <span className="form-help">
          {filteredClients.length} cliente(s) · {visibleVehicleCount} vehículo(s)
        </span>
      </div>

      <Modal
        open={activeModal === 'cliente'}
        title={editingClient ? 'Editar cliente' : 'Registrar cliente'}
        onClose={closeClientModal}
      >
        <form onSubmit={saveClient}>
          <div className="field">
            <label htmlFor="cliente-nombre">Nombre completo *</label>
            <input
              id="cliente-nombre"
              name="nombre"
              defaultValue={editingClient?.nombre}
              placeholder="Ej. Ana Pérez"
              minLength={3}
              maxLength={80}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="cliente-telefono">Teléfono *</label>
            <input
              id="cliente-telefono"
              name="telefono"
              defaultValue={editingClient?.telefono}
              placeholder="Ej. 70000000"
              inputMode="numeric"
              pattern="[0-9]{8}"
              maxLength={8}
              required
            />
            <small>Debe tener 8 dígitos; normalmente comienza con 6 o 7.</small>
          </div>
          {!editingClient && (
            <>
              <label className="checkbox-field" htmlFor="cliente-registrar-vehiculo">
                <input
                  id="cliente-registrar-vehiculo"
                  type="checkbox"
                  checked={registerVehicleWithClient}
                  onChange={(event) => setRegisterVehicleWithClient(event.currentTarget.checked)}
                />
                <span>Registrar también un vehículo para este cliente</span>
              </label>

              {registerVehicleWithClient && (
                <fieldset className="nested-form-section">
                  <legend>Datos del vehículo</legend>
                  <div className="field">
                    <label htmlFor="cliente-vehiculo-placa">Placa *</label>
                    <input
                      id="cliente-vehiculo-placa"
                      name="vehiculoPlaca"
                      placeholder="Ej. ABC123"
                      maxLength={12}
                      pattern="[A-Z0-9]+"
                      onInput={(event) => {
                        event.currentTarget.value = event.currentTarget.value
                          .toUpperCase()
                          .replace(/[^A-Z0-9]/g, '')
                      }}
                      required
                    />
                  </div>
                  <div className="form-grid-two">
                    <div className="field">
                      <label htmlFor="cliente-vehiculo-marca">Marca *</label>
                      <input
                        id="cliente-vehiculo-marca"
                        name="vehiculoMarca"
                        placeholder="Ej. Toyota"
                        maxLength={40}
                        required
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="cliente-vehiculo-modelo">Modelo *</label>
                      <input
                        id="cliente-vehiculo-modelo"
                        name="vehiculoModelo"
                        placeholder="Ej. Corolla"
                        maxLength={40}
                        required
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="cliente-vehiculo-color">Color</label>
                      <input
                        id="cliente-vehiculo-color"
                        name="vehiculoColor"
                        placeholder="Ej. Blanco"
                        maxLength={30}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="cliente-vehiculo-tipo">Tipo</label>
                      <select
                        id="cliente-vehiculo-tipo"
                        name="vehiculoTipo"
                        defaultValue="Automóvil"
                      >
                        {tiposVehiculo.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="cliente-vehiculo-observaciones">
                      Estado y observaciones del vehículo
                    </label>
                    <textarea
                      id="cliente-vehiculo-observaciones"
                      name="vehiculoObservaciones"
                      placeholder="Ej. Rayón en la puerta derecha, golpe en el parachoques trasero"
                      rows={3}
                      maxLength={250}
                    />
                    <small>
                      Registra daños o condiciones visibles antes de recibir el vehículo.
                    </small>
                  </div>
                </fieldset>
              )}
            </>
          )}
          <div className="modal-actions">
            <button type="button" className="button-secondary" onClick={closeClientModal}>
              Cancelar
            </button>
            <button disabled={isSaving}>
              {isSaving
                ? 'Guardando...'
                : editingClient
                  ? 'Guardar cambios'
                  : registerVehicleWithClient
                    ? 'Guardar cliente y vehículo'
                    : 'Guardar cliente'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={activeModal === 'vehiculo'}
        title={editingVehicle ? 'Editar vehículo' : 'Registrar vehículo'}
        onClose={closeVehicleModal}
      >
        <form onSubmit={saveVehicle}>
          <div className="field">
            <label htmlFor="vehiculo-cliente">Cliente propietario *</label>
            <select
              id="vehiculo-cliente"
              name="clienteId"
              value={vehicleOwnerId}
              onChange={(event) => setVehicleOwnerId(event.currentTarget.value)}
              required
            >
              <option value="">Seleccionar cliente</option>
              {clientes.filter((item) => item.estado === 'ACTIVO').map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="vehiculo-placa">Placa *</label>
            <input
              id="vehiculo-placa"
              name="placa"
              defaultValue={editingVehicle?.placa}
              placeholder="Ej. ABC123"
              maxLength={12}
              pattern="[A-Z0-9]+"
              onInput={(event) => {
                event.currentTarget.value = event.currentTarget.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, '')
              }}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="vehiculo-marca">Marca *</label>
            <input
              id="vehiculo-marca"
              name="marca"
              defaultValue={editingVehicle?.marca}
              placeholder="Ej. Toyota"
              maxLength={40}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="vehiculo-modelo">Modelo *</label>
            <input
              id="vehiculo-modelo"
              name="modelo"
              defaultValue={editingVehicle?.modelo}
              placeholder="Ej. Corolla"
              maxLength={40}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="vehiculo-color">Color</label>
            <input
              id="vehiculo-color"
              name="color"
              defaultValue={editingVehicle?.color}
              placeholder="Ej. Blanco"
              maxLength={30}
            />
          </div>
          <div className="field">
            <label htmlFor="vehiculo-tipo">Tipo</label>
            <select
              id="vehiculo-tipo"
              name="tipo"
              defaultValue={editingVehicle?.tipo ?? 'Automóvil'}
            >
              {tiposVehiculo.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="vehiculo-observaciones">Estado y observaciones del vehículo</label>
            <textarea
              id="vehiculo-observaciones"
              name="observaciones"
              defaultValue={editingVehicle?.observaciones}
              placeholder="Ej. Rayón en la puerta derecha, golpe en el parachoques trasero"
              rows={3}
              maxLength={250}
            />
            <small>Registra daños o condiciones visibles para respaldo del establecimiento.</small>
          </div>
          <div className="modal-actions">
            <button type="button" className="button-secondary" onClick={closeVehicleModal}>
              Cancelar
            </button>
            <button disabled={isSaving}>
              {isSaving ? 'Guardando...' : editingVehicle ? 'Guardar cambios' : 'Guardar vehículo'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={activeModal === 'detalleVehiculo'}
        title={
          selectedVehicle ? `Datos del vehículo ${selectedVehicle.placa}` : 'Datos del vehículo'
        }
        onClose={closeVehicleDetails}
      >
        {selectedVehicle && (
          <div className="vehicle-details">
            <div>
              <span>Cliente propietario</span>
              <strong>
                {clientes.find((client) => client.id === selectedVehicle.clienteId)?.nombre ??
                  'No encontrado'}
              </strong>
            </div>
            <div>
              <span>Placa</span>
              <strong>{selectedVehicle.placa}</strong>
            </div>
            <div>
              <span>Marca</span>
              <strong>{selectedVehicle.marca}</strong>
            </div>
            <div>
              <span>Modelo</span>
              <strong>{selectedVehicle.modelo}</strong>
            </div>
            <div>
              <span>Color</span>
              <strong>{selectedVehicle.color || 'No registrado'}</strong>
            </div>
            <div>
              <span>Tipo</span>
              <strong>{selectedVehicle.tipo || 'No registrado'}</strong>
            </div>
            <div className="vehicle-observations">
              <span>Estado y observaciones</span>
              <strong>{selectedVehicle.observaciones || 'Sin observaciones registradas'}</strong>
            </div>
            <div className="modal-actions vehicle-detail-actions">
              <button type="button" className="button-secondary" onClick={closeVehicleDetails}>
                Cerrar
              </button>
              <button type="button" onClick={() => editVehicle(selectedVehicle)}>
                Editar
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  closeVehicleDetails()
                  deleteVehicle(selectedVehicle)
                }}
              >
                Eliminar
              </button>
            </div>
          </div>
        )}
      </Modal>

      <DataTable
        headers={[
          'Cliente',
          'Teléfono',
          'Vehículos registrados',
          'Visitas',
          'Total gastado',
          'Última visita',
          'Acciones'
        ]}
      >
        {filteredClients.map((cliente) => {
          const clientVehicles = vehiculos.filter((vehicle) => vehicle.clienteId === cliente.id)
          const history = clientHistories[cliente.id]

          return (
            <tr
              key={cliente.id}
              className={cliente.eliminacionProgramadaEn ? 'service-pending-delete' : undefined}
            >
              <td>
                <strong>{cliente.nombre}</strong>
              </td>
              <td>{cliente.telefono}</td>
              <td className="vehicle-cell">
                {clientVehicles.length > 0 ? (
                  <div className="vehicle-list">
                    {clientVehicles.map((vehicle) => (
                      <article
                        className={`vehicle-summary ${vehicle.eliminacionProgramadaEn ? 'vehicle-pending-delete' : ''}`}
                        key={vehicle.id}
                      >
                        <strong>{vehicle.placa}</strong>
                        <span>
                          {vehicle.marca} {vehicle.modelo}
                        </span>
                        <div className="actions vehicle-actions">
                          {!cliente.eliminacionProgramadaEn && vehicle.estado === 'INACTIVO' ? (
                            <button type="button" onClick={() => cancelVehicleDeletion(vehicle)}>
                              Cancelar eliminación
                            </button>
                          ) : !cliente.eliminacionProgramadaEn && vehicle.estado === 'ACTIVO' ? (
                            <button type="button" onClick={() => viewVehicle(vehicle)}>
                              Ver datos
                            </button>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <span className="form-help">Sin vehículos registrados</span>
                )}
              </td>
              <td>{history?.visitas ?? 0}</td>
              <td>{money.format(history?.totalGastado ?? 0)}</td>
              <td>
                {history?.ultimaVisita
                  ? new Date(`${history.ultimaVisita.replace(' ', 'T')}Z`).toLocaleDateString()
                  : 'Sin visitas'}
              </td>
              <td>
                <div className="actions client-actions">
                  {cliente.eliminacionProgramadaEn ? (
                    <button onClick={() => cancelClientDeletion(cliente)}>
                      Cancelar eliminación
                    </button>
                  ) : (
                    <>
                      <button onClick={() => openVehicleModal(cliente.id)}>Agregar vehículo</button>
                      <button onClick={() => openClientModal(cliente)}>Editar cliente</button>
                      <button className="danger" onClick={() => deleteClient(cliente)}>
                        Eliminar cliente
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          )
        })}
      </DataTable>

      <Modal
        open={clientToDelete !== null}
        title="Eliminar cliente"
        onClose={() => {
          if (!isDeletingClient) setClientToDelete(null)
        }}
      >
        <p>
          ¿Deseas eliminar al cliente
          {clientToDelete ? ` "${clientToDelete.nombre}"` : ''}?
        </p>
        <p className="form-help">
          El cliente quedará inactivo inmediatamente y se ocultará después de 24 horas. Durante ese
          tiempo se verá atenuado en esta tabla.
        </p>
        <div className="modal-actions">
          <button
            type="button"
            className="button-secondary"
            disabled={isDeletingClient}
            onClick={() => setClientToDelete(null)}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="danger"
            disabled={isDeletingClient}
            onClick={deleteClientConfirmed}
          >
            {isDeletingClient ? 'Eliminando...' : 'Eliminar'}
          </button>
        </div>
      </Modal>

      <Modal
        open={vehicleToDelete !== null}
        title="Eliminar vehículo"
        onClose={() => {
          if (!isDeletingVehicle) setVehicleToDelete(null)
        }}
      >
        <p>
          ¿Deseas eliminar el vehículo
          {vehicleToDelete ? ` "${vehicleToDelete.placa}"` : ''}?
        </p>
        <p className="form-help">
          El vehículo quedará inactivo inmediatamente y se ocultará después de 24 horas. Durante ese
          tiempo se verá atenuado en esta tabla.
        </p>
        <div className="modal-actions">
          <button
            type="button"
            className="button-secondary"
            disabled={isDeletingVehicle}
            onClick={() => setVehicleToDelete(null)}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="danger"
            disabled={isDeletingVehicle}
            onClick={deleteVehicleConfirmed}
          >
            {isDeletingVehicle ? 'Eliminando...' : 'Eliminar'}
          </button>
        </div>
      </Modal>
    </section>
  )
}
