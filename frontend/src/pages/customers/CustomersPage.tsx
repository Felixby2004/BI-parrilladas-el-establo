import { useState, useEffect, useCallback } from 'react'
import { clsx } from 'clsx'
import {
  CheckCircle2,
  ChefHat,
  Clock3,
  Flame,
  MessageSquareQuote,
  PackageCheck,
  RefreshCw,
  Send,
  Sparkles,
  Square,
  Star,
  Timer,
  TriangleAlert,
  UtensilsCrossed,
} from 'lucide-react'
import api from '@/services/api'
import { apiErrorMessage } from '@/services/errors'
import { apiNumber, type ApiNumber } from '@/services/numbers'
import {
  EmptyState,
  ProgressBar,
  SegmentedTabs,
  StatCard,
  StatusBadge,
} from '@/components/ui/kit'

interface ComandaItem {
  id_servicio_detalle: number
  nombre_item: string
  cantidad: number
  termino_coccion?: string
  estado_item: string
  prioridad: number
  notas_cocina?: string
}

interface Comanda {
  id_servicio: number
  mesa_numero?: string
  prioridad: string
  estado: string
  tiempo_espera_min?: number
  items: ComandaItem[]
  created_at: string
}

interface Resena {
  id_resena: number
  calificacion_general: number
  comentario?: string
  created_at: string
}

type ResenaResponse = Omit<Resena, 'calificacion_general'> & { calificacion_general: ApiNumber }
type ComandaResponse = Omit<Comanda, 'tiempo_espera_min' | 'items'> & {
  tiempo_espera_min?: ApiNumber | null
  items: (Omit<ComandaItem, 'cantidad' | 'prioridad'> & { cantidad: ApiNumber; prioridad: ApiNumber })[]
}

const ITEM_ESTADO_COLORS: Record<string, string> = {
  pendiente:  'border-arena-200/10 bg-arena-200/[0.04] text-arena-300/50',
  preparando: 'border-gold-500/30 bg-gold-500/10 text-gold-300',
  listo:      'border-sage-500/30 bg-sage-500/10 text-sage-300',
  entregado:  'border-arena-200/[0.06] bg-dark-800/40 text-arena-400/35',
}

const ITEM_ESTADOS = ['pendiente', 'preparando', 'listo', 'entregado']
const ITEM_ICONS = { pendiente: Square, preparando: Flame, listo: CheckCircle2, entregado: PackageCheck }

