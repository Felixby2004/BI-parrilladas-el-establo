import { isAxiosError } from 'axios'

/** FastAPI puede devolver detail como texto o como lista de validaciones. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!isAxiosError(error)) return fallback
  const detail: unknown = error.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail.map(item => {
      if (item && typeof item === 'object' && 'msg' in item) return String(item.msg)
      return 'Datos no válidos'
    }).join('. ')
  }
  return fallback
}
