import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import {
  CalendarDays,
  Megaphone,
  Save,
  Tag,
  Users,
  X,
} from 'lucide-react'
import type { LeadKanban, EstadoLead } from '@/types'
import { KANBAN_COLUMNS, INTERES_LABELS } from '@/types'
import { leadsService } from '@/services/api'
import { StatusBadge, type Tone } from '@/components/ui/kit'

interface LeadDetailModalProps {
  lead: LeadKanban
  onClose: () => void
  onUpdated: () => void
}

const ESTADOS: EstadoLead[] = ['nuevo', 'contactado', 'respondio', 'ganado', 'perdido']

const ESTADO_TONE: Record<EstadoLead, Tone> = {
  nuevo: 'info',
  contactado: 'gold',
  respondio: 'wine',
  ganado: 'sage',
  perdido: 'rose',
}

export function LeadDetailModal({ lead, onClose, onUpdated }: LeadDetailModalProps) {
  const [estado, setEstado] = useState<EstadoLead>(lead.estado as EstadoLead)
  const [notas, setNotas] = useState(lead.notas || '')
  const [loading, setLoading] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const handleGuardar = async () => {
    setLoading(true)
    try {
      await leadsService.actualizarEstado(lead.id_lead, estado, notas)
      onUpdated()
      onClose()
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const initials = (lead.buyer_nombre || 'NN')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const info = [
    { label: 'Interés', value: lead.interes_confirmado ? INTERES_LABELS[lead.interes_confirmado] || lead.interes_confirmado : '—', icon: Tag },
    { label: 'Personas', value: lead.personas_estimadas ? `${lead.personas_estimadas} comensales` : '—', icon: Users },
    {
      label: 'Fecha preferida',
      value: lead.fecha_preferida
        ? new Date(lead.fecha_preferida + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
        : '—',
      icon: CalendarDays,
    },
    { label: 'Campaña', value: lead.campana_nombre || 'Sin campaña', icon: Megaphone },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-modal-title"
        className="w-full max-w-lg animate-slide-up overflow-hidden rounded-[24px] border border-arena-200/10 bg-dark-800 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.95)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-arena-200/[0.07] p-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-vino-700/40 bg-vino-900/30 font-display text-sm font-bold text-arena-100">
              {initials}
            </span>
            <div className="min-w-0">
              <h2 id="lead-modal-title" className="truncate font-display text-lg font-semibold leading-tight text-arena-50">
                {lead.buyer_nombre || 'Lead sin nombre'}
              </h2>
              <p className="mt-0.5 truncate text-[11px] text-arena-300/50">
                Lead #{lead.id_lead} · {lead.buyer_telefono || lead.buyer_email || 'Sin contacto'}
              </p>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="btn-icon h-9 w-9 shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[70dvh] overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-2.5">
            {info.map(item => {
              const Icon = item.icon
              return (
                <div key={item.label} className="rounded-xl border border-arena-200/[0.06] bg-dark-900/40 p-3">
                  <p className="flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-arena-400/60">
                    <Icon size={11} strokeWidth={1.8} />
                    {item.label}
                  </p>
                  <p className="mt-1.5 line-clamp-2 text-[12px] font-medium text-arena-200">{item.value}</p>
                </div>
              )
            })}
          </div>

          <div className="mt-5">
            <p className="label">Mover en el embudo</p>
            <div className="flex flex-wrap gap-2">
              {ESTADOS.map(e => {
                const col = KANBAN_COLUMNS.find(c => c.id === e)!
                const active = estado === e
                return (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEstado(e)}
                    className={clsx(
                      'rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-all',
                      active
                        ? 'border-vino-600/60 bg-vino-900 text-arena-50 shadow-glow-vino-sm'
                        : 'border-arena-200/[0.08] bg-dark-900/40 text-arena-300/60 hover:border-arena-200/15 hover:text-arena-100',
                    )}
                  >
                    {col.label}
                  </button>
                )
              })}
            </div>
            <div className="mt-2.5">
              <StatusBadge tone={ESTADO_TONE[estado]} dot>
                Estado seleccionado: {estado}
              </StatusBadge>
            </div>
          </div>

          <div className="mt-5">
            <label htmlFor="lead-notas" className="label">Notas internas</label>
            <textarea
              id="lead-notas"
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={3}
              placeholder="Agrega contexto sobre este lead…"
              className="input-field resize-none text-[12.5px]"
            />
          </div>
        </div>

        <div className="flex gap-2 border-t border-arena-200/[0.07] p-4">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5 text-xs">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleGuardar}
            disabled={loading}
            className="btn-primary flex-1 py-2.5 text-xs"
          >
            {loading ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-arena-100 border-t-transparent" /> : <Save size={14} />}
            {loading ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}
