import { useState, useRef, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import type { Perfil360, DetallePedido, MPPreferenceResponse } from '@/types/leads'
import { perfilesService } from '@/services/leadsService'
import { leadsService } from '@/services/api'
import { ChatNegociacion } from '@/components/leads/ChatNegociacion'
import { ResumenPedido } from '@/components/leads/ResumenPedido'
import { PerfilLead } from '@/components/leads/PerfilLead'

type Tab = 'perfil' | 'chat' | 'pedido'

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

  const [idBuyer, setIdBuyer] = useState<number>(0)
  const pedidoCargado = useRef<number>()

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
      // Los refrescos del chat no deben borrar el borrador del pedido.
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
      window.alert('El pedido ya está confirmado y no admite cambios desde el catálogo.')
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
    // Cambiar al tab de pedido para mostrar feedback
    setActiveTab('pedido')
    setTimeout(() => setActiveTab('chat'), 600)
  }

  const handlePagoIniciado = (resp: MPPreferenceResponse) => {
    setMpResp(resp)
    fetchPerfil()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center animate-fade-in">
          <div className="text-5xl mb-4 animate-bounce">🔥</div>
          <p className="text-gray-400">Cargando perfil del lead...</p>
        </div>
      </div>
    )
  }

  if (error || !perfil) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="text-5xl">😶</div>
        <p className="text-red-400 text-sm">{error || 'Lead no encontrado'}</p>
        <button onClick={() => navigate('/leads')} className="btn-ghost">
          ← Volver al Kanban
        </button>
      </div>
    )
  }

  const tabs: { id: Tab; label: string; emoji: string }[] = [
    { id: 'perfil', label: 'Perfil 360°', emoji: '👤' },
    { id: 'chat',   label: 'Chat',        emoji: '💬' },
    { id: 'pedido', label: 'Pedido',      emoji: '📋' },
  ]

  return (
    <div className="animate-fade-in h-[calc(100vh-4rem)] flex flex-col">

      {/* ── Page Header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/leads')}
            className="btn-ghost text-sm px-3 py-2"
          >
            ← Kanban
          </button>
          <div>
            <h1 className="page-title text-xl">
              🎯 Negociación — {perfil.buyer_nombre || `Lead #${perfil.id_lead}`}
            </h1>
            <p className="page-subtitle">
              Lead #{perfil.id_lead} · Estado: <span className="text-brand-400 font-semibold">{perfil.estado_lead}</span>
              {perfil.buyer_etapa === 'payer' && (
                <span className="ml-2 badge badge-ganado">✅ PAYER</span>
              )}
            </p>
          </div>
        </div>

        {/* Badge de alerta si hay pago pendiente */}
        {mpResp && (
          <a
            href={mpResp.init_point}
            target="_blank"
            rel="noreferrer"
            className="btn-primary text-sm animate-pulse-glow"
          >
            💳 Ir a pagar ${mpResp.monto_adelanto} MXN →
          </a>
        )}
      </div>

      {/* ── Layout 3 columnas en desktop ────────────────────── */}
      <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">

        {/* PERFIL (siempre visible en desktop) */}
        <div className="hidden xl:block col-span-3 overflow-y-auto">
          <PerfilLead perfil={perfil} />
        </div>

        {/* CHAT (columna central) */}
        <div className="col-span-12 xl:col-span-6 flex flex-col min-h-0">
          {/* Tabs para mobile */}
          <div className="flex xl:hidden gap-1 mb-3 bg-dark-700 p-1 rounded-xl border border-dark-500">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={clsx(
                  'flex-1 py-2 rounded-lg text-xs font-semibold transition-all',
                  activeTab === t.id
                    ? 'bg-brand-500 text-white shadow-glow-sm'
                    : 'text-gray-400 hover:text-white'
                )}
              >
                {t.emoji} {t.label}
              </button>
            ))}
          </div>

          {/* Vista condicional en mobile */}
          <div className="flex-1 card p-0 overflow-hidden min-h-0">
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
              <div className="p-4 overflow-y-auto h-full">
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

        {/* RESUMEN PEDIDO (siempre visible en desktop) */}
        <div className="hidden xl:flex col-span-3 flex-col min-h-0">
          <div className="card p-0 overflow-hidden flex-1">
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
    </div>
  )
}
