import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiErrorMessage } from '@/services/errors'
import { clsx } from 'clsx'
import {
  Beef,
  Beer,
  Bot,
  CakeSlice,
  ClipboardList,
  MessageCircle,
  Plus,
  Salad,
  Send,
  Soup,
  UserRound,
  X,
} from 'lucide-react'
import type { MensajeChat, ProductoCatalogo, DetallePedido } from '@/types/leads'
import { CATALOGO_MOCK } from '@/types/leads'
import { perfilesService } from '@/services/leadsService'

interface ChatNegociacionProps {
  idLead: number
  buyerNombre: string
  mensajes: MensajeChat[]
  onMensajeEnviado: () => void
  onAgregarAlPedido: (item: DetallePedido) => void
}

const CATEGORIA_ICON = {
  corte: Beef,
  entrada: Soup,
  bebida: Beer,
  guarnicion: Salad,
  postre: CakeSlice,
}

const CATEGORIA_TONE = {
  corte: 'text-vino-300',
  entrada: 'text-gold-300',
  bebida: 'text-[#A8C6E0]',
  guarnicion: 'text-sage-400',
  postre: 'text-[#D2B6E2]',
}

function ChatBubble({ msg }: { msg: MensajeChat }) {
  const isBot = msg.remitente === 'bot'
  const isOutgoing = msg.remitente === 'agente'

  return (
    <div className={clsx('flex gap-2', isOutgoing ? 'justify-end' : 'justify-start')}>
      {!isOutgoing && (
        <span className={clsx(
          'mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full border',
          isBot
            ? 'border-vino-700/40 bg-vino-900/30 text-vino-300'
            : 'border-gold-500/30 bg-gold-500/10 text-gold-300',
        )}>
          {isBot ? <Bot size={14} strokeWidth={1.7} /> : <UserRound size={14} strokeWidth={1.7} />}
        </span>
      )}

      <div className={clsx(
        'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-relaxed shadow-sm sm:max-w-[75%]',
        isOutgoing
          ? 'rounded-tr-sm bg-vino-900 text-arena-50'
          : isBot
            ? 'rounded-tl-sm border border-arena-200/[0.07] bg-dark-700/90 text-arena-100'
            : 'rounded-tl-sm border border-gold-500/25 bg-gold-500/[0.07] text-arena-100',
      )}>
        <p className={clsx('mb-1 text-[9px] font-bold uppercase tracking-[0.12em]', isBot ? 'text-vino-300' : 'text-arena-200/75')}>
          {isBot ? 'Automatización registrada' : isOutgoing ? 'Agente' : 'Cliente'}
        </p>
        <p className="break-words" style={{ whiteSpace: 'pre-line' }}>{msg.mensaje}</p>
        <p className={clsx('mt-1 text-[9px]', isOutgoing ? 'text-right text-arena-200/55' : 'text-arena-400/45')}>
          {new Date(msg.created_at).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

function SugerenciaCard({
  producto,
  onAgregar,
}: {
  producto: ProductoCatalogo
  onAgregar: (p: ProductoCatalogo) => void
}) {
  const Icon = CATEGORIA_ICON[producto.categoria] ?? Beef
  return (
    <div className="group rounded-xl border border-arena-200/[0.07] bg-dark-800/70 p-3 transition-colors hover:border-vino-700/50">
      <div className="flex items-start gap-2.5">
        <span className={clsx('mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-arena-200/[0.07] bg-dark-900/50', CATEGORIA_TONE[producto.categoria])}>
          <Icon size={14} strokeWidth={1.7} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-semibold text-arena-100">{producto.nombre}</p>
          <p className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-arena-300/45">{producto.descripcion}</p>
          <p className="mt-1 text-[11.5px] font-bold text-gold-300 tabular">${producto.precio} MXN</p>
        </div>
        <button
          type="button"
          onClick={() => onAgregar(producto)}
          aria-label={`Agregar ${producto.nombre} al pedido`}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-vino-700/40 bg-vino-900/30 text-vino-200 transition-colors hover:bg-vino-800 hover:text-arena-50"
        >
          <Plus size={13} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  )
}

export function ChatNegociacion({
  idLead,
  buyerNombre,
  mensajes,
  onMensajeEnviado,
  onAgregarAlPedido,
}: ChatNegociacionProps) {
  const [inputMsg, setInputMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [showCatalogo, setShowCatalogo] = useState(false)
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('all')
  const [sendError, setSendError] = useState('')
  const cache = useQueryClient()
  const chat = useQuery({
    queryKey: ['lead-chat', idLead],
    queryFn: () => perfilesService.getChat(idLead),
    refetchInterval: 5_000,
    staleTime: 0,
    retry: 1,
  })
  const endRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const nearBottom = useRef(true)
  const mensajesOrdenados = [...(chat.data ?? mensajes)].sort(
    (a, b) => (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) || a.id_negociacion - b.id_negociacion,
  )
  const lastMessageId = mensajesOrdenados[mensajesOrdenados.length - 1]?.id_negociacion

  useEffect(() => {
    if (nearBottom.current) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [lastMessageId])

  const handleSend = async () => {
    if (!inputMsg.trim() || sending) return
    setSending(true)
    const texto = inputMsg.trim()
    setSendError('')

    try {
      const saved = await perfilesService.enviarMensaje(idLead, texto, 'agente')
      cache.setQueryData<MensajeChat[]>(['lead-chat', idLead], current => [
        ...(current ?? mensajes).filter(message => message.id_negociacion !== saved.id_negociacion), saved,
      ])
      setInputMsg(current => current.trim() === texto ? '' : current)
      nearBottom.current = true
      void cache.invalidateQueries({ queryKey: ['lead-chat', idLead] })
      onMensajeEnviado()
    } catch (e) {
      setSendError(apiErrorMessage(e, 'No se pudo confirmar el mensaje. El borrador sigue aquí; revisa el historial antes de reenviar.'))
    } finally {
      setSending(false)
    }
  }

  const handleAgregarAlPedido = (producto: ProductoCatalogo) => {
    onAgregarAlPedido({
      nombre_producto: producto.nombre,
      categoria: producto.categoria,
      cantidad: 1,
      precio_unitario: producto.precio,
    })
  }

  const productosFiltrados = CATALOGO_MOCK.filter(p =>
    categoriaFiltro === 'all' ? true : p.categoria === categoriaFiltro
  )

  const categorias = [
    { id: 'all', label: 'Todos' },
    { id: 'corte', label: 'Cortes' },
    { id: 'entrada', label: 'Entradas' },
    { id: 'bebida', label: 'Bebidas' },
    { id: 'guarnicion', label: 'Guarniciones' },
    { id: 'postre', label: 'Postres' },
  ]

  return (
    <div className="flex h-full flex-col">
      {/* Cabecera */}
      <div className="flex items-center gap-3 border-b border-arena-200/[0.07] px-4 py-3">
        <div className="relative shrink-0">
          <div className="grid h-10 w-10 place-items-center rounded-full border border-sage-500/30 bg-sage-500/10 font-display text-sm font-bold text-sage-200">
            {(buyerNombre || 'C').charAt(0).toUpperCase()}
          </div>

        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-arena-50">{buyerNombre || 'Cliente'}</p>
          <p className="text-[10px] text-arena-300/60">Historial real · actualización cada 5 s</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCatalogo(!showCatalogo)}
          aria-expanded={showCatalogo}
          className={clsx(
            'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10.5px] font-semibold transition-all',
            showCatalogo
              ? 'border-vino-600/50 bg-vino-900/30 text-vino-200'
              : 'border-arena-200/10 bg-dark-700/70 text-arena-300/65 hover:border-arena-200/20 hover:text-arena-100',
          )}
        >
          <ClipboardList size={13} />
          Catálogo demo
        </button>
      </div>

      {chat.isError && <div role="alert" className="border-b border-red-400/20 bg-red-400/10 px-4 py-2 text-[11px] text-red-200">No se pudo actualizar el historial. Se conserva la última versión. <button type="button" onClick={() => void chat.refetch()} className="underline">Reintentar</button></div>}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Mensajes */}
        <div ref={scrollRef} onScroll={() => { const node = scrollRef.current; if (node) nearBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 100 }} className="flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_20%_10%,rgba(127,1,31,0.10),transparent_55%)] p-4">
          <div className="space-y-3">
            {mensajesOrdenados.length === 0 && (
              <div className="flex h-48 flex-col items-center justify-center text-center">
                <span className="grid h-12 w-12 place-items-center rounded-2xl border border-arena-200/10 bg-dark-800/70 text-arena-400/50">
                  <MessageCircle size={22} strokeWidth={1.5} />
                </span>
                <p className="mt-3 text-[12px] font-medium text-arena-300/55">Inicia la conversación</p>
                <p className="mt-0.5 text-[10.5px] text-arena-400/40">Los mensajes quedan guardados en el historial del lead.</p>
              </div>
            )}
            {mensajesOrdenados.map(msg => <ChatBubble key={msg.id_negociacion} msg={msg} />)}
            <div ref={endRef} />
          </div>
        </div>

        {/* Catálogo */}
        {showCatalogo && (
          <>
            <button
              type="button"
              aria-label="Cerrar catálogo"
              onClick={() => setShowCatalogo(false)}
              className="absolute inset-0 z-10 bg-black/55 backdrop-blur-[2px] sm:hidden"
            />
            <aside aria-label="Catálogo de productos" className="absolute inset-y-0 right-0 z-20 flex w-full flex-col border-l border-arena-200/[0.07] bg-dark-900/98 sm:relative sm:z-0 sm:w-72 sm:max-w-none">
              <div className="flex items-center justify-between border-b border-arena-200/[0.07] p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-arena-300/60">Catálogo de demostración</p>
                <button type="button" onClick={() => setShowCatalogo(false)} aria-label="Cerrar catálogo" className="btn-icon h-7 w-7">
                  <X size={13} />
                </button>
              </div>
              <div className="border-b border-arena-200/[0.07] p-3">
                <div className="flex flex-wrap gap-1">
                  {categorias.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategoriaFiltro(c.id)}
                      className={clsx(
                        'rounded-full px-2.5 py-1 text-[9.5px] font-semibold transition-colors',
                        categoriaFiltro === c.id
                          ? 'bg-vino-900 text-arena-50'
                          : 'bg-arena-200/[0.05] text-arena-300/55 hover:bg-arena-200/10 hover:text-arena-200',
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-2.5">
                {productosFiltrados.map(p => (
                  <SugerenciaCard key={p.id} producto={p} onAgregar={handleAgregarAlPedido} />
                ))}
              </div>
            </aside>
          </>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-arena-200/[0.07] p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputMsg}
            onChange={e => setInputMsg(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) void handleSend() }}
            placeholder="Registrar mensaje como agente…"
            aria-label="Mensaje"
            className="input-field flex-1 py-2.5 text-[12.5px]"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!inputMsg.trim() || sending}
            aria-label="Guardar mensaje en el historial"
            className="btn-primary h-10 w-10 shrink-0 rounded-xl p-0"
          >
            {sending ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-arena-100 border-t-transparent" /> : <Send size={15} />}
          </button>
        </div>
        {sendError && <p role="alert" className="mt-2 text-[11px] text-red-200">{sendError}</p>}
        <p className="mt-2 text-center text-[10px] leading-relaxed text-arena-300/65">
          Responder aquí registra el mensaje; aún no lo envía a WhatsApp/Hermes.
        </p>
      </div>
    </div>
  )
}
