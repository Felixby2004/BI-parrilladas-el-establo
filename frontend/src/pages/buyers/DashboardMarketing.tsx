import { useState, useEffect, useCallback } from 'react'
import { clsx } from 'clsx'
import type { LeadKanban, KanbanStats } from '@/types'
import { leadsService } from '@/services/api'
import { KanbanColumn } from '@/components/kanban/KanbanColumn'
import { LeadDetailModal } from '@/components/kanban/LeadDetailModal'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
} from 'recharts'

const ESTADOS = ['nuevo', 'contactado', 'respondio', 'ganado', 'perdido'] as const
type Estado = typeof ESTADOS[number]

const ESTADO_META: Record<Estado, { label: string; emoji: string; desc: string; color: string; hex: string }> = {
  nuevo:      { label: 'Nuevo',      emoji: '🆕', desc: 'Recién captados',     color: 'text-blue-400',   hex: '#60a5fa' },
  contactado: { label: 'Contactado', emoji: '📲', desc: 'Ya recibió mensaje',   color: 'text-yellow-400', hex: '#facc15' },
  respondio:  { label: 'Respondió',  emoji: '💬', desc: 'Hay conversación',     color: 'text-purple-400', hex: '#c084fc' },
  ganado:     { label: 'Ganado',     emoji: '✅', desc: 'Adelanto confirmado',  color: 'text-green-400',  hex: '#4ade80' },
  perdido:    { label: 'Perdido',    emoji: '❌', desc: 'No hubo conversión',   color: 'text-red-400',    hex: '#f87171' },
}

// ─── Creativos Pomelli (Google Labs On-Brand Studio) ─────────
interface PomelliCreative {
  id: string
  titulo: string
  subtitulo: string
  canal: string
  imagen: string
  badge: string
  publicoObjetivo: string
  copyTexto: string
  metricas: { ctr: string; tasaConv: string; cpc: string }
}

const POMELLI_CREATIVES: PomelliCreative[] = [
  {
    id: 'cortes-premium',
    titulo: 'Cortes Angus al Carbón de Quebracho',
    subtitulo: 'Ribeye, Tomahawk y Bife madurados 28 días',
    canal: 'Instagram & Facebook Ads',
    imagen: '/images/campana_cortes.jpg',
    badge: '🔥 ALTO IMPACTO · CTR 5.4%',
    publicoObjetivo: 'Adultos 28-55 años, amantes de la carne, ejecutivos, celebraciones.',
    copyTexto: '¿Listo para probar un corte que se deshace al primer bocado? En Parrilladas El Establo asamos con carbón de quebracho blanco y sal marina. Reserva hoy con solo 10% de adelanto y asegura tu corte preferido. ¡Cupos limitados para el fin de semana!',
    metricas: { ctr: '5.4%', tasaConv: '22.8%', cpc: '$4.20 MXN' },
  },
  {
    id: 'parrillada-familiar',
    titulo: 'Gran Banquete Parrillero Familiar',
    subtitulo: 'Para grupos de 4 a 8 personas con guarniciones y chimichurri',
    canal: 'WhatsApp & TikTok Reels',
    imagen: '/images/campana_familiar.jpg',
    badge: '👨‍👩‍👧‍👦 GRUPOS & FAMILIAS · CTR 4.9%',
    publicoObjetivo: 'Familias, grupos de amigos, cumpleaños y reuniones de domingo.',
    copyTexto: 'Los mejores momentos se comparten alrededor del fuego. Nuestra Gran Parrillada Familiar incluye asado de tira, chorizo criollo, morcilla, papas al plomo y chimichurri casero. ¡Haz tu reserva y ven a relajarte sin cocinar!',
    metricas: { ctr: '4.9%', tasaConv: '28.1%', cpc: '$3.80 MXN' },
  },
  {
    id: 'salon-vip',
    titulo: 'Salón Privado & Cenas Ejecutivas',
    subtitulo: 'Ambiente exclusivo con cava de vinos Malbec y servicio VIP',
    canal: 'LinkedIn & Google Search',
    imagen: '/images/campana_eventos.jpg',
    badge: '💼 CORPORATIVO · TICKET ALTO',
    publicoObjetivo: 'Empresas, directores, celebraciones corporativas y cenas privadas.',
    copyTexto: 'Sorprende a tus clientes o equipo en nuestro Salón VIP El Establo. Menús de pasos maridados con nuestra exclusiva cava de vinos, parrilla en vivo y atención reservada. Emisión de factura fiscal inmediata.',
    metricas: { ctr: '3.9%', tasaConv: '34.5%', cpc: '$8.50 MXN' },
  },
]

