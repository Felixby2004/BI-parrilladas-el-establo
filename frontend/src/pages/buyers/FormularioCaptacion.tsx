import { useState } from 'react'
import { clsx } from 'clsx'
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  Clock3,
  Flame,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  ShieldCheck,
  Sparkles,
  UtensilsCrossed,
  Wine,
  Zap,
} from 'lucide-react'
import { captacionService } from '@/services/api'
import type { InteresLead } from '@/types'
import { apiErrorMessage } from '@/services/errors'

const INTERESES = [
  { id: 'reserva',     label: 'Reserva para grupo',  icon: UtensilsCrossed, desc: 'Mesa para amigos, familia o festejo' },
  { id: 'evento',      label: 'Evento empresarial',  icon: Building2,       desc: 'Cenas corporativas y fin de año' },
  { id: 'informacion', label: 'Conocer carta y menú', icon: Wine,            desc: 'Cortes premium y sugerencias de vino' },
  { id: 'otro',        label: 'Consulta especial',   icon: MessageCircle,   desc: 'Menú degustación o parrillero privado' },
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
      <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-dark-950 p-4 sm:p-6">
        <img
          src="/images/hero_parrillada.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-25"
          width={1376}
          height={768}
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-dark-950/80 via-dark-950/85 to-dark-950" />
        <div className="absolute -left-20 top-0 h-72 w-72 rounded-full bg-vino-900/20 blur-3xl" />
        <div className="absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-gold-500/10 blur-3xl" />

        <div className="relative z-10 w-full max-w-lg animate-slide-up rounded-[28px] border border-arena-200/12 bg-[#f7efe2] p-6 text-[#241b17] shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)] sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-2xl border border-[#7F011F]/20 bg-[#7F011F] text-arena-50 shadow-[0_16px_30px_-18px_rgba(127,1,31,0.8)]">
              <Check size={26} strokeWidth={2} />
            </span>
            <img src="/images/logo_emblema.png" alt="El Establo" className="h-12 w-12 object-contain opacity-80" />
          </div>

          <span className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-[#7F011F]/20 bg-[#7F011F]/[0.06] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#7F011F]">
            <Sparkles size={11} />
            Solicitud recibida
          </span>

          <h1 className="mt-3 font-display text-[clamp(1.8rem,4vw,2.4rem)] font-semibold leading-tight tracking-tight">
            Nos vemos en las brasas.
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-[#6e5d4d]">
            En los próximos minutos, un anfitrión de <span className="font-semibold text-[#241b17]">Parrilladas El Establo</span> te escribirá por WhatsApp al <span className="font-semibold text-[#7F011F]">{form.telefono}</span> con la propuesta y disponibilidad.
          </p>

          <div className="mt-5 rounded-2xl border border-[#ddcdb6] bg-white/55 p-4">
            <div className="flex justify-between gap-4 text-[12px]">
              <span className="text-[#8b7058]">Cliente</span>
              <span className="text-right font-semibold">{form.nombre}</span>
            </div>
            <div className="mt-2.5 flex justify-between gap-4 border-t border-[#e7dac7] pt-2.5 text-[12px]">
              <span className="text-[#8b7058]">Comensales</span>
              <span className="font-semibold">{form.personas} personas</span>
            </div>
            {form.fecha && (
              <div className="mt-2.5 flex justify-between gap-4 border-t border-[#e7dac7] pt-2.5 text-[12px]">
                <span className="text-[#8b7058]">Fecha solicitada</span>
                <span className="font-semibold">
                  {new Date(form.fecha + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}
                </span>
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <a
              href={`https://wa.me/?text=Hola%2C%20acabo%20de%20solicitar%20reserva%20en%20Parrilladas%20El%20Establo%20a%20nombre%20de%20${encodeURIComponent(form.nombre)}`}
              target="_blank"
              rel="noreferrer"
              className="btn-primary flex-1 py-3 text-sm"
            >
              <MessageCircle size={16} />
              Abrir WhatsApp
            </a>
            <button
              onClick={() => { setSuccess(false); setForm({ nombre:'', telefono:'', email:'', interes:'reserva', personas:'4', fecha:'' }) }}
              className="rounded-xl border border-[#d8c7ad] bg-white/50 px-4 py-3 text-xs font-semibold text-[#5c4a3c] transition-colors hover:bg-white"
            >
              Nueva solicitud
            </button>
          </div>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-[#9a8775]">
            <ShieldCheck size={12} />
            Tus datos se usan solo para gestionar esta reserva.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div data-theme="dark" className="min-h-dvh bg-dark-950 lg:grid lg:grid-cols-[1.06fr_0.94fr]">
      {/* ── Hero editorial ─────────────────────────────── */}
      <section className="relative flex min-h-[560px] flex-col justify-between overflow-hidden p-6 sm:p-10 lg:min-h-dvh lg:p-12 xl:p-16">
        <img
          src="/images/hero_parrillada.jpg"
          alt="Cortes de res asándose al carbón en Parrilladas El Establo"
          className="absolute inset-0 h-full w-full scale-[1.02] object-cover object-center"
          width={1376}
          height={768}
          fetchPriority="high"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-dark-950/45 to-dark-950/30 lg:bg-gradient-to-r lg:from-dark-950/40 lg:via-dark-950/55 lg:to-dark-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_20%,rgba(127,1,31,0.25),transparent_55%)]" />

        <header className="relative z-10 flex items-center gap-3">
          <img
            src="/images/logo_establo.jpg"
            alt="Logo Parrilladas El Establo"
            className="h-12 w-12 rounded-2xl border border-gold-500/35 object-cover shadow-glow-vino-sm"
            width={512}
            height={512}
          />
          <div>
            <p className="font-display text-lg font-semibold leading-none tracking-wide text-arena-50">EL ESTABLO</p>
            <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.26em] text-gold-500/80">Parrilladas y cortes de autor</p>
          </div>
        </header>

        <div className="relative z-10 my-12 max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold-500/25 bg-black/30 px-3 py-1.5 text-[10.5px] font-semibold text-gold-200 backdrop-blur-md">
            <Flame size={12} strokeWidth={1.8} />
            Carbón de quebracho · Cortes Black Angus
          </div>

          <h1 className="mt-5 font-display text-[clamp(2.2rem,4.6vw,3.6rem)] font-semibold leading-[1.04] tracking-[-0.03em] text-arena-50">
            El arte de la brasa,<br />
            <span className="text-gold-300">servido en tu mesa.</span>
          </h1>

          <p className="mt-4 max-w-lg text-[13.5px] leading-relaxed text-arena-200/75">
            Reserva con antelación y asegura tu lugar en el salón principal o en el área VIP. Diseñamos banquetes, parrilladas familiares y cenas ejecutivas con cortes madurados al punto perfecto.
          </p>

          <div className="mt-7 grid max-w-md grid-cols-3 gap-2.5">
            {[
              { value: '4.9', label: 'Google reviews', accent: 'text-gold-300' },
              { value: '100%', label: 'Angus certificado', accent: 'text-arena-100' },
              { value: '10%', label: 'Anticipo MP', accent: 'text-sage-400' },
            ].map(item => (
              <div key={item.label} className="rounded-xl border border-arena-200/10 bg-black/25 px-3 py-2.5 backdrop-blur-md">
                <p className={clsx('font-display text-lg font-semibold leading-none tabular', item.accent)}>{item.value}</p>
                <p className="mt-1 text-[9.5px] leading-tight text-arena-300/60">{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        <footer className="relative z-10 flex flex-col gap-2 border-t border-arena-200/10 pt-4 text-[10.5px] text-arena-300/55 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-1.5">
            <MapPin size={12} className="text-gold-400/70" />
            Av. Las Brasas 1420 · Salón y cava
          </span>
          <span className="flex items-center gap-1.5">
            <Clock3 size={12} className="text-gold-400/70" />
            Martes a domingo · 13:00 – 23:30
          </span>
        </footer>
      </section>

      {/* ── Panel de reserva ───────────────────────────── */}
      <section className="booking-panel relative flex items-center justify-center px-5 py-10 sm:px-8 lg:min-h-dvh lg:px-10 xl:px-14">
        <div className="pointer-events-none absolute right-0 top-0 h-56 w-56 rounded-full bg-gold-500/15 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-56 w-56 rounded-full bg-vino-900/[0.06] blur-3xl" />

        <div className="relative w-full max-w-xl">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8b7058]">Reserva de mesa</p>
            <span className="flex items-center gap-1.5 text-[10px] font-medium text-[#8b7058]">
              <ShieldCheck size={12} />
              Datos protegidos
            </span>
          </div>

          <h2 className="mt-2 font-display text-[clamp(1.8rem,3.2vw,2.35rem)] font-semibold leading-tight tracking-tight text-[#241b17]">
            Personaliza tu visita
          </h2>
          <p className="mt-1.5 max-w-md text-[12px] leading-relaxed text-[#7a6a5c]">
            Completa este breve formulario y nuestro equipo preparará tu llegada.
          </p>

          <ol className="mt-5 grid grid-cols-3 gap-2" aria-label="Pasos de la reserva">
            {[
              { n: '01', label: 'Experiencia', active: true },
              { n: '02', label: 'Datos', active: true },
              { n: '03', label: 'Confirmación', active: false },
            ].map(step => (
              <li key={step.n} className="flex items-center gap-2">
                <span className={clsx(
                  'grid h-6 w-6 shrink-0 place-items-center rounded-full text-[9px] font-bold',
                  step.active ? 'bg-[#7F011F] text-arena-50' : 'border border-[#cdbba2] text-[#9a8775]',
                )}>
                  {step.n}
                </span>
                <span className={clsx('truncate text-[10px] font-semibold', step.active ? 'text-[#4c3b2f]' : 'text-[#9a8775]')}>
                  {step.label}
                </span>
              </li>
            ))}
          </ol>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <fieldset>
              <legend className="booking-label">¿Qué experiencia buscas?</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {INTERESES.map(i => {
                  const Icon = i.icon
                  const active = form.interes === i.id
                  return (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, interes: i.id }))}
                      aria-pressed={active}
                      className={clsx('booking-option', active ? 'booking-option-active' : 'booking-option-idle')}
                    >
                      <span className={clsx(
                        'grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors',
                        active ? 'bg-[#7F011F] text-arena-50' : 'bg-[#efe3d1] text-[#7F011F]',
                      )}>
                        <Icon size={16} strokeWidth={1.7} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[11.5px] font-bold leading-tight text-[#241b17]">{i.label}</span>
                        <span className="mt-0.5 block text-[10px] leading-tight text-[#8b7058]">{i.desc}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </fieldset>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="nombre" className="booking-label">Nombre y apellido *</label>
                <input
                  id="nombre"
                  name="nombre"
                  value={form.nombre}
                  onChange={handleChange}
                  placeholder="Ej. Marcelo Gómez"
                  className="booking-input"
                  autoComplete="name"
                  required
                />
              </div>

              <div>
                <label htmlFor="telefono" className="booking-label">WhatsApp de contacto *</label>
                <input
                  id="telefono"
                  name="telefono"
                  value={form.telefono}
                  onChange={handleChange}
                  placeholder="+52 55 1234 5678"
                  className="booking-input"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="booking-label">Correo electrónico (opcional)</label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="marcelo@ejemplo.com"
                className="booking-input"
                autoComplete="email"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="personas" className="booking-label">Número de comensales</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => ajustarPersonas(-1)}
                    aria-label="Quitar un comensal"
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#d8c7ad] bg-white/55 text-[#5c4a3c] transition-colors hover:bg-white"
                  >
                    <Minus size={15} />
                  </button>
                  <input
                    id="personas"
                    name="personas"
                    type="number"
                    min="1"
                    max="60"
                    value={form.personas}
                    onChange={handleChange}
                    className="booking-input text-center font-display text-base font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => ajustarPersonas(1)}
                    aria-label="Agregar un comensal"
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#d8c7ad] bg-white/55 text-[#5c4a3c] transition-colors hover:bg-white"
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="fecha" className="booking-label">Fecha deseada</label>
                <div className="relative">
                  <CalendarDays size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9a8775]" />
                  <input
                    id="fecha"
                    name="fecha"
                    type="date"
                    value={form.fecha}
                    onChange={handleChange}
                    className="booking-input pl-10"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-xl border border-[#b33d3d]/35 bg-[#b33d3d]/[0.07] p-3 text-[11.5px] leading-relaxed text-[#8f2f2f] animate-fade-in">
                <Zap size={14} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3.5 text-[13px] tracking-wide"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-arena-200 border-t-transparent" />
                  Conectando con el anfitrión…
                </>
              ) : (
                <>
                  <Flame size={16} />
                  Quiero mi reserva en El Establo
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[10px] text-[#9a8775]">
            <span className="flex items-center gap-1"><ShieldCheck size={11} /> Datos protegidos</span>
            <span className="text-[#c9b294]">·</span>
            <span className="flex items-center gap-1"><Zap size={11} /> Respuesta en menos de 15 min</span>
            <span className="text-[#c9b294]">·</span>
            <span className="flex items-center gap-1"><Check size={11} /> Pago seguro con Mercado Pago</span>
          </div>
        </div>
      </section>
    </div>
  )
}
