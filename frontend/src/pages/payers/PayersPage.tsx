import { useState, useEffect, useCallback } from 'react'
import { clsx } from 'clsx'
import api from '@/services/api'
import { apiErrorMessage } from '@/services/errors'
import { apiNumber, type ApiNumber } from '@/services/numbers'

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

const METODOS_PAGO = [
  { id: 'mercado_pago', label: 'Mercado Pago Point', emoji: '📱' },
  { id: 'tarjeta',      label: 'Tarjeta bancaria',   emoji: '💳' },
  { id: 'efectivo',     label: 'Efectivo',            emoji: '💵' },
  { id: 'transferencia',label: 'Transferencia',       emoji: '🏦' },
]

function MesaGrid({ mesas, onSelect }: { mesas: Mesa[], onSelect: (m: Mesa) => void }) {
  const estadoClass: Record<string, string> = {
    disponible:   'mesa-disponible',
    ocupada:      'mesa-ocupada',
    reservada:    'mesa-reservada',
    mantenimiento:'mesa-mantenimiento',
  }

  return (
    <div className="grid grid-cols-4 gap-3">
      {mesas.map(m => (
        <button
          key={m.id_mesa}
          onClick={() => onSelect(m)}
          className={clsx('mesa-card', estadoClass[m.estado] || 'mesa-disponible')}
        >
          <span className="text-2xl mb-1">
            {m.estado === 'ocupada' ? '🔥' : m.estado === 'reservada' ? '📅' : '🪑'}
          </span>
          <span className="text-sm font-display font-bold text-arena-200">Mesa {m.numero}</span>
          <span className="text-[10px] text-dark-300 mt-0.5">{m.capacidad} personas</span>
          <span className={clsx(
            'text-[9px] font-bold px-2 py-0.5 rounded-full mt-1 border',
            m.estado === 'disponible' ? 'text-green-400 border-green-500/30 bg-green-500/10' :
            m.estado === 'ocupada'    ? 'text-vino-300 border-vino-700/30 bg-vino-900/20' :
            'text-yellow-400 border-yellow-500/30 bg-yellow-500/10'
          )}>
            {m.estado}
          </span>
        </button>
      ))}
    </div>
  )
}

