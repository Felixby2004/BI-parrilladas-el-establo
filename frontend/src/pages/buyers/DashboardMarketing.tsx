import { useState, useEffect, useCallback } from 'react'
import { clsx } from 'clsx'
import type { LeadKanban, KanbanStats } from '@/types'
import { leadsService } from '@/services/api'
import { KanbanColumn } from '@/components/kanban/KanbanColumn'
import { LeadDetailModal } from '@/components/kanban/LeadDetailModal'
import {
  EmptyState,
  SectionHeader,
  SegmentedTabs,
  Skeleton,
  StatCard,
  StatusBadge,
  type Tone,
} from '@/components/ui/kit'
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
import {
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  Check,
  ClipboardList,
  Copy,
  ExternalLink,
  LoaderCircle,
  Megaphone,
  MessageSquare,
  Palette,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react'

const ESTADOS = ['nuevo', 'contactado', 'respondio', 'ganado', 'perdido'] as const
type Estado = typeof ESTADOS[number]

const ESTADO_META: Record<Estado, { label: string; desc: string; tone: Tone }> = {
  nuevo:      { label: 'Nuevo',      desc: 'Recién captados',    tone: 'info' },
  contactado: { label: 'Contactado', desc: 'Mensaje enviado',    tone: 'gold' },
  respondio:  { label: 'Respondió',  desc: 'En conversación',    tone: 'wine' },
  ganado:     { label: 'Ganado',     desc: 'Adelanto confirmado', tone: 'sage' },
  perdido:    { label: 'Perdido',    desc: 'Sin conversión',     tone: 'rose' },
}

// ─── Creativos Pomelli (Google Labs On-Brand Studio) ─────────
interface PomelliCreative {
  id: string
  titulo: string
  subtitulo: string
  canal: string
  imagen: string
  imageSet?: string
  badge: string
  publicoObjetivo: string
  copyTexto: string
  metricas: { ctr: string; tasaConv: string; cpc: string }
}

const POMELLI_CREATIVES: PomelliCreative[] = [
  {
    id: 'cortes-premium',
    titulo: 'Cortes Angus al carbón de quebracho',
    subtitulo: 'Ribeye, Tomahawk y bife madurados 28 días',
    canal: 'Instagram y Facebook Ads',
    imagen: '/images/campana_cortes.jpg',
    imageSet: '/images/campana_cortes_640.jpg 640w, /images/campana_cortes.jpg 1200w',
    badge: 'Alto impacto · CTR 5.4%',
    publicoObjetivo: 'Adultos 28-55 años, amantes de la carne, ejecutivos, celebraciones.',
    copyTexto: '¿Listo para probar un corte que se deshace al primer bocado? En Parrilladas El Establo asamos con carbón de quebracho blanco y sal marina. Reserva hoy con solo 10% de adelanto y asegura tu corte preferido. ¡Cupos limitados para el fin de semana!',
    metricas: { ctr: '5.4%', tasaConv: '22.8%', cpc: '$4.20 MXN' },
  },
  {
    id: 'parrillada-familiar',
    titulo: 'Gran banquete parrillero familiar',
    subtitulo: 'Para grupos de 4 a 8 personas con guarniciones y chimichurri',
    canal: 'WhatsApp y TikTok Reels',
    imagen: '/images/campana_familiar.jpg',
    imageSet: '/images/campana_familiar_640.jpg 640w, /images/campana_familiar.jpg 1200w',
    badge: 'Grupos y familias · CTR 4.9%',
    publicoObjetivo: 'Familias, grupos de amigos, cumpleaños y reuniones de domingo.',
    copyTexto: 'Los mejores momentos se comparten alrededor del fuego. Nuestra Gran Parrillada Familiar incluye asado de tira, chorizo criollo, morcilla, papas al plomo y chimichurri casero. ¡Haz tu reserva y ven a relajarte sin cocinar!',
    metricas: { ctr: '4.9%', tasaConv: '28.1%', cpc: '$3.80 MXN' },
  },
  {
    id: 'salon-vip',
    titulo: 'Salón privado y cenas ejecutivas',
    subtitulo: 'Ambiente exclusivo con cava de vinos Malbec y servicio VIP',
    canal: 'LinkedIn y Google Search',
    imagen: '/images/campana_eventos.jpg',
    imageSet: '/images/campana_eventos_640.jpg 640w, /images/campana_eventos.jpg 1200w',
    badge: 'Corporativo · ticket alto',
    publicoObjetivo: 'Empresas, directores, celebraciones corporativas y cenas privadas.',
    copyTexto: 'Sorprende a tus clientes o equipo en nuestro Salón VIP El Establo. Menús de pasos maridados con nuestra exclusiva cava de vinos, parrilla en vivo y atención reservada. Emisión de factura fiscal inmediata.',
    metricas: { ctr: '3.9%', tasaConv: '34.5%', cpc: '$8.50 MXN' },
  },
  {
    id: 'bife-cava',
    titulo: 'Bife de chorizo y cava Malbec',
    subtitulo: 'Maridaje de autor para noches que se recuerdan',
    canal: 'Google Display y Meta',
    imagen: '/images/bife_chorizo.jpg',
    badge: 'Maridaje · ticket medio alto',
    publicoObjetivo: 'Parejas, aniversarios y clientes que buscan una experiencia completa.',
    copyTexto: 'Un bife de chorizo en su punto exacto, sal de escamas y una copa de Malbec para acompañar. Nuestro sommelier elige la etiqueta perfecta para tu mesa. Reserva con 10% de adelanto y deja el resto en nuestras manos.',
    metricas: { ctr: '4.6%', tasaConv: '31.2%', cpc: '$5.10 MXN' },
  },
]

type ActiveTab = 'kanban' | 'analytics' | 'pomelli'

const TOOLTIP_STYLE = {
  backgroundColor: '#12100E',
  border: '1px solid rgba(245,235,208,0.14)',
  borderRadius: '12px',
  color: '#F6EFE6',
  fontSize: '12px',
  boxShadow: '0 20px 40px -24px rgba(0,0,0,0.9)',
}

function tabFromHash(): ActiveTab {
  const hash = window.location.hash.replace('#', '')
  return hash === 'analytics' || hash === 'pomelli' ? hash : 'kanban'
}

export default function DashboardMarketing() {
  const [activeTab, setActiveTab] = useState<ActiveTab>(tabFromHash)
  const [leads, setLeads] = useState<LeadKanban[]>([])
  const [stats, setStats] = useState<KanbanStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedLead, setSelectedLead] = useState<LeadKanban | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

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
  const enConversacion = (stats?.contactado ?? 0) + (stats?.respondio ?? 0)

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
        `• Copy CTA: "Reserva hoy tu mesa con 10% de adelanto y asegura el corte estrella de la casa."'`
      )
      setGenerandoPrompt(false)
    }, 450)
  }

  const funnelData = [
    { etapa: 'Captados', cantidad: stats?.total ?? 0, fill: '#6F9FC4' },
    { etapa: 'Contactados', cantidad: stats?.contactado ?? 0, fill: '#C9A25A' },
    { etapa: 'En diálogo', cantidad: stats?.respondio ?? 0, fill: '#B58AC9' },
    { etapa: 'Ganados', cantidad: stats?.ganado ?? 0, fill: '#6FA88A' },
  ]

  const pieData = [
    { name: 'Nuevos', value: stats?.nuevo ?? 0, color: '#6F9FC4' },
    { name: 'Contactados', value: stats?.contactado ?? 0, color: '#C9A25A' },
    { name: 'En diálogo', value: stats?.respondio ?? 0, color: '#B58AC9' },
    { name: 'Ganados', value: stats?.ganado ?? 0, color: '#6FA88A' },
    { name: 'Perdidos', value: stats?.perdido ?? 0, color: '#C46666' },
  ].filter(d => d.value > 0)

  return (
    <div className="animate-fade-in space-y-6">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex flex-col gap-5 border-b border-arena-200/[0.07] pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="eyebrow">Buyers / Embudo comercial</span>
            <span className="h-1 w-1 rounded-full bg-arena-400/30" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-arena-400/45">IMPULSE</span>
          </div>
          <h1 className="page-title mt-2">Centro de captación</h1>
          <p className="page-subtitle">
            Prospectos, campañas y conversión en una sola vista. Cada lead avanza con intención, no por inercia.
          </p>
        </div>

        <SegmentedTabs
          value={activeTab}
          onChange={tab => {
            setActiveTab(tab)
            window.history.replaceState(null, '', `#${tab}`)
          }}
          items={[
            { id: 'kanban', label: 'Tablero', icon: ClipboardList, badge: stats?.total ?? 0 },
            { id: 'analytics', label: 'Analítica', icon: BarChart3 },
            { id: 'pomelli', label: 'Creativos', icon: Palette },
          ]}
        />
      </div>

      {/* ── KPIs ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Total captados"
          value={stats?.total ?? 0}
          hint="Base completa del embudo"
          icon={Users}
          tone="info"
          progress={100}
        />
        <StatCard
          label="Nuevos"
          value={stats?.nuevo ?? 0}
          hint="Pendientes de primer contacto"
          icon={UserPlus}
          tone="gold"
          progress={stats?.total ? ((stats.nuevo ?? 0) / stats.total) * 100 : 0}
        />
        <StatCard
          label="En conversación"
          value={enConversacion}
          hint="Contactados + respondieron"
          icon={MessageSquare}
          tone="wine"
          progress={stats?.total ? (enConversacion / stats.total) * 100 : 0}
        />
        <StatCard
          label="Ganados"
          value={stats?.ganado ?? 0}
          hint="Adelanto del 10% confirmado"
          icon={BadgeCheck}
          tone="sage"
          progress={tasaCierre}
        />
        <StatCard
          label="Tasa de cierre"
          value={`${tasaCierre.toFixed(1)}%`}
          hint="Conversión comercial acumulada"
          icon={TrendingUp}
          tone="gold"
          progress={tasaCierre}
          className="col-span-2 sm:col-span-1"
        />
      </div>

      {/* ── TAB 1: KANBAN ─────────────────────────────── */}
      {activeTab === 'kanban' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-md">
              <Search size={15} strokeWidth={1.8} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-arena-400/45" />
              <input
                type="text"
                placeholder="Buscar por nombre, teléfono o correo"
                value={search}
                onChange={e => setSearch(e.target.value)}
                aria-label="Buscar prospecto"
                className="input-field py-2.5 pl-10 text-[13px]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button onClick={fetchData} className="btn-secondary px-3.5 py-2 text-[11px]" title="Actualizar leads">
                <RefreshCw size={13} className={loading ? 'animate-spin' : undefined} />
                Refrescar
              </button>
              <a href="/formulario" target="_blank" rel="noreferrer" className="btn-primary px-3.5 py-2 text-[11px]">
                <ArrowUpRight size={13} />
                Formulario web
              </a>
            </div>
          </div>

          {loading ? (
            <div className="flex gap-4 overflow-hidden pb-4">
              {ESTADOS.map(estado => (
                <div key={estado} className="kanban-col gap-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-28 w-full" />
                  <Skeleton className="h-28 w-full" />
                  <Skeleton className="h-28 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 pt-1">
              {ESTADOS.map(estado => {
                const meta = ESTADO_META[estado]
                return (
                  <KanbanColumn
                    key={estado}
                    estado={estado}
                    label={meta.label}
                    description={meta.desc}
                    tone={meta.tone}
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

      {/* ── TAB 2: ANALÍTICA ──────────────────────────── */}
      {activeTab === 'analytics' && (
        <div className="space-y-5 animate-fade-in">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="card lg:col-span-2">
              <SectionHeader
                eyebrow="Embudo"
                title="Progresión comercial"
                description="Del primer formulario al adelanto confirmado."
                icon={BarChart3}
                action={<StatusBadge tone={tasaCierre >= 20 ? 'sage' : 'gold'} dot>{tasaCierre.toFixed(1)}% éxito</StatusBadge>}
              />

              <div className="mt-6 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <defs>
                      {funnelData.map((entry, index) => (
                        <linearGradient key={index} id={`funnel-${index}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={entry.fill} stopOpacity={0.95} />
                          <stop offset="100%" stopColor={entry.fill} stopOpacity={0.35} />
                        </linearGradient>
                      ))}
                    </defs>
                    <XAxis dataKey="etapa" stroke="rgba(245,235,208,0.35)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="rgba(245,235,208,0.35)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      cursor={{ fill: 'rgba(245,235,208,0.03)' }}
                      formatter={(value: unknown) => [`${value} prospectos`, 'Volumen']}
                    />
                    <Bar dataKey="cantidad" radius={[8, 8, 2, 2]} maxBarSize={64} isAnimationActive={false}>
                      {funnelData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={`url(#funnel-${index})`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-arena-200/[0.07] pt-4 sm:grid-cols-4">
                {funnelData.map(f => (
                  <div key={f.etapa} className="rounded-xl border border-arena-200/[0.06] bg-dark-900/40 p-2.5 text-center">
                    <p className="text-[10px] text-arena-300/50">{f.etapa}</p>
                    <p className="mt-1 font-display text-lg font-semibold text-arena-50 tabular">{f.cantidad}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <SectionHeader
                eyebrow="Distribución"
                title="Estado de la base"
                description="Leads activos por etapa."
                icon={Users}
              />

              {pieData.length === 0 ? (
                <EmptyState icon={Users} title="Sin datos aún" description="Captura el primer lead para ver la distribución." className="mt-5 border-0 bg-transparent py-10" />
              ) : (
                <>
                  <div className="relative mt-2 h-52 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={56}
                          outerRadius={80}
                          paddingAngle={4}
                          dataKey="value"
                          stroke="rgba(12,10,9,0.8)"
                          strokeWidth={2}
                          isAnimationActive={false}
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-display text-2xl font-semibold text-arena-50 tabular">{stats?.total ?? 0}</span>
                      <span className="text-[9.5px] uppercase tracking-[0.18em] text-arena-400/55">leads</span>
                    </div>
                  </div>

                  <div className="mt-2 space-y-2 border-t border-arena-200/[0.07] pt-3">
                    {pieData.map(item => (
                      <div key={item.name} className="flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-2 text-arena-300/70">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                          {item.name}
                        </span>
                        <span className="font-semibold text-arena-100 tabular">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="card">
            <SectionHeader
              eyebrow="Canales"
              title="Rendimiento por adquisición"
              description="Origen de los prospectos y calidad de cada canal."
              icon={Megaphone}
            />
            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {[
                { nombre: 'Formulario web', detalle: 'Orgánico y SEO', share: 48, tone: 'sage' as Tone, nota: 'Alta intención de reserva' },
                { nombre: 'Instagram Ads', detalle: 'Campaña cortes', share: 29, tone: 'wine' as Tone, nota: 'Reels y stories visuales' },
                { nombre: 'WhatsApp directo', detalle: 'Parrillada familiar', share: 16, tone: 'gold' as Tone, nota: 'Respuesta inmediata' },
                { nombre: 'Google y LinkedIn', detalle: 'Eventos VIP', share: 7, tone: 'info' as Tone, nota: 'Ticket promedio alto' },
              ].map(canal => (
                <div key={canal.nombre} className="rounded-2xl border border-arena-200/[0.06] bg-dark-900/40 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-semibold text-arena-200">{canal.nombre}</p>
                      <p className="mt-0.5 truncate text-[10px] text-arena-300/45">{canal.detalle}</p>
                    </div>
                    <span className={clsx(
                      'shrink-0 font-display text-lg font-semibold tabular',
                      canal.tone === 'sage' ? 'text-sage-400' : canal.tone === 'wine' ? 'text-vino-300' : canal.tone === 'gold' ? 'text-gold-400' : 'text-[#A8C6E0]',
                    )}>
                      {canal.share}%
                    </span>
                  </div>
                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-arena-200/[0.06]">
                    <div
                      className={clsx(
                        'h-full rounded-full',
                        canal.tone === 'sage' ? 'bg-sage-500' : canal.tone === 'wine' ? 'bg-vino-600' : canal.tone === 'gold' ? 'bg-gold-500' : 'bg-[#6F9FC4]',
                      )}
                      style={{ width: `${canal.share}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[10px] leading-relaxed text-arena-300/45">{canal.nota}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: POMELLI ────────────────────────────── */}
      {activeTab === 'pomelli' && (
        <div className="space-y-5 animate-fade-in">
          <div className="relative overflow-hidden rounded-[24px] border border-arena-200/10">
            <img
              src="/images/campana_eventos.jpg"
              alt="Salón privado de Parrilladas El Establo"
              className="absolute inset-0 h-full w-full object-cover opacity-30"
              loading="lazy"
              decoding="async"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-dark-950 via-dark-950/90 to-dark-950/30" />
            <div className="relative flex flex-col gap-5 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-gold-500/30 bg-gold-500/10 px-3 py-1 text-[10.5px] font-semibold text-gold-300">
                  <Sparkles size={12} strokeWidth={1.8} />
                  Google Labs Pomelli · Brand Creative Studio
                </div>
                <h2 className="mt-4 font-display text-[clamp(1.6rem,3vw,2.35rem)] font-semibold leading-tight tracking-tight text-arena-50">
                  Creativos listos para pauta
                </h2>
                <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-arena-300/70">
                  Imágenes de calidad publicitaria, copys persuasivos y llamadas a la acción diseñadas para captar leads y llevarlos al formulario con 10% de adelanto.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone="sage" dot>4 campañas activas</StatusBadge>
                <StatusBadge tone="neutral">Actualizado hoy</StatusBadge>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {POMELLI_CREATIVES.map(creative => (
              <article key={creative.id} className="group flex flex-col overflow-hidden rounded-[22px] border border-arena-200/[0.08] bg-dark-800/75 shadow-card transition-all duration-300 hover:border-vino-700/50 hover:shadow-card-hover">
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-dark-950">
                  <img
                    src={creative.imagen}
                    srcSet={creative.imageSet}
                    sizes="(min-width: 1024px) 50vw, 100vw"
                    alt={creative.titulo}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-dark-950/10 to-transparent opacity-90" />
                  <span className="absolute left-3 top-3 rounded-full border border-gold-500/30 bg-black/65 px-2.5 py-1 text-[9.5px] font-semibold text-gold-200 backdrop-blur-sm">
                    {creative.badge}
                  </span>
                  <span className="absolute bottom-3 left-3 flex items-center gap-1.5 text-[10px] font-medium text-arena-100/85">
                    <Megaphone size={11} strokeWidth={1.8} className="text-gold-400" />
                    {creative.canal}
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <h3 className="font-display text-lg font-semibold leading-snug tracking-tight text-arena-50">
                    {creative.titulo}
                  </h3>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-arena-300/50">{creative.subtitulo}</p>

                  <div className="mt-4 rounded-xl border border-arena-200/[0.06] bg-dark-900/40 p-3">
                    <p className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-arena-400/55">Público objetivo</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-arena-300/70">{creative.publicoObjetivo}</p>
                  </div>

                  <div className="mt-2 rounded-xl border border-vino-800/30 bg-vino-950/20 p-3">
                    <p className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-vino-300/80">Copy sugerido</p>
                    <p className="mt-1 line-clamp-3 text-[11px] italic leading-relaxed text-arena-200/75">“{creative.copyTexto}”</p>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-arena-200/[0.07] pt-3 text-center">
                    <div>
                      <p className="text-[9.5px] text-arena-300/45">CTR</p>
                      <p className="mt-0.5 font-display text-sm font-semibold text-gold-300 tabular">{creative.metricas.ctr}</p>
                    </div>
                    <div>
                      <p className="text-[9.5px] text-arena-300/45">Conversión</p>
                      <p className="mt-0.5 font-display text-sm font-semibold text-sage-400 tabular">{creative.metricas.tasaConv}</p>
                    </div>
                    <div>
                      <p className="text-[9.5px] text-arena-300/45">CPC est.</p>
                      <p className="mt-0.5 font-display text-sm font-semibold text-arena-200 tabular">{creative.metricas.cpc}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => handleCopyCopy(creative.id, creative.copyTexto)}
                      className="btn-secondary flex-1 px-3 py-2 text-[11px]"
                    >
                      {copiedId === creative.id ? <Check size={13} className="text-sage-400" /> : <Copy size={13} />}
                      {copiedId === creative.id ? 'Copiado' : 'Copiar copy'}
                    </button>
                    <a
                      href={creative.imagen}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-primary flex-1 px-3 py-2 text-[11px]"
                    >
                      <ExternalLink size={13} />
                      Ver original
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="card border-vino-800/25">
            <SectionHeader
              eyebrow="Studio"
              title="Generador de creativos on-brand"
              description="Simula la creación guiada de contenido publicitario para redes sociales y WhatsApp."
              icon={Sparkles}
              action={<StatusBadge tone="gold">Beta</StatusBadge>}
            />

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label htmlFor="prompt-corte" className="label">Corte o menú destacado</label>
                <select id="prompt-corte" value={promptCorte} onChange={e => setPromptCorte(e.target.value)} className="input-field py-2.5 text-[12px]">
                  <option value="Tomahawk">Tomahawk Steak 1.2kg</option>
                  <option value="Ribeye">Ojo de Bife / Ribeye Angus</option>
                  <option value="Bife de Chorizo">Bife de Chorizo Clásico</option>
                  <option value="Parrillada Completa">Parrillada El Establo Familiar</option>
                  <option value="Degustación y Cava">Cena Maridaje Cava Malbec</option>
                </select>
              </div>

              <div>
                <label htmlFor="prompt-objetivo" className="label">Objetivo comercial</label>
                <select id="prompt-objetivo" value={promptObjetivo} onChange={e => setPromptObjetivo(e.target.value)} className="input-field py-2.5 text-[12px]">
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
                  className="btn-primary w-full py-3 text-xs"
                >
                  {generandoPrompt ? <LoaderCircle size={15} className="animate-spin" /> : <Sparkles size={15} />}
                  {generandoPrompt ? 'Diseñando con Pomelli…' : 'Generar ficha publicitaria'}
                </button>
              </div>
            </div>

            {promptResultado && (
              <div className="mt-4 animate-fade-in rounded-xl border border-gold-500/25 bg-dark-950/70 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-[0.16em] text-gold-400">
                    <Sparkles size={11} />
                    Resultado on-brand
                  </p>
                  <button
                    onClick={() => handleCopyCopy('prompt', promptResultado)}
                    className="btn-ghost px-2 py-1 text-[10px]"
                  >
                    {copiedId === 'prompt' ? <Check size={12} className="text-sage-400" /> : <Copy size={12} />}
                    {copiedId === 'prompt' ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
                <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-arena-200/80">{promptResultado}</pre>
              </div>
            )}
          </div>
        </div>
      )}

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
