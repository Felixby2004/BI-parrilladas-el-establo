/** Pydantic serializa Decimal como string; los componentes operan con números. */
export type ApiNumber = number | string

export function apiNumber(value: ApiNumber, field = 'Valor numérico'): number {
  if ((typeof value !== 'number' && typeof value !== 'string') ||
      (typeof value === 'string' && value.trim() === '')) {
    throw new Error(`${field} no válido en la respuesta de la API`)
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error(`${field} no válido en la respuesta de la API`)
  return parsed
}
