import { clsx } from 'clsx'
import type { LeadKanban } from '@/types'
import { LeadCard } from './LeadCard'

interface KanbanColumnProps {
  estado: string
  label: string
  emoji: string
  description: string
  colorClass: string
  leads: LeadKanban[]
  onLeadMoved: () => void
  onLeadSelect: (lead: LeadKanban) => void
}

export function KanbanColumn({
  estado, label, emoji, description, colorClass, leads, onLeadMoved, onLeadSelect,
}: KanbanColumnProps) {
  return (
    <div className="kanban-col">
      {/* Header columna */}
      <div className="kanban-col-header">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base">{emoji}</span>
            <span className={clsx('text-[11px] font-bold uppercase tracking-wider', colorClass)}>
              {label}
            </span>
          </div>
          <p className="text-[10px] text-dark-300 mt-0.5 pl-6">{description}</p>
        </div>
        <span className="flex-shrink-0 min-w-[24px] h-6 px-2 rounded-full text-[10px] font-bold
                         bg-dark-500 border border-dark-300 text-arena-300/70 flex items-center justify-center">
          {leads.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2.5 overflow-y-auto flex-1">
        {leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 opacity-30">
            <div className="text-3xl mb-2">📭</div>
            <p className="text-[10px] text-dark-300 text-center">Sin leads en esta etapa</p>
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
