import { useState, useRef, useEffect } from 'react'
import { clsx } from 'clsx'
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

// Respuestas automáticas del bot
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

function ChatBubble({ msg }: { msg: MensajeChat }) {
  const isBot = msg.remitente === 'bot'
  const isCliente = msg.remitente === 'cliente'

  return (
    <div className={clsx('flex gap-2', isCliente ? 'justify-end' : 'justify-start')}>
      {!isCliente && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-ember-500 flex items-center justify-center text-sm flex-shrink-0 mt-1 shadow-glow-sm">
          🤖
        </div>
      )}
      <div
        className={clsx(
          'max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm',
          isCliente
            ? 'bg-brand-500 text-white rounded-tr-sm'
            : isBot
            ? 'bg-dark-600 text-gray-100 rounded-tl-sm border border-dark-400'
            : 'bg-purple-600 text-white rounded-tl-sm'
        )}
      >
        {!isCliente && (
          <p className={clsx(
            'text-[10px] font-bold mb-1',
            isBot ? 'text-brand-400' : 'text-purple-300'
          )}>
            {isBot ? '🤖 Bot Establo' : '👤 Agente'}
          </p>
        )}
        <p style={{ whiteSpace: 'pre-line' }}>{msg.mensaje}</p>
        <p className={clsx(
          'text-[10px] mt-1',
          isCliente ? 'text-orange-200 text-right' : 'text-gray-500'
        )}>
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
  return (
    <div className="bg-dark-700 border border-dark-500 rounded-xl p-3 hover:border-brand-500/50 transition-colors">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{producto.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">{producto.nombre}</p>
          <p className="text-xs text-gray-500 mt-0.5">{producto.descripcion}</p>
          <p className="text-sm font-bold text-brand-400 mt-1">${producto.precio} MXN</p>
        </div>
        <button
          onClick={() => onAgregar(producto)}
          className="flex-shrink-0 w-7 h-7 rounded-lg bg-brand-500 hover:bg-brand-400 text-white text-sm flex items-center justify-center transition-colors"
          title="Agregar al pedido"
        >
          +
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

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  const handleSend = async () => {
    if (!inputMsg.trim() || sending) return
    setSending(true)
    const texto = inputMsg.trim()
    setInputMsg('')

    try {
      // Guardar mensaje del cliente
      await perfilesService.enviarMensaje(idLead, texto, 'cliente')
      onMensajeEnviado()

      // Simular respuesta del bot después de 1 segundo
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
      // El catálogo es local: su id no es una FK de productos en la API.
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
    { id: 'all', label: '🍽️ Todos' },
    { id: 'corte', label: '🥩 Cortes' },
    { id: 'entrada', label: '🌭 Entradas' },
    { id: 'bebida', label: '🍺 Bebidas' },
    { id: 'guarnicion', label: '🥔 Guarniciones' },
    { id: 'postre', label: '🍫 Postres' },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Cabecera WhatsApp */}
      <div className="flex items-center gap-3 px-4 py-3 bg-dark-600 border-b border-dark-500 rounded-t-xl">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white font-bold text-sm">
          {(buyerNombre || 'C').charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{buyerNombre || 'Cliente'}</p>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            <p className="text-xs text-green-400">En línea</p>
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setShowCatalogo(!showCatalogo)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
              showCatalogo
                ? 'bg-brand-500/20 border-brand-500 text-brand-300'
                : 'bg-dark-500 border-dark-400 text-gray-400 hover:border-gray-300'
            )}
          >
            📋 Catálogo
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Área de mensajes */}
        <div
          className="flex-1 overflow-y-auto p-4 space-y-3"
          style={{
            background: 'linear-gradient(180deg, #0d0d0d 0%, #141414 100%)',
            backgroundImage: `radial-gradient(circle at 20% 50%, rgba(249,115,22,0.03) 0%, transparent 50%)`,
          }}
        >
          {mensajes.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <div className="text-4xl mb-3">💬</div>
              <p className="text-sm text-gray-500">Inicia la conversación con el cliente</p>
            </div>
          )}
          {mensajes.map(msg => (
            <ChatBubble key={msg.id_negociacion} msg={msg} />
          ))}
          <div ref={endRef} />
        </div>

        {/* Panel catálogo (lateral) */}
        {showCatalogo && (
          <div className="w-64 border-l border-dark-500 bg-dark-700 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-dark-500">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Catálogo</p>
              <div className="flex flex-wrap gap-1">
                {categorias.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setCategoriaFiltro(c.id)}
                    className={clsx(
                      'px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors',
                      categoriaFiltro === c.id
                        ? 'bg-brand-500 text-white'
                        : 'bg-dark-500 text-gray-400 hover:bg-dark-400'
                    )}
                  >
                    {c.label.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {productosFiltrados.map(p => (
                <SugerenciaCard key={p.id} producto={p} onAgregar={handleAgregarAlPedido} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input de mensaje */}
      <div className="p-3 bg-dark-600 border-t border-dark-500 rounded-b-xl">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputMsg}
            onChange={e => setInputMsg(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Escribe como agente o simula cliente..."
            className="input-field py-2.5 flex-1 text-sm"
          />
          <button
            onClick={handleSend}
            disabled={!inputMsg.trim() || sending}
            className="btn-primary px-4 py-2.5 rounded-xl disabled:opacity-50"
          >
            {sending ? '⏳' : '➤'}
          </button>
        </div>
        <p className="text-[10px] text-gray-600 mt-1.5 text-center">
          Presiona Enter para enviar · Los mensajes se guardan en el historial del lead
        </p>
      </div>
    </div>
  )
}
