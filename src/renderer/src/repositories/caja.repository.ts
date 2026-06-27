import type { EgresoInput, MovimientoManualInput } from '../../../shared/schemas/inputs'
import { api } from '../lib/api-client'

export const cajaRepository = {
  getSummary: () => api.caja.resumen(),
  registerExpense: (input: EgresoInput) => api.caja.registrarEgreso(input),
  registerMovement: (input: MovimientoManualInput) => api.caja.registrarMovimiento(input)
}
