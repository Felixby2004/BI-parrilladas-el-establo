import { useState } from 'react'
import { clsx } from 'clsx'
import { captacionService } from '@/services/api'
import type { InteresLead } from '@/types'
import { apiErrorMessage } from '@/services/errors'

const INTERESES = [
  { id: 'reserva',     label: 'Reserva para grupo',  emoji: '🥩', desc: 'Mesa para amigos, familia o festejo' },
  { id: 'evento',      label: 'Evento empresarial',   emoji: '🏢', desc: 'Cenas corporativas y fin de año' },
  { id: 'informacion', label: 'Conocer carta & menú', emoji: '🍷', desc: 'Cortes premium y sugerencias de vino' },
  { id: 'otro',        label: 'Consulta especial',   emoji: '💬', desc: 'Menú degustación o parrillero privado' },
]

export default function FormularioCaptacion() {
  const [form, setForm] = useState({ nombre: '', telefono: '', email: '', interes: 'reserva', personas: '4', fecha: '' })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const ajustarPersonas = (delta: number) => {
    setForm(f => {
      const actual = parseInt(f.personas) || 1
      const nuevo = Math.max(1, Math.min(60, actual + delta))
      return { ...f, personas: String(nuevo) }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre.trim() || !form.telefono.trim() || !form.interes) {
      setError('Por favor indica tu nombre, WhatsApp y el motivo de tu consulta.')
      return
    }
    setLoading(true); setError('')
    try {
      await captacionService.enviarFormulario({
        nombre: form.nombre.trim(),
        telefono: form.telefono.trim(),
        email: form.email.trim() || undefined,
        interes: form.interes as InteresLead,
        personas_aproximadas: form.personas ? Number(form.personas) : undefined,
        fecha_preferida: form.fecha || undefined,
        canal: 'formulario_web',
      })
      setSuccess(true)
    } catch (e: any) {
      setError(apiErrorMessage(e, 'Ocurrió un error al procesar tu solicitud. Intenta de nuevo.'))
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-900 bg-grill-pattern p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-radial from-vino-950/40 via-transparent to-black pointer-events-none" />
        
        <div className="glass-card max-w-lg w-full text-center animate-slide-up relative z-10 border-vino-700/60 p-8">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-vino-gradient flex items-center justify-center text-4xl shadow-glow-vino mb-6 animate-float">
            🔥
          </div>
          <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30 mb-3">
            ¡Solicitud Recibida con Éxito!
          </span>
          <h2 className="font-display font-bold text-3xl text-arena-200 mb-3">
            ¡Nos vemos en las brasas!
          </h2>
          <p className="text-arena-300/80 text-sm mb-6 leading-relaxed">
            Hemos recibido tus datos con éxito. En los próximos minutos, un anfitrión de <span className="text-arena-200 font-bold">Parrilladas El Establo</span> te escribirá vía WhatsApp al <span className="text-emerald-400 font-mono font-bold">{form.telefono}</span> con la propuesta y disponibilidad.
          </p>

          <div className="p-4 rounded-xl bg-dark-800/90 border border-dark-400 text-left space-y-2 mb-6">
            <div className="flex justify-between text-xs">
              <span className="text-dark-300">Cliente:</span>
              <span className="text-arena-200 font-semibold">{form.nombre}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-dark-300">Comensales estimados:</span>
              <span className="text-arena-200 font-semibold">{form.personas} personas</span>
            </div>
            {form.fecha && (
              <div className="flex justify-between text-xs">
                <span className="text-dark-300">Fecha solicitada:</span>
                <span className="text-arena-200 font-semibold">{form.fecha}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={`https://wa.me/?text=Hola%2C%20acabo%20de%20solicitar%20reserva%20en%20Parrilladas%20El%20Establo%20a%20nombre%20de%20${encodeURIComponent(form.nombre)}`}
              target="_blank"
              rel="noreferrer"
              className="btn-primary flex-1 justify-center py-3 text-sm"
            >
              💬 Abrir WhatsApp directo
            </a>
            <button
              onClick={() => { setSuccess(false); setForm({ nombre:'', telefono:'', email:'', interes:'reserva', personas:'4', fecha:'' }) }}
              className="btn-secondary text-xs"
            >
              Nueva solicitud
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col lg:flex-row relative">

      {/* ── Left Hero Panel (Cinematic Photography) ──────── */}
      <div className="lg:w-1/2 relative min-h-[420px] lg:min-h-screen flex flex-col justify-between p-8 lg:p-14 overflow-hidden">
        {/* Background Image with warm gradient overlay */}
        <div className="absolute inset-0">
          <img
            src="/images/hero_parrillada.jpg"
            alt="Parrilla El Establo al fuego"
            className="w-full h-full object-cover object-center filter brightness-[0.75] contrast-[1.1] scale-105 transform hover:scale-100 transition-transform duration-1000"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-dark-900 via-dark-900/40 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-dark-900/50 lg:to-dark-900" />
          <div className="absolute inset-0 bg-gradient-to-b from-dark-950/80 via-transparent to-dark-950/90" />
        </div>

        {/* Brand Header */}
        <div className="relative z-10 flex items-center gap-3.5">
          <img
            src="/images/logo_establo.jpg"
            alt="Logo El Establo"
            className="w-14 h-14 rounded-2xl object-cover border-2 border-amber-400/40 shadow-glow-vino"
          />
          <div>
            <h1 className="font-display font-extrabold text-xl text-arena-200 tracking-wide drop-shadow-md">
              EL ESTABLO
            </h1>
            <p className="text-[10px] text-vino-400 font-bold tracking-[3px] uppercase">
              PARRILLADAS & CORTES DE AUTOR
            </p>
          </div>
        </div>

        {/* Hero Copy */}
        <div className="relative z-10 my-auto py-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-vino-950/80 border border-vino-600/50 text-arena-200 text-xs font-semibold mb-4 backdrop-blur-md shadow-glow-vino-sm">
            <span>🔥</span>
            <span>Carbón de Quebracho · Cortes Black Angus</span>
          </div>
          
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl xl:text-5xl text-arena-100 leading-[1.15] mb-4 drop-shadow-lg">
            El arte de las brasas llevado a su <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-400 to-red-400">máxima expresión</span>.
          </h2>

          <p className="text-arena-200/90 text-sm sm:text-base max-w-lg leading-relaxed drop-shadow">
            Reserva con antelación y asegura una mesa en nuestro salón principal o área VIP. Diseñamos banquetes personalizados, parrilladas familiares y cenas ejecutivas con cortes madurados al punto perfecto.
          </p>

          {/* Social Proof Badges */}
          <div className="grid grid-cols-3 gap-3 mt-8 max-w-md">
            <div className="glass-panel rounded-xl p-3 text-center border-amber-500/20">
              <p className="text-amber-400 text-lg font-bold font-display">⭐ 4.9</p>
              <p className="text-[10px] text-arena-300/80">850+ Google Reviews</p>
            </div>
            <div className="glass-panel rounded-xl p-3 text-center border-amber-500/20">
              <p className="text-arena-200 text-lg font-bold font-display">100%</p>
              <p className="text-[10px] text-arena-300/80">Angus Certificado</p>
            </div>
            <div className="glass-panel rounded-xl p-3 text-center border-amber-500/20">
              <p className="text-emerald-400 text-lg font-bold font-display">10%</p>
              <p className="text-[10px] text-arena-300/80">Anticipo con MP</p>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 flex items-center justify-between text-xs text-arena-300/60 pt-4 border-t border-arena-300/10">
          <span className="flex items-center gap-1.5">📍 Av. Las Brasas 1420 · Salón & Cava</span>
          <span>Martes a Domingo: 13:00 - 23:30</span>
        </div>
      </div>

      {/* ── Right Form Panel (Glassmorphism & Interactive Booking) ── */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 sm:p-10 lg:p-14 bg-dark-900 bg-grill-pattern">
        <div className="w-full max-w-lg">
          
          <div className="mb-6">
            <span className="text-[11px] font-bold text-vino-400 uppercase tracking-widest">
              Experiencia Parrillada El Establo
            </span>
            <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-arena-200 mt-1">
              Personaliza tu Reserva
            </h2>
            <p className="text-xs text-arena-300/70 mt-1">
              Completa este breve formulario y nuestro sommelier y parrillero prepararán tu llegada.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Selector de interés */}
            <div>
              <label className="label">1. ¿Qué experiencia buscas?</label>
              <div className="grid grid-cols-2 gap-2.5">
                {INTERESES.map(i => (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, interes: i.id }))}
                    className={clsx(
                      'p-3 rounded-xl border text-left transition-all duration-200 flex items-start gap-2.5',
                      form.interes === i.id
                        ? 'bg-vino-950/70 border-vino-600 shadow-glow-vino-sm text-arena-200 ring-1 ring-vino-500'
                        : 'bg-dark-700/80 border-dark-400/80 text-arena-300/70 hover:border-dark-300 hover:bg-dark-600'
                    )}
                  >
                    <span className="text-xl flex-shrink-0 mt-0.5">{i.emoji}</span>
                    <div className="min-w-0">
                      <p className={clsx('text-xs font-bold truncate', form.interes === i.id ? 'text-arena-200' : 'text-arena-300/90')}>
                        {i.label}
                      </p>
                      <p className="text-[10px] text-dark-300 leading-tight mt-0.5 line-clamp-2">{i.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Datos de contacto */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="label">Nombre y Apellido *</label>
                <input
                  name="nombre"
                  value={form.nombre}
                  onChange={handleChange}
                  placeholder="Ej: Marcelo Gómez"
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="label">WhatsApp de Contacto *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs">📱</span>
                  <input
                    name="telefono"
                    value={form.telefono}
                    onChange={handleChange}
                    placeholder="+54 9 11 4050 6070"
                    className="input-field pl-8"
                    required
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="label">Correo Electrónico (Para envío de menú digital)</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="marcelo@ejemplo.com"
                className="input-field"
              />
            </div>

            {/* Personas y Fecha */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Número de comensales</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => ajustarPersonas(-1)}
                    className="w-10 h-10 rounded-xl bg-dark-600 border border-dark-400 text-arena-200 font-bold hover:bg-dark-500 transition-colors flex items-center justify-center text-base"
                  >
                    -
                  </button>
                  <input
                    name="personas"
                    type="number"
                    min="1"
                    max="60"
                    value={form.personas}
                    onChange={handleChange}
                    className="input-field text-center font-bold font-display text-base"
                  />
                  <button
                    type="button"
                    onClick={() => ajustarPersonas(1)}
                    className="w-10 h-10 rounded-xl bg-dark-600 border border-dark-400 text-arena-200 font-bold hover:bg-dark-500 transition-colors flex items-center justify-center text-base"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="label">Fecha deseada</label>
                <input
                  name="fecha"
                  type="date"
                  value={form.fecha}
                  onChange={handleChange}
                  className="input-field"
                />
              </div>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/50 text-red-300 text-xs flex items-center gap-2 animate-fade-in">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-3.5 text-base shadow-glow-vino font-display tracking-wide mt-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-arena-200 border-t-transparent rounded-full animate-spin"></span>
                  Conectando con el anfitrión...
                </span>
              ) : (
                '🔥 Quiero mi Reserva en El Establo'
              )}
            </button>
          </form>

          <div className="mt-4 flex items-center justify-center gap-4 text-[11px] text-dark-300">
            <span className="flex items-center gap-1">🔒 Datos protegidos</span>
            <span>·</span>
            <span className="flex items-center gap-1">⚡ Respuesta &lt; 15 min</span>
            <span>·</span>
            <span className="flex items-center gap-1">💳 Pago seguro</span>
          </div>

        </div>
      </div>

    </div>
  )
}

