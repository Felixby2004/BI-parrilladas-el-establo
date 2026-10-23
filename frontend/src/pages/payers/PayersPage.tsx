import { useState, useEffect, useCallback } from 'react'
import { clsx } from 'clsx'
import {
  Armchair,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Flame,
  Landmark,
  Printer,
  ReceiptText,
  RefreshCw,
  Smartphone,
  Table2,
  Wallet,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react'
import api from '@/services/api'
import { apiErrorMessage } from '@/services/errors'
import { apiNumber, type ApiNumber } from '@/services/numbers'
import {
  EmptyState,
  SectionHeader,
  SegmentedTabs,
  StatCard,
  StatusBadge,
  type Tone,
} from '@/components/ui/kit'

interface PayerRow {
  id_payer: number
  id_pedido: number
  id_lead: number
  estado: string
  buyer_nombre?: string
  buyer_telefono?: string
  mesa_numero?: string
  total_pedido: number
  monto_adelanto_pagado: number
  monto_saldo: number
  fecha_llegada?: string
  created_at: string
}

type PayerResponse = Omit<PayerRow, 'total_pedido' | 'monto_adelanto_pagado' | 'monto_saldo'> & {
  total_pedido: ApiNumber
  monto_adelanto_pagado: ApiNumber
  monto_saldo: ApiNumber
}

interface Comprobante {
  folio: string
  subtotal: number
  descuento: number
  total: number
  adelanto_aplicado: number
  saldo_cobrado: number
  metodo_pago_saldo?: string
  cliente_nombre?: string
  created_at: string
}

type ComprobanteResponse = Omit<Comprobante, 'subtotal' | 'descuento' | 'total' | 'adelanto_aplicado' | 'saldo_cobrado'> & {
  subtotal: ApiNumber
  descuento: ApiNumber
  total: ApiNumber
  adelanto_aplicado: ApiNumber
  saldo_cobrado: ApiNumber
}

interface Mesa {
  id_mesa: number
  numero: string
  capacidad: number
  sector?: string
  estado: string
}

const METODOS_PAGO: { id: string; label: string; short: string; icon: LucideIcon }[] = [
  { id: 'mercado_pago', label: 'Mercado Pago Point', short: 'Point', icon: Smartphone },
  { id: 'tarjeta',      label: 'Tarjeta bancaria',   short: 'Tarjeta', icon: CreditCard },
  { id: 'efectivo',     label: 'Efectivo',            short: 'Efectivo', icon: Banknote },
  { id: 'transferencia',label: 'Transferencia',       short: 'Transferencia', icon: Landmark },
]

const MESA_ESTADO: Record<string, { label: string; dot: string; icon: LucideIcon; tone: Tone }> = {
  disponible:    { label: 'Disponible', dot: 'bg-sage-500', icon: Armchair,     tone: 'sage' },
  ocupada:       { label: 'Ocupada',    dot: 'bg-vino-500', icon: Flame,        tone: 'wine' },
  reservada:     { label: 'Reservada',  dot: 'bg-gold-500', icon: CalendarDays, tone: 'gold' },
  mantenimiento: { label: 'Mantenimiento', dot: 'bg-arena-400', icon: Wrench,   tone: 'neutral' },
}

const SECTOR_LABEL: Record<string, string> = {
  salon: 'Salón principal',
  terraza: 'Terraza',
  privado: 'Salón privado',
  barra: 'Barra',
}

function MesaGrid({ mesas, onSelect }: { mesas: Mesa[], onSelect: (m: Mesa) => void }) {
  const sectores = Array.from(new Set(mesas.map(m => m.sector?.trim() || 'salon')))

  return (
    <div className="space-y-7">
      {sectores.map(sector => {
        const delSector = mesas.filter(m => (m.sector?.trim() || 'salon') === sector)
        return (
          <div key={sector}>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-arena-300/55">{SECTOR_LABEL[sector] || sector}</p>
              <span className="text-[10px] text-arena-400/45">{delSector.length} mesas</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {delSector.map(m => {
                const meta = MESA_ESTADO[m.estado] || MESA_ESTADO.disponible
                const Icon = meta.icon
                return (
                  <button
                    key={m.id_mesa}
                    type="button"
                    onClick={() => onSelect(m)}
                    aria-label={`Mesa ${m.numero}, ${m.capacidad} personas, ${meta.label}`}
                    className={clsx('mesa-card group', `mesa-${m.estado}`)}
                  >
                    <span className="absolute right-2.5 top-2.5 flex items-center gap-1.5">
                      <span className={clsx('h-1.5 w-1.5 rounded-full', meta.dot)} />
                      <span className="text-[8px] font-bold uppercase tracking-wider text-arena-300/45">{meta.label}</span>
                    </span>
                    <Icon size={22} strokeWidth={1.4} className="mt-2 text-arena-200/70 transition-transform duration-200 group-hover:-translate-y-0.5" />
                    <span className="font-display text-base font-semibold text-arena-50">Mesa {m.numero}</span>
                    <span className="text-[9.5px] text-arena-300/45">{m.capacidad} personas</span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ComprobanteModal({ comp, onClose }: { comp: Comprobante, onClose: () => void }) {
  const handleImprimir = () => window.print()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const rows = [
    { label: 'Subtotal',        value: comp.subtotal,          color: 'text-[#3b2d24]', prefix: '' },
    { label: 'Descuento',       value: comp.descuento,         color: 'text-[#3f6c55]', prefix: comp.descuento > 0 ? '-' : '' },
    { label: 'Total',           value: comp.total,             color: 'text-[#241b17]', prefix: '' },
    { label: 'Adelanto pagado', value: comp.adelanto_aplicado, color: 'text-[#3f6c55]', prefix: comp.adelanto_aplicado > 0 ? '-' : '' },
    { label: 'Saldo cobrado',   value: comp.saldo_cobrado,     color: 'text-[#7F011F]', bold: true },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm animate-fade-in"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-md">
        <div role="dialog" aria-modal="true" aria-labelledby="comprobante-title" className="receipt-paper animate-slide-up overflow-hidden rounded-[24px] border border-arena-200/10 bg-[#f8f1e6] text-[#241b17] shadow-2xl">
          <div className="relative border-b border-[#e2d4c0] p-5 text-center">
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar comprobante"
              className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-[#8b7058] transition-colors hover:bg-black/5 print:hidden"
            >
              <X size={15} />
            </button>
            <img src="/images/logo_emblema.png" alt="El Establo" className="mx-auto h-14 w-14 object-contain" />
            <h2 id="comprobante-title" className="mt-2 font-display text-xl font-semibold tracking-wide">Parrilladas El Establo</h2>
            <p className="receipt-muted mt-0.5 text-[10px] text-[#8b7058]">RFC: XAXX010101000</p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#7F011F]/20 bg-[#7F011F]/[0.06] px-3 py-1">
              <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-[#7F011F]">Folio</span>
              <span className="text-[12px] font-bold tabular">{comp.folio}</span>
            </div>
          </div>

          <div className="p-5">
            <div className="receipt-line flex justify-between border-b border-[#e2d4c0] pb-3 text-[11px]">
              <span className="receipt-muted text-[#8b7058]">Cliente</span>
              <span className="font-semibold">{comp.cliente_nombre || 'Consumidor final'}</span>
            </div>
            <div className="receipt-line flex justify-between border-b border-[#e2d4c0] py-2 text-[10px]">
              <span className="receipt-muted text-[#8b7058]">Fecha</span>
              <span>{new Date(comp.created_at).toLocaleString('es-MX')}</span>
            </div>

            <div className="mt-3 space-y-1.5">
              {rows.map(row => (
                <div key={row.label} className={clsx('receipt-line flex items-center justify-between border-b border-[#eadfce] py-1.5 last:border-0', row.bold && 'mt-1 border-t border-[#d8c7ad] pt-2.5')}>
                  <span className={clsx('text-[11px]', row.bold ? 'font-semibold text-[#241b17]' : 'receipt-muted text-[#8b7058]')}>{row.label}</span>
                  <span className={clsx('tabular', row.bold ? 'font-display text-base font-bold text-[#7F011F]' : `text-[12px] font-medium ${row.color}`)}>
                    {row.prefix}${row.value.toFixed(2)} MXN
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-[#e2d4c0] bg-white/45 p-3 text-center">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#8b7058]">Método de cobro</p>
              <p className="mt-0.5 text-[12px] font-semibold">
                {METODOS_PAGO.find(m => m.id === comp.metodo_pago_saldo)?.label
                  || comp.metodo_pago_saldo?.replace(/_/g, ' ')
                  || 'N/A'}
              </p>
            </div>

            <div className="mt-4 text-center">
              <p className="font-display text-sm font-semibold text-[#7F011F]">Gracias por visitarnos</p>
              <p className="receipt-muted mt-0.5 text-[10px] text-[#8b7058]">Te esperamos pronto en El Establo.</p>
            </div>
          </div>

          <div className="flex gap-2 border-t border-[#e2d4c0] p-4 print:hidden">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-[#d8c7ad] bg-white/50 px-4 py-2.5 text-[11px] font-semibold text-[#5c4a3c] transition-colors hover:bg-white">
              Cerrar
            </button>
            <button type="button" onClick={handleImprimir} className="btn-primary flex-1 py-2.5 text-[11px]">
              <Printer size={13} />
              Imprimir
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PayersPage() {
  const [payers, setPayers] = useState<PayerRow[]>([])
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cobrando, setCobrando] = useState<number | null>(null)
  const [metodoPago, setMetodoPago] = useState('mercado_pago')
  const [comprobante, setComprobante] = useState<Comprobante | null>(null)
  const [activeTab, setActiveTab] = useState<'caja' | 'mesas'>(() =>
    window.location.hash === '#mesas' ? 'mesas' : 'caja',
  )

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [payersR, mesasR] = await Promise.all([
        api.get<PayerResponse[]>('/payers').then(r => r.data),
        api.get<Mesa[]>('/mesas').then(r => r.data),
      ])
      setPayers(payersR.map(p => ({
        ...p,
        total_pedido: apiNumber(p.total_pedido, 'Total del pedido'),
        monto_adelanto_pagado: apiNumber(p.monto_adelanto_pagado, 'Adelanto'),
        monto_saldo: apiNumber(p.monto_saldo, 'Saldo'),
      })))
      setMesas(mesasR)
    } catch (e) { setError(apiErrorMessage(e, 'No se pudo cargar la caja y las mesas.')) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleCobrar = async (payer: PayerRow) => {
    if (cobrando !== null) return
    setCobrando(payer.id_payer)
    setError('')
    let cobroRegistrado = false
    try {
      await api.post('/caja/cobrar-saldo', {
        id_payer: payer.id_payer,
        tipo_pago: metodoPago,
        procesado_por: 'Cajero',
      })
      cobroRegistrado = true
      const { data: comp } = await api.get<ComprobanteResponse>(`/caja/comprobante/${payer.id_payer}`)
      setComprobante({
        ...comp,
        subtotal: apiNumber(comp.subtotal, 'Subtotal'),
        descuento: apiNumber(comp.descuento, 'Descuento'),
        total: apiNumber(comp.total, 'Total'),
        adelanto_aplicado: apiNumber(comp.adelanto_aplicado, 'Adelanto'),
        saldo_cobrado: apiNumber(comp.saldo_cobrado, 'Saldo cobrado'),
      })
      await fetchData()
    } catch (e) {
      if (cobroRegistrado) await fetchData()
      const detail = apiErrorMessage(e, 'No se pudo cargar el comprobante.')
      setError(cobroRegistrado
        ? `El cobro fue registrado. No vuelvas a cobrar. ${detail}`
        : apiErrorMessage(e, 'No se pudo confirmar el cobro. Actualiza la caja antes de reintentar.'))
    } finally {
      setCobrando(null)
    }
  }

  const pendientes = payers.filter(p => p.estado !== 'saldo_pagado' && p.estado !== 'finalizado')
  const cobrados   = payers.filter(p => p.estado === 'saldo_pagado' || p.estado === 'finalizado')
  const totalPendiente = pendientes.reduce((acc, p) => acc + p.monto_saldo, 0)
  const totalCobrado = cobrados.reduce((acc, p) => acc + p.total_pedido, 0)
  const metodoActual = METODOS_PAGO.find(m => m.id === metodoPago) ?? METODOS_PAGO[0]

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-arena-200/[0.07] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="eyebrow">Payers / Caja</span>
            <span className="h-1 w-1 rounded-full bg-arena-400/30" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-arena-400/45">Cobranza</span>
          </div>
          <h1 className="page-title mt-2">Caja y cobranza</h1>
          <p className="page-subtitle">
            Cobra el saldo restante, asigna mesas y entrega comprobantes sin fricción.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge tone="sage" dot>Mercado Pago Sandbox</StatusBadge>
          <button onClick={fetchData} className="btn-secondary px-3 py-2 text-[11px]">
            <RefreshCw size={13} className={loading ? 'animate-spin' : undefined} />
            Actualizar
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Pendientes" value={pendientes.length} hint="Mesas por cobrar" icon={Wallet} tone="gold" />
        <StatCard label="Cobrados" value={cobrados.length} hint="Saldos liquidados" icon={CheckCircle2} tone="sage" />
        <StatCard label="Por cobrar" value={`$${totalPendiente.toFixed(0)}`} hint="MXN en saldo pendiente" icon={ReceiptText} tone="wine" />
        <StatCard label="Cobrado" value={`$${totalCobrado.toFixed(0)}`} hint="MXN en pedidos cerrados" icon={ArrowUpRight} tone="info" />
      </div>

      {error && (
        <div role="alert" className="flex flex-col gap-2 rounded-2xl border border-[#C46666]/30 bg-[#C46666]/[0.06] p-4 text-[12px] text-[#E0A3A3] sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <button onClick={fetchData} className="btn-secondary self-start px-3 py-1.5 text-[10.5px] sm:self-auto">
            <RefreshCw size={12} />
            Actualizar caja
          </button>
        </div>
      )}

      <SegmentedTabs
        value={activeTab}
        onChange={tab => {
          setActiveTab(tab)
          window.history.replaceState(null, '', `#${tab}`)
        }}
        items={[
          { id: 'caja', label: 'Cola de caja', icon: Wallet, badge: pendientes.length },
          { id: 'mesas', label: 'Mapa de mesas', icon: Table2, badge: mesas.length },
        ]}
      />

      {activeTab === 'caja' && (
        <div className="space-y-5 animate-fade-in">
          {/* Método */}
          <div className="card">
            <SectionHeader
              eyebrow="Cobro"
              title="Método de cobro"
              description={`Se aplicará a los próximos cobros: ${metodoActual.label}.`}
              icon={CreditCard}
            />
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {METODOS_PAGO.map(m => {
                const Icon = m.icon
                const active = metodoPago === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMetodoPago(m.id)}
                    aria-pressed={active}
                    className={clsx(
                      'flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all',
                      active
                        ? 'border-vino-600/50 bg-vino-900/25 text-arena-50 shadow-glow-vino-sm'
                        : 'border-arena-200/[0.07] bg-dark-900/30 text-arena-300/60 hover:border-arena-200/15 hover:text-arena-100',
                    )}
                  >
                    <Icon size={15} className={active ? 'text-gold-400' : 'text-arena-400/50'} />
                    <span className="min-w-0">
                      <span className="block truncate text-[11px] font-semibold">{m.short}</span>
                      <span className="block truncate text-[9px] text-arena-400/45">{m.label}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Cola */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-arena-300/55">Pendientes de cobro</p>
              <span className="text-[10px] text-arena-400/45">{pendientes.length} cuentas</span>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-28 animate-pulse rounded-2xl bg-arena-200/[0.05]" />)}
              </div>
            ) : pendientes.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Cola de caja vacía"
                description="Todos los payers han sido cobrados. Buen servicio."
              />
            ) : (
              pendientes.map(p => (
                <div key={p.id_payer} className="card card-hover flex flex-col gap-4 p-4 md:flex-row md:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-vino-700/40 bg-vino-900/30 font-display text-sm font-bold text-arena-100">
                      {(p.buyer_nombre || 'C').charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-display text-[15px] font-semibold text-arena-50">{p.buyer_nombre || 'Cliente'}</p>
                      <p className="mt-0.5 truncate text-[10.5px] text-arena-300/45">
                        {p.buyer_telefono || '—'} · Lead #{p.id_lead}
                      </p>
                      {p.mesa_numero && (
                        <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-gold-500/20 bg-gold-500/[0.06] px-2 py-0.5 text-[9px] text-gold-300">
                          <Armchair size={10} />
                          Mesa {p.mesa_numero}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 md:w-[290px] md:grid-cols-3 md:text-right">
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-arena-400/45">Total</p>
                      <p className="mt-0.5 text-[11.5px] font-semibold text-arena-200 tabular">${p.total_pedido.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-arena-400/45">Adelanto</p>
                      <p className="mt-0.5 text-[11.5px] font-semibold text-sage-400 tabular">
                        {p.monto_adelanto_pagado > 0 ? '-' : ''}${p.monto_adelanto_pagado.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-arena-400/45">Saldo</p>
                      <p className="mt-0.5 font-display text-base font-semibold text-gold-300 tabular">${p.monto_saldo.toFixed(2)}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCobrar(p)}
                    disabled={cobrando !== null}
                    className="btn-primary shrink-0 px-4 py-2.5 text-[11px] md:self-center"
                  >
                    {cobrando === p.id_payer ? (
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-arena-100 border-t-transparent" />
                    ) : (
                      <CreditCard size={13} />
                    )}
                    {cobrando === p.id_payer ? 'Cobrando…' : 'Cobrar saldo'}
                  </button>
                </div>
              ))
            )}
          </div>

          {cobrados.length > 0 && (
            <div className="pt-3">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-arena-300/45">Cobrados</p>
              <div className="space-y-2">
                {cobrados.map(p => (
                  <div key={p.id_payer} className="flex items-center gap-3 rounded-xl border border-arena-200/[0.06] bg-dark-800/50 px-4 py-3">
                    <CheckCircle2 size={15} className="shrink-0 text-sage-400/80" />
                    <span className="min-w-0 flex-1 truncate text-[11.5px] text-arena-300/70">{p.buyer_nombre || 'Cliente'}</span>
                    <span className="shrink-0 text-[11.5px] font-semibold text-arena-200 tabular">${p.total_pedido.toFixed(2)} MXN</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'mesas' && (
        <div className="space-y-5 animate-fade-in">
          <div className="relative overflow-hidden rounded-[24px] border border-arena-200/10">
            <img
              src="/images/campana_eventos.jpg"
              alt="Salón principal de Parrilladas El Establo"
              className="absolute inset-0 h-full w-full object-cover opacity-40"
              loading="lazy"
              decoding="async"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-dark-950 via-dark-950/85 to-dark-950/20" />
            <div className="relative flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="eyebrow">Salón</p>
                <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-arena-50">Distribución del salón</h2>
                <p className="mt-1 max-w-md text-[11.5px] text-arena-300/55">Mesas agrupadas por sector, con disponibilidad en tiempo real.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Disponible', color: 'bg-sage-500' },
                  { label: 'Ocupada', color: 'bg-vino-500' },
                  { label: 'Reservada', color: 'bg-gold-500' },
                ].map(item => (
                  <span key={item.label} className="inline-flex items-center gap-1.5 rounded-full border border-arena-200/10 bg-black/30 px-2.5 py-1 text-[9.5px] text-arena-200/75 backdrop-blur-sm">
                    <span className={clsx('h-1.5 w-1.5 rounded-full', item.color)} />
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            {mesas.length === 0 ? (
              <EmptyState
                icon={Table2}
                title="Sin mesas configuradas"
                description="Crea las mesas desde la API para visualizar la distribución del salón."
              />
            ) : (
              <MesaGrid mesas={mesas} onSelect={() => {}} />
            )}
          </div>
        </div>
      )}

      {comprobante && <ComprobanteModal comp={comprobante} onClose={() => setComprobante(null)} />}
    </div>
  )
}
