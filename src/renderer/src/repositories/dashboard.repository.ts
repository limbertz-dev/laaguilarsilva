import type { ReporteFiltroInput } from '../../../shared/schemas/inputs'

export const dashboardRepository = {
  get: (filtro: ReporteFiltroInput) => window.api.dashboard(filtro)
}