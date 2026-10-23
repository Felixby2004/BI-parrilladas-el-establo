import { useState, type Dispatch, type SetStateAction } from 'react'
import { clsx } from 'clsx'
import {
  Check,
  CreditCard,
  ExternalLink,
  FlaskConical,
  Minus,
  Plus,
  ReceiptText,
  ShoppingBag,
  Trash2,
} from 'lucide-react'
import type { Pedido, DetallePedido, MPPreferenceResponse, PagoInfo } from '@/types/leads'
import { TERMINOS_COCCION } from '@/types/leads'
import { pedidosService, pagosService } from '@/services/leadsService'
import { apiErrorMessage } from '@/services/errors'
import { StatusBadge, type Tone } from '@/components/ui/kit'

interface ResumenPedidoProps {
  idLead: number
  idBuyer: number
  items: DetallePedido[]
  onItemsChange: Dispatch<SetStateAction<DetallePedido[]>>
  buyerNombre?: string
  buyerEmail?: string
  pedidoActivo?: Pedido
  pagoAdelanto?: PagoInfo
  onPedidoCreado: () => void
  onPagoIniciado: (resp: MPPreferenceResponse) => void
}

const ESTADO_TONE: Record<string, Tone> = {
  borrador: 'neutral',
  confirmado: 'gold',
  pagado_adelanto: 'sage',
  finalizado: 'sage',
  cancelado: 'rose',
}

