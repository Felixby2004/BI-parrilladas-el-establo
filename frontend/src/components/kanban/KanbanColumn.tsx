import { clsx } from 'clsx'
import { Inbox } from 'lucide-react'
import type { LeadKanban } from '@/types'
import type { Tone } from '@/components/ui/kit'
import { LeadCard } from './LeadCard'

interface KanbanColumnProps {
  estado: string
  label: string
  description: string
  tone: Tone
  leads: LeadKanban[]
  onLeadMoved: () => void
  onLeadSelect: (lead: LeadKanban) => void
}

const DOTS: Record<Tone, string> = {
  wine: 'bg-vino-500',
  gold: 'bg-gold-500',
  sage: 'bg-sage-500',
  amber: 'bg-amber-500',
  rose: 'bg-[#C46666]',
  info: 'bg-[#6F9FC4]',
  neutral: 'bg-arena-400',
}

export function KanbanColumn({
  label, description, tone, leads, onLeadMoved, onLeadSelect,
}: KanbanColumnProps) {
  return (
    <div className="kanban-col" aria-label={`Columna ${label}`}>
      <div className="kanban-col-header">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={clsx('h-2 w-2 shrink-0 rounded-full', DOTS[tone])} />
            <h3 className="truncate text-[11px] font-bold uppercase tracking-[0.16em] text-arena-100">
              {label}
            </h3>
          </div>
          <p className="mt-1 pl-4 text-[10.5px] leading-tight text-arena-300/45">{description}</p>
        </div>
        <span className="grid h-6 min-w-6 shrink-0 place-items-center rounded-full border border-arena-200/10 bg-arena-200/[0.05] px-2 text-[10.5px] font-bold tabular text-arena-300/75">
          {leads.length}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto pb-1">
        {leads.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-arena-200/[0.06] px-4 py-8 text-center">
            <Inbox size={22} strokeWidth={1.4} className="text-arena-400/30" />
            <p className="mt-2 text-[10.5px] text-arena-300/35">Sin leads en esta etapa</p>
          </div>
        ) : (
          leads.map(lead => (
            <LeadCard
              key={lead.id_lead}
              lead={lead}
              onMoved={onLeadMoved}
              onSelect={onLeadSelect}
            />
          ))
        )}
      </div>
    </div>
  )
}
