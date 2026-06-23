import { useEffect, useState } from 'react'
import type { Dashboard } from '../../../../shared/types/domain'
import {
  BalanceChart,
  ComparisonChart,
  HorizontalBarChart,
  LineChart
} from '../../components/charts/DashboardCharts'
import { useAppFeedback } from '../../hooks/useAppFeedback'
import { dashboardRepository } from '../../repositories/dashboard.repository'
import { money } from '../../utils/format'
import { AppIcon } from '../../components/ui/AppIcon'

function financialAnswer(result: number): { title: string; detail: string; tone: string } {
  if (result > 0) {
    return {
      title: 'Estamos generando ganancia',
      detail: `El resultado de caja de hoy es positivo en ${money.format(result)}.`,
      tone: 'positive'
    }
  }
  if (result < 0) {
    return {
      title: 'Hoy gastamos más de lo que ingresó',
      detail: `El resultado de caja de hoy es ${money.format(result)}.`,
      tone: 'negative'
    }
  }
  return {
    title: 'Hoy solo estamos moviendo dinero',
    detail: 'Los ingresos y egresos están equilibrados.',
    tone: 'neutral'
  }
}

export function DashboardPage(): React.JSX.Element {
  const [dashboard, setDashboard] = useState<Dashboard>()
  const { showMessage, clearMessage } = useAppFeedback()

  useEffect(() => {
    clearMessage()
    dashboardRepository
      .get()
      .then(setDashboard)
      .catch((error) => showMessage(String(error)))
  }, [clearMessage, showMessage])

  if (!dashboard) return <p>Cargando resumen...</p>

  const financial = financialAnswer(dashboard.resultadoHoy)

  return (
    <section>
      <div className="dashboard-heading">
        <div>
          <h2>Actividad del negocio</h2>
          <p>Indicadores diarios y tendencias para tomar decisiones.</p>
        </div>
      </div>

      <div className="cards dashboard-kpis">
        <article>
          <span className="kpi-icon">
            <AppIcon name="car" size={27} />
          </span>
          <div>
            <span>Autos atendidos hoy</span>
            <strong>{dashboard.autosAtendidosHoy}</strong>
            <small>Vehículos entregados</small>
          </div>
        </article>
        <article>
          <span className="kpi-icon">
            <AppIcon name="receipt" size={27} />
          </span>
          <div>
            <span>Facturación de hoy</span>
            <strong>{money.format(dashboard.facturacionHoy)}</strong>
            <small>Ingresos por servicios</small>
          </div>
        </article>
        <article>
          <span className="kpi-icon">
            <AppIcon name="award" size={27} />
          </span>
          <div>
            <span>Servicio más vendido hoy</span>
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
            <span>Shampoo consumido hoy</span>
            <strong>
              {dashboard.shampooConsumido
                ? `${dashboard.shampooConsumido.cantidad} ${dashboard.shampooConsumido.unidad}`
                : 'Sin consumo'}
            </strong>
            <small>Consumo registrado</small>
          </div>
        </article>
      </div>

      <div className="dashboard-grid">
        <article className="chart-card chart-wide">
          <header>
            <div>
              <h3>Autos atendidos</h3>
              <p>Vehículos distintos durante los últimos 7 días</p>
            </div>
            <strong>{dashboard.autosAtendidosHoy} hoy</strong>
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
              <p>Facturación diaria de los últimos 7 días</p>
            </div>
            <strong>{money.format(dashboard.facturacionHoy)} hoy</strong>
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
              <p>Ranking de los últimos 30 días</p>
            </div>
          </header>
          <HorizontalBarChart
            data={dashboard.serviciosVendidos.map((item) => ({
              label: item.nombre,
              value: item.cantidad,
              suffix: 'venta(s)'
            }))}
            emptyMessage="Todavía no existen servicios completados."
          />
        </article>

        <article className="chart-card">
          <header>
            <div>
              <h3>Consumo de insumos</h3>
              <p>Cantidades descontadas en los últimos 30 días</p>
            </div>
          </header>
          <HorizontalBarChart
            data={dashboard.consumoInsumos.map((item) => ({
              label: item.nombre,
              value: item.cantidad,
              suffix: item.unidad
            }))}
            color="#38BDF8"
            emptyMessage="Configure recetas de servicios para registrar consumos."
          />
        </article>

        <article className="chart-card chart-wide">
          <header>
            <div>
              <h3>Ingresos frente a egresos</h3>
              <p>Movimiento de caja de los últimos 7 días</p>
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
              <p>Diferencia entre ingresos y egresos de los últimos 7 días</p>
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
