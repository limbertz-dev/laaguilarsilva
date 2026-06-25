export const toCents = (value: number): number => Math.round(value * 100)
export const fromCents = (value: unknown): number => Number(value) / 100
export const toId = (value: number | bigint): number => Number(value)

const CONCEPTO_MAX_LENGTH = 120

export function formatMovimientoFechaHora(value: string | Date = new Date()): string {
  const fecha =
    typeof value === 'string' ? new Date(`${value.replace(' ', 'T')}Z`) : value

  return fecha.toLocaleString('es-BO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function buildConceptoConFecha(prefix: string, suffix: string): string {
  const maxSuffix = Math.max(1, CONCEPTO_MAX_LENGTH - prefix.length)
  const suffixVisible =
    suffix.length > maxSuffix ? `${suffix.slice(0, maxSuffix - 1)}…` : suffix

  return `${prefix}${suffixVisible}`
}

export function buildCobroOrdenConcepto(fechaIngreso: string, cliente: string): string {
  const fechaFormateada = formatMovimientoFechaHora(fechaIngreso)
  return buildConceptoConFecha(`Cobro de orden del ${fechaFormateada} al cliente `, cliente)
}

export function buildPagoSalarioConcepto(
  nombreEmpleado: string,
  fecha: string | Date = new Date()
): string {
  const fechaFormateada = formatMovimientoFechaHora(fecha)
  return buildConceptoConFecha(`Pago de salario del ${fechaFormateada} a `, nombreEmpleado)
}

export function buildCompraInsumoConcepto(
  nombreInsumo: string,
  fecha: string | Date = new Date()
): string {
  const fechaFormateada = formatMovimientoFechaHora(fecha)
  return buildConceptoConFecha(`Compra del ${fechaFormateada} de `, nombreInsumo)
}
