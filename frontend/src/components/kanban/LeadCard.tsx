import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import type { LeadKanban } from '@/types'
import { INTERES_LABELS } from '@/types'

interface LeadCardProps {
  lead: LeadKanban
  onMoved: () => void
  onSelect: (lead: LeadKanban) => void
}

const ESTADO_CONFIG: Record<string, { badge: string; dot: string }> = {
  nuevo:      { badge: 'badge-nuevo',      dot: 'bg-blue-400'   },
  contactado: { badge: 'badge-contactado', dot: 'bg-yellow-400' },
  respondio:  { badge: 'badge-respondio',  dot: 'bg-purple-400' },
  ganado:     { badge: 'badge-ganado',     dot: 'bg-green-400'  },
  perdido:    { badge: 'badge-perdido',    dot: 'bg-red-400'    },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `hace ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs}h`
  return `hace ${Math.floor(hrs / 24)}d`
}

export function LeadCard({ lead, onMoved, onSelect }: LeadCardProps) {
  const navigate = useNavigate()
  const cfg = ESTADO_CONFIG[lead.estado] || ESTADO_CONFIG.nuevo
  const initials = (lead.buyer_nombre || 'NN')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const avatarColors = [
    'from-blue-500 to-indigo-600',
    'from-orange-500 to-red-600',
    'from-green-500 to-teal-600',
    'from-purple-500 to-pink-600',
    'from-yellow-500 to-amber-600',
  ]
  const colorIdx = lead.id_lead % avatarColors.length

  const handleClick = () => {
    navigate(`/leads/${lead.id_lead}/negociacion`)
  }

  const handleEstadoClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect(lead)
  }

  return (
    <div className="lead-card group" onClick={handleClick}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className={clsx(
          'w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center',
          'text-xs font-bold text-white flex-shrink-0',
          avatarColors[colorIdx]
        )}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-white truncate leading-tight">
            {lead.buyer_nombre || 'Sin nombre'}
          </p>
          <p className="text-[11px] text-gray-500 truncate mt-0.5">
            {lead.buyer_telefono || lead.buyer_email || 'Sin contacto'}
          </p>
        </div>
        <button
          onClick={handleEstadoClick}
          className={clsx('badge text-[10px] flex-shrink-0 hover:opacity-80 transition-opacity', cfg.badge)}
          title="Cambiar estado"
        >
          <span className={clsx('w-1.5 h-1.5 rounded-full', cfg.dot)} />
          {lead.estado}
        </button>
      </div>

      {/* Interés */}
      {lead.interes_confirmado && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-dark-600 border border-dark-500">
          <p className="text-xs text-gray-300">
            {INTERES_LABELS[lead.interes_confirmado] || lead.interes_confirmado}
          </p>
        </div>
      )}

      {/* Detalles */}
      <div className="flex items-center gap-3 text-[11px] text-gray-500 mb-3">
        {lead.personas_estimadas && (
          <span className="flex items-center gap-1">
            👥 <span>{lead.personas_estimadas} personas</span>
          </span>
        )}
        {lead.fecha_preferida && (
          <span className="flex items-center gap-1">
            📅 <span>{new Date(lead.fecha_preferida + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}</span>
          </span>
        )}
      </div>

      {/* Campaña */}
      {lead.campana_nombre && (
        <div className="mb-3">
          <span className="inline-flex items-center gap-1 text-[10px] bg-brand-500/10 text-brand-400 border border-brand-500/20 px-2 py-0.5 rounded-full">
            📣 {lead.campana_nombre}
          </span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-dark-600">
        <span className="text-[10px] text-gray-600">#{lead.id_lead}</span>
        <span className="text-[10px] text-brand-500/70 group-hover:text-brand-400 transition-colors font-medium">
          Negociar →
        </span>
        <span className="text-[10px] text-gray-600">{timeAgo(lead.created_at)}</span>
      </div>
    </div>
  )
}
