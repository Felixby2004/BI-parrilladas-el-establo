import { clsx } from 'clsx'
import type { Perfil360 } from '@/types/leads'
import { TERMINOS_COCCION, OCASIONES } from '@/types/leads'

interface PerfilLeadProps {
  perfil: Perfil360
}

function InfoRow({ label, value }: { label: string; value?: string | number | boolean | null }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-dark-600 last:border-0">
      <span className="text-xs text-gray-500 flex-shrink-0">{label}</span>
      <span className="text-xs text-right text-gray-200 font-medium">{String(value)}</span>
    </div>
  )
}

function SectionCard({
  title,
  emoji,
  children,
  accentColor = 'border-brand-500/40',
}: {
  title: string
  emoji: string
  children: React.ReactNode
  accentColor?: string
}) {
  return (
    <div className={clsx('bg-dark-700 border rounded-xl p-4', accentColor)}>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <span>{emoji}</span> {title}
      </p>
      {children}
    </div>
  )
}

export function PerfilLead({ perfil }: PerfilLeadProps) {
  const { perfil_gustos: pg, perfil_reserva: pr, pedido_activo: ped, pago_adelanto: pago } = perfil

  const etapaColor: Record<string, string> = {
    buyer:    'bg-blue-500/20 text-blue-300 border-blue-500/30',
    lead:     'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    payer:    'bg-green-500/20 text-green-300 border-green-500/30',
    customer: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  }

  return (
    <div className="space-y-4 overflow-y-auto">

      {/* ── Cabecera del cliente ─────────────────────────── */}
      <div className="bg-gradient-to-r from-dark-700 to-dark-600 border border-dark-500 rounded-xl p-4">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-ember-500 flex items-center justify-center text-2xl font-bold text-white shadow-glow-sm flex-shrink-0">
            {(perfil.buyer_nombre || 'C').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-display font-bold text-white truncate">
              {perfil.buyer_nombre || 'Sin nombre'}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">{perfil.buyer_telefono || perfil.buyer_email || '—'}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={clsx(
                'text-[10px] px-2.5 py-1 rounded-full border font-bold uppercase tracking-wide',
                etapaColor[perfil.buyer_etapa || 'buyer'] || 'bg-dark-500 text-gray-400'
              )}>
                {perfil.buyer_etapa || 'buyer'}
              </span>
              <span className="text-[10px] text-gray-500">
                {perfil.buyer_canal && `📣 ${perfil.buyer_canal}`}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-500">Lead</p>
            <p className="text-xl font-bold text-brand-400">#{perfil.id_lead}</p>
          </div>
        </div>
      </div>

      {/* ── Perfil de Gustos ─────────────────────────────── */}
      {pg ? (
        <SectionCard title="Preferencias Gastronómicas" emoji="🥩" accentColor="border-orange-500/30">
          <div className="space-y-0">
            <InfoRow label="Cortes favoritos" value={pg.tipos_corte_preferidos} />
            <InfoRow
              label="Término cocción"
              value={pg.termino_coccion ? TERMINOS_COCCION[pg.termino_coccion] || pg.termino_coccion : undefined}
            />
            <InfoRow label="Bebidas" value={pg.bebidas_preferidas} />
            <InfoRow label="Entradas" value={pg.entradas_preferidas} />
            <InfoRow label="Guarniciones" value={pg.guarniciones_preferidas} />
            <InfoRow label="Postres" value={pg.postres_preferidos} />
            {pg.alergias && (
              <div className="mt-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-[10px] font-bold text-red-400">⚠️ Alergias</p>
                <p className="text-xs text-red-300 mt-0.5">{pg.alergias}</p>
              </div>
            )}
            <InfoRow label="Restricciones" value={pg.restricciones_dieteticas} />
            {pg.presupuesto_por_persona && (
              <InfoRow label="Presupuesto/persona" value={`$${pg.presupuesto_por_persona} MXN`} />
            )}
          </div>
        </SectionCard>
      ) : (
        <div className="bg-dark-700 border border-dashed border-dark-400 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-600">🥩 Sin perfil de gustos — recopila preferencias en el chat</p>
        </div>
      )}

      {/* ── Perfil de Reserva ────────────────────────────── */}
      {pr ? (
        <SectionCard title="Datos de Reserva" emoji="📅" accentColor="border-blue-500/30">
          <div className="space-y-0">
            <InfoRow
              label="Fecha"
              value={pr.fecha_reserva
                ? new Date(pr.fecha_reserva + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: '2-digit', month: 'long' })
                : undefined}
            />
            <InfoRow
              label="Horario"
              value={pr.hora_inicio ? `${pr.hora_inicio} – ${pr.hora_fin || '?'}` : undefined}
            />
            <InfoRow label="Personas" value={pr.numero_personas} />
            <InfoRow label="Adultos / Niños" value={pr.numero_adultos !== undefined ? `${pr.numero_adultos} / ${pr.numero_ninos || 0}` : undefined} />
            <InfoRow
              label="Ocasión"
              value={pr.ocasion_especial ? OCASIONES[pr.ocasion_especial] || pr.ocasion_especial : undefined}
            />
            {pr.nombre_festejado && <InfoRow label="Festejado" value={`🎂 ${pr.nombre_festejado}`} />}
            <div className="flex gap-2 mt-2 flex-wrap">
              {pr.requiere_decoracion && <span className="badge badge-nuevo">🎊 Decoración</span>}
              {pr.requiere_musica && <span className="badge badge-contactado">🎵 Música</span>}
              {pr.requiere_pastel && <span className="badge badge-respondio">🎂 Pastel</span>}
            </div>
            {pr.peticiones_especiales && (
              <div className="mt-2 p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <p className="text-[10px] font-bold text-purple-400">✨ Peticiones especiales</p>
                <p className="text-xs text-purple-300 mt-0.5">{pr.peticiones_especiales}</p>
              </div>
            )}
            <div className="mt-2">
              <span className={clsx(
                'badge',
                pr.estado_reserva === 'confirmada' ? 'badge-ganado' :
                pr.estado_reserva === 'cancelada' ? 'badge-perdido' : 'badge-nuevo'
              )}>
                {pr.estado_reserva}
              </span>
            </div>
          </div>
        </SectionCard>
      ) : (
        <div className="bg-dark-700 border border-dashed border-dark-400 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-600">📅 Sin datos de reserva — solicita fecha y personas en el chat</p>
        </div>
      )}

      {/* ── Pedido activo ────────────────────────────────── */}
      {ped && (
        <SectionCard title="Pedido Activo" emoji="🧾" accentColor="border-green-500/30">
          <div className="space-y-1.5">
            {ped.detalles.map((d, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-gray-300">{d.cantidad}× {d.nombre_producto}</span>
                <span className="text-gray-400">${(d.precio_unitario * d.cantidad).toFixed(0)}</span>
              </div>
            ))}
            <div className="border-t border-dark-500 pt-2 mt-2 flex justify-between">
              <span className="text-xs font-bold text-white">Total</span>
              <span className="text-sm font-bold text-brand-400">${Number(ped.total).toFixed(2)} MXN</span>
            </div>
          </div>
        </SectionCard>
      )}

      {/* ── Estado del pago ──────────────────────────────── */}
      {pago && (
        <div className={clsx(
          'rounded-xl p-4 border',
          pago.estado === 'aprobado'
            ? 'bg-green-500/10 border-green-500/30'
            : 'bg-yellow-500/10 border-yellow-500/30'
        )}>
          <p className="text-xs font-bold mb-2 flex items-center gap-1.5">
            {pago.estado === 'aprobado' ? '✅' : '💳'}
            <span className={pago.estado === 'aprobado' ? 'text-green-400' : 'text-yellow-400'}>
              Adelanto {pago.estado === 'aprobado' ? 'PAGADO' : 'pendiente'}
            </span>
          </p>
          <div className="space-y-0.5">
            <InfoRow label="Monto" value={`$${Number(pago.monto).toFixed(2)} MXN`} />
            <InfoRow label="ID MP" value={pago.mp_payment_id} />
            {pago.fecha_pago && (
              <InfoRow label="Pagado" value={new Date(pago.fecha_pago).toLocaleString('es-MX')} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
