import { useState, useEffect, useCallback } from 'react'
import { clsx } from 'clsx'
import api from '@/services/api'
import { apiErrorMessage } from '@/services/errors'
import { apiNumber, type ApiNumber } from '@/services/numbers'

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
  pendiente:  'bg-dark-500 text-dark-300 border-dark-300',
  preparando: 'bg-yellow-900/30 text-yellow-300 border-yellow-700/50',
  listo:      'bg-green-900/30 text-green-300 border-green-700/50',
  entregado:  'bg-dark-600 text-dark-300/50 border-dark-400 line-through',
}

const ITEM_ESTADOS = ['pendiente', 'preparando', 'listo', 'entregado']

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
      // Este endpoint recibe estado en query; los ítems usan JSON en su ruta anidada.
      await api.patch(`/servicios/${comanda.id_servicio}/estado`, undefined, { params: { estado } })
      onActualizar()
    } catch (e) { setError(apiErrorMessage(e, 'No se pudo actualizar la comanda.')) }
  }

  const listosCount = comanda.items.filter(i => i.estado_item === 'listo' || i.estado_item === 'entregado').length
  const progreso = comanda.items.length > 0 ? (listosCount / comanda.items.length) * 100 : 0

  return (
    <div className={clsx(
      'comanda-card',
      comanda.prioridad === 'vip'     ? 'comanda-vip'     :
      comanda.prioridad === 'urgente' ? 'comanda-urgente' : 'comanda-normal'
    )}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-arena-200 text-lg">
              {comanda.mesa_numero ? `Mesa ${comanda.mesa_numero}` : `#${comanda.id_servicio}`}
            </span>
            {comanda.prioridad !== 'normal' && (
              <span className={clsx(
                'text-[9px] font-bold px-2 py-0.5 rounded-full border',
                comanda.prioridad === 'vip'     ? 'text-vino-300 border-vino-700/40 bg-vino-900/20' :
                'text-yellow-300 border-yellow-600/40 bg-yellow-900/20'
              )}>
                {comanda.prioridad === 'vip' ? '⭐ VIP' : '🔥 URGENTE'}
              </span>
            )}
          </div>
          <p className="text-xs text-dark-300 mt-0.5">
            {comanda.tiempo_espera_min !== undefined
              ? `⏱️ ${comanda.tiempo_espera_min} min esperando`
              : `Orden #${comanda.id_servicio}`}
          </p>
        </div>
        <div className="flex gap-2">
          {comanda.estado === 'en_espera' && (
            <button onClick={() => cambiarEstadoComanda('preparando')}
              className="btn-primary text-xs px-3 py-1.5">
              🔥 Iniciar
            </button>
          )}
          {comanda.estado === 'preparando' && (
            <button onClick={() => cambiarEstadoComanda('servido')}
              className="btn-arena text-xs px-3 py-1.5">
              ✅ Servir
            </button>
          )}
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="mb-4">
        <div className="flex justify-between text-[10px] text-dark-300 mb-1">
          <span>Progreso</span>
          <span>{listosCount}/{comanda.items.length} listos</span>
        </div>
        <div className="h-1.5 bg-dark-500 rounded-full overflow-hidden">
          <div
            className="h-full bg-vino-gradient rounded-full transition-all duration-500"
            style={{ width: `${progreso}%` }}
          />
        </div>
      </div>

      {error && <p role="alert" className="mb-3 text-xs text-red-300">{error}</p>}

      {/* Items */}
      <div className="space-y-2">
        {comanda.items.map(item => (
          <div key={item.id_servicio_detalle}
            className="flex items-center gap-3 p-2 rounded-xl bg-dark-600 border border-dark-500">
            <div className="flex-1 min-w-0">
              <p className={clsx('text-sm font-medium',
                item.estado_item === 'entregado' ? 'line-through text-dark-300' : 'text-arena-200'
              )}>
                {item.cantidad}× {item.nombre_item}
              </p>
              {item.termino_coccion && (
                <p className="text-[10px] text-dark-300">{item.termino_coccion}</p>
              )}
              {item.notas_cocina && (
                <p className="text-[10px] text-yellow-400">📝 {item.notas_cocina}</p>
              )}
            </div>
            {/* Selector de estado */}
            <div className="flex gap-1 flex-shrink-0">
              {ITEM_ESTADOS.map(e => (
                <button
                  key={e}
                  onClick={() => cambiarEstadoItem(item.id_servicio_detalle, e)}
                  disabled={actualizando === item.id_servicio_detalle}
                  className={clsx(
                    'text-[9px] font-bold px-2 py-1 rounded-lg border transition-all',
                    item.estado_item === e
                      ? ITEM_ESTADO_COLORS[e]
                      : 'bg-transparent border-dark-400 text-dark-300 hover:border-dark-300'
                  )}
                >
                  {e === 'pendiente' ? '⬜' : e === 'preparando' ? '🔥' : e === 'listo' ? '✅' : '📦'}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function EstrellaRating({ value, onChange }: { value: number, onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(n => (
        <button key={n}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(n)}
          className="text-3xl transition-transform hover:scale-110"
        >
          {n <= (hovered || value) ? '⭐' : '☆'}
        </button>
      ))}
    </div>
  )
}

export default function CustomersPage() {
  const [comandas, setComanadas] = useState<Comanda[]>([])
  const [resenas, setResenas] = useState<Resena[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [resenaError, setResenaError] = useState('')
  const [activeTab, setActiveTab] = useState<'cocina' | 'resenas'>('cocina')
  const [resenaForm, setResenaForm] = useState({ calificacion: 0, comentario: '', id_servicio: '' })
  const [enviandoResena, setEnviandoResena] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
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

  // Auto-refresh cada 30s
  useEffect(() => {
    const interval = setInterval(fetchData, 30_000)
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

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">🍽️ CUSTOMERS — Salón</h1>
          <p className="page-subtitle">Comandas en cocina · Reseñas · Actualización automática cada 30s</p>
        </div>
        <div className="flex gap-3">
          <div className="stat-card px-4 py-3 text-center">
            <p className="text-2xl font-bold text-arena-200">{comandas.length}</p>
            <p className="text-[10px] text-dark-300">En cocina</p>
          </div>
          <div className="stat-card px-4 py-3 text-center">
            <p className="text-2xl font-bold text-yellow-300">{avgRating}</p>
            <p className="text-[10px] text-dark-300">★ Promedio</p>
          </div>
          <button onClick={fetchData} className="btn-ghost text-sm self-center">🔄</button>
        </div>
      </div>

      {error && <p role="alert" className="card mb-4 border-red-500/40 text-red-300 text-sm">{error}</p>}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 bg-dark-700 p-1 rounded-xl border border-dark-400 w-fit">
        {[{ id: 'cocina', label: '🔥 Vista Cocina' }, { id: 'resenas', label: '⭐ Reseñas' }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            className={clsx('px-4 py-2 rounded-lg text-sm font-semibold transition-all',
              activeTab === t.id ? 'bg-vino-gradient text-arena-200 shadow-glow-vino-sm' : 'text-arena-300/50 hover:text-arena-200'
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* COCINA */}
      {activeTab === 'cocina' && (
        loading ? (
          <div className="flex justify-center py-20">
            <div className="text-center"><div className="text-4xl animate-float mb-3">🔥</div><p className="text-dark-300 text-sm">Cargando comandas...</p></div>
          </div>
        ) : comandas.length === 0 ? (
          <div className="card text-center py-20">
            <div className="text-6xl mb-4">🍖</div>
            <p className="font-display font-bold text-arena-200 text-xl">Sin comandas activas</p>
            <p className="text-dark-300 text-sm mt-2">La cocina está en reposo 🔥</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {comandas.map(c => (
              <ComandaCard key={c.id_servicio} comanda={c} onActualizar={fetchData} />
            ))}
          </div>
        )
      )}

      {/* RESEÑAS */}
      {activeTab === 'resenas' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulario */}
          <div className="card">
            <h3 className="font-display font-bold text-arena-200 mb-5">Nueva Reseña del Cliente</h3>
            <div className="space-y-4">
              <div>
                <label className="label">ID del Servicio</label>
                <input type="number" placeholder="Ej: 1" value={resenaForm.id_servicio}
                  onChange={e => setResenaForm(f => ({ ...f, id_servicio: e.target.value }))}
                  className="input-field" />
              </div>
              <div>
                <label className="label">Calificación general</label>
                <EstrellaRating value={resenaForm.calificacion}
                  onChange={v => setResenaForm(f => ({ ...f, calificacion: v }))} />
              </div>
              <div>
                <label className="label">Comentario (opcional)</label>
                <textarea rows={3} value={resenaForm.comentario}
                  onChange={e => setResenaForm(f => ({ ...f, comentario: e.target.value }))}
                  placeholder="¿Qué te pareció tu experiencia?"
                  className="input-field resize-none" />
              </div>
              {resenaError && <p role="alert" className="text-red-300 text-xs">{resenaError}</p>}
              <button onClick={handleEnviarResena}
                disabled={!resenaForm.calificacion || !resenaForm.id_servicio || enviandoResena}
                className="btn-primary w-full justify-center">
                {enviandoResena ? '⏳ Enviando...' : '⭐ Enviar reseña'}
              </button>
            </div>
          </div>

          {/* Listado */}
          <div className="space-y-3">
            <div className="card bg-vino-900/20 border-vino-800/30 text-center py-6 mb-4">
              <p className="text-5xl font-display font-bold text-arena-200">{avgRating}</p>
              <div className="flex justify-center gap-0.5 my-2">
                {[1,2,3,4,5].map(n => (
                  <span key={n} className={Number(avgRating) >= n ? 'text-yellow-400' : 'text-dark-400'}>★</span>
                ))}
              </div>
              <p className="text-dark-300 text-xs">{resenas.length} reseñas totales</p>
            </div>

            {resenas.slice(0, 10).map(r => (
              <div key={r.id_resena} className="card card-hover">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(n => (
                      <span key={n} className={r.calificacion_general >= n ? 'text-yellow-400 text-sm' : 'text-dark-400 text-sm'}>★</span>
                    ))}
                  </div>
                  <span className="text-[10px] text-dark-300">
                    {new Date(r.created_at).toLocaleDateString('es-MX')}
                  </span>
                </div>
                {r.comentario && <p className="text-sm text-arena-300 italic">"{r.comentario}"</p>}
              </div>
            ))}

            {resenas.length === 0 && (
              <div className="card text-center py-10">
                <p className="text-dark-300 text-sm">Sin reseñas aún</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
