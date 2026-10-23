import { clsx } from 'clsx'
import {
  Beef,
  CalendarDays,
  Check,
  CreditCard,
  ReceiptText,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import type { Perfil360 } from '@/types/leads'
import { TERMINOS_COCCION, OCASIONES } from '@/types/leads'
import { StatusBadge, type Tone } from '@/components/ui/kit'

interface PerfilLeadProps {
  perfil: Perfil360
}

const ETAPA_TONE: Record<string, Tone> = {
  buyer: 'info',
  lead: 'gold',
  payer: 'sage',
  customer: 'wine',
}

function InfoRow({ label, value }: { label: string; value?: string | number | boolean | null }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div className="flex items-start justify-between gap-3 border-b border-arena-200/[0.05] py-1.5 last:border-0">
      <span className="shrink-0 text-[10.5px] text-arena-300/45">{label}</span>
      <span className="text-right text-[11px] font-medium text-arena-200">{String(value)}</span>
    </div>
  )
}

function SectionCard({
  title,
  icon: Icon,
  accent = 'text-gold-400',
  children,
}: {
  title: string
  icon: typeof Beef
  accent?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-arena-200/[0.07] bg-dark-800/70 p-4">
      <p className="mb-3 flex items-center gap-2 text-[9.5px] font-bold uppercase tracking-[0.16em] text-arena-300/55">
        <Icon size={12} strokeWidth={1.8} className={accent} />
        {title}
      </p>
      {children}
    </section>
  )
}

