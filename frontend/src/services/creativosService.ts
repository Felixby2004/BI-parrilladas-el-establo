import api from './api'

export type FormatoCreativo = '9:16' | '4:5'
export interface CreativeConfig {
  proveedor: string
  configurado: boolean
  modelo: string
  formatos: FormatoCreativo[]
  pomelli_url: string
  pomelli_integracion: string
  nota: string
}
export interface CreativeRequest {
  prompt: string
  formato: FormatoCreativo
  texto_publicitario: string
  llamada_accion: string
}
export interface CreativeResult {
  proveedor: string
  modelo: string
  formato: FormatoCreativo
  mime_type: 'image/png' | 'image/jpeg' | 'image/webp'
  imagen_base64: string
  ancho: number
  alto: number
  texto: string
  brief: string
  advertencia: string
}
export const creativosService = {
  configuracion: () => api.get<CreativeConfig>('/creativos/configuracion').then(r => r.data),
  generar: (data: CreativeRequest) => api.post<CreativeResult>('/creativos/generar', data, { timeout: 135_000 }).then(r => r.data),
}
