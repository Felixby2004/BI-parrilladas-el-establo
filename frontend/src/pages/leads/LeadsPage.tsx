import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CalendarDays, Columns3, Filter, Mail, MessageCircle, Phone, Plus, RefreshCw, Search, Table2, Users, X } from 'lucide-react'
import { clsx } from 'clsx'
import { leadsService } from '@/services/api'
import { apiErrorMessage } from '@/services/errors'
import { EmptyState, SegmentedTabs, Skeleton } from '@/components/ui/kit'
import { NewLeadDialog } from '@/components/leads/NewLeadDialog'
import { INTERES_LABELS, type EstadoLead, type LeadKanban } from '@/types'

const STATES: { id: EstadoLead; label: string; color: string }[] = [
  { id: 'nuevo', label: 'Nuevo', color: '#6F9FC4' }, { id: 'contactado', label: 'Contactado', color: '#C9A25A' },
  { id: 'respondio', label: 'Respondió', color: '#B58AC9' }, { id: 'ganado', label: 'Ganado', color: '#84A98C' },
  { id: 'perdido', label: 'Perdido', color: '#C46666' },
]
const date = (value?: string) => {
  if (!value) return 'Sin fecha'
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  return Number.isNaN(parsed.getTime()) ? 'Sin fecha' : parsed.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}
const budget = (lead: LeadKanban) => lead.presupuesto_estimado == null ? 'Sin presupuesto' : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(Number(lead.presupuesto_estimado)) + ' MXN'
const channel = (lead: LeadKanban) => lead.buyer_canal?.replace(/_/g, ' ') || 'Canal no informado'

