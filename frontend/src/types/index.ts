// Tipos globales para el sistema IMPULSE

export type EtapaImpulse = 'buyer' | 'lead' | 'payer' | 'customer' | 'turned'
export type EstadoLead = 'nuevo' | 'contactado' | 'respondio' | 'ganado' | 'perdido'
export type EstadoCampana = 'borrador' | 'activa' | 'pausada' | 'finalizada'
export type PlataformaAnuncio = 'facebook' | 'instagram' | 'google' | 'tiktok' | 'whatsapp' | 'otro'
export type InteresLead = 'reserva' | 'informacion' | 'evento' | 'otro'

// ─── Buyer ──────────────────────────────────────────────
export interface Buyer {
  id_buyer: number
  nombre: string
  apellido?: string
  telefono?: string
  email?: string
  canal_captacion?: string
  etapa_impulse: EtapaImpulse
  activo: boolean
  created_at: string
}

// ─── Lead (Kanban) ───────────────────────────────────────
export interface LeadKanban {
  id_lead: number
  estado: EstadoLead
  interes_confirmado?: InteresLead | 'consulta'
  personas_estimadas?: number
  fecha_preferida?: string
  presupuesto_estimado?: number
  notas?: string
  created_at: string
  buyer_nombre?: string
  buyer_telefono?: string
  buyer_email?: string
  campana_nombre?: string
}

// Detalle mínimo devuelto por GET /leads/{id}; incluye el comprador del pedido.
export interface LeadDetalle {
  id_lead: number
  id_buyer: number
  estado: EstadoLead
}

// ─── KanbanStats ────────────────────────────────────────
export interface KanbanStats {
  nuevo: number
  contactado: number
  respondio: number
  ganado: number
  perdido: number
  total: number
}

// ─── Campaña ────────────────────────────────────────────
export interface Campana {
  id_campana: number
  nombre: string
  descripcion?: string
  objetivo?: string
  presupuesto_total?: number
  presupuesto_gastado: number
  fecha_inicio?: string
  fecha_fin?: string
  estado: EstadoCampana
  id_buyer_persona?: number
  created_at: string
  updated_at: string
}

// ─── Formulario de Captación ────────────────────────────
export interface FormularioCaptacionPayload {
  nombre: string
  telefono: string
  email?: string
  interes: InteresLead
  mensaje?: string
  personas_aproximadas?: number
  fecha_preferida?: string
  canal?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
}

export interface FormularioCaptacionResponse {
  id_formulario: number
  id_buyer?: number
  id_lead?: number
  mensaje: string
}

// ─── Utilidades ─────────────────────────────────────────
export const KANBAN_COLUMNS: { id: EstadoLead; label: string; color: string; accent: string }[] = [
  { id: 'nuevo',      label: 'Nuevo',      color: 'border-blue-500',   accent: 'bg-blue-500'   },
  { id: 'contactado', label: 'Contactado', color: 'border-yellow-500', accent: 'bg-yellow-500' },
  { id: 'respondio',  label: 'Respondió',  color: 'border-purple-500', accent: 'bg-purple-500' },
  { id: 'ganado',     label: 'Ganado',     color: 'border-green-500',  accent: 'bg-green-500'  },
  { id: 'perdido',    label: 'Perdido',    color: 'border-red-500',    accent: 'bg-red-500'    },
]

export const INTERES_LABELS: Record<string, string> = {
  reserva: '🍖 Reserva de Mesa',
  informacion: 'ℹ️ Información General',
  consulta: 'ℹ️ Consulta General',
  evento: '🎉 Evento Privado',
  otro: '💬 Otro',
}
