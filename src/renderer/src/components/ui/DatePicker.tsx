import { useEffect, useMemo, useRef, useState } from 'react'
import { dateFromKey, dateKey } from '../../utils/date'
import { AppIcon } from './AppIcon'

interface DatePickerProps {
  value: string
  onChange: (value: string) => void
  label: string
  emptyLabel?: string
  allowEmpty?: boolean
  min?: string
  max?: string
  showShortcuts?: boolean
}

export function DatePicker({
  value,
  onChange,
  label,
  emptyLabel = 'Todas las fechas',
  allowEmpty = true,
  min,
  max,
  showShortcuts = true
}: DatePickerProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(() =>
    value ? dateFromKey(value) : new Date()
  )
  const pickerRef = useRef<HTMLDivElement>(null)
  const todayKey = dateKey(new Date())
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = dateKey(yesterday)

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    const firstDayOffset = (new Date(year, month, 1).getDay() + 6) % 7

    return Array.from({ length: 42 }, (_, index) => {
      const day = index - firstDayOffset + 1
      return new Date(year, month, day)
    })
  }, [calendarMonth])

  useEffect(() => {
    if (!open) return

    const closePicker = (event: PointerEvent): void => {
      if (!pickerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', closePicker)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closePicker)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const selectedDateLabel = value
    ? new Intl.DateTimeFormat('es-BO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(dateFromKey(value))
    : emptyLabel

  const select = (nextValue: string): void => {
    onChange(nextValue)
    setOpen(false)
  }

  return (
    <div className="order-calendar-picker" ref={pickerRef}>
      <button
        type="button"
        className={`order-calendar-trigger ${value ? 'active' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setCalendarMonth(value ? dateFromKey(value) : new Date())
          setOpen((current) => !current)
        }}
      >
        <AppIcon name="calendar" size={18} />
        <span>
          <small>{label}</small>
          <strong>{selectedDateLabel}</strong>
        </span>
        <span className="order-calendar-chevron">⌄</span>
      </button>

      {open && (
        <div className="order-calendar-popover" role="dialog" aria-label={label}>
          {showShortcuts && (
            <div className="order-calendar-shortcuts">
              <button type="button" onClick={() => select(todayKey)}>
                Hoy
              </button>
              <button type="button" onClick={() => select(yesterdayKey)}>
                Ayer
              </button>
              {allowEmpty && (
                <button type="button" onClick={() => select('')}>
                  Todas
                </button>
              )}
            </div>
          )}

          <div className="order-calendar-header">
            <button
              type="button"
              aria-label="Mes anterior"
              onClick={() =>
                setCalendarMonth(
                  (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)
                )
              }
            >
              ‹
            </button>
            <strong>
              {new Intl.DateTimeFormat('es-BO', {
                month: 'long',
                year: 'numeric'
              }).format(calendarMonth)}
            </strong>
            <button
              type="button"
              aria-label="Mes siguiente"
              onClick={() =>
                setCalendarMonth(
                  (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)
                )
              }
            >
              ›
            </button>
          </div>

          <div className="order-calendar-weekdays" aria-hidden="true">
            {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="order-calendar-days">
            {calendarDays.map((day) => {
              const key = dateKey(day)
              const outsideMonth = day.getMonth() !== calendarMonth.getMonth()
              const disabled = Boolean((min && key < min) || (max && key > max))

              return (
                <button
                  type="button"
                  className={[
                    outsideMonth ? 'outside' : '',
                    key === todayKey ? 'today' : '',
                    key === value ? 'selected' : ''
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-label={new Intl.DateTimeFormat('es-BO', {
                    dateStyle: 'full'
                  }).format(day)}
                  aria-pressed={key === value}
                  disabled={disabled}
                  key={key}
                  onClick={() => select(key)}
                >
                  {day.getDate()}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
