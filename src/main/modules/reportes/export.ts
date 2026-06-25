import { BrowserWindow, dialog } from 'electron'
import { writeFile } from 'node:fs/promises'
import type { ReporteResumen } from '../../../shared/types/domain'

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const money = (value: number): string =>
  new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(value)

function reportHtml(report: ReporteResumen): string {
  const rows = report.ordenes
    .map(
      (orden) => `<tr>
        <td>${orden.id}</td><td>${escapeHtml(orden.fecha)}</td>
        <td>${escapeHtml(orden.cliente)}</td><td>${escapeHtml(orden.placa)}</td>
        <td>${escapeHtml(orden.servicios)}</td><td>${escapeHtml(orden.metodoPago)}</td>
        <td>${money(orden.total)}</td>
      </tr>`
    )
    .join('')
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;color:#172033;padding:24px;font-size:12px}
    h1{margin:0 0 4px;font-size:22px} h2{margin:24px 0 8px;font-size:16px}
    .periodo{color:#647085;margin-bottom:18px}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
    .card{border:1px solid #dce1ea;padding:10px;border-radius:6px}.card strong{display:block;font-size:16px}
    table{width:100%;border-collapse:collapse}th,td{padding:7px;border:1px solid #dce1ea;text-align:left}
    th{background:#eef1f6}
  </style></head><body>
    <h1>Reporte operativo - LA Aguilar Silva</h1>
    <div class="periodo">Periodo: ${escapeHtml(report.desde)} al ${escapeHtml(report.hasta)}</div>
    <div class="cards">
      <div class="card"><span>Autos atendidos</span><strong>${report.autosAtendidos}</strong></div>
      <div class="card"><span>Facturación</span><strong>${money(report.facturacion)}</strong></div>
      <div class="card"><span>Resultado de caja</span><strong>${money(report.resultado)}</strong></div>
      <div class="card"><span>Ingresos</span><strong>${money(report.ingresos)}</strong></div>
      <div class="card"><span>Egresos</span><strong>${money(report.egresos)}</strong></div>
      <div class="card"><span>Servicio más vendido</span><strong>${escapeHtml(report.servicioMasVendido ?? 'Sin datos')}</strong></div>
    </div>
    <h2>Órdenes completadas</h2>
    <table><thead><tr><th>#</th><th>Fecha</th><th>Cliente</th><th>Placa</th><th>Servicios</th><th>Pago</th><th>Total</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="7">Sin órdenes en el periodo</td></tr>'}</tbody></table>
  </body></html>`
}

const xml = (value: unknown): string => escapeHtml(value)

function reportExcel(report: ReporteResumen): string {
  const row = (values: (string | number)[]): string =>
    `<Row>${values
      .map(
        (value) =>
          `<Cell><Data ss:Type="${typeof value === 'number' ? 'Number' : 'String'}">${xml(value)}</Data></Cell>`
      )
      .join('')}</Row>`
  const summary = [
    row(['Indicador', 'Valor']),
    row(['Desde', report.desde]),
    row(['Hasta', report.hasta]),
    row(['Autos atendidos', report.autosAtendidos]),
    row(['Facturación', report.facturacion]),
    row(['Ingresos', report.ingresos]),
    row(['Egresos', report.egresos]),
    row(['Resultado', report.resultado]),
    row(['Servicio más vendido', report.servicioMasVendido ?? 'Sin datos'])
  ].join('')
  const orders = [
    row(['Orden', 'Fecha', 'Cliente', 'Placa', 'Servicios', 'Pago', 'Total']),
    ...report.ordenes.map((item) =>
      row([
        item.id,
        item.fecha,
        item.cliente,
        item.placa,
        item.servicios,
        item.metodoPago,
        item.total
      ])
    )
  ].join('')
  return `<?xml version="1.0" encoding="UTF-8"?>
  <?mso-application progid="Excel.Sheet"?>
  <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
    xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
    <Worksheet ss:Name="Resumen"><Table>${summary}</Table></Worksheet>
    <Worksheet ss:Name="Ordenes"><Table>${orders}</Table></Worksheet>
  </Workbook>`
}

export async function exportarReportePdf(
  report: ReporteResumen,
  parent?: BrowserWindow
): Promise<string | null> {
  const options = {
    title: 'Guardar reporte PDF',
    defaultPath: `reporte-${report.desde}-${report.hasta}.pdf`,
    filters: [{ name: 'Documento PDF', extensions: ['pdf'] }]
  }
  const result = parent
    ? await dialog.showSaveDialog(parent, options)
    : await dialog.showSaveDialog(options)
  if (result.canceled || !result.filePath) return null

  const window = new BrowserWindow({ show: false })
  try {
    await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(reportHtml(report))}`)
    const data = await window.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4'
    })
    await writeFile(result.filePath, data)
    return result.filePath
  } finally {
    window.destroy()
  }
}

export async function exportarReporteExcel(
  report: ReporteResumen,
  parent?: BrowserWindow
): Promise<string | null> {
  const options = {
    title: 'Guardar reporte para Excel',
    defaultPath: `reporte-${report.desde}-${report.hasta}.xls`,
    filters: [{ name: 'Libro de Excel', extensions: ['xls'] }]
  }
  const result = parent
    ? await dialog.showSaveDialog(parent, options)
    : await dialog.showSaveDialog(options)
  if (result.canceled || !result.filePath) return null
  await writeFile(result.filePath, reportExcel(report), 'utf8')
  return result.filePath
}
