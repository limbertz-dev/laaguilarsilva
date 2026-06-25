import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { Dashboard } from '../../../../shared/types/domain'
import {
  BalanceChart,
  ComparisonChart,
  HorizontalBarChart,
  LineChart
} from '../../components/charts/DashboardCharts'
import { AppIcon } from '../../components/ui/AppIcon'
import { DatePicker } from '../../components/ui/DatePicker'
import { useAppFeedback } from '../../hooks/useAppFeedback'
import { dashboardRepository } from '../../repositories/dashboard.repository'
import { dateFromKey } from '../../utils/date'
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

function financialAnswer(result: number): { title: string; detail: string; tone: string } {
  if (result > 0) {
    return {
      title: 'Estamos generando ganancia',
      detail: `El resultado de caja del periodo es positivo en ${money.format(result)}.`,
      tone: 'positive'
    }
  }
  if (result < 0) {
    return {
      title: 'Gastamos más de lo que ingresó',
      detail: `El resultado de caja del periodo es ${money.format(result)}.`,
      tone: 'negative'
    }
  }
  return {
    title: 'Solo estamos moviendo dinero',
    detail: 'Los ingresos y egresos del periodo están equilibrados.',
    tone: 'neutral'
  }
}

export function DashboardPage(): React.JSX.Element {
  const defaults = defaultDates()
  const [desde, setDesde] = useState(defaults.desde)
  const [hasta, setHasta] = useState(defaults.hasta)
  const [dashboard, setDashboard] = useState<Dashboard>()
  const [loading, setLoading] = useState(false)
  const { showMessage, clearMessage } = useAppFeedback()
  const dateFormatter = new Intl.DateTimeFormat('es-BO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
  const rangeDays =
    Math.round((dateFromKey(hasta).getTime() - dateFromKey(desde).getTime()) / 86_400_000) + 1

  const load = useCallback(async () => {
    setLoading(true)
    try {
      clearMessage()
      setDashboard(await dashboardRepository.get({ desde, hasta }))
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

  const selectPeriod = (period: 'hoy' | 'semana' | 'mes'): void => {
    const now = new Date()
    setHasta(localDate(now))
    if (period === 'hoy') {
      setDesde(localDate(now))
      return
    }
    if (period === 'semana') {
      const start = new Date(now)
      start.setDate(start.getDate() - 6)
      setDesde(localDate(start))
      return
    }
    setDesde(localDate(new Date(now.getFullYear(), now.getMonth(), 1)))
  }

  const activePeriod = (() => {
    const now = new Date()
    const today = localDate(now)
    if (desde === today && hasta === today) return 'hoy'
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - 6)
    if (desde === localDate(weekStart) && hasta === today) return 'semana'
    const monthStart = localDate(new Date(now.getFullYear(), now.getMonth(), 1))
    if (desde === monthStart && hasta === today) return 'mes'
    return null
  })()

  if (!dashboard) return <p>Cargando resumen...</p>

  const financial = financialAnswer(dashboard.resultadoHoy)
  const chartPointCount = dashboard.actividadSemanal.length

  return (
    <section>
      <div className="dashboard-heading">
        <div>
          <h2>Actividad del negocio</h2>
          <p>Selecciona un periodo y revisa los indicadores del negocio.</p>
        </div>
      </div>

      <div className="report-controls">
        <div className="period-shortcuts">
          <span>Periodo rápido</span>
          <div>
            <button
              type="button"
              className={activePeriod === 'hoy' ? 'active' : undefined}
              onClick={() => selectPeriod('hoy')}
            >
              Hoy
            </button>
            <button
              type="button"
              className={activePeriod === 'semana' ? 'active' : undefined}
              onClick={() => selectPeriod('semana')}
            >
              Últimos 7 días
            </button>
            <button
              type="button"
              className={activePeriod === 'mes' ? 'active' : undefined}
              onClick={() => selectPeriod('mes')}
            >
              Este mes
            </button>
          </div>
        </div>
        <form className="report-filter" onSubmit={submit}>
          <DatePicker
            value={desde}
            onChange={setDesde}
            label="Fecha inicial"
            allowEmpty={false}
            max={hasta}
            showShortcuts={false}
          />
          <DatePicker
            value={hasta}
            onChange={setHasta}
            label="Fecha final"
            allowEmpty={false}
            min={desde}
            showShortcuts={false}
          />
          <button disabled={loading}>
            {loading ? 'Actualizando...' : 'Actualizar resumen'}
          </button>
        </form>
      </div>

      <div className="report-period-card" aria-label="Periodo seleccionado">
        <div className="report-period-intro">
          <span className="report-period-icon">
            <AppIcon name="calendar" size={23} />
          </span>
          <span>
            <small>Periodo seleccionado</small>
            <strong>
              {dateFormatter.format(dateFromKey(dashboard.desde))} —{' '}
              {dateFormatter.format(dateFromKey(dashboard.hasta))}
            </strong>
          </span>
        </div>
        <div className="report-period-dates">
          <div>
            <small>Desde</small>
            <strong>{dateFormatter.format(dateFromKey(dashboard.desde))}</strong>
          </div>
          <span className="report-period-line" aria-hidden="true">
            <i />
          </span>
          <div>
            <small>Hasta</small>
            <strong>{dateFormatter.format(dateFromKey(dashboard.hasta))}</strong>
          </div>
        </div>
        <span className="report-period-duration">
          <strong>{rangeDays}</strong>
          <span>{rangeDays === 1 ? 'día incluido' : 'días incluidos'}</span>
        </span>
      </div>

      <div className="cards dashboard-kpis">
        <article>
          <span className="kpi-icon">
            <AppIcon name="car" size={27} />
          </span>
          <div>
            <span>Autos atendidos en el periodo</span>
            <strong>{dashboard.autosAtendidosHoy}</strong>
            <small>Vehículos entregados</small>
          </div>
        </article>
        <article>
          <span className="kpi-icon">
            <AppIcon name="receipt" size={27} />
          </span>
          <div>
            <span>Facturación del periodo</span>
            <strong>{money.format(dashboard.facturacionHoy)}</strong>
            <small>Ingresos por servicios</small>
          </div>
        </article>
        <article>
          <span className="kpi-icon">
            <AppIcon name="award" size={27} />
          </span>
          <div>
            <span>Servicio más vendido</span>
            <strong>{dashboard.servicioMasVendido?.nombre ?? 'Sin ventas'}</strong>
            <small>
              {dashboard.servicioMasVendido
                ? `${dashboard.servicioMasVendido.cantidad} venta(s)`
                : 'Sin actividad'}
            </small>
          </div>
        </article>
        <article>
          <span className="kpi-icon">
            <AppIcon name="bottle" size={27} />
          </span>
          <div>
            <span>Insumo con menos paquetes</span>
            <strong>
              {dashboard.insumoMasBajo
                ? `${dashboard.insumoMasBajo.paquetes} ${dashboard.insumoMasBajo.tipoPaquete.toLowerCase()}${dashboard.insumoMasBajo.paquetes === 1 ? '' : 's'}`
                : 'Sin insumos'}
            </strong>
            <small>{dashboard.insumoMasBajo?.nombre ?? 'Inventario vacío'}</small>
          </div>
        </article>
      </div>

      <div className="dashboard-grid">
        <article className="chart-card chart-wide">
          <header>
            <div>
              <h3>Autos atendidos</h3>
              <p>Vehículos distintos por día en el periodo</p>
            </div>
            <strong>{dashboard.autosAtendidosHoy} en total</strong>
          </header>
          <LineChart
            data={dashboard.actividadSemanal.map((item) => ({
              label: item.etiqueta,
              value: item.autos
            }))}
            formatValue={(value) => String(Math.round(value))}
          />
        </article>

        <article className="chart-card chart-wide">
          <header>
            <div>
              <h3>Facturación</h3>
              <p>Facturación diaria en el periodo</p>
            </div>
            <strong>{money.format(dashboard.facturacionHoy)} en total</strong>
          </header>
          <LineChart
            data={dashboard.actividadSemanal.map((item) => ({
              label: item.etiqueta,
              value: item.facturacion
            }))}
            color="#0284C7"
            formatValue={(value) => money.format(value)}
          />
        </article>

        <article className="chart-card">
          <header>
            <div>
              <h3>Servicios más vendidos</h3>
              <p>Ranking del periodo</p>
            </div>
          </header>
          <HorizontalBarChart
            data={dashboard.serviciosVendidos.map((item) => ({
              label: item.nombre,
              value: item.cantidad,
              suffix: 'venta(s)'
            }))}
            emptyMessage="Todavía no existen servicios completados en este periodo."
          />
        </article>

        <article className="chart-card">
          <header>
            <div>
              <h3>Inventario actual</h3>
              <p>Paquetes disponibles por insumo</p>
            </div>
          </header>
          <HorizontalBarChart
            data={dashboard.inventarioActual.map((item) => ({
              label: item.nombre,
              value: item.paquetes,
              suffix: item.tipoPaquete.toLowerCase()
            }))}
            color="#38BDF8"
            emptyMessage="Registre insumos en Inventario para ver el resumen."
          />
        </article>

        <article className="chart-card chart-wide">
          <header>
            <div>
              <h3>Ingresos frente a egresos</h3>
              <p>Movimiento de caja en el periodo</p>
            </div>
          </header>
          <ComparisonChart
            data={dashboard.actividadSemanal.map((item) => ({
              label: item.etiqueta,
              first: item.ingresos,
              second: item.egresos
            }))}
            firstLabel="Ingresos"
            secondLabel="Egresos"
            formatValue={(value) => money.format(value)}
          />
        </article>

        <article className="chart-card chart-wide">
          <header>
            <div>
              <h3>Resultado diario</h3>
              <p>
                Diferencia entre ingresos y egresos en {chartPointCount} día
                {chartPointCount === 1 ? '' : 's'}
              </p>
            </div>
          </header>
          <BalanceChart
            data={dashboard.actividadSemanal.map((item) => ({
              label: item.etiqueta,
              value: item.ingresos - item.egresos
            }))}
            formatValue={(value) => money.format(value)}
          />
        </article>

        <article className={`financial-summary ${financial.tone}`}>
          <div>
            <span>¿Estamos ganando o solo moviendo dinero?</span>
            <h3>{financial.title}</h3>
            <p>{financial.detail}</p>
          </div>
          <div className="financial-numbers">
            <span>
              Ingresos <strong>{money.format(dashboard.ingresosHoy)}</strong>
            </span>
            <span>
              Egresos <strong>{money.format(dashboard.egresosHoy)}</strong>
            </span>
          </div>
        </article>
      </div>

      <div className="cards compact-cards">
        <article>
          <strong>{dashboard.ordenesPendientes}</strong>
          <span>Órdenes pendientes</span>
        </article>
        <article>
          <strong>{dashboard.insumosCriticos}</strong>
          <span>Insumos críticos</span>
        </article>
        <article>
          <strong>{dashboard.clientes}</strong>
          <span>Clientes registrados</span>
        </article>
      </div>
    </section>
  )
}