export const normalizeText = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')

export const parseDecimal = (value: unknown): number => {
  const normalized = normalizeText(value).replace(',', '.')
  return normalized === '' ? Number.NaN : Number(normalized)
}

export const formNumber = (form: FormData, key: string): number => parseDecimal(form.get(key))

export const formText = (form: FormData, key: string): string => normalizeText(form.get(key))
