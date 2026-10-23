import api from '@/services/api'
import type {
  Perfil360,
  PerfilGustos,
  PerfilReserva,
  MensajeChat,
  Pedido,
  PagoInfo,
  MPPreferenceResponse,
} from '@/types/leads'

// ─── Perfil 360 ───────────────────────────────────────────────────
export const perfilesService = {
  getPerfil360: (id_lead: number) =>
    api.get<Perfil360>(`/perfiles/${id_lead}/360`).then(r => r.data),

  upsertGustos: (data: Partial<PerfilGustos> & { id_lead: number }) =>
    api.post<PerfilGustos>('/perfiles/gustos', data).then(r => r.data),

  upsertReserva: (data: Partial<PerfilReserva> & { id_lead: number }) =>
    api.post<PerfilReserva>('/perfiles/reserva', data).then(r => r.data),

  // Chat
  getChat: (id_lead: number) =>
    api.get<MensajeChat[]>(`/perfiles/chat/${id_lead}`).then(r => r.data),

  enviarMensaje: (id_lead: number, mensaje: string, remitente: 'bot'|'agente'|'cliente' = 'cliente') =>
    api.post<MensajeChat>('/perfiles/chat', { id_lead, mensaje, remitente, tipo_mensaje: 'texto' }).then(r => r.data),
}

// ─── Pedidos ──────────────────────────────────────────────────────
export const pedidosService = {
  crear: (data: any) =>
    api.post<Pedido>('/pedidos', data).then(r => r.data),

  actualizar: (id: number, data: any) =>
    api.patch<Pedido>(`/pedidos/${id}`, data).then(r => r.data),

  getPorLead: (id_lead: number) =>
    api.get<Pedido[]>('/pedidos', { params: { id_lead } }).then(r => r.data),
}

// ─── Pagos / Mercado Pago ─────────────────────────────────────────
export const pagosService = {
  generarAdelanto: (id_pedido: number, pagador_nombre?: string, pagador_email?: string) =>
    api.post<MPPreferenceResponse>('/pagos/adelanto', {
      id_pedido,
      porcentaje: 10,
      pagador_nombre,
      pagador_email,
      url_retorno: `${window.location.origin}/leads`,
    }).then(r => r.data),

  simularAprobacion: (id_pago: number) =>
    api.post<PagoInfo>(`/pagos/simular-aprobacion?id_pago=${id_pago}`).then(r => r.data),

  getPaymentsByPedido: (id_pedido: number) =>
    api.get<PagoInfo[]>(`/pagos/pedido/${id_pedido}`).then(r => r.data),
}
