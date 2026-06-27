import type { ReporteFiltroInput } from '../../../shared/schemas/inputs'

export const reportesRepository = {
  get: (filter: ReporteFiltroInput) => window.api.reportes.obtener(filter),
  exportPdf: (filter: ReporteFiltroInput) => window.api.reportes.exportarPdf(filter),
  exportExcel: (filter: ReporteFiltroInput) => window.api.reportes.exportarExcel(filter)
}
