import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  ArrowRight,
  CalendarDays,
  Mail,
  Megaphone,
  Phone,
  Users,
  UtensilsCrossed,
} from 'lucide-react'
import type { LeadKanban } from '@/types'
import { INTERES_LABELS } from '@/types'

interface LeadCardProps {
  lead: LeadKanban
  onMoved: () => void
  onSelect: (lead: LeadKanban) => void
}

const ESTADO_CONFIG: Record<string, { badge: string; dot: string }> = {
  nuevo:      { badge: 'badge-nuevo',      dot: 'bg-[#6F9FC4]' },
  contactado: { badge: 'badge-contactado', dot: 'bg-gold-500' },
  respondio:  { badge: 'badge-respondio',  dot: 'bg-[#B58AC9]' },
  ganado:     { badge: 'badge-ganado',     dot: 'bg-sage-500' },
  perdido:    { badge: 'badge-perdido',    dot: 'bg-[#C46666]' },
}

const AVATAR_COLORS = [
  'from-vino-800 to-vino-950',
  'from-gold-600 to-[#6b4f29]',
  'from-sage-600 to-[#2f5542]',
  'from-[#4b6274] to-[#253846]',
  'from-[#6a4a5e] to-[#3c2734]',
]

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `hace ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs}h`
  return `hace ${Math.floor(hrs / 24)}d`
}

export function LeadCard({ lead, onSelect }: LeadCardProps) {
  const navigate = useNavigate()
  const cfg = ESTADO_CONFIG[lead.estado] || ESTADO_CONFIG.nuevo
  const initials = (lead.buyer_nombre || 'NN')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const colorIdx = [...lead.id_lead].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % AVATAR_COLORS.length
  const ContactIcon = lead.buyer_telefono ? Phone : Mail
  const contacto = lead.buyer_telefono || lead.buyer_email || 'Sin contacto'

  return (
    <article
      className="lead-card group"
      onClick={() => navigate(`/leads/${lead.id_lead}/negociacion`)}
    >
      <div className="flex items-start gap-3">
        <div className={clsx(
          'grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-[11px] font-bold text-arena-50 ring-1 ring-inset ring-white/10',
          AVATAR_COLORS[colorIdx],
        )}>
          {initials}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-tight text-arena-50">
            {lead.buyer_nombre || 'Sin nombre'}
          </p>
          <p className="mt-1 flex items-center gap-1.5 truncate text-[10.5px] text-arena-300/50">
            <ContactIcon size={11} strokeWidth={1.7} className="shrink-0" />
            <span className="truncate">{contacto}</span>
          </p>
        </div>

        <button
          type="button"
          onClick={event => {
            event.stopPropagation()
            onSelect(lead)
          }}
          className={clsx('badge shrink-0 text-[10px] transition-opacity hover:opacity-80', cfg.badge)}
          title="Cambiar estado del lead"
        >
          <span className={clsx('h-1.5 w-1.5 rounded-full', cfg.dot)} />
          {lead.estado}
        </button>
      </div>

      {lead.interes_confirmado && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-arena-200/[0.06] bg-dark-800/70 px-2.5 py-2">
          <UtensilsCrossed size={12} strokeWidth={1.7} className="shrink-0 text-gold-400/80" />
          <p className="truncate text-[10.5px] font-medium text-arena-300/80">
            {INTERES_LABELS[lead.interes_confirmado] || lead.interes_confirmado}
          </p>
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-arena-300/50">
        {lead.personas_estimadas && (
          <span className="flex items-center gap-1.5">
            <Users size={11} strokeWidth={1.7} />
            {lead.personas_estimadas} personas
          </span>
        )}
        {lead.fecha_preferida && (
          <span className="flex items-center gap-1.5">
            <CalendarDays size={11} strokeWidth={1.7} />
            {new Date(lead.fecha_preferida + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
          </span>
        )}
      </div>

      {lead.campana_nombre && (
        <div className="mt-2.5">
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-gold-500/15 bg-gold-500/[0.06] px-2 py-0.5 text-[9.5px] text-gold-400/90">
            <Megaphone size={10} strokeWidth={1.8} className="shrink-0" />
            <span className="truncate">{lead.campana_nombre}</span>
          </span>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-arena-200/[0.06] pt-2.5">
        <span className="text-[9.5px] font-medium tabular text-arena-400/40">#{lead.id_lead}</span>
        <button
          type="button"
          onClick={event => {
            event.stopPropagation()
            navigate(`/leads/${lead.id_lead}/negociacion`)
          }}
          className="flex items-center gap-1 text-[10px] font-semibold text-gold-500/80 transition-colors hover:text-gold-300 group-hover:text-gold-300"
          aria-label={`Negociar con ${lead.buyer_nombre || 'este lead'}`}
        >
          Negociar
          <ArrowRight size={11} strokeWidth={2} />
        </button>
        <span className="text-[9.5px] text-arena-400/40">{timeAgo(lead.created_at)}</span>
      </div>
    </article>
  )
}