type ActiveTab = 'kanban' | 'analytics' | 'pomelli'

export default function DashboardMarketing() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('kanban')
  const [leads, setLeads] = useState<LeadKanban[]>([])
  const [stats, setStats] = useState<KanbanStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedLead, setSelectedLead] = useState<LeadKanban | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Pomelli generator state
  const [promptCorte, setPromptCorte] = useState('Tomahawk')
  const [promptObjetivo, setPromptObjetivo] = useState('Reserva Fin de Semana')
  const [generandoPrompt, setGenerandoPrompt] = useState(false)
  const [promptResultado, setPromptResultado] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [leadsData, statsData] = await Promise.all([
        leadsService.listar(),
        leadsService.stats(),
      ])
      setLeads(leadsData)
      setStats(statsData)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(fetchData, search ? 400 : 0)
    return () => clearTimeout(t)
  }, [fetchData, search])

  const leadsByEstado = (estado: Estado) => {
    const query = search.trim().toLocaleLowerCase('es')
    return leads.filter(l => l.estado === estado && (
      !query || [l.buyer_nombre, l.buyer_telefono, l.buyer_email]
        .some(value => value?.toLocaleLowerCase('es').includes(query))
    ))
  }

  const tasaCierre = stats?.total ? (stats.ganado / stats.total) * 100 : 0

  const handleCopyCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2500)
  }

  const handleGenerarPromptPomelli = () => {
    setGenerandoPrompt(true)
    setTimeout(() => {
      setPromptResultado(
        `[Pomelli On-Brand Creative] - Parrilladas El Establo\n` +
        `• Título: Experiencia ${promptCorte} Supremo al Quebracho\n` +
        `• Enfoque: ${promptObjetivo}\n` +
        `• Prompt Visual Pomelli: Cinematic close-up photograph of prime sizzling ${promptCorte} steak on iron parrilla grate with ember sparks, rustic charred wooden table, deep Malbec wine reflections, high contrast culinary lighting #7F011F aesthetic.\n` +
        `• Copy CTA: "Reserva hoy tu mesa con 10% de adelanto y asegura el corte estrella de la casa."'
      )
      setGenerandoPrompt(false)
    }, 450)
  }

  // Datos para Recharts (Stitch Style)
  const funnelData = [
    { etapa: 'Captados', cantidad: stats?.total ?? 0, fill: '#60a5fa' },
    { etapa: 'Contactados', cantidad: stats?.contactado ?? 0, fill: '#facc15' },
    { etapa: 'En Diálogo', cantidad: stats?.respondio ?? 0, fill: '#c084fc' },
    { etapa: 'Ganados (10%)', cantidad: stats?.ganado ?? 0, fill: '#4ade80' },
  ]

  const pieData = [
    { name: 'Nuevos', value: stats?.nuevo ?? 0, color: '#60a5fa' },
    { name: 'Contactados', value: stats?.contactado ?? 0, color: '#facc15' },
    { name: 'En Diálogo', value: stats?.respondio ?? 0, color: '#c084fc' },
    { name: 'Ganados', value: stats?.ganado ?? 0, color: '#4ade80' },
    { name: 'Perdidos', value: stats?.perdido ?? 0, color: '#f87171' },
  ].filter(d => d.value > 0)

  return (
    <div className="animate-fade-in space-y-6">

      {/* ── Page Header & Quick Navigation ─────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-dark-400/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">📣</span>
            <h1 className="page-title text-2xl font-display font-extrabold text-arena-200">
              BUYERS — Centro de Captación & Marketing
            </h1>
          </div>
          <p className="page-subtitle text-xs text-dark-300 mt-1">
            Gestión comercial de prospectos · Metodología IMPULSE · Parrilladas El Establo
          </p>
        </div>

        {/* Tab Selector (Google Stitch Pills) */}
        <div className="flex items-center p-1 rounded-2xl bg-dark-700/80 border border-dark-400">
          <button
            onClick={() => setActiveTab('kanban')}
            className={clsx('stitch-pill', activeTab === 'kanban' ? 'stitch-pill-active' : 'stitch-pill-inactive')}
          >
            <span>📋</span>
            <span>Tablero Kanban</span>
            <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px] font-mono">
              {stats?.total ?? 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={clsx('stitch-pill', activeTab === 'analytics' ? 'stitch-pill-active' : 'stitch-pill-inactive')}
          >
            <span>📊</span>
            <span>Analítica Stitch</span>
          </button>

          <button
            onClick={() => setActiveTab('pomelli')}
            className={clsx('stitch-pill', activeTab === 'pomelli' ? 'stitch-pill-active' : 'stitch-pill-inactive')}
          >
            <span>🎨</span>
            <span>Creativos Pomelli</span>
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          </button>
        </div>
      </div>

      {/* ── Stat Cards (Stitch Glass Style) ─────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="stat-card border-blue-500/30 bg-gradient-to-br from-dark-700 to-dark-800">
          <div className="flex items-start justify-between">
            <span className="text-2xl">🎯</span>
            <span className="text-2xl font-display font-extrabold text-arena-200">{stats?.total ?? 0}</span>
          </div>
          <p className="text-[11px] font-semibold text-arena-300/80">Total Captados</p>
          <div className="w-full bg-dark-600 h-1 rounded-full overflow-hidden mt-1">
            <div className="bg-blue-400 h-full w-full"></div>
          </div>
        </div>

        <div className="stat-card border-dark-300 bg-gradient-to-br from-dark-700 to-dark-800">
          <div className="flex items-start justify-between">
            <span className="text-2xl">🆕</span>
            <span className="text-2xl font-display font-extrabold text-arena-200">{stats?.nuevo ?? 0}</span>
          </div>
          <p className="text-[11px] font-semibold text-dark-300">Nuevos por Atender</p>
          <div className="w-full bg-dark-600 h-1 rounded-full overflow-hidden mt-1">
            <div className="bg-amber-400 h-full" style={{ width: `${stats?.total ? ((stats.nuevo / stats.total) * 100) : 0}%` }}></div>
          </div>
        </div>

        <div className="stat-card border-purple-500/30 bg-gradient-to-br from-dark-700 to-dark-800">
          <div className="flex items-start justify-between">
            <span className="text-2xl">💬</span>
            <span className="text-2xl font-display font-extrabold text-arena-200">
              {(stats?.contactado ?? 0) + (stats?.respondio ?? 0)}
            </span>
          </div>
          <p className="text-[11px] font-semibold text-purple-300/80">En Negociación WhatsApp</p>
          <div className="w-full bg-dark-600 h-1 rounded-full overflow-hidden mt-1">
            <div className="bg-purple-400 h-full" style={{ width: `${stats?.total ? ((((stats.contactado || 0) + (stats.respondio || 0)) / stats.total) * 100) : 0}%` }}></div>
          </div>
        </div>

        <div className="stat-card border-green-500/30 bg-gradient-to-br from-dark-700 to-dark-800">
          <div className="flex items-start justify-between">
            <span className="text-2xl">✅</span>
            <span className="text-2xl font-display font-extrabold text-emerald-400">{stats?.ganado ?? 0}</span>
          </div>
          <p className="text-[11px] font-semibold text-emerald-300/80">Ganados (Adelanto 10%)</p>
          <div className="w-full bg-dark-600 h-1 rounded-full overflow-hidden mt-1">
            <div className="bg-emerald-400 h-full" style={{ width: `${tasaCierre}%` }}></div>
          </div>
        </div>

        <div className="stat-card border-vino-700/50 bg-gradient-to-br from-vino-950/40 to-dark-800 shadow-glow-vino-sm">
          <div className="flex items-start justify-between">
            <span className="text-2xl">📈</span>
            <span className="text-2xl font-display font-extrabold text-arena-200">{tasaCierre.toFixed(1)}%</span>
          </div>
          <p className="text-[11px] font-semibold text-vino-300">Tasa de Conversión</p>
          <div className="w-full bg-dark-600 h-1 rounded-full overflow-hidden mt-1">
            <div className="bg-vino-500 h-full" style={{ width: `${Math.min(100, tasaCierre)}%` }}></div>
          </div>
        </div>
      </div>

      {/* ── TAB 1: KANBAN BOARD ────────────────────────── */}
      {activeTab === 'kanban' && (
        <div className="space-y-4 animate-fade-in">
          {/* Búsqueda y Filtros */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="relative flex-1 max-w-md">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-300 text-sm">🔍</span>
              <input
                type="text"
                placeholder="Buscar prospecto por nombre, teléfono, correo..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input-field pl-10 bg-dark-700/90 text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchData}
                className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
                title="Actualizar leads"
              >
                <span>🔄</span>
                <span>Refrescar</span>
              </button>
              <a
                href="/formulario"
                target="_blank"
                rel="noreferrer"
                className="btn-primary text-xs py-2 px-3 flex items-center gap-1.5"
              >
                <span>🌐</span>
                <span>Abrir Formulario Web</span>
              </a>
            </div>
          </div>

          {/* Tablero Kanban */}
          {loading ? (
            <div className="flex justify-center items-center py-24 glass-card">
              <div className="text-center animate-fade-in">
                <div className="text-5xl mb-4 animate-float">🔥</div>
                <p className="text-arena-200 font-semibold text-sm">Sincronizando embudo de leads...</p>
                <p className="text-dark-300 text-xs mt-1">Cargando base de datos PostgreSQL</p>
              </div>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4 pt-1">
              {ESTADOS.map(estado => {
                const meta = ESTADO_META[estado]
                return (
                  <KanbanColumn
                    key={estado}
                    estado={estado}
                    label={meta.label}
                    emoji={meta.emoji}
                    description={meta.desc}
                    colorClass={meta.color}
                    leads={leadsByEstado(estado)}
                    onLeadMoved={fetchData}
                    onLeadSelect={setSelectedLead}
                  />
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: ANALÍTICA STITCH (RECHARTS) ──────────── */}
      {activeTab === 'analytics' && (
        <div className="space-y-6 animate-fade-in">
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Gráfico 1: Embudo de Conversión (Funnel BarChart) */}
            <div className="glass-card lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-display font-bold text-base text-arena-200">
                    Embudo de Conversión Comercial (Fase Buyers & Leads)
                  </h3>
                  <p className="text-xs text-dark-300">
                    Progresión del prospecto desde el primer contacto hasta el adelanto
                  </p>
                </div>
                <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  {tasaCierre.toFixed(1)}% Éxito
                </span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <XAxis dataKey="etapa" stroke="#4f2f2f" fontSize={11} tickLine={false} />
                    <YAxis stroke="#4f2f2f" fontSize={11} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1c1010',
                        borderColor: '#7F011F',
                        borderRadius: '12px',
                        color: '#F5EBD0',
                        fontSize: '12px',
                      }}
                      formatter={(value: any) => [`${value} prospectos`, 'Volumen']}
                    />
                    <Bar dataKey="cantidad" radius={[8, 8, 0, 0]}>
                      {funnelData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-4 gap-2 pt-4 border-t border-dark-400/80 text-center">
                {funnelData.map(f => (
                  <div key={f.etapa} className="p-2 rounded-xl bg-dark-800/80">
                    <p className="text-[10px] text-dark-300">{f.etapa}</p>
                    <p className="text-base font-bold font-display text-arena-200 mt-0.5">{f.cantidad}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Gráfico 2: Distribución de Estados (PieChart) */}
            <div className="glass-card">
              <h3 className="font-display font-bold text-base text-arena-200 mb-1">
                Distribución de Estados
              </h3>
              <p className="text-xs text-dark-300 mb-4">
                Desglose actual de leads activos
              </p>

              {pieData.length === 0 ? (
                <div className="h-56 flex items-center justify-center text-xs text-dark-300">
                  Sin suficientes datos para graficar
                </div>
              ) : (
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1c1010',
                          borderColor: '#7F011F',
                          borderRadius: '12px',
                          color: '#F5EBD0',
                          fontSize: '12px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="space-y-1.5 pt-2 border-t border-dark-400/80">
                {pieData.map(item => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-arena-300/80">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.name}
                    </span>
                    <span className="font-mono font-bold text-arena-200">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Resumen de Canales & Rendimiento */}
          <div className="glass-card">
            <h3 className="font-display font-bold text-base text-arena-200 mb-4">
              Rendimiento por Canal de Adquisición
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-dark-800/80 border border-dark-400">
                <div className="flex items-center justify-between text-xs text-dark-300 mb-1">
                  <span>🌐 Formulario Web</span>
                  <span className="text-emerald-400 font-bold">48%</span>
                </div>
                <p className="text-lg font-bold font-display text-arena-200">Orgánico & SEO</p>
                <p className="text-[10px] text-dark-300 mt-1">Leads con alta intención de reserva</p>
              </div>

              <div className="p-4 rounded-xl bg-dark-800/80 border border-dark-400">
                <div className="flex items-center justify-between text-xs text-dark-300 mb-1">
                  <span>📸 Instagram Ads</span>
                  <span className="text-purple-400 font-bold">29%</span>
                </div>
                <p className="text-lg font-bold font-display text-arena-200">Campaña Cortes</p>
                <p className="text-[10px] text-dark-300 mt-1">Formato Reels & Stories visuales</p>
              </div>

              <div className="p-4 rounded-xl bg-dark-800/80 border border-dark-400">
                <div className="flex items-center justify-between text-xs text-dark-300 mb-1">
                  <span>📱 WhatsApp Click-to-Chat</span>
                  <span className="text-emerald-400 font-bold">16%</span>
                </div>
                <p className="text-lg font-bold font-display text-arena-200">Parrillada Familiar</p>
                <p className="text-[10px] text-dark-300 mt-1">Respuesta inmediata por bot</p>
              </div>

              <div className="p-4 rounded-xl bg-dark-800/80 border border-dark-400">
                <div className="flex items-center justify-between text-xs text-dark-300 mb-1">
                  <span>💼 Google & LinkedIn</span>
                  <span className="text-blue-400 font-bold">7%</span>
                </div>
                <p className="text-lg font-bold font-display text-arena-200">Eventos VIP</p>
                <p className="text-[10px] text-dark-300 mt-1">Ticket promedio mayor a $5,000</p>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ── TAB 3: CREATIVOS POMELLI (GOOGLE LABS) ──────── */}
      {activeTab === 'pomelli' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Header Banner Pomelli */}
          <div className="glass-card relative overflow-hidden border-amber-500/30 bg-gradient-to-r from-vino-950/60 via-dark-800 to-dark-800">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold mb-2">
                  <span>✨</span>
                  <span>Google Labs Pomelli · Brand Creative Studio</span>
                </div>
                <h2 className="font-display font-extrabold text-2xl text-arena-200">
                  Creativos Listos para Pauta en Fase Buyers
                </h2>
                <p className="text-xs text-arena-300/80 max-w-2xl mt-1">
                  Imágenes de calidad publicitaria 8K, copies persuasivos y llamadas a la acción diseñadas para captar leads y canalizarlos al formulario con 10% de adelanto.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs px-3 py-1.5 rounded-xl bg-dark-600 border border-dark-400 text-arena-300">
                  3 Campañas Activas
                </span>
              </div>
            </div>
          </div>

          {/* Grid de Creativos Pomelli */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {POMELLI_CREATIVES.map(creative => (
              <div
                key={creative.id}
                className="glass-card glass-card-hover flex flex-col overflow-hidden p-0 border-dark-400 group"
              >
                {/* Visual Image */}
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-black">
                  <img
                    src={creative.imagen}
                    alt={creative.titulo}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-dark-900 via-transparent to-transparent opacity-80" />
                  <span className="absolute top-3 left-3 text-[10px] font-bold px-2.5 py-1 rounded-full bg-black/80 backdrop-blur-sm text-arena-200 border border-amber-500/40">
                    {creative.badge}
                  </span>
                  <span className="absolute bottom-3 left-3 text-[10px] font-semibold text-arena-200/90 flex items-center gap-1 drop-shadow">
                    📢 {creative.canal}
                  </span>
                </div>

                {/* Content */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="font-display font-bold text-base text-arena-200 leading-snug">
                      {creative.titulo}
                    </h3>
                    <p className="text-xs text-dark-300 mt-1">
                      {creative.subtitulo}
                    </p>

                    <div className="mt-3 p-3 rounded-xl bg-dark-800/90 border border-dark-400 text-xs">
                      <p className="text-[10px] uppercase font-bold text-dark-300 tracking-wider mb-1">
                        Público Objetivo
                      </p>
                      <p className="text-arena-300/80 text-[11px] leading-relaxed">
                        {creative.publicoObjetivo}
                      </p>
                    </div>

                    <div className="mt-3 p-3 rounded-xl bg-dark-900/80 border border-vino-900/40 text-xs relative">
                      <p className="text-[10px] uppercase font-bold text-vino-400 tracking-wider mb-1">
                        Copy Sugerido para Anuncio
                      </p>
                      <p className="text-arena-200/90 text-xs italic line-clamp-3">
                        "{creative.copyTexto}"
                      </p>
                    </div>
                  </div>

                  {/* Métricas estimadas */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-dark-400/80 text-center text-xs">
                    <div>
                      <p className="text-[10px] text-dark-300">CTR</p>
                      <p className="font-bold text-amber-300 font-display">{creative.metricas.ctr}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-dark-300">Conversión</p>
                      <p className="font-bold text-emerald-400 font-display">{creative.metricas.tasaConv}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-dark-300">CPC Est.</p>
                      <p className="font-bold text-arena-200 font-display">{creative.metricas.cpc}</p>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => handleCopyCopy(creative.id, creative.copyTexto)}
                      className="btn-secondary flex-1 justify-center py-2 text-xs"
                    >
                      {copiedId === creative.id ? '✓ ¡Copiado!' : '📋 Copiar Copy'}
                    </button>
                    <a
                      href={creative.imagen}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-primary flex-1 justify-center py-2 text-xs"
                    >
                      Ver 8K ↗
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Generador de Prompts Pomelli Interactivo */}
          <div className="glass-card border-vino-800/60 p-6">
            <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
              <div>
                <h3 className="font-display font-bold text-lg text-arena-200 flex items-center gap-2">
                  <span>✨</span>
                  <span>Generador de Creativos & Copies On-Brand (Estilo Pomelli)</span>
                </h3>
                <p className="text-xs text-dark-300 mt-0.5">
                  Simula la creación guiada de contenido publicitario para redes sociales y WhatsApp
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <div>
                <label className="label">Corte o Menú Destacado</label>
                <select
                  value={promptCorte}
                  onChange={e => setPromptCorte(e.target.value)}
                  className="input-field bg-dark-700"
                >
                  <option value="Tomahawk">Tomahawk Steak 1.2kg</option>
                  <option value="Ribeye">Ojo de Bife / Ribeye Angus</option>
                  <option value="Bife de Chorizo">Bife de Chorizo Clásico</option>
                  <option value="Parrillada Completa">Parrillada El Establo Familiar</option>
                  <option value="Degustación & Cava">Cena Maridaje Cava Malbec</option>
                </select>
              </div>

              <div>
                <label className="label">Objetivo Comercial</label>
                <select
                  value={promptObjetivo}
                  onChange={e => setPromptObjetivo(e.target.value)}
                  className="input-field bg-dark-700"
                >
                  <option value="Reserva Fin de Semana">Reserva Fin de Semana (10% MP)</option>
                  <option value="Cena Empresarial">Cena Empresarial / Fin de Año</option>
                  <option value="Cumpleaños VIP">Cumpleaños con Copa de Bienvenida</option>
                  <option value="Promoción Mediodía">Almuerzo Ejecutivo a la Leña</option>
                </select>
              </div>

              <div className="sm:col-span-2 flex items-end">
                <button
                  onClick={handleGenerarPromptPomelli}
                  disabled={generandoPrompt}
                  className="btn-primary w-full justify-center py-3 text-xs"
                >
                  {generandoPrompt ? '⏳ Diseñando con Pomelli...' : '✨ Generar Ficha Publicitaria On-Brand'}
                </button>
              </div>
            </div>

            {promptResultado && (
              <div className="p-4 rounded-xl bg-dark-900 border border-amber-500/30 text-xs font-mono text-arena-200 whitespace-pre-line animate-fade-in">
                {promptResultado}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ── Modal Detalle de Lead ──────────────────────── */}
      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdated={() => { setSelectedLead(null); fetchData() }}
        />
      )}
    </div>
  )
}