export default function LeadsPage() {
  const cache = useQueryClient()
  const query = useQuery({ queryKey: ['leads', 'board'], queryFn: leadsService.listarTodos, refetchInterval: 30_000 })
  const [view, setView] = useState<'board' | 'table'>('board')
  const [search, setSearch] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [stateFilter, setStateFilter] = useState('')
  const [interest, setInterest] = useState('')
  const [source, setSource] = useState('')
  const [sort, setSort] = useState('recent')
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState('')
  const [dragOver, setDragOver] = useState<EstadoLead | null>(null)
  const mutation = useMutation({
    mutationFn: ({ id, state }: { id: number; state: EstadoLead }) => leadsService.actualizarEstado(id, state),
    onSuccess: updated => {
      cache.setQueryData<LeadKanban[]>(['leads', 'board'], old => old?.map(lead => lead.id_lead === updated.id_lead ? updated : lead))
      setNotice(`Lead #${updated.id_lead}: estado guardado.`)
      void cache.invalidateQueries({ queryKey: ['leads'] })
    },
  })
  const all = query.data ?? []
  const sources = [...new Set(all.map(lead => lead.buyer_canal).filter((value): value is string => Boolean(value)))].sort()
  const visible = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase()
    return all.filter(lead => (!stateFilter || lead.estado === stateFilter)
      && (!interest || (interest === 'informacion' ? ['consulta', 'informacion'].includes(lead.interes_confirmado || '') : lead.interes_confirmado === interest))
      && (!source || (source === '__missing' ? !lead.buyer_canal : lead.buyer_canal === source))
      && (!needle || [lead.buyer_nombre, lead.buyer_telefono, lead.buyer_email, lead.id_lead, lead.campana_nombre, lead.buyer_canal].some(value => String(value ?? '').toLocaleLowerCase().includes(needle))))
      .sort((a, b) => {
        if (sort === 'name') return (a.buyer_nombre || '').localeCompare(b.buyer_nombre || '', 'es') || a.id_lead - b.id_lead
        if (sort === 'budget') return Number(b.presupuesto_estimado ?? -1) - Number(a.presupuesto_estimado ?? -1) || b.id_lead - a.id_lead
        const difference = new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || b.id_lead - a.id_lead
        return sort === 'oldest' ? -difference : difference
      })
  }, [all, search, stateFilter, interest, source, sort])
  const activeFilters = [stateFilter, interest, source].filter(Boolean).length
  const reset = () => { setStateFilter(''); setInterest(''); setSource(''); setSearch('') }
  const changeState = (lead: LeadKanban, state: EstadoLead) => {
    if (mutation.isPending || lead.estado === state) return
    mutation.reset()
    setNotice('')
    mutation.mutate({ id: lead.id_lead, state })
  }
  const stateSelect = (lead: LeadKanban) => <select aria-label={`Cambiar estado de ${lead.buyer_nombre || `lead ${lead.id_lead}`}`} value={lead.estado} disabled={mutation.isPending} onChange={e => changeState(lead, e.target.value as EstadoLead)} className={`badge badge-${lead.estado} min-w-0 cursor-pointer bg-dark-800 py-1.5 disabled:opacity-50`}>{STATES.map(state => <option key={state.id} value={state.id}>{state.label}</option>)}</select>
  return (
    <div className="min-w-0 animate-fade-in space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow mb-1.5">Pipeline comercial</p><h1 className="page-title">Leads</h1><p className="page-subtitle">Cada contacto, una conversación por avanzar.</p></div><span className="rounded-full border border-arena-200/10 px-3 py-1.5 text-xs text-arena-300">{all.length} leads registrados</span></header>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-arena-200/10 bg-dark-800/80 p-2.5">
        <SegmentedTabs value={view} onChange={setView} items={[{ id: 'board', label: 'Tablero', icon: Columns3 }, { id: 'table', label: 'Tabla', icon: Table2 }]} className="rounded-xl border-0 bg-transparent p-0" />
        <button onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={filtersOpen} aria-controls="leads-filters" className={clsx('btn-secondary px-3 py-2 text-xs', activeFilters > 0 && 'border-gold-500/40 text-gold-300')}><Filter size={14} />Filtrar{activeFilters > 0 ? ` (${activeFilters})` : ''}</button>
        <label className="sr-only" htmlFor="leads-sort">Ordenar leads</label><select id="leads-sort" value={sort} onChange={e => setSort(e.target.value)} className="input-field w-auto max-w-full px-3 py-2 text-xs"><option value="recent">Más recientes</option><option value="oldest">Más antiguos</option><option value="name">Nombre A–Z</option><option value="budget">Mayor presupuesto</option></select>
        <div className="relative min-w-[180px] flex-1 sm:ml-auto"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-arena-400" /><input aria-label="Buscar leads por nombre, teléfono, correo o ID" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar leads…" className="input-field py-2 pl-9 text-xs" /></div>
        <button onClick={() => void query.refetch()} disabled={query.isFetching} aria-label="Actualizar leads" className="btn-icon h-9 w-9"><RefreshCw size={14} className={query.isFetching ? 'animate-spin' : ''} /></button>
        <button onClick={() => setCreating(true)} className="btn-primary px-3 py-2 text-xs"><Plus size={15} />Nuevo lead</button>
      </div>
      {filtersOpen && <div id="leads-filters" className="grid gap-3 rounded-2xl border border-arena-200/10 bg-dark-800/70 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-arena-300">Estado<select value={stateFilter} onChange={e => setStateFilter(e.target.value)} className="input-field mt-1.5 py-2 text-xs"><option value="">Todos los estados</option>{STATES.map(state => <option key={state.id} value={state.id}>{state.label}</option>)}</select></label>
        <label className="text-xs text-arena-300">Interés<select value={interest} onChange={e => setInterest(e.target.value)} className="input-field mt-1.5 py-2 text-xs"><option value="">Todos los intereses</option>{['reserva', 'informacion', 'evento', 'otro'].map(value => <option key={value} value={value}>{INTERES_LABELS[value]}</option>)}</select></label>
        <label className="text-xs text-arena-300">Canal<select value={source} onChange={e => setSource(e.target.value)} className="input-field mt-1.5 py-2 text-xs"><option value="">Todos los canales</option>{sources.map(value => <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>)}<option value="__missing">Sin canal informado</option></select></label>
        <button onClick={reset} className="btn-ghost self-end text-xs"><X size={13} />Limpiar filtros</button>
      </div>}
      {(query.isError || mutation.isError) && <div role="alert" className="rounded-xl border border-red-400/25 bg-red-400/10 p-3 text-xs text-red-200">{apiErrorMessage(mutation.error || query.error, mutation.isError ? 'No se guardó el estado. Intenta nuevamente.' : 'No se pudieron actualizar los leads. Revisa tu conexión.')}<button onClick={() => { mutation.reset(); void query.refetch() }} className="ml-3 underline">Reintentar</button></div>}
      {notice && <p role="status" className="text-xs text-sage-300">{notice}</p>}
      <div className="flex flex-wrap justify-between gap-2 text-[11px] text-arena-300/60"><p>{visible.length} de {all.length} leads{activeFilters || search ? ' · Vista filtrada' : ''}</p><p>{view === 'board' ? 'Arrastra una tarjeta o usa su selector de estado.' : 'Cambia estados y abre conversaciones desde la tabla.'}</p></div>
      {query.isPending ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">{STATES.map(state => <Skeleton key={state.id} className="h-80" />)}</div> : <>
        {visible.length === 0 && <EmptyState icon={Users} title={all.length ? 'Sin coincidencias' : 'Aún no hay leads'} description={all.length ? 'Prueba con otro término o limpia los filtros.' : 'Crea el primer contacto para comenzar el seguimiento.'} action={<button onClick={all.length ? reset : () => setCreating(true)} className="btn-secondary text-xs">{all.length ? 'Limpiar búsqueda y filtros' : 'Crear lead'}</button>} />}
        {view === 'board' && <div className="flex snap-x gap-3 overflow-x-auto pb-4" aria-label="Tablero de leads">{STATES.map(state => {
          const items = visible.filter(lead => lead.estado === state.id)
          return <section key={state.id} aria-label={`${state.label}: ${items.length} leads`} onDragOver={event => { if (!mutation.isPending) { event.preventDefault(); setDragOver(state.id) } }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOver(null) }} onDrop={event => { event.preventDefault(); setDragOver(null); const id = Number(event.dataTransfer.getData('application/x-establo-lead')); const lead = all.find(item => item.id_lead === id); if (lead) changeState(lead, state.id) }} className={clsx('min-h-[350px] w-[280px] min-w-[280px] flex-1 snap-start rounded-2xl border bg-dark-800/50 p-2.5', dragOver === state.id ? 'border-gold-500/60 bg-gold-500/5' : 'border-arena-200/[0.07]')}>
            <div className="mb-3 h-[3px] rounded-full" style={{ backgroundColor: state.color }} /><header className="mb-3 flex items-center justify-between px-1"><h2 className="text-xs font-semibold">{state.label}</h2><span className="rounded-md bg-arena-200/[0.07] px-2 py-0.5 text-[11px] tabular">{items.length}</span></header>
            <div className="space-y-2.5">{items.map(lead => <article key={lead.id_lead} draggable={!mutation.isPending} onDragStart={event => { event.dataTransfer.setData('application/x-establo-lead', String(lead.id_lead)); event.dataTransfer.effectAllowed = 'move' }} onDragEnd={() => setDragOver(null)} className="rounded-xl border border-arena-200/10 bg-dark-700/80 p-3 shadow-sm transition-colors hover:border-arena-200/25">
              <div className="flex items-start gap-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-vino-700/30 bg-vino-900/20 text-xs font-semibold text-arena-200">{(lead.buyer_nombre || 'L').charAt(0).toUpperCase()}</span><div className="min-w-0"><Link to={`/leads/${lead.id_lead}/negociacion`} className="block break-words text-[13px] font-semibold text-arena-50 hover:text-gold-300">{lead.buyer_nombre || `Lead #${lead.id_lead}`}</Link><p className="mt-0.5 text-[10px] text-arena-400">#{lead.id_lead} · {channel(lead)}</p></div></div>
              <div className="mt-3 space-y-1.5 text-[11px] text-arena-300/80">{lead.buyer_telefono && <a href={`tel:${lead.buyer_telefono}`} className="flex items-center gap-2 break-all hover:text-arena-50"><Phone size={11} className="shrink-0" />{lead.buyer_telefono}</a>}{lead.buyer_email && <a href={`mailto:${lead.buyer_email}`} className="flex items-center gap-2 break-all hover:text-arena-50"><Mail size={11} className="shrink-0" />{lead.buyer_email}</a>}{!lead.buyer_telefono && !lead.buyer_email && <p>Sin datos de contacto</p>}</div>
              <div className="mt-3 flex flex-wrap gap-1.5"><span className="rounded-md bg-arena-200/[0.05] px-2 py-1 text-[10px] text-arena-200">{INTERES_LABELS[lead.interes_confirmado || ''] || 'Interés no informado'}</span>{lead.personas_estimadas != null && <span className="inline-flex items-center gap-1 rounded-md bg-arena-200/[0.05] px-2 py-1 text-[10px] text-arena-300"><Users size={10} />{lead.personas_estimadas}</span>}</div>
              <div className="mt-3 flex items-center justify-between gap-2 text-[10px]"><span className="font-semibold text-gold-300">{budget(lead)}</span><span className="text-arena-400" title="Fecha de creación">{date(lead.created_at)}</span></div>{lead.fecha_preferida && <p className="mt-2 flex items-center gap-1.5 text-[10px] text-arena-300/65"><CalendarDays size={11} />Preferida: {date(lead.fecha_preferida)}</p>}
              <footer className="mt-3 flex items-center justify-between gap-2 border-t border-arena-200/[0.07] pt-2.5">{stateSelect(lead)}<Link to={`/leads/${lead.id_lead}/negociacion`} aria-label={`Abrir chat de ${lead.buyer_nombre || `lead ${lead.id_lead}`}`} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] text-arena-200 hover:bg-vino-900/40"><MessageCircle size={13} />Chat</Link></footer>
            </article>)}{items.length === 0 && <p className="rounded-xl border border-dashed border-arena-200/10 px-4 py-10 text-center text-[11px] text-arena-400/65">Sin leads en este estado</p>}</div>
          </section>
        })}</div>}
        {view === 'table' && visible.length > 0 && <div className="overflow-x-auto rounded-2xl border border-arena-200/10 bg-dark-800/60"><table className="w-full min-w-[980px] text-left text-xs"><caption className="sr-only">Leads filtrados y ordenados</caption><thead className="border-b border-arena-200/10 bg-dark-700/60 text-[10px] uppercase tracking-wide text-arena-400"><tr>{['Contacto', 'Estado', 'Canal', 'Interés', 'Presupuesto', 'Creado', 'Fecha preferida', 'Conversación'].map(label => <th key={label} scope="col" className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y divide-arena-200/[0.06]">{visible.map(lead => <tr key={lead.id_lead} className="hover:bg-arena-200/[0.025]"><td className="px-4 py-3"><Link to={`/leads/${lead.id_lead}/negociacion`} className="font-semibold text-arena-100 hover:text-gold-300">{lead.buyer_nombre || `Lead #${lead.id_lead}`}</Link><p className="mt-1 text-[11px] text-arena-400">#{lead.id_lead}{lead.buyer_telefono ? ` · ${lead.buyer_telefono}` : ''}</p>{lead.buyer_email && <p className="mt-0.5 text-[11px] text-arena-400">{lead.buyer_email}</p>}</td><td className="px-4 py-3">{stateSelect(lead)}</td><td className="px-4 py-3 text-arena-300">{channel(lead)}</td><td className="px-4 py-3 text-arena-300">{INTERES_LABELS[lead.interes_confirmado || ''] || 'No informado'}</td><td className="whitespace-nowrap px-4 py-3 text-gold-300">{budget(lead)}</td><td className="whitespace-nowrap px-4 py-3 text-arena-300">{date(lead.created_at)}</td><td className="whitespace-nowrap px-4 py-3 text-arena-300">{date(lead.fecha_preferida)}</td><td className="px-4 py-3"><Link to={`/leads/${lead.id_lead}/negociacion`} className="inline-flex items-center gap-1.5 rounded-lg border border-arena-200/10 px-2.5 py-2 hover:bg-vino-900/30"><MessageCircle size={13} />Abrir chat</Link></td></tr>)}</tbody></table></div>}
      </>}
      {creating && <NewLeadDialog onClose={() => setCreating(false)} onCreated={id => { setCreating(false); reset(); setSort('recent'); setNotice(`Lead #${id} creado correctamente.`); void cache.invalidateQueries({ queryKey: ['leads'] }) }} />}
    </div>
  )
}
