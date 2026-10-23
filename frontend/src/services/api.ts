import axios from 'axios'
import type {
  LeadKanban,
  LeadDetalle,
  KanbanStats,
  FormularioCaptacionPayload,
  FormularioCaptacionResponse,
  Campana,
} from '@/types'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
})

// ─── Captación pública ───────────────────────────────────
export const captacionService = {
  enviarFormulario: (data: FormularioCaptacionPayload) =>
    api.post<FormularioCaptacionResponse>('/captacion/formulario', data).then(r => r.data),
}

// ─── Leads ───────────────────────────────────────────────
export const leadsService = {
  detalle: (id: number) =>
    api.get<LeadDetalle>(`/leads/${id}`).then(r => r.data),

  listar: (estado?: string) =>
    api.get<LeadKanban[]>('/leads', { params: estado ? { estado } : {} }).then(r => r.data),

  listarTodos: async () => {
    const leads: LeadKanban[] = []
    const limit = 100
    for (let skip = 0; ; skip += limit) {
      const { data } = await api.get<LeadKanban[]>('/leads', { params: { skip, limit } })
      leads.push(...data)
      if (data.length < limit) return [...new Map(leads.map(lead => [lead.id_lead, lead])).values()]
    }
  },

  stats: () =>
    api.get<KanbanStats>('/leads/stats').then(r => r.data),

  actualizarEstado: (id: number, estado: string, notas?: string) =>
    api.patch<LeadKanban>(`/leads/${id}/estado`, { estado, notas }).then(r => r.data),

  eliminar: (id: number) =>
    api.delete(`/leads/${id}`),
}

// ─── Campañas ─────────────────────────────────────────────
export const campanasService = {
  listar: () =>
    api.get<Campana[]>('/campanas').then(r => r.data),

  crear: (data: Partial<Campana>) =>
    api.post<Campana>('/campanas', data).then(r => r.data),

  actualizar: (id: number, data: Partial<Campana>) =>
    api.put<Campana>(`/campanas/${id}`, data).then(r => r.data),

  eliminar: (id: number) =>
    api.delete(`/campanas/${id}`),
}

export default api
