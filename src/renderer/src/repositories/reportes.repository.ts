import type { ReporteFiltroInput } from '../../../shared/schemas/inputs'
import { api } from '../lib/api-client'

export const reportesRepository = {
  get: (filter: ReporteFiltroInput) => api.reportes.obtener(filter),
  exportPdf: (filter: ReporteFiltroInput) => api.reportes.exportarPdf(filter),
  exportExcel: (filter: ReporteFiltroInput) => api.reportes.exportarExcel(filter)
}
