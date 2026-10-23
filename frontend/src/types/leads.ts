// Tipos adicionales — Fase Leads/Negociación

export interface PerfilGustos {
  id_perfil_gustos: string
  id_lead: string
  tipos_corte_preferidos?: string
  termino_coccion?: string
  bebidas_preferidas?: string
  entradas_preferidas?: string
  guarniciones_preferidas?: string
  postres_preferidos?: string
  alergias?: string
  restricciones_dieteticas?: string
  presupuesto_por_persona?: number
  notas_adicionales?: string
  created_at: string
  updated_at: string
}

export interface PerfilReserva {
  id_perfil_reserva: string
  id_lead: string
  fecha_reserva?: string
  hora_inicio?: string
  hora_fin?: string
  numero_personas?: number
  numero_adultos?: number
  numero_ninos?: number
  ocasion_especial?: string
  nombre_festejado?: string
  requiere_decoracion: boolean
  requiere_musica: boolean
  requiere_pastel: boolean
  peticiones_especiales?: string
  estado_reserva: string
  created_at: string
  updated_at: string
}

export interface MensajeChat {
  id_negociacion: number
  id_lead: string
  remitente: 'bot' | 'agente' | 'cliente'
  mensaje: string
  tipo_mensaje?: string
  leido: boolean
  created_at: string
}

export interface DetallePedido {
  id_detalle?: number
  id_pedido?: string
  id_producto?: number
  nombre_producto: string
  categoria?: string
  cantidad: number
  precio_unitario: number
  subtotal?: number
  termino_coccion?: string
  notas_especiales?: string
}

export interface Pedido {
  id_pedido: string
  id_lead: string
  id_buyer: string
  subtotal: number
  descuento: number
  total: number
  estado: string
  tipo_pedido?: string
  notas?: string
  created_at: string
  updated_at: string
  detalles: DetallePedido[]
}

export interface PagoInfo {
  id_pago: string
  id_pedido: string
  id_lead: string
  tipo_pago: string
  porcentaje?: number
  monto: number
  estado: string
  mp_preference_id?: string
  mp_payment_id?: string
  mp_status?: string
  mp_init_point?: string
  fecha_pago?: string
  created_at: string
}

export interface Perfil360 {
  id_lead: string
  estado_lead: string
  buyer_nombre?: string
  buyer_telefono?: string
  buyer_email?: string
  buyer_canal?: string
  buyer_etapa?: string
  perfil_gustos?: PerfilGustos
  perfil_reserva?: PerfilReserva
  pedido_activo?: Pedido
  pago_adelanto?: PagoInfo
  mensajes_recientes: MensajeChat[]
}

export interface MPPreferenceResponse {
  id_pago: string
  preference_id: string
  init_point: string
  monto_adelanto: number
  total_pedido: number
  mensaje: string
}

// Catálogo mock de productos para el chat
export interface ProductoCatalogo {
  id: number
  nombre: string
  categoria: 'corte' | 'entrada' | 'bebida' | 'postre' | 'guarnicion'
  precio: number
  descripcion: string
  emoji: string
  terminos?: string[]
}

export const CATALOGO_MOCK: ProductoCatalogo[] = [
  { id: 1, nombre: 'Ribeye Premium',    categoria: 'corte',      precio: 420, emoji: '🥩', descripcion: 'Corte marmoleado, 400g',        terminos: ['inglés','tres_cuartos','bien_cocido','a_punto'] },
  { id: 2, nombre: 'T-Bone Especial',   categoria: 'corte',      precio: 390, emoji: '🥩', descripcion: 'Jugoso corte con hueso, 450g',  terminos: ['inglés','tres_cuartos','bien_cocido','a_punto'] },
  { id: 3, nombre: 'Picaña El Establo', categoria: 'corte',      precio: 350, emoji: '🥩', descripcion: 'Corte argentino, 380g',         terminos: ['inglés','tres_cuartos','bien_cocido','a_punto'] },
  { id: 4, nombre: 'New York Strip',    categoria: 'corte',      precio: 380, emoji: '🥩', descripcion: 'Clásico corte americano, 350g', terminos: ['inglés','tres_cuartos','bien_cocido','a_punto'] },
  { id: 5, nombre: 'Chorizo Artesanal', categoria: 'entrada',    precio: 120, emoji: '🌭', descripcion: 'Chorizo casero a las brasas'   },
  { id: 6, nombre: 'Provoleta',         categoria: 'entrada',    precio: 95,  emoji: '🧀', descripcion: 'Queso fundido con orégano'     },
  { id: 7, nombre: 'Cerveza Artesanal', categoria: 'bebida',     precio: 80,  emoji: '🍺', descripcion: 'De barril, 500ml'              },
  { id: 8, nombre: 'Agua Mineral 1L',   categoria: 'bebida',     precio: 35,  emoji: '💧', descripcion: 'Natural o con gas'             },
  { id: 9, nombre: 'Papas al Horno',    categoria: 'guarnicion', precio: 75,  emoji: '🥔', descripcion: 'Con crema y cebollín'          },
  { id: 10,nombre: 'Ensalada Verde',    categoria: 'guarnicion', precio: 65,  emoji: '🥗', descripcion: 'Con vinagreta de miel'         },
  { id: 11,nombre: 'Brownie Caliente',  categoria: 'postre',     precio: 85,  emoji: '🍫', descripcion: 'Con helado de vainilla'        },
]

export const TERMINOS_COCCION: Record<string, string> = {
  ingles:      'Inglés (55 °C)',
  tres_cuartos:'Tres cuartos (65 °C)',
  bien_cocido: 'Bien cocido (75 °C)',
  a_punto:     'A punto (60 °C)',
}

export const OCASIONES: Record<string, string> = {
  cumpleanos: 'Cumpleaños',
  aniversario: 'Aniversario',
  empresa: 'Evento empresarial',
  ninguna: 'Comida casual',
  otro: 'Otro',
}
