import type { ReporteFiltroInput } from '../../../shared/schemas/inputs'
import { api } from '../lib/api-client'

export const dashboardRepository = {
  get: (filtro: ReporteFiltroInput) => api.dashboard(filtro)
}