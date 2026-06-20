import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { ReporteResumen } from '../../../../shared/types/domain'
import { DataTable } from '../../components/ui/DataTable'
import { useAppFeedback } from '../../hooks/useAppFeedback'
import { reportesRepository } from '../../repositories/reportes.repository'
import { money } from '../../utils/format'

function localDate(date = new Date()): string {
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

function defaultDates(): { desde: string; hasta: string } {
  const now = new Date()
  return {
    desde: localDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    hasta: localDate(now)
  }
}

export function ReportesPage(): React.JSX.Element {
  const defaults = defaultDates()
  const [desde, setDesde] = useState(defaults.desde)
  const [hasta, setHasta] = useState(defaults.hasta)
  const [report, setReport] = useState<ReporteResumen>()
  const [loading, setLoading] = useState(false)
  const { showMessage, clearMessage } = useAppFeedback()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      clearMessage()
      setReport(await reportesRepository.get({ desde, hasta }))
    } catch (error) {
      showMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }, [clearMessage, desde, hasta, showMessage])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const submit = (event: FormEvent): void => {
    event.preventDefault()
    void load()
  }

  const exportReport = async (format: 'pdf' | 'excel'): Promise<void> => {
    try {
      clearMessage()
      const path =
        format === 'pdf'
          ? await reportesRepository.exportPdf({ desde, hasta })
          : await reportesRepository.exportExcel({ desde, hasta })
      if (path) showMessage(`Reporte guardado en ${path}`)
    } catch (error) {
      showMessage(error instanceof Error ? error.message : String(error))
    }
  }

  const selectPeriod = (period: 'hoy' | 'semana' | 'mes'): void => {
    const now = new Date()
    setHasta(localDate(now))
    if (period === 'hoy') {
      setDesde(localDate(now))
    } else if (period === 'semana') {
      const start = new Date(now)
      start.setDate(start.getDate() - 6)
      setDesde(localDate(start))
    } else {
      setDesde(localDate(new Date(now.getFullYear(), now.getMonth(), 1)))
    }
  }

  return (
    <div>
      <div className="report-controls">
        <div className="period-shortcuts">
          <span>Periodo rápido</span>
          <div>
            <button type="button" onClick={() => selectPeriod('hoy')}>
              Hoy
            </button>
            <button type="button" onClick={() => selectPeriod('semana')}>
              Últimos 7 días
            </button>
            <button type="button" onClick={() => selectPeriod('mes')}>
              Este mes
            </button>
          </div>
        </div>
        <form className="report-filter" onSubmit={submit}>
          <div className="field">
            <label htmlFor="reporte-desde">Fecha inicial</label>
            <input
              id="reporte-desde"
              type="date"
              value={desde}
              max={hasta}
              onChange={(event) => setDesde(event.currentTarget.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="reporte-hasta">Fecha final</label>
            <input
              id="reporte-hasta"
              type="date"
              value={hasta}
              min={desde}
              onChange={(event) => setHasta(event.currentTarget.value)}
              required
            />
          </div>
          <button disabled={loading}>{loading ? 'Consultando...' : 'Actualizar resultados'}</button>
        </form>
      </div>

      {report && (
        <>
          <div className="report-result-heading">
            <div>
              <h3>Resultados del periodo</h3>
              <span>
                {new Date(`${report.desde}T12:00:00`).toLocaleDateString()} al{' '}
                {new Date(`${report.hasta}T12:00:00`).toLocaleDateString()}
              </span>
            </div>
            <div className="export-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => void exportReport('pdf')}
              >
                Descargar PDF
              </button>
              <button type="button" onClick={() => void exportReport('excel')}>
                Descargar Excel
              </button>
            </div>
          </div>

          <div className="cards report-cards">
            <article>
              <strong>{report.autosAtendidos}</strong>
              <span>Autos atendidos</span>
            </article>
            <article>
              <strong>{money.format(report.facturacion)}</strong>
              <span>Facturación</span>
            </article>
            <article>
              <strong>{report.servicioMasVendido ?? 'Sin datos'}</strong>
              <span>Servicio más vendido</span>
            </article>
            <article>
              <strong>{money.format(report.ingresos)}</strong>
              <span>Ingresos</span>
            </article>
            <article>
              <strong>{money.format(report.egresos)}</strong>
              <span>Egresos</span>
            </article>
            <article className={report.resultado >= 0 ? 'positive' : 'negative'}>
              <strong>{money.format(report.resultado)}</strong>
              <span>Resultado de caja</span>
            </article>
          </div>

          <div className="report-section">
            <h2>Servicios vendidos</h2>
            <DataTable headers={['Servicio', 'Cantidad', 'Facturación']}>
              {report.servicios.length > 0 ? (
                report.servicios.map((service) => (
                  <tr key={service.nombre}>
                    <td>{service.nombre}</td>
                    <td>{service.cantidad}</td>
                    <td>{money.format(service.facturacion)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3}>Sin servicios vendidos en el periodo.</td>
                </tr>
              )}
            </DataTable>
          </div>

          <div className="report-section">
            <h2>Consumo de insumos</h2>
            <DataTable headers={['Insumo', 'Cantidad', 'Unidad']}>
              {report.consumos.length > 0 ? (
                report.consumos.map((supply) => (
                  <tr key={`${supply.insumo}-${supply.unidad}`}>
                    <td>{supply.insumo}</td>
                    <td>{supply.cantidad}</td>
                    <td>{supply.unidad}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3}>Sin consumos registrados en el periodo.</td>
                </tr>
              )}
            </DataTable>
          </div>

          <div className="report-section">
            <h2>Órdenes completadas</h2>
            <DataTable
              headers={['Orden', 'Fecha', 'Cliente', 'Placa', 'Servicios', 'Pago', 'Total']}
            >
              {report.ordenes.length > 0 ? (
                report.ordenes.map((order) => (
                  <tr key={order.id}>
                    <td>#{order.id}</td>
                    <td>{order.fecha}</td>
                    <td>{order.cliente}</td>
                    <td>{order.placa}</td>
                    <td>{order.servicios}</td>
                    <td>{order.metodoPago}</td>
                    <td>{money.format(order.total)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7}>Sin órdenes completadas en el periodo.</td>
                </tr>
              )}
            </DataTable>
          </div>
        </>
      )}
    </div>
  )
}
