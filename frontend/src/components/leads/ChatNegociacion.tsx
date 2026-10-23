import { useState, useRef, useEffect } from 'react'
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

const BOT_RESPONSES: Record<string, string> = {
  hola: "¡Hola! 🔥 Soy el asistente de Parrilladas El Establo. Estoy aquí para ayudarte a armar tu pedido perfecto. ¿Qué tipo de corte te interesa?",
  reserva: "¡Perfecto! Para confirmar tu reserva necesito:\n📅 ¿Qué fecha tienes en mente?\n👥 ¿Cuántas personas asistirán?\n🎉 ¿Es alguna ocasión especial?",
  precio: "💰 Nuestros precios van desde $120 MXN (entradas) hasta $420 MXN (cortes premium). El paquete incluye guarnición y pan de ajo. ¿Te armo una propuesta?",
  default: "Entendido. Te voy a preparar una selección personalizada. ¿Quieres que te sugiera nuestros cortes más populares? 🥩",
}

function getBotResponse(msg: string): string {
  const lower = msg.toLowerCase()
  if (lower.includes('hola') || lower.includes('buenas')) return BOT_RESPONSES.hola
  if (lower.includes('reserva') || lower.includes('fecha')) return BOT_RESPONSES.reserva
  if (lower.includes('precio') || lower.includes('costo') || lower.includes('cuánto')) return BOT_RESPONSES.precio
  return BOT_RESPONSES.default
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
  const isCliente = msg.remitente === 'cliente'

  return (
    <div className={clsx('flex gap-2', isCliente ? 'justify-end' : 'justify-start')}>
      {!isCliente && (
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
        isCliente
          ? 'rounded-tr-sm bg-vino-900 text-arena-50'
          : isBot
            ? 'rounded-tl-sm border border-arena-200/[0.07] bg-dark-700/90 text-arena-100'
            : 'rounded-tl-sm border border-gold-500/25 bg-gold-500/[0.07] text-arena-100',
      )}>
        {!isCliente && (
          <p className={clsx('mb-1 text-[9px] font-bold uppercase tracking-[0.12em]', isBot ? 'text-vino-300' : 'text-gold-300')}>
            {isBot ? 'Bot Establo' : 'Agente'}
          </p>
        )}
        <p style={{ whiteSpace: 'pre-line' }}>{msg.mensaje}</p>
        <p className={clsx('mt-1 text-[9px]', isCliente ? 'text-right text-arena-200/55' : 'text-arena-400/45')}>
          {new Date(msg.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
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
  const endRef = useRef<HTMLDivElement>(null)
  const mensajesOrdenados = [...mensajes].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  const handleSend = async () => {
    if (!inputMsg.trim() || sending) return
    setSending(true)
    const texto = inputMsg.trim()
    setInputMsg('')

    try {
      await perfilesService.enviarMensaje(idLead, texto, 'cliente')
      onMensajeEnviado()

      setTimeout(async () => {
        const respuesta = getBotResponse(texto)
        await perfilesService.enviarMensaje(idLead, respuesta, 'bot')
        onMensajeEnviado()
      }, 1000)
    } catch (e) {
      console.error(e)
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
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-dark-800 bg-sage-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-arena-50">{buyerNombre || 'Cliente'}</p>
          <p className="flex items-center gap-1.5 text-[10px] text-sage-400">
            <span className="h-1.5 w-1.5 rounded-full bg-sage-400" />
            En línea · WhatsApp
          </p>
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
          Catálogo
        </button>
      </div>

      <div className="relative flex flex-1 overflow-hidden">
        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_20%_10%,rgba(127,1,31,0.10),transparent_55%)] p-4">
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
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-arena-300/60">Catálogo</p>
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
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Escribe como agente o simula cliente…"
            aria-label="Mensaje"
            className="input-field flex-1 py-2.5 text-[12.5px]"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!inputMsg.trim() || sending}
            aria-label="Enviar mensaje"
            className="btn-primary h-10 w-10 shrink-0 rounded-xl p-0"
          >
            {sending ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-arena-100 border-t-transparent" /> : <Send size={15} />}
          </button>
        </div>
        <p className="mt-2 text-center text-[9.5px] text-arena-400/35">
          Enter para enviar · Los mensajes se guardan en el historial del lead
        </p>
      </div>
    </div>
  )
}
