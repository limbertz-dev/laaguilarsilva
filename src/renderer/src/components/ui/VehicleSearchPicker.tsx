import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { Vehiculo } from '../../../../shared/types/domain'

const MAX_RESULTS = 10

interface VehicleSearchPickerProps {
  id?: string
  name?: string
  value: string
  onChange: (value: string) => void
  vehicles: Vehiculo[]
  clientNames: Record<number, string>
  required?: boolean
  placeholder?: string
}

export function VehicleSearchPicker({
  id,
  name,
  value,
  onChange,
  vehicles,
  clientNames,
  required = false,
  placeholder = 'Buscar por placa'
}: VehicleSearchPickerProps): React.JSX.Element {
  const listboxId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const activeVehicles = useMemo(
    () => vehicles.filter((vehicle) => vehicle.estado === 'ACTIVO'),
    [vehicles]
  )

  const selectedVehicle = useMemo(
    () => activeVehicles.find((vehicle) => String(vehicle.id) === value) ?? null,
    [activeVehicles, value]
  )

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toUpperCase()
    if (!normalizedQuery) return []

    return activeVehicles
      .filter((vehicle) => vehicle.placa.includes(normalizedQuery))
      .slice(0, MAX_RESULTS)
  }, [activeVehicles, query])

  useEffect(() => {
    if (!open) return

    const closeMenu = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', closeMenu)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeMenu)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const selectVehicle = (vehicleId: number): void => {
    onChange(String(vehicleId))
    setQuery('')
    setOpen(false)
  }

  const startChanging = (): void => {
    onChange('')
    setQuery('')
    setOpen(false)
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }

  if (selectedVehicle && value) {
    const clientName = clientNames[selectedVehicle.clienteId] ?? 'Cliente no encontrado'

    return (
      <div className="vehicle-picker">
        <div className="vehicle-picker-selected">
          <div className="vehicle-picker-selected-copy">
            <strong>{selectedVehicle.placa}</strong>
            <span>
              {selectedVehicle.marca} {selectedVehicle.modelo} · {clientName}
            </span>
          </div>
          <button type="button" className="button-secondary" onClick={startChanging}>
            Cambiar
          </button>
        </div>
        {name ? <input type="hidden" name={name} value={value} required={required} /> : null}
      </div>
    )
  }

  return (
    <div className={`vehicle-picker ${open ? 'open' : ''}`} ref={rootRef}>
      <input
        ref={inputRef}
        id={id}
        type="search"
        className="vehicle-picker-input"
        value={query}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={open}
        onChange={(event) => {
          const nextValue = event.currentTarget.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
          setQuery(nextValue)
          setOpen(nextValue.length > 0)
        }}
        onFocus={() => {
          if (query.length > 0) setOpen(true)
        }}
      />
      {name ? <input type="hidden" name={name} value={value} required={required} /> : null}
      {open && results.length > 0 && (
        <ul className="vehicle-picker-menu" id={listboxId} role="listbox" aria-label="Vehículos">
          {results.map((vehicle) => {
            const clientName = clientNames[vehicle.clienteId] ?? 'Cliente no encontrado'

            return (
              <li key={vehicle.id} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={String(vehicle.id) === value}
                  onClick={() => selectVehicle(vehicle.id)}
                >
                  <strong>{vehicle.placa}</strong>
                  <span>
                    {vehicle.marca} {vehicle.modelo} · {clientName}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {open && query.length > 0 && results.length === 0 && (
        <p className="vehicle-picker-empty">No se encontró ningún vehículo con esa placa.</p>
      )}
    </div>
  )
}