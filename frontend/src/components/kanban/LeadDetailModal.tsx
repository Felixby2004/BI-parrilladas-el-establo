import { useState } from 'react'
import { clsx } from 'clsx'
import type { LeadKanban, EstadoLead } from '@/types'
import { KANBAN_COLUMNS, INTERES_LABELS } from '@/types'
import { leadsService } from '@/services/api'

interface LeadDetailModalProps {
  lead: LeadKanban
  onClose: () => void
  onUpdated: () => void
}

const ESTADOS: EstadoLead[] = ['nuevo', 'contactado', 'respondio', 'ganado', 'perdido']

export function LeadDetailModal({ lead, onClose, onUpdated }: LeadDetailModalProps) {
  const [estado, setEstado] = useState<EstadoLead>(lead.estado as EstadoLead)
  const [notas, setNotas] = useState(lead.notas || '')
  const [loading, setLoading] = useState(false)

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="card w-full max-w-lg animate-slide-up">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-lg font-display font-bold text-white">
              {lead.buyer_nombre || 'Lead sin nombre'}
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">
              Lead #{lead.id_lead} · {lead.buyer_telefono || lead.buyer_email || 'Sin contacto'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost text-gray-400 hover:text-white p-1 rounded-lg"
          >
            ✕
          </button>
        </div>

        {/* Info */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-dark-600 rounded-xl p-3">
            <p className="label">Interés</p>
            <p className="text-sm text-white">
              {lead.interes_confirmado ? INTERES_LABELS[lead.interes_confirmado] : '—'}
            </p>
          </div>
          <div className="bg-dark-600 rounded-xl p-3">
            <p className="label">Personas</p>
            <p className="text-sm text-white">{lead.personas_estimadas || '—'}</p>
          </div>
          <div className="bg-dark-600 rounded-xl p-3">
            <p className="label">Fecha preferida</p>
            <p className="text-sm text-white">
              {lead.fecha_preferida
                ? new Date(lead.fecha_preferida).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
                : '—'}
            </p>
          </div>
          <div className="bg-dark-600 rounded-xl p-3">
            <p className="label">Campaña</p>
            <p className="text-sm text-white">{lead.campana_nombre || '—'}</p>
          </div>
        </div>

        {/* Cambiar estado */}
        <div className="mb-5">
          <label className="label">Mover en Kanban</label>
          <div className="flex flex-wrap gap-2">
            {ESTADOS.map(e => {
              const col = KANBAN_COLUMNS.find(c => c.id === e)!
              return (
                <button
                  key={e}
                  onClick={() => setEstado(e)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150',
                    estado === e
                      ? 'bg-brand-500 border-brand-400 text-white'
                      : 'bg-dark-600 border-dark-400 text-gray-400 hover:border-gray-300'
                  )}
                >
                  {col.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Notas */}
        <div className="mb-6">
          <label className="label">Notas internas</label>
          <textarea
            value={notas}
            onChange={e => setNotas(e.target.value)}
            rows={3}
            placeholder="Agrega notas sobre este lead..."
            className="input-field resize-none"
          />
        </div>

        {/* Acciones */}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={loading}
            className="btn-primary flex-1 justify-center"
          >
            {loading ? '⏳ Guardando...' : '✓ Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}
