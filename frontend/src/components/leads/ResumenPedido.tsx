import { useState, type Dispatch, type SetStateAction } from 'react'
import { clsx } from 'clsx'
import type { Pedido, DetallePedido, MPPreferenceResponse, PagoInfo } from '@/types/leads'
import { TERMINOS_COCCION } from '@/types/leads'
import { pedidosService, pagosService } from '@/services/leadsService'
import { apiErrorMessage } from '@/services/errors'

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
      onPedidoCreado() // refrescar
    } catch (e: any) {
      setErrorMsg(apiErrorMessage(e, 'Error en simulación'))
    } finally {
      setLoadingSim(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-dark-500">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          📋 Resumen del Pedido
          {pedidoActivo && (
            <span className={clsx(
              'text-[10px] px-2 py-0.5 rounded-full border font-semibold',
              pedidoActivo.estado === 'pagado_adelanto'
                ? 'bg-green-500/20 text-green-300 border-green-500/30'
                : pedidoActivo.estado === 'confirmado'
                ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                : 'bg-dark-400 text-gray-400 border-dark-300'
            )}>
              {pedidoActivo.estado}
            </span>
          )}
        </h3>
      </div>

      {/* Lista de ítems */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <div className="text-3xl mb-2">🛒</div>
            <p className="text-xs text-gray-500">
              Agrega productos desde el catálogo del chat
            </p>
          </div>
        ) : (
          items.map((item, idx) => (
            <div key={idx} className="bg-dark-600 border border-dark-400 rounded-xl p-3">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {item.nombre_producto}
                  </p>
                  {item.termino_coccion && (
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {TERMINOS_COCCION[item.termino_coccion] || item.termino_coccion}
                    </p>
                  )}
                  <p className="text-xs text-brand-400 mt-1 font-semibold">
                    ${(item.precio_unitario * item.cantidad).toFixed(2)}
                  </p>
                </div>
                {/* Controles cantidad */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => actualizarCantidad(idx, -1)}
                    disabled={!editable || loadingPedido}
                    className="w-6 h-6 rounded-lg bg-dark-500 hover:bg-dark-400 text-gray-300 text-xs flex items-center justify-center"
                  >−</button>
                  <span className="text-xs font-bold text-white w-5 text-center">{item.cantidad}</span>
                  <button
                    onClick={() => actualizarCantidad(idx, 1)}
                    disabled={!editable || loadingPedido}
                    className="w-6 h-6 rounded-lg bg-dark-500 hover:bg-dark-400 text-gray-300 text-xs flex items-center justify-center"
                  >+</button>
                  <button
                    onClick={() => quitarItem(idx)}
                    disabled={!editable || loadingPedido}
                    className="w-6 h-6 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-400 text-xs flex items-center justify-center ml-1"
                  >✕</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Totales */}
      {items.length > 0 && (
        <div className="px-4 py-3 border-t border-dark-500 space-y-2 bg-dark-700">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Subtotal</span>
            <span className="text-white font-semibold">${subtotal.toFixed(2)} MXN</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-yellow-400">Adelanto 10%</span>
            <span className="text-yellow-300 font-bold">${adelanto10.toFixed(2)} MXN</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Saldo en caja</span>
            <span className="text-gray-400">${saldo.toFixed(2)} MXN</span>
          </div>
        </div>
      )}

      {/* Error */}
      {errorMsg && (
        <div className="mx-3 mb-2 p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Acciones */}
      <div className="p-3 space-y-2 border-t border-dark-500">
        {/* Sin pedido aún → confirmar */}
        {editable && cambiosSinGuardar && items.length > 0 && (
          <button
            onClick={handleConfirmarPedido}
            disabled={loadingPedido || idBuyer <= 0}
            className="btn-secondary w-full justify-center text-sm"
          >
            {loadingPedido ? '⏳ Guardando...' : pedidoActivo ? '✓ Guardar cambios' : '✓ Confirmar pedido'}
          </button>
        )}

        {/* Pedido confirmado → generar pago */}
        {pedidoActivo && pedidoActivo.estado !== 'pagado_adelanto' && !pagoAdelanto && (
          <button
            onClick={handleGenerarPago}
            disabled={loadingPago || cambiosSinGuardar}
            className="btn-primary w-full justify-center text-sm"
          >
            {loadingPago ? '⏳ Generando...' : '💳 Generar Adelanto 10% (Mercado Pago)'}
          </button>
        )}

        {/* Pago pendiente → link y simulación */}
        {pagoAdelanto && pagoAdelanto.estado === 'pendiente' && (
          <div className="space-y-2">
            {pagoAdelanto.mp_init_point && (
              <a
                href={pagoAdelanto.mp_init_point}
                target="_blank"
                rel="noreferrer"
                className="btn-primary w-full justify-center text-sm text-center block"
              >
                🔗 Ir a pagar en Mercado Pago
              </a>
            )}
            <button
              onClick={handleSimularAprobacion}
              disabled={loadingSim}
              className="btn-secondary w-full justify-center text-xs"
            >
              {loadingSim ? '⏳...' : '🧪 Simular aprobación (Sandbox)'}
            </button>
          </div>
        )}

        {/* Pago aprobado */}
        {pagoAdelanto && pagoAdelanto.estado === 'aprobado' && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
            ✅ Adelanto pagado — Cliente → <strong>PAYER</strong>
          </div>
        )}
      </div>
    </div>
  )
}

// Exportar función para agregar desde el chat
export { }
export type { ResumenPedidoProps }
