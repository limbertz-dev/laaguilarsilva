import type { EgresoInput, MovimientoManualInput } from '../../../shared/schemas/inputs'

export const cajaRepository = {
  getSummary: () => window.api.caja.resumen(),
  registerExpense: (input: EgresoInput) => window.api.caja.registrarEgreso(input),
  registerMovement: (input: MovimientoManualInput) => window.api.caja.registrarMovimiento(input)
}