function ComandaCard({ comanda, onActualizar }: { comanda: Comanda, onActualizar: () => void }) {
  const [actualizando, setActualizando] = useState<number | null>(null)
  const [error, setError] = useState('')

  const cambiarEstadoItem = async (idItem: number, nuevoEstado: string) => {
    setActualizando(idItem)
    setError('')
    try {
      await api.patch<ComandaItem>(
        `/servicios/${comanda.id_servicio}/items/${idItem}`,
        { estado_item: nuevoEstado }
      )
      onActualizar()
    } catch (e) { setError(apiErrorMessage(e, 'No se pudo actualizar el ítem.')) }
    finally { setActualizando(null) }
  }

  const cambiarEstadoComanda = async (estado: string) => {
    setError('')
    try {
      await api.patch(`/servicios/${comanda.id_servicio}/estado`, undefined, { params: { estado } })
      onActualizar()
    } catch (e) { setError(apiErrorMessage(e, 'No se pudo actualizar la comanda.')) }
  }

  const listosCount = comanda.items.filter(i => i.estado_item === 'listo' || i.estado_item === 'entregado').length
  const progreso = comanda.items.length > 0 ? (listosCount / comanda.items.length) * 100 : 0

  return (
    <article className={clsx(
      'comanda-card',
      comanda.prioridad === 'vip'     ? 'comanda-vip'     :
      comanda.prioridad === 'urgente' ? 'comanda-urgente' : 'comanda-normal'
    )}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-semibold text-arena-50">
              {comanda.mesa_numero ? `Mesa ${comanda.mesa_numero}` : `Orden #${comanda.id_servicio}`}
            </h3>
            {comanda.prioridad !== 'normal' && (
              <StatusBadge tone={comanda.prioridad === 'vip' ? 'wine' : 'gold'} dot>
                {comanda.prioridad === 'vip' ? 'VIP' : 'Urgente'}
              </StatusBadge>
            )}
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-[10.5px] text-arena-300/45">
            <Clock3 size={11} />
            {comanda.tiempo_espera_min !== undefined && comanda.tiempo_espera_min >= 0
              ? `${comanda.tiempo_espera_min} min esperando`
              : 'En curso'}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {comanda.estado === 'en_espera' && (
            <button type="button" onClick={() => cambiarEstadoComanda('preparando')} className="btn-primary px-3 py-1.5 text-[10.5px]">
              <Flame size={12} />
              Iniciar
            </button>
          )}
          {comanda.estado === 'preparando' && (
            <button type="button" onClick={() => cambiarEstadoComanda('servido')} className="btn-arena px-3 py-1.5 text-[10.5px]">
              <CheckCircle2 size={12} />
              Servir
            </button>
          )}
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-1.5 flex justify-between text-[9.5px] text-arena-300/45">
          <span>Progreso</span>
          <span className="tabular">{listosCount}/{comanda.items.length} listos</span>
        </div>
        <ProgressBar value={progreso} tone={progreso === 100 ? 'sage' : 'wine'} />
      </div>

      {error && <p role="alert" className="mb-3 text-[10.5px] text-[#E0A3A3]">{error}</p>}

      <div className="space-y-2">
        {comanda.items.map(item => (
          <div key={item.id_servicio_detalle} className="flex items-center gap-3 rounded-xl border border-arena-200/[0.06] bg-dark-900/40 p-2.5">
            <div className="min-w-0 flex-1">
              <p className={clsx('text-[12px] font-medium', item.estado_item === 'entregado' ? 'text-arena-400/40 line-through' : 'text-arena-100')}>
                {item.cantidad}× {item.nombre_item}
              </p>
              {item.termino_coccion && <p className="text-[9.5px] text-arena-300/40">{item.termino_coccion}</p>}
              {item.notas_cocina && <p className="text-[9.5px] text-gold-400/90">{item.notas_cocina}</p>}
            </div>

            <div className="flex shrink-0 gap-1">
              {ITEM_ESTADOS.map(e => {
                const Icon = ITEM_ICONS[e as keyof typeof ITEM_ICONS]
                return (
                  <button
                    key={e}
                    type="button"
                    onClick={() => cambiarEstadoItem(item.id_servicio_detalle, e)}
                    disabled={actualizando === item.id_servicio_detalle}
                    aria-label={`Marcar ${item.nombre_item} como ${e}`}
                    title={e}
                    className={clsx(
                      'grid h-6 w-6 place-items-center rounded-md border transition-all',
                      item.estado_item === e
                        ? ITEM_ESTADO_COLORS[e]
                        : 'border-arena-200/[0.06] bg-transparent text-arena-400/35 hover:border-arena-200/15 hover:text-arena-200',
                    )}
                  >
                    <Icon size={11} />
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

function EstrellaRating({ value, onChange }: { value: number, onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Calificación">
      {[1, 2, 3, 4, 5].map(n => {
        const active = n <= (hovered || value)
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} estrellas`}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => onChange(n)}
            className="rounded-md p-0.5 transition-transform hover:scale-110"
          >
            <Star size={24} className={active ? 'fill-gold-400 text-gold-400' : 'text-arena-400/30'} />
          </button>
        )
      })}
    </div>
  )
}

export default function CustomersPage() {
  const [comandas, setComanadas] = useState<Comanda[]>([])
  const [resenas, setResenas] = useState<Resena[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [resenaError, setResenaError] = useState('')
  const [activeTab, setActiveTab] = useState<'cocina' | 'resenas'>(() =>
    window.location.hash === '#resenas' ? 'resenas' : 'cocina',
  )
  const [resenaForm, setResenaForm] = useState({ calificacion: 0, comentario: '', id_servicio: '' })
  const [enviandoResena, setEnviandoResena] = useState(false)

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError('')
    try {
      const [comR, resR] = await Promise.all([
        api.get<ComandaResponse[]>('/servicios/cocina').then(r => r.data),
        api.get<ResenaResponse[]>('/resenas').then(r => r.data),
      ])
      setComanadas(comR.map(comanda => ({
        ...comanda,
        tiempo_espera_min: comanda.tiempo_espera_min == null ? undefined : apiNumber(comanda.tiempo_espera_min),
        items: comanda.items.map(item => ({
          ...item,
          cantidad: apiNumber(item.cantidad, 'Cantidad'),
          prioridad: apiNumber(item.prioridad, 'Prioridad'),
        })),
      })))
      setResenas(resR.map(resena => ({ ...resena, calificacion_general: apiNumber(resena.calificacion_general, 'Calificación') })))
    } catch (e) { setError(apiErrorMessage(e, 'No se pudieron cargar las comandas y reseñas.')) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    const interval = setInterval(() => fetchData(true), 30_000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleEnviarResena = async () => {
    if (enviandoResena) return
    const servicioId = Number(resenaForm.id_servicio)
    if (!Number.isInteger(servicioId) || servicioId <= 0 || !resenaForm.calificacion) {
      setResenaError('Introduce un ID de servicio positivo y una calificación.')
      return
    }
    setResenaError('')
    setEnviandoResena(true)
    try {
      await api.post('/resenas', {
        id_servicio: servicioId,
        calificacion_general: resenaForm.calificacion,
        comentario: resenaForm.comentario || undefined,
      })
      setResenaForm({ calificacion: 0, comentario: '', id_servicio: '' })
      await fetchData()
    } catch (e) { setResenaError(apiErrorMessage(e, 'No se pudo enviar la reseña.')) }
    finally { setEnviandoResena(false) }
  }

  const avgRating = resenas.length
    ? (resenas.reduce((a, r) => a + r.calificacion_general, 0) / resenas.length).toFixed(1)
    : '—'

  const distribucion = [5, 4, 3, 2, 1].map(n => ({
    n,
    count: resenas.filter(r => Math.round(r.calificacion_general) === n).length,
  }))
  const urgentes = comandas.filter(c => c.prioridad !== 'normal').length

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-arena-200/[0.07] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="eyebrow">Customers / Salón</span>
            <span className="h-1 w-1 rounded-full bg-arena-400/30" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-arena-400/45">Servicio</span>
          </div>
          <h1 className="page-title mt-2">Servicio y experiencia</h1>
          <p className="page-subtitle">
            Comandas de cocina, tiempos de servicio y la voz del cliente en un mismo lugar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge tone="sage" dot>Actualiza cada 30 s</StatusBadge>
          <button onClick={() => fetchData()} aria-label="Actualizar comandas" className="btn-secondary px-3 py-2 text-[11px]">
            <RefreshCw size={13} className={loading ? 'animate-spin' : undefined} />
            Actualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="En cocina" value={comandas.length} hint="Comandas activas" icon={ChefHat} tone="wine" />
        <StatCard label="Prioridad alta" value={urgentes} hint="VIP o urgentes" icon={Flame} tone="gold" />
        <StatCard label="Promedio" value={avgRating} hint={`${resenas.length} reseñas`} icon={Star} tone="gold" />
        <StatCard label="Servicio" value="30 s" hint="Refresco automático" icon={Timer} tone="sage" />
      </div>

      {error && <p role="alert" className="rounded-2xl border border-[#C46666]/30 bg-[#C46666]/[0.06] p-4 text-[12px] text-[#E0A3A3]">{error}</p>}

      <SegmentedTabs
        value={activeTab}
        onChange={tab => {
          setActiveTab(tab)
          window.history.replaceState(null, '', `#${tab}`)
        }}
        items={[
          { id: 'cocina', label: 'Vista cocina', icon: Flame, badge: comandas.length },
          { id: 'resenas', label: 'Reseñas', icon: Star, badge: resenas.length },
        ]}
      />

      {activeTab === 'cocina' && (
        <div className="animate-fade-in space-y-4">
          <div className="relative overflow-hidden rounded-[24px] border border-arena-200/10">
            <img
              src="/images/bife_chorizo.jpg"
              alt="Bife de chorizo recién servido"
              className="absolute inset-0 h-full w-full object-cover object-center opacity-35"
              loading="lazy"
              decoding="async"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-dark-950 via-dark-950/85 to-dark-950/25" />
            <div className="relative flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div>
                <p className="eyebrow">Pase de cocina</p>
                <h2 className="mt-1 font-display text-xl font-semibold tracking-tight text-arena-50">Del fuego a la mesa</h2>
                <p className="mt-1 max-w-md text-[11px] text-arena-300/55">Cada comanda muestra prioridad, tiempos e ítems pendientes.</p>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-arena-200/65">
                <UtensilsCrossed size={13} className="text-gold-400" />
                {comandas.reduce((acc, c) => acc + c.items.length, 0)} ítems en curso
              </div>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map(i => <div key={i} className="h-72 animate-pulse rounded-[20px] bg-arena-200/[0.05]" />)}
            </div>
          ) : comandas.length === 0 ? (
            <EmptyState
              icon={ChefHat}
              title="Sin comandas activas"
              description="La cocina está en reposo. Las nuevas comandas aparecerán aquí automáticamente."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {comandas.map(c => (
                <ComandaCard key={c.id_servicio} comanda={c} onActualizar={() => fetchData()} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'resenas' && (
        <div className="grid grid-cols-1 gap-5 animate-fade-in lg:grid-cols-[0.95fr_1.05fr]">
          <div className="card self-start">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-gold-500/25 bg-gold-500/[0.08] text-gold-400">
                <Sparkles size={16} strokeWidth={1.6} />
              </span>
              <div>
                <h3 className="font-display text-base font-semibold text-arena-50">Nueva reseña</h3>
                <p className="text-[10.5px] text-arena-300/45">Registra la experiencia de un servicio.</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor="resena-servicio" className="label">ID del servicio</label>
                <input
                  id="resena-servicio"
                  type="number"
                  placeholder="Ej. 1"
                  value={resenaForm.id_servicio}
                  onChange={e => setResenaForm(f => ({ ...f, id_servicio: e.target.value }))}
                  className="input-field py-2.5 text-[12.5px]"
                />
              </div>
              <div>
                <p className="label">Calificación</p>
                <EstrellaRating
                  value={resenaForm.calificacion}
                  onChange={v => setResenaForm(f => ({ ...f, calificacion: v }))}
                />
              </div>
              <div>
                <label htmlFor="resena-comentario" className="label">Comentario (opcional)</label>
                <textarea
                  id="resena-comentario"
                  rows={3}
                  value={resenaForm.comentario}
                  onChange={e => setResenaForm(f => ({ ...f, comentario: e.target.value }))}
                  placeholder="¿Qué te pareció la experiencia?"
                  className="input-field resize-none text-[12.5px]"
                />
              </div>
              {resenaError && <p role="alert" className="text-[10.5px] text-[#E0A3A3]">{resenaError}</p>}
              <button
                type="button"
                onClick={handleEnviarResena}
                disabled={!resenaForm.calificacion || !resenaForm.id_servicio || enviandoResena}
                className="btn-primary w-full py-2.5 text-[11.5px]"
              >
                {enviandoResena ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-arena-100 border-t-transparent" /> : <Send size={13} />}
                {enviandoResena ? 'Enviando…' : 'Enviar reseña'}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="card overflow-hidden">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="text-center sm:min-w-32">
                  <p className="font-display text-5xl font-semibold leading-none text-arena-50 tabular">{avgRating}</p>
                  <div className="mt-2 flex justify-center gap-0.5">
                    {[1, 2, 3, 4, 5].map(n => (
                      <Star key={n} size={13} className={Number(avgRating) >= n ? 'fill-gold-400 text-gold-400' : 'text-arena-400/25'} />
                    ))}
                  </div>
                  <p className="mt-1 text-[9.5px] text-arena-300/45">{resenas.length} reseñas</p>
                </div>

                <div className="flex-1 space-y-1.5">
                  {distribucion.map(row => (
                    <div key={row.n} className="flex items-center gap-2">
                      <span className="w-3 text-right text-[9.5px] text-arena-300/45 tabular">{row.n}</span>
                      <Star size={9} className="text-gold-400/70" />
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-arena-200/[0.06]">
                        <div
                          className="h-full rounded-full bg-gold-500/70"
                          style={{ width: `${resenas.length ? (row.count / resenas.length) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="w-5 text-right text-[9px] text-arena-400/40 tabular">{row.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {resenas.slice(0, 10).map(r => (
              <article key={r.id_resena} className="card card-hover p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map(n => (
                      <Star key={n} size={12} className={r.calificacion_general >= n ? 'fill-gold-400 text-gold-400' : 'text-arena-400/25'} />
                    ))}
                  </div>
                  <span className="text-[9px] text-arena-400/40">
                    {new Date(r.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
                {r.comentario ? (
                  <p className="mt-2 flex gap-2 text-[12px] italic leading-relaxed text-arena-300/70">
                    <MessageSquareQuote size={14} className="mt-0.5 shrink-0 text-gold-500/50" />
                    “{r.comentario}”
                  </p>
                ) : (
                  <p className="mt-2 flex items-center gap-1.5 text-[10.5px] text-arena-400/40">
                    <TriangleAlert size={11} />
                    Sin comentario
                  </p>
                )}
              </article>
            ))}

            {resenas.length === 0 && (
              <EmptyState
                icon={Star}
                title="Sin reseñas aún"
                description="Cuando un cliente califique su visita, aparecerá aquí."
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