function ComprobanteModal({ comp, onClose }: { comp: Comprobante, onClose: () => void }) {
  const handleImprimir = () => window.print()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="card max-w-md w-full animate-slide-up print:shadow-none print:border-none">
        {/* Header imprimible */}
        <div className="text-center mb-6 pb-4 border-b border-dark-500">
          <div className="text-4xl mb-2">🔥</div>
          <h2 className="font-display font-bold text-xl text-arena-200">Parrilladas El Establo</h2>
          <p className="text-xs text-dark-300 mt-1">RFC: XAXX010101000</p>
          <div className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-vino-900/30 border border-vino-700/30">
            <span className="text-[10px] font-bold text-vino-300">FOLIO</span>
            <span className="text-sm font-bold text-arena-200">{comp.folio}</span>
          </div>
        </div>

        {/* Cliente */}
        <div className="mb-4 p-3 bg-dark-600 rounded-xl border border-dark-400">
          <p className="text-[10px] text-dark-300 mb-1">CLIENTE</p>
          <p className="text-sm font-semibold text-arena-200">{comp.cliente_nombre || 'Consumidor Final'}</p>
          <p className="text-xs text-dark-300">{new Date(comp.created_at).toLocaleString('es-MX')}</p>
        </div>

        {/* Montos */}
        <div className="space-y-2 mb-4">
          {[
            { label: 'Subtotal',       value: comp.subtotal,         color: 'text-arena-300' },
            { label: 'Descuento',      value: comp.descuento,        color: 'text-green-400', prefix: '-' },
            { label: 'Total',          value: comp.total,            color: 'text-arena-200' },
            { label: 'Adelanto pagado',value: comp.adelanto_aplicado, color: 'text-green-400', prefix: '-' },
            { label: 'Saldo cobrado',  value: comp.saldo_cobrado,    color: 'text-arena-200',  bold: true },
          ].map(row => (
            <div key={row.label} className="flex justify-between items-center py-1.5 border-b border-dark-600 last:border-0">
              <span className="text-xs text-dark-300">{row.label}</span>
              <span className={clsx('text-sm', row.color, row.bold && 'font-bold text-base')}>
                {row.prefix}${row.value.toFixed(2)} MXN
              </span>
            </div>
          ))}
        </div>

        {/* Método de pago */}
        <div className="text-center text-xs text-dark-300 mb-6">
          Método: <span className="text-arena-300 font-semibold">{comp.metodo_pago_saldo || 'N/A'}</span>
        </div>

        {/* Mensaje */}
        <div className="text-center py-3 bg-vino-900/20 rounded-xl border border-vino-800/30 mb-6">
          <p className="text-xs text-arena-300">¡Gracias por visitarnos! 🔥</p>
          <p className="text-[10px] text-dark-300 mt-0.5">Te esperamos pronto</p>
        </div>

        {/* Acciones */}
        <div className="flex gap-3 print:hidden">
          <button onClick={onClose} className="btn-ghost flex-1 justify-center">Cerrar</button>
          <button onClick={handleImprimir} className="btn-primary flex-1 justify-center">
            🖨️ Imprimir comprobante
          </button>
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
  const [activeTab, setActiveTab] = useState<'caja' | 'mesas'>('caja')

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
      // Si sólo falló el GET anidado, no invitar a repetir un cobro ya registrado.
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

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">💳 PAYERS — Caja</h1>
          <p className="page-subtitle">Cobro del saldo restante · Generación de comprobantes</p>
        </div>
        <div className="flex gap-3">
          <div className="stat-card px-4 py-3 text-center min-w-[80px]">
            <p className="text-2xl font-bold text-arena-200">{pendientes.length}</p>
            <p className="text-[10px] text-dark-300">Pendientes</p>
          </div>
          <div className="stat-card px-4 py-3 text-center min-w-[80px]">
            <p className="text-2xl font-bold text-green-400">{cobrados.length}</p>
            <p className="text-[10px] text-dark-300">Cobrados hoy</p>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="card mb-4 border-red-500/40 text-red-300 text-sm">
          {error}
          <button onClick={fetchData} className="btn-ghost ml-3 text-sm">Actualizar caja</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 bg-dark-700 p-1 rounded-xl border border-dark-400 w-fit">
        {[{ id: 'caja', label: '💳 Cola de Caja' }, { id: 'mesas', label: '🪑 Mapa de Mesas' }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-semibold transition-all',
              activeTab === t.id ? 'bg-vino-gradient text-arena-200 shadow-glow-vino-sm' : 'text-arena-300/50 hover:text-arena-200'
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Método de pago */}
      {activeTab === 'caja' && (
        <div className="card mb-6">
          <p className="label mb-3">Método de cobro por defecto</p>
          <div className="flex flex-wrap gap-2">
            {METODOS_PAGO.map(m => (
              <button key={m.id} onClick={() => setMetodoPago(m.id)}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all',
                  metodoPago === m.id
                    ? 'bg-vino-900/30 border-vino-700 text-arena-200 shadow-glow-vino-sm'
                    : 'bg-dark-600 border-dark-400 text-arena-300/50 hover:border-dark-300'
                )}>
                <span>{m.emoji}</span> {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* COLA DE CAJA */}
      {activeTab === 'caja' && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-16"><p className="text-dark-300">Cargando...</p></div>
          ) : pendientes.length === 0 ? (
            <div className="card text-center py-16">
              <div className="text-5xl mb-4">✅</div>
              <p className="text-arena-300 font-semibold">Cola de caja vacía</p>
              <p className="text-dark-300 text-sm mt-1">Todos los payers han sido cobrados</p>
            </div>
          ) : (
            pendientes.map(p => (
              <div key={p.id_payer} className="card card-hover flex items-center gap-5">
                {/* Avatar */}
                <div className="w-12 h-12 rounded-2xl bg-vino-gradient flex items-center justify-center text-arena-200 font-bold text-lg flex-shrink-0 shadow-glow-vino-sm">
                  {(p.buyer_nombre || 'C').charAt(0)}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold text-arena-200">{p.buyer_nombre || 'Cliente'}</p>
                  <p className="text-xs text-dark-300 mt-0.5">{p.buyer_telefono || '—'} · Lead #{p.id_lead}</p>
                  {p.mesa_numero && (
                    <span className="inline-flex items-center gap-1 text-[10px] bg-vino-900/20 text-vino-300 border border-vino-800/30 px-2 py-0.5 rounded-full mt-1">
                      🪑 Mesa {p.mesa_numero}
                    </span>
                  )}
                </div>
                {/* Montos */}
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-dark-300">Total pedido</p>
                  <p className="text-lg font-bold text-arena-200">${p.total_pedido.toFixed(2)} MXN</p>
                  <p className="text-xs text-green-400">Adelanto: -${p.monto_adelanto_pagado.toFixed(2)}</p>
                  <p className="text-sm font-semibold text-yellow-300">Saldo: ${p.monto_saldo.toFixed(2)} MXN</p>
                </div>
                {/* Cobrar */}
                <button
                  onClick={() => handleCobrar(p)}
                  disabled={cobrando !== null}
                  className="btn-primary flex-shrink-0"
                >
                  {cobrando === p.id_payer ? '⏳ Cobrando...' : '💳 Cobrar saldo'}
                </button>
              </div>
            ))
          )}

          {/* Historial cobrados */}
          {cobrados.length > 0 && (
            <div className="mt-8">
              <p className="text-xs font-bold text-dark-300 uppercase tracking-widest mb-3">✅ Cobrados hoy</p>
              <div className="space-y-2">
                {cobrados.map(p => (
                  <div key={p.id_payer} className="flex items-center gap-4 px-4 py-3 rounded-xl bg-dark-700 border border-dark-400 opacity-70">
                    <span className="text-green-400 text-lg">✅</span>
                    <span className="text-sm text-arena-300 flex-1">{p.buyer_nombre}</span>
                    <span className="text-sm font-bold text-arena-200">${p.total_pedido.toFixed(2)} MXN</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MAPA DE MESAS */}
      {activeTab === 'mesas' && (
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display font-bold text-arena-200">Distribución del Salón</h2>
            <div className="flex gap-3 text-xs">
              {[['bg-dark-600 border-dark-400','Disponible'],['bg-vino-900/20 border-vino-800','Ocupada'],['bg-yellow-900/20 border-yellow-700','Reservada']].map(([cls, label]) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className={clsx('w-3 h-3 rounded border', cls)} />
                  <span className="text-dark-300">{label}</span>
                </div>
              ))}
            </div>
          </div>
          {mesas.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-dark-300 text-sm">Sin mesas configuradas</p>
              <p className="text-dark-300/50 text-xs mt-1">Créalas desde la API: POST /api/v1/mesas</p>
            </div>
          ) : (
            <MesaGrid mesas={mesas} onSelect={() => {}} />
          )}
        </div>
      )}

      {/* Modal comprobante */}
      {comprobante && (
        <ComprobanteModal comp={comprobante} onClose={() => setComprobante(null)} />
      )}
    </div>
  )
}
