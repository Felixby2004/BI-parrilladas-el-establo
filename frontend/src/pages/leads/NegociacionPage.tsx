import { useState, useRef, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  ArrowLeft,
  ClipboardList,
  CreditCard,
  MessageCircle,
  UserRound,
  AlertTriangle,
} from 'lucide-react'
import type { Perfil360, DetallePedido, MPPreferenceResponse } from '@/types/leads'
import { perfilesService } from '@/services/leadsService'
import { leadsService } from '@/services/api'
import { ChatNegociacion } from '@/components/leads/ChatNegociacion'
import { ResumenPedido } from '@/components/leads/ResumenPedido'
import { PerfilLead } from '@/components/leads/PerfilLead'
import { SegmentedTabs, Skeleton, StatusBadge, type Tone } from '@/components/ui/kit'

type Tab = 'perfil' | 'chat' | 'pedido'

const ESTADO_TONE: Record<string, Tone> = {
  nuevo: 'info',
  contactado: 'gold',
  respondio: 'wine',
  ganado: 'sage',
  perdido: 'rose',
}

export default function NegociacionPage() {
  const { idLead } = useParams<{ idLead: string }>()
  const navigate = useNavigate()
  const leadId = Number(idLead)

  const [perfil, setPerfil] = useState<Perfil360 | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('chat')
  const [mpResp, setMpResp] = useState<MPPreferenceResponse | null>(null)
  const [itemsPedido, setItemsPedido] = useState<DetallePedido[]>([])
  const [aviso, setAviso] = useState('')

  const [idBuyer, setIdBuyer] = useState<number>(0)
  const pedidoCargado = useRef<number>()
  const avisoTimer = useRef<number>()

  const mostrarAviso = useCallback((mensaje: string) => {
    setAviso(mensaje)
    window.clearTimeout(avisoTimer.current)
    avisoTimer.current = window.setTimeout(() => setAviso(''), 4200)
  }, [])

  useEffect(() => () => window.clearTimeout(avisoTimer.current), [])

  const fetchPerfil = useCallback(async () => {
    if (!Number.isInteger(leadId) || leadId <= 0) {
      setError('Identificador de lead no válido')
      setLoading(false)
      return
    }
    setError('')
    try {
      const [data, lead] = await Promise.all([
        perfilesService.getPerfil360(leadId),
        leadsService.detalle(leadId),
      ])
      setPerfil(data)
      setIdBuyer(lead.id_buyer)
      if (data.pedido_activo && pedidoCargado.current !== data.pedido_activo.id_pedido) {
        setItemsPedido(data.pedido_activo.detalles)
        pedidoCargado.current = data.pedido_activo.id_pedido
      }
    } catch (e) {
      setError('No se pudo cargar el perfil del lead')
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    setLoading(true)
    setPerfil(null)
    setItemsPedido([])
    setMpResp(null)
    setIdBuyer(0)
    pedidoCargado.current = undefined
    fetchPerfil()
  }, [fetchPerfil])

  const handleAgregarAlPedido = (item: DetallePedido) => {
    if (perfil?.pago_adelanto || (perfil?.pedido_activo && perfil.pedido_activo.estado !== 'borrador')) {
      mostrarAviso('El pedido ya está confirmado y no admite cambios desde el catálogo.')
      return
    }
    setItemsPedido(prev => {
      const existe = prev.findIndex(i => i.nombre_producto === item.nombre_producto)
      if (existe >= 0) {
        const copia = [...prev]
        copia[existe] = { ...copia[existe], cantidad: copia[existe].cantidad + 1 }
        return copia
      }
      return [...prev, item]
    })
    setActiveTab('pedido')
    setTimeout(() => setActiveTab('chat'), 600)
  }

  const handlePagoIniciado = (resp: MPPreferenceResponse) => {
    setMpResp(resp)
    fetchPerfil()
  }

  if (loading) {
    return (
      <div className="animate-fade-in space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-52" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-12 gap-4">
          <Skeleton className="col-span-3 hidden h-[60dvh] xl:block" />
          <Skeleton className="col-span-12 h-[60dvh] xl:col-span-6" />
          <Skeleton className="col-span-3 hidden h-[60dvh] xl:block" />
        </div>
      </div>
    )
  }

  if (!perfil) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl border border-vino-700/30 bg-vino-900/20 text-vino-300">
          <AlertTriangle size={24} strokeWidth={1.5} />
        </span>
        <div>
          <h1 className="font-display text-xl font-semibold text-arena-50">No pudimos abrir este lead</h1>
          <p className="mt-1 text-sm text-arena-300/60">{error || 'Lead no encontrado'}</p>
        </div>
        <button onClick={() => navigate('/leads')} className="btn-secondary text-xs">
          <ArrowLeft size={14} />
          Volver al tablero
        </button>
      </div>
    )
  }

  const tabs: { id: Tab; label: string; icon: typeof UserRound }[] = [
    { id: 'perfil', label: 'Perfil', icon: UserRound },
    { id: 'chat',   label: 'Chat',   icon: MessageCircle },
    { id: 'pedido', label: 'Pedido', icon: ClipboardList },
  ]

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] min-h-[640px] animate-fade-in flex-col">
      {/* ── Header ────────────────────────────────────── */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => navigate('/leads')}
            aria-label="Volver al tablero"
            className="btn-icon h-9 w-9 shrink-0"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="eyebrow">Leads / Negociación</p>
              <StatusBadge tone={ESTADO_TONE[perfil.estado_lead] ?? 'neutral'} dot>
                {perfil.estado_lead}
              </StatusBadge>
              {perfil.buyer_etapa === 'payer' && <StatusBadge tone="sage">Payer</StatusBadge>}
            </div>
            <h1 className="mt-1 truncate font-display text-[clamp(1.35rem,2.2vw,1.8rem)] font-semibold tracking-tight text-arena-50">
              {perfil.buyer_nombre || `Lead #${perfil.id_lead}`}
            </h1>
            <p className="mt-0.5 text-[11px] text-arena-300/50">
              Lead #{perfil.id_lead}
              {perfil.buyer_telefono ? ` · ${perfil.buyer_telefono}` : ''}
              {perfil.buyer_canal ? ` · ${perfil.buyer_canal}` : ''}
            </p>
          </div>
        </div>

        {mpResp && (
          <a
            href={mpResp.init_point}
            target="_blank"
            rel="noreferrer"
            className="btn-primary animate-pulse-glow self-start px-4 py-2.5 text-xs lg:self-auto"
          >
            <CreditCard size={15} />
            Pagar ${mpResp.monto_adelanto} MXN
          </a>
        )}
      </div>

      {error && <div role="alert" className="mb-3 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-2 text-xs text-red-200">{error}. Se conserva el perfil y pedido local. <button type="button" onClick={() => void fetchPerfil()} className="underline">Reintentar</button></div>}
      {/* ── Layout ────────────────────────────────────── */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)_340px]">
        <div className="hidden min-h-0 overflow-y-auto pr-1 xl:block">
          <PerfilLead perfil={perfil} />
        </div>

        <div className="flex min-h-0 flex-col">
          <div className="mb-3 xl:hidden">
            <SegmentedTabs
              value={activeTab}
              onChange={setActiveTab}
              items={tabs}
              className="w-full justify-between [&>button]:flex-1"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-hidden rounded-[20px] border border-arena-200/[0.07] bg-dark-800/75 shadow-card">
            <div className={clsx('h-full', activeTab !== 'chat' && 'hidden xl:block')}>
              <ChatNegociacion
                idLead={leadId}
                buyerNombre={perfil.buyer_nombre || ''}
                mensajes={perfil.mensajes_recientes}
                onMensajeEnviado={fetchPerfil}
                onAgregarAlPedido={handleAgregarAlPedido}
              />
            </div>
            <div className={clsx('h-full xl:hidden', activeTab !== 'perfil' && 'hidden')}>
              <div className="h-full overflow-y-auto p-4">
                <PerfilLead perfil={perfil} />
              </div>
            </div>
            <div className={clsx('h-full xl:hidden', activeTab !== 'pedido' && 'hidden')}>
              <ResumenPedido
                idLead={leadId}
                idBuyer={idBuyer}
                items={itemsPedido}
                onItemsChange={setItemsPedido}
                buyerNombre={perfil.buyer_nombre}
                buyerEmail={perfil.buyer_email}
                pedidoActivo={perfil.pedido_activo}
                pagoAdelanto={perfil.pago_adelanto}
                onPedidoCreado={fetchPerfil}
                onPagoIniciado={handlePagoIniciado}
              />
            </div>
          </div>
        </div>

        <div className="hidden min-h-0 flex-col xl:flex">
          <div className="min-h-0 flex-1 overflow-hidden rounded-[20px] border border-arena-200/[0.07] bg-dark-800/75 shadow-card">
            <ResumenPedido
              idLead={leadId}
              idBuyer={idBuyer}
              items={itemsPedido}
              onItemsChange={setItemsPedido}
              buyerNombre={perfil.buyer_nombre}
              buyerEmail={perfil.buyer_email}
              pedidoActivo={perfil.pedido_activo}
              pagoAdelanto={perfil.pago_adelanto}
              onPedidoCreado={fetchPerfil}
              onPagoIniciado={handlePagoIniciado}
            />
          </div>
        </div>
      </div>

      {aviso && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-2.5 rounded-xl border border-gold-500/30 bg-dark-800/95 px-4 py-3 text-[12px] text-arena-200 shadow-2xl backdrop-blur-md animate-slide-up"
        >
          <AlertTriangle size={15} className="shrink-0 text-gold-400" />
          <span>{aviso}</span>
        </div>
      )}
    </div>
  )
}
