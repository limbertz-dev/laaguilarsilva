export const toCents = (value: number): number => Math.round(value * 100)
export const fromCents = (value: unknown): number => Number(value) / 100
export const toId = (value: number | bigint): number => Number(value)
