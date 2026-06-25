import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { ResumenCaja } from '../../../../shared/types/domain'
import { AppSelect } from '../../components/ui/AppSelect'
import { DataTable } from '../../components/ui/DataTable'
import { DatePicker } from '../../components/ui/DatePicker'
import { Modal } from '../../components/ui/Modal'
import { useAppFeedback } from '../../hooks/useAppFeedback'
import { cajaRepository } from '../../repositories/caja.repository'
import { money } from '../../utils/format'
import { formNumber, formText } from '../../utils/form'
import { dateKey } from '../../utils/date'
import { ReportesPage } from '../reportes/ReportesPage'
import { categoriasCaja } from '../../../../shared/schemas/inputs'

function parseDatabaseDate(value: string): Date {
  return new Date(`${value.replace(' ', 'T')}Z`)
}

function localDateKey(value: string): string {
  return dateKey(parseDatabaseDate(value))
}

export function CajaPage(): React.JSX.Element {
  const [caja, setCaja] = useState<ResumenCaja>()
  const [modalOpen, setModalOpen] = useState(false)
  const [movementType, setMovementType] = useState<'INGRESO' | 'EGRESO'>('EGRESO')
  const [activeView, setActiveView] = useState<'movimientos' | 'reportes'>('movimientos')
  const [dateFilter, setDateFilter] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const { showMessage, clearMessage } = useAppFeedback()

  const load = useCallback(async () => setCaja(await cajaRepository.getSummary()), [])

  useEffect(() => {
    clearMessage()
    const timer = window.setTimeout(() => {
      load().catch((error) => showMessage(String(error)))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [clearMessage, load, showMessage])

  const filteredMovements = useMemo(
    () =>
      caja
        ? dateFilter
          ? caja.movimientos.filter((movement) => localDateKey(movement.fecha) === dateFilter)
          : caja.movimientos
        : [],
    [caja, dateFilter]
  )

  const filteredSummary = useMemo(() => {
    const ingresos = filteredMovements
      .filter((movement) => movement.tipo === 'INGRESO')
      .reduce((total, movement) => total + movement.monto, 0)
    const egresos = filteredMovements
      .filter((movement) => movement.tipo === 'EGRESO')
      .reduce((total, movement) => total + movement.monto, 0)
    return { ingresos, egresos, utilidad: ingresos - egresos }
  }, [filteredMovements])

  const registerMovement = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    if (isSaving) return
    setIsSaving(true)
    try {
      clearMessage()
      await cajaRepository.registerMovement({
        tipo: movementType,
        categoria: formText(data, 'categoria'),
        concepto: formText(data, 'concepto'),
        monto: formNumber(data, 'monto')
      })
      form.reset()
      setMovementType('EGRESO')
      setModalOpen(false)
      showMessage(movementType === 'INGRESO' ? 'Ingreso registrado' : 'Egreso registrado')
      await load()
    } catch (error) {
      showMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setIsSaving(false)
    }
  }

  if (!caja) return <p>Cargando caja...</p>

  return (
    <section>
      <div className="cash-view-switch" role="tablist" aria-label="Secciones de caja">
        <button
          type="button"
          role="tab"
          aria-selected={activeView === 'movimientos'}
          className={activeView === 'movimientos' ? 'active' : ''}
          onClick={() => setActiveView('movimientos')}
        >
          <strong>Movimientos de caja</strong>
          <span>Ingresos, egresos y saldo</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeView === 'reportes'}
          className={activeView === 'reportes' ? 'active' : ''}
          onClick={() => setActiveView('reportes')}
        >
          <strong>Reportes</strong>
          <span>Resultados y exportaciones</span>
        </button>
      </div>

      {activeView === 'movimientos' ? (
        <>
          <div className="cash-section-heading">
            <div>
              <h2>Estado de caja</h2>
              <p>
                {dateFilter
                  ? `Resumen correspondiente al ${new Date(`${dateFilter}T12:00:00`).toLocaleDateString()}`
                  : 'Resumen acumulado de todos los movimientos'}
              </p>
            </div>
            <button onClick={() => setModalOpen(true)}>+ Registrar movimiento</button>
          </div>

          <div className="cash-summary">
            <article className="cash-summary-card income">
              <span>Ingresos</span>
              <strong>{money.format(filteredSummary.ingresos)}</strong>
              <small>Dinero que entró</small>
            </article>
            <article className="cash-summary-card expense">
              <span>Egresos</span>
              <strong>{money.format(filteredSummary.egresos)}</strong>
              <small>Dinero que salió</small>
            </article>
            <article
              className={`cash-summary-card balance ${
                filteredSummary.utilidad >= 0 ? 'positive' : 'negative'
              }`}
            >
              <span>Resultado</span>
              <strong>{money.format(filteredSummary.utilidad)}</strong>
              <small>
                {filteredSummary.utilidad > 0
                  ? 'Caja positiva'
                  : filteredSummary.utilidad < 0
                    ? 'Caja negativa'
                    : 'Caja equilibrada'}
              </small>
            </article>
          </div>

          <div className="cash-toolbar">
            <div>
              <strong>Historial de movimientos</strong>
              <span>{filteredMovements.length} registro(s)</span>
            </div>
            <DatePicker
              value={dateFilter}
              onChange={setDateFilter}
              label="Fecha seleccionada"
            />
          </div>

          {filteredMovements.length > 0 ? (
            <DataTable
              headers={['Fecha', 'Tipo', 'Categoría', 'Concepto', 'Monto', 'Saldo']}
            >
              {filteredMovements.map((item) => (
                <tr key={item.id}>
                  <td>{parseDatabaseDate(item.fecha).toLocaleString()}</td>
                  <td>
                    <span className={`movement-badge ${item.tipo.toLowerCase()}`}>
                      {item.tipo === 'INGRESO' ? 'Ingreso' : 'Egreso'}
                    </span>
                  </td>
                  <td>{item.categoria}</td>
                  <td>{item.concepto}</td>
                  <td className={`money-cell ${item.tipo.toLowerCase()}`}>
                    {item.tipo === 'INGRESO' ? '+' : '-'}
                    {money.format(item.monto)}
                  </td>
                  <td>
                    <strong>{money.format(item.saldo)}</strong>
                  </td>
                </tr>
              ))}
            </DataTable>
          ) : (
            <div className="empty-state">
              <strong>No hay movimientos para mostrar</strong>
              <p>
                {dateFilter
                  ? 'No se registraron movimientos en la fecha seleccionada.'
                  : 'Registra el primer ingreso o egreso para comenzar.'}
              </p>
              {!dateFilter && (
                <button onClick={() => setModalOpen(true)}>Registrar movimiento</button>
              )}
            </div>
          )}
        </>
      ) : (
        <section className="reports-workspace" id="reportes">
          <header className="cash-section-heading">
            <div>
              <h2>Reportes del negocio</h2>
              <p>
                Selecciona un periodo, revisa los resultados y descarga el archivo que necesites.
              </p>
            </div>
          </header>
          <ReportesPage />
        </section>
      )}

      <Modal
        open={modalOpen}
        title="Registrar movimiento de caja"
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={registerMovement}>
          <div className="movement-type-picker">
            <button
              type="button"
              className={movementType === 'INGRESO' ? 'income active' : 'income'}
              onClick={() => setMovementType('INGRESO')}
            >
              <strong>Ingreso</strong>
              <span>Dinero que entra</span>
            </button>
            <button
              type="button"
              className={movementType === 'EGRESO' ? 'expense active' : 'expense'}
              onClick={() => setMovementType('EGRESO')}
            >
              <strong>Egreso</strong>
              <span>Dinero que sale</span>
            </button>
          </div>
          <div className="field">
            <label htmlFor="movimiento-categoria">Categoría *</label>
            <AppSelect
              id="movimiento-categoria"
              name="categoria"
              required
              defaultValue="Otro"
              options={categoriasCaja.map((category) => ({
                value: category,
                label: category
              }))}
            />
          </div>
          <div className="field">
            <label htmlFor="movimiento-concepto">Concepto *</label>
            <input
              id="movimiento-concepto"
              name="concepto"
              placeholder="Detalle del movimiento"
              minLength={5}
              maxLength={120}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="movimiento-monto">Monto *</label>
            <input
              id="movimiento-monto"
              name="monto"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              required
            />
          </div>
          <p className="form-help">
            Este movimiento es manual y no depende de una orden, compra o salario.
          </p>
          <div className="modal-actions">
            <button type="button" className="button-secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </button>
            <button disabled={isSaving}>
              {isSaving
                ? 'Guardando...'
                : `Registrar ${movementType === 'INGRESO' ? 'ingreso' : 'egreso'}`}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  )
}
