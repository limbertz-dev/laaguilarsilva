import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'

export interface AppSelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface AppSelectProps {
  id?: string
  name?: string
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  required?: boolean
  disabled?: boolean
  placeholder?: string
  options: AppSelectOption[]
}

export function AppSelect({
  id,
  name,
  value,
  defaultValue = '',
  onChange,
  required = false,
  disabled = false,
  placeholder,
  options
}: AppSelectProps): React.JSX.Element {
  const listboxId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [internalValue, setInternalValue] = useState(defaultValue)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
  const isControlled = value !== undefined
  const currentValue = isControlled ? value : internalValue
  const selectedOption = options.find((option) => option.value === currentValue)
  const displayLabel = selectedOption?.label ?? placeholder ?? 'Seleccionar'

  const updateMenuPosition = (): void => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    setMenuStyle({
      position: 'fixed',
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
      zIndex: 1100
    })
  }

  useLayoutEffect(() => {
    if (!open) return
    updateMenuPosition()
  }, [open, options.length])

  useEffect(() => {
    if (!open) return

    const closeMenu = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    const reposition = (): void => updateMenuPosition()

    document.addEventListener('pointerdown', closeMenu)
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      document.removeEventListener('pointerdown', closeMenu)
      document.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [open])

  const setValue = (nextValue: string): void => {
    if (!isControlled) setInternalValue(nextValue)
    onChange?.(nextValue)
    setOpen(false)
  }

  return (
    <div className={`app-select ${open ? 'open' : ''}`} ref={rootRef}>
      <select
        className="app-select-native"
        id={id ? `${id}-native` : undefined}
        name={name}
        value={currentValue}
        required={required}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        onChange={() => undefined}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>

      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={`app-select-trigger ${!currentValue ? 'placeholder' : ''}`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => {
          if (disabled) return
          setOpen((current) => !current)
        }}
      >
        <span className="app-select-value">{displayLabel}</span>
        <span className="app-select-chevron" aria-hidden="true">
          ⌄
        </span>
      </button>

      {open && (
        <ul
          className="app-select-menu"
          id={listboxId}
          role="listbox"
          aria-label="Opciones"
          style={menuStyle}
        >
          {options.map((option) => (
            <li key={option.value} role="none">
              <button
                type="button"
                role="option"
                className={option.value === currentValue ? 'selected' : undefined}
                aria-selected={option.value === currentValue}
                disabled={option.disabled}
                onClick={() => setValue(option.value)}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}