export function PerfilLead({ perfil }: PerfilLeadProps) {
  const { perfil_gustos: pg, perfil_reserva: pr, pedido_activo: ped, pago_adelanto: pago } = perfil
  const etapa = perfil.buyer_etapa || 'buyer'
  const initials = (perfil.buyer_nombre || 'C')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="space-y-3 overflow-y-auto pb-1">

      {/* Cabecera */}
      <div className="relative overflow-hidden rounded-2xl border border-arena-200/[0.08] bg-dark-800/80 p-4">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-vino-900/20 via-transparent to-transparent" />
        <div className="relative flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-vino-700/40 bg-vino-900/30 font-display text-sm font-bold text-arena-100">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-[15px] font-semibold leading-tight text-arena-50">
              {perfil.buyer_nombre || 'Sin nombre'}
            </h3>
            <p className="mt-0.5 truncate text-[10.5px] text-arena-300/50">
              {perfil.buyer_telefono || perfil.buyer_email || 'Sin contacto'}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <StatusBadge tone={ETAPA_TONE[etapa] ?? 'neutral'}>{etapa}</StatusBadge>
              {perfil.buyer_canal && (
                <span className="truncate text-[9.5px] text-arena-300/45">{perfil.buyer_canal}</span>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-wider text-arena-400/45">Lead</p>
            <p className="font-display text-lg font-semibold text-gold-400 tabular">#{perfil.id_lead}</p>
          </div>
        </div>
      </div>

      {/* Gustos */}
      {pg ? (
        <SectionCard title="Preferencias gastronómicas" icon={Beef} accent="text-vino-300">
          <div>
            <InfoRow label="Cortes favoritos" value={pg.tipos_corte_preferidos} />
            <InfoRow
              label="Término"
              value={pg.termino_coccion ? TERMINOS_COCCION[pg.termino_coccion] || pg.termino_coccion : undefined}
            />
            <InfoRow label="Bebidas" value={pg.bebidas_preferidas} />
            <InfoRow label="Entradas" value={pg.entradas_preferidas} />
            <InfoRow label="Guarniciones" value={pg.guarniciones_preferidas} />
            <InfoRow label="Postres" value={pg.postres_preferidos} />
            {pg.presupuesto_por_persona && (
              <InfoRow label="Presupuesto/persona" value={`$${pg.presupuesto_por_persona} MXN`} />
            )}
            {pg.restricciones_dieteticas && <InfoRow label="Restricciones" value={pg.restricciones_dieteticas} />}
            {pg.alergias && !['ninguna', 'ninguno', 'no', 'n/a', '-'].includes(pg.alergias.trim().toLowerCase()) && (
              <div className="mt-2 rounded-lg border border-[#C46666]/25 bg-[#C46666]/[0.07] p-2.5">
                <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-[#E0A3A3]">
                  <TriangleAlert size={11} />
                  Alergias
                </p>
                <p className="mt-1 text-[11px] text-[#E8B4B4]">{pg.alergias}</p>
              </div>
            )}
          </div>
        </SectionCard>
      ) : (
        <div className="rounded-2xl border border-dashed border-arena-200/[0.09] p-4 text-center">
          <Beef size={18} strokeWidth={1.4} className="mx-auto text-arena-400/30" />
          <p className="mt-1.5 text-[10.5px] text-arena-300/35">Sin perfil de gustos. Recopila preferencias en el chat.</p>
        </div>
      )}

      {/* Reserva */}
      {pr ? (
        <SectionCard title="Datos de reserva" icon={CalendarDays} accent="text-[#A8C6E0]">
          <div>
            <InfoRow
              label="Fecha"
              value={pr.fecha_reserva
                ? new Date(pr.fecha_reserva + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: '2-digit', month: 'long' })
                : undefined}
            />
            <InfoRow label="Horario" value={pr.hora_inicio ? `${pr.hora_inicio} – ${pr.hora_fin || '?'}` : undefined} />
            <InfoRow label="Personas" value={pr.numero_personas} />
            <InfoRow label="Adultos / niños" value={pr.numero_adultos !== undefined ? `${pr.numero_adultos} / ${pr.numero_ninos || 0}` : undefined} />
            <InfoRow label="Ocasión" value={pr.ocasion_especial ? OCASIONES[pr.ocasion_especial] || pr.ocasion_especial : undefined} />
            <InfoRow label="Festejado" value={pr.nombre_festejado} />

            {(pr.requiere_decoracion || pr.requiere_musica || pr.requiere_pastel) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {pr.requiere_decoracion && <StatusBadge tone="wine">Decoración</StatusBadge>}
                {pr.requiere_musica && <StatusBadge tone="gold">Música</StatusBadge>}
                {pr.requiere_pastel && <StatusBadge tone="rose">Pastel</StatusBadge>}
              </div>
            )}

            {pr.peticiones_especiales && (
              <div className="mt-2 rounded-lg border border-[#B58AC9]/25 bg-[#B58AC9]/[0.07] p-2.5">
                <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-[#D2B6E2]">
                  <Sparkles size={11} />
                  Peticiones especiales
                </p>
                <p className="mt-1 text-[11px] text-[#DCC5EA]">{pr.peticiones_especiales}</p>
              </div>
            )}

            <div className="mt-2.5">
              <StatusBadge
                tone={pr.estado_reserva === 'confirmada' ? 'sage' : pr.estado_reserva === 'cancelada' ? 'rose' : 'gold'}
                dot
              >
                Reserva {pr.estado_reserva}
              </StatusBadge>
            </div>
          </div>
        </SectionCard>
      ) : (
        <div className="rounded-2xl border border-dashed border-arena-200/[0.09] p-4 text-center">
          <CalendarDays size={18} strokeWidth={1.4} className="mx-auto text-arena-400/30" />
          <p className="mt-1.5 text-[10.5px] text-arena-300/35">Sin datos de reserva. Solicita fecha y personas en el chat.</p>
        </div>
      )}

      {/* Pedido */}
      {ped && (
        <SectionCard title="Pedido activo" icon={ReceiptText} accent="text-sage-400">
          <div className="space-y-1.5">
            {ped.detalles.map((d, i) => (
              <div key={i} className="flex justify-between gap-2 text-[11px]">
                <span className="min-w-0 truncate text-arena-300/75">{d.cantidad}× {d.nombre_producto}</span>
                <span className="shrink-0 text-arena-300/55 tabular">${(d.precio_unitario * d.cantidad).toFixed(0)}</span>
              </div>
            ))}
            <div className="mt-2 flex justify-between border-t border-arena-200/[0.07] pt-2">
              <span className="text-[10.5px] font-semibold text-arena-200">Total</span>
              <span className="font-display text-sm font-semibold text-gold-300 tabular">${Number(ped.total).toFixed(2)} MXN</span>
            </div>
          </div>
        </SectionCard>
      )}

      {/* Pago */}
      {pago && (
        <div className={clsx(
          'rounded-2xl border p-4',
          pago.estado === 'aprobado'
            ? 'border-sage-500/25 bg-sage-500/[0.07]'
            : 'border-gold-500/25 bg-gold-500/[0.06]',
        )}>
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em]">
            {pago.estado === 'aprobado' ? <Check size={12} className="text-sage-400" /> : <CreditCard size={12} className="text-gold-400" />}
            <span className={pago.estado === 'aprobado' ? 'text-sage-300' : 'text-gold-300'}>
              Adelanto {pago.estado === 'aprobado' ? 'pagado' : 'pendiente'}
            </span>
          </p>
          <div className="mt-2">
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
