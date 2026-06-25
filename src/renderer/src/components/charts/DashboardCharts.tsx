import type { CSSProperties } from 'react'

interface SeriesPoint {
  label: string
  value: number
}

function shouldShowChartLabel(index: number, total: number): boolean {
  if (total <= 10) return true
  if (total <= 20) return index % 2 === 0 || index === total - 1
  if (total <= 31) return index % 5 === 0 || index === total - 1
  return index % 7 === 0 || index === total - 1
}

function chartColumnStyle(count: number): CSSProperties {
  const minWidth = count > 14 ? 22 : 38
  return {
    gridTemplateColumns: `repeat(${count}, minmax(${minWidth}px, 1fr))`,
    minWidth: `${Math.max(count * (minWidth + 8), 480)}px`
  }
}

interface LineChartProps {
  data: SeriesPoint[]
  color?: string
  formatValue?: (value: number) => string
}

export function LineChart({
  data,
  color = '#0284C7',
  formatValue = String
}: LineChartProps): React.JSX.Element {
  const pointWidth = data.length > 14 ? 28 : 44
  const width = Math.max(640, data.length * pointWidth + 92)
  const height = 230
  const padding = { top: 22, right: 20, bottom: 42, left: 52 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const max = Math.max(...data.map((item) => item.value), 1)
  const points = data.map((item, index) => ({
    ...item,
    x: padding.left + (index * chartWidth) / Math.max(data.length - 1, 1),
    y: padding.top + chartHeight - (item.value / max) * chartHeight,
    showLabel: shouldShowChartLabel(index, data.length)
  }))

  return (
    <div className="chart-scroll">
      <svg
        className="line-chart"
        viewBox={`0 0 ${width} ${height}`}
        style={{ minWidth: width }}
        role="img"
        aria-label="Gráfico de tendencia"
      >
        {[0, 0.5, 1].map((ratio) => {
          const y = padding.top + chartHeight * ratio
          const value = max * (1 - ratio)
          return (
            <g key={ratio}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} />
              <text x={padding.left - 8} y={y + 4} textAnchor="end">
                {formatValue(value)}
              </text>
            </g>
          )
        })}
        <polyline
          points={points.map((point) => `${point.x},${point.y}`).join(' ')}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((point) => (
          <g key={`${point.label}-${point.x}`}>
            <circle cx={point.x} cy={point.y} r="4.5" fill="white" stroke={color} strokeWidth="3">
              <title>
                {point.label}: {formatValue(point.value)}
              </title>
            </circle>
            {point.showLabel ? (
              <text x={point.x} y={height - 14} textAnchor="middle">
                {point.label}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
    </div>
  )
}

interface ComparisonChartProps {
  data: {
    label: string
    first: number
    second: number
  }[]
  firstLabel: string
  secondLabel: string
  formatValue: (value: number) => string
}

export function ComparisonChart({
  data,
  firstLabel,
  secondLabel,
  formatValue
}: ComparisonChartProps): React.JSX.Element {
  const max = Math.max(...data.flatMap((item) => [item.first, item.second]), 1)
  const dense = data.length > 10

  return (
    <div>
      <div className="chart-legend">
        <span>
          <i className="legend-income" /> {firstLabel}
        </span>
        <span>
          <i className="legend-expense" /> {secondLabel}
        </span>
      </div>
      <div className="chart-scroll">
        <div
          className={`comparison-chart ${dense ? 'chart-dense' : ''}`}
          style={chartColumnStyle(data.length)}
          role="img"
          aria-label={`${firstLabel} y ${secondLabel}`}
        >
          {data.map((item, index) => (
            <div className="comparison-column" key={`${item.label}-${index}`}>
              <div className="comparison-bars">
                <div
                  className="comparison-bar income"
                  style={{ height: `${(item.first / max) * 100}%` }}
                  title={`${item.label} · ${firstLabel}: ${formatValue(item.first)}`}
                />
                <div
                  className="comparison-bar expense"
                  style={{ height: `${(item.second / max) * 100}%` }}
                  title={`${item.label} · ${secondLabel}: ${formatValue(item.second)}`}
                />
              </div>
              {shouldShowChartLabel(index, data.length) ? <span>{item.label}</span> : <span />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

interface BalanceChartProps {
  data: {
    label: string
    value: number
  }[]
  formatValue: (value: number) => string
}

export function BalanceChart({ data, formatValue }: BalanceChartProps): React.JSX.Element {
  const max = Math.max(...data.map((item) => Math.abs(item.value)), 1)
  const dense = data.length > 10

  return (
    <div>
      <div className="chart-legend">
        <span>
          <i className="legend-positive" /> Ganancia
        </span>
        <span>
          <i className="legend-negative" /> Pérdida
        </span>
      </div>
      <div className="chart-scroll">
        <div
          className={`balance-chart ${dense ? 'chart-dense' : ''}`}
          style={chartColumnStyle(data.length)}
          role="img"
          aria-label="Resultado diario de caja"
        >
          {data.map((item, index) => {
            const height = `${(Math.abs(item.value) / max) * 100}%`
            const tone = item.value > 0 ? 'positive' : 'negative'

            return (
              <div className="balance-column" key={`${item.label}-${index}`}>
                <div className="balance-plot">
                  <div className="balance-half balance-positive">
                    {item.value > 0 && (
                      <div
                        className={`balance-bar ${tone}`}
                        style={{ height }}
                        title={`${item.label}: ${formatValue(item.value)}`}
                      />
                    )}
                  </div>
                  <div className="balance-half balance-negative">
                    {item.value < 0 && (
                      <div
                        className={`balance-bar ${tone}`}
                        style={{ height }}
                        title={`${item.label}: ${formatValue(item.value)}`}
                      />
                    )}
                  </div>
                </div>
                {shouldShowChartLabel(index, data.length) ? <span>{item.label}</span> : <span />}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

interface HorizontalBarChartProps {
  data: {
    label: string
    value: number
    suffix?: string
  }[]
  emptyMessage: string
  color?: string
}

export function HorizontalBarChart({
  data,
  emptyMessage,
  color = '#38BDF8'
}: HorizontalBarChartProps): React.JSX.Element {
  if (data.length === 0) return <p className="chart-empty">{emptyMessage}</p>
  const max = Math.max(...data.map((item) => item.value), 1)

  return (
    <div className="horizontal-chart">
      {data.map((item) => (
        <div className="horizontal-row" key={`${item.label}-${item.suffix ?? ''}`}>
          <div className="horizontal-label">
            <span>{item.label}</span>
            <strong>
              {item.value} {item.suffix}
            </strong>
          </div>
          <div className="horizontal-track">
            <div
              className="horizontal-bar"
              style={{ width: `${(item.value / max) * 100}%`, backgroundColor: color }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}