export function ResumenPedido({
  idLead,
  idBuyer,
  items,
  onItemsChange: setItems,
  buyerNombre,
  buyerEmail,
  pedidoActivo,
  pagoAdelanto,
  onPedidoCreado,
  onPagoIniciado,
}: ResumenPedidoProps) {
  const [loadingPedido, setLoadingPedido] = useState(false)
  const [loadingPago, setLoadingPago] = useState(false)
  const [loadingSim, setLoadingSim] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const quitarItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  const actualizarCantidad = (idx: number, delta: number) => {
    setItems(prev => {
      const nuevo = [...prev]
      nuevo[idx] = { ...nuevo[idx], cantidad: Math.max(1, nuevo[idx].cantidad + delta) }
      return nuevo
    })
  }

  const editable = !pagoAdelanto && (!pedidoActivo || pedidoActivo.estado === 'borrador')
  const detallesPayload = (detalles: DetallePedido[]) => detalles.map(i => ({
    id_producto: i.id_producto ?? null,
    nombre_producto: i.nombre_producto,
    categoria: i.categoria ?? null,
    cantidad: i.cantidad,
    precio_unitario: Number(i.precio_unitario),
    termino_coccion: i.termino_coccion ?? null,
    notas_especiales: i.notas_especiales ?? null,
  }))
  const cambiosSinGuardar = !pedidoActivo || JSON.stringify(detallesPayload(items)) !==
    JSON.stringify(detallesPayload(pedidoActivo.detalles))

  const subtotal = items.reduce((acc, i) => acc + i.precio_unitario * i.cantidad, 0)
  const adelanto10 = subtotal * 0.1
  const saldo = subtotal * 0.9

  const handleConfirmarPedido = async () => {
    if (items.length === 0 || !editable || idBuyer <= 0 || loadingPedido) return
    setLoadingPedido(true)
    setErrorMsg('')
    try {
      const detalles = detallesPayload(items)
      if (pedidoActivo) {
        await pedidosService.actualizar(pedidoActivo.id_pedido, { detalles })
      } else {
        await pedidosService.crear({
          id_lead: idLead,
          id_buyer: idBuyer,
          tipo_pedido: 'reserva',
          detalles,
        })
      }
      onPedidoCreado()
    } catch (e: any) {
      setErrorMsg(apiErrorMessage(e, 'Error al guardar el pedido'))
    } finally {
      setLoadingPedido(false)
    }
  }

  const handleGenerarPago = async () => {
    if (!pedidoActivo || cambiosSinGuardar || loadingPago) return
    setLoadingPago(true)
    setErrorMsg('')
    try {
      const resp = await pagosService.generarAdelanto(
        pedidoActivo.id_pedido,
        buyerNombre,
        buyerEmail
      )
      onPagoIniciado(resp)
    } catch (e: any) {
      setErrorMsg(apiErrorMessage(e, 'Error al generar pago'))
    } finally {
      setLoadingPago(false)
    }
  }

  const handleSimularAprobacion = async () => {
    if (!pagoAdelanto) return
    setLoadingSim(true)
    try {
      await pagosService.simularAprobacion(pagoAdelanto.id_pago)
      onPedidoCreado()
    } catch (e: any) {
      setErrorMsg(apiErrorMessage(e, 'Error en simulación'))
    } finally {
      setLoadingSim(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-arena-200/[0.07] px-4 py-3">
        <h3 className="flex items-center gap-2 text-[12px] font-semibold text-arena-100">
          <ReceiptText size={14} strokeWidth={1.7} className="text-gold-400" />
          Resumen del pedido
        </h3>
        {pedidoActivo && (
          <StatusBadge tone={ESTADO_TONE[pedidoActivo.estado] ?? 'neutral'} dot>
            {pedidoActivo.estado.replace(/_/g, ' ')}
          </StatusBadge>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {items.length === 0 ? (
          <div className="flex h-full min-h-40 flex-col items-center justify-center px-4 text-center">
            <span className="grid h-11 w-11 place-items-center rounded-2xl border border-arena-200/10 bg-dark-900/50 text-arena-400/40">
              <ShoppingBag size={20} strokeWidth={1.5} />
            </span>
            <p className="mt-3 text-[11.5px] font-medium text-arena-300/55">Pedido vacío</p>
            <p className="mt-1 text-[10px] leading-relaxed text-arena-400/40">Agrega productos desde el catálogo del chat.</p>
          </div>
        ) : (
          items.map((item, idx) => (
            <div key={idx} className="rounded-xl border border-arena-200/[0.07] bg-dark-900/40 p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-arena-100">{item.nombre_producto}</p>
                  {item.termino_coccion && (
                    <p className="mt-0.5 text-[9.5px] text-arena-300/45">
                      {TERMINOS_COCCION[item.termino_coccion] || item.termino_coccion}
                    </p>
                  )}
                  <p className="mt-1 text-[11.5px] font-semibold text-gold-300 tabular">
                    ${(item.precio_unitario * item.cantidad).toFixed(2)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => actualizarCantidad(idx, -1)}
                    disabled={!editable || loadingPedido}
                    aria-label="Quitar una unidad"
                    className="grid h-6 w-6 place-items-center rounded-md border border-arena-200/[0.08] bg-dark-700 text-arena-300 transition-colors hover:bg-dark-600 disabled:opacity-40"
                  >
                    <Minus size={11} />
                  </button>
                  <span className="w-5 text-center text-[11px] font-bold text-arena-100 tabular">{item.cantidad}</span>
                  <button
                    type="button"
                    onClick={() => actualizarCantidad(idx, 1)}
                    disabled={!editable || loadingPedido}
                    aria-label="Agregar una unidad"
                    className="grid h-6 w-6 place-items-center rounded-md border border-arena-200/[0.08] bg-dark-700 text-arena-300 transition-colors hover:bg-dark-600 disabled:opacity-40"
                  >
                    <Plus size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={() => quitarItem(idx)}
                    disabled={!editable || loadingPedido}
                    aria-label={`Quitar ${item.nombre_producto}`}
                    className="ml-0.5 grid h-6 w-6 place-items-center rounded-md border border-[#C46666]/20 bg-[#C46666]/10 text-[#E0A3A3] transition-colors hover:bg-[#C46666]/20 disabled:opacity-40"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Totales */}
      {items.length > 0 && (
        <div className="space-y-2 border-t border-arena-200/[0.07] bg-dark-900/30 px-4 py-3">
          <div className="flex justify-between text-[11.5px]">
            <span className="text-arena-300/55">Subtotal</span>
            <span className="font-semibold text-arena-100 tabular">${subtotal.toFixed(2)} MXN</span>
          </div>
          <div className="flex justify-between rounded-lg border border-gold-500/20 bg-gold-500/[0.06] px-2.5 py-1.5 text-[11px]">
            <span className="font-medium text-gold-300">Adelanto 10%</span>
            <span className="font-bold text-gold-200 tabular">${adelanto10.toFixed(2)} MXN</span>
          </div>
          <div className="flex justify-between text-[10.5px]">
            <span className="text-arena-300/40">Saldo en caja</span>
            <span className="text-arena-300/55 tabular">${saldo.toFixed(2)} MXN</span>
          </div>
        </div>
      )}

      {errorMsg && (
        <div role="alert" className="mx-3 mb-2 rounded-lg border border-[#C46666]/30 bg-[#C46666]/[0.08] px-3 py-2 text-[10.5px] leading-relaxed text-[#E0A3A3]">
          {errorMsg}
        </div>
      )}

      {/* Acciones */}
      <div className="space-y-2 border-t border-arena-200/[0.07] p-3">
        {editable && cambiosSinGuardar && items.length > 0 && (
          <button
            type="button"
            onClick={handleConfirmarPedido}
            disabled={loadingPedido || idBuyer <= 0}
            className="btn-secondary w-full py-2.5 text-[11.5px]"
          >
            {loadingPedido ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-arena-100 border-t-transparent" /> : <Check size={13} />}
            {loadingPedido ? 'Guardando…' : pedidoActivo ? 'Guardar cambios' : 'Confirmar pedido'}
          </button>
        )}

        {pedidoActivo && pedidoActivo.estado !== 'pagado_adelanto' && !pagoAdelanto && (
          <button
            type="button"
            onClick={handleGenerarPago}
            disabled={loadingPago || cambiosSinGuardar}
            className="btn-primary w-full py-2.5 text-[11.5px]"
          >
            {loadingPago ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-arena-100 border-t-transparent" /> : <CreditCard size={13} />}
            {loadingPago ? 'Generando…' : 'Generar adelanto 10%'}
          </button>
        )}

        {pagoAdelanto && pagoAdelanto.estado === 'pendiente' && (
          <div className="space-y-2">
            {pagoAdelanto.mp_init_point && (
              <a
                href={pagoAdelanto.mp_init_point}
                target="_blank"
                rel="noreferrer"
                className="btn-primary block w-full py-2.5 text-center text-[11.5px]"
              >
                <span className="inline-flex items-center gap-2">
                  <ExternalLink size={13} />
                  Ir a pagar en Mercado Pago
                </span>
              </a>
            )}
            <button
              type="button"
              onClick={handleSimularAprobacion}
              disabled={loadingSim}
              className="btn-secondary w-full py-2 text-[10.5px]"
            >
              {loadingSim ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-arena-100 border-t-transparent" /> : <FlaskConical size={12} />}
              {loadingSim ? 'Simulando…' : 'Simular aprobación (Sandbox)'}
            </button>
          </div>
        )}

        {pagoAdelanto && pagoAdelanto.estado === 'aprobado' && (
          <div className="flex items-center gap-2 rounded-xl border border-sage-500/25 bg-sage-500/[0.07] p-3 text-[11px] text-sage-300">
            <Check size={14} />
            Adelanto pagado. Cliente listo para <strong className="font-semibold">PAYER</strong>.
          </div>
        )}
      </div>
    </div>
  )
}

export type { ResumenPedidoProps }
