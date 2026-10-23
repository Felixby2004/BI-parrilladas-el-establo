import { ArrowUpRight, Crown, Gift, Repeat2, Sparkles, Star } from 'lucide-react'
import { StatusBadge } from '@/components/ui/kit'

interface PlaceholderPageProps {
  phase: string
  emoji: string
  description: string
  comingSoon?: boolean
}

export function PlaceholderPage({ phase, description, comingSoon }: PlaceholderPageProps) {
  return (
    <div className="animate-fade-in space-y-6">
      <div className="relative overflow-hidden rounded-[28px] border border-arena-200/10 bg-dark-800/70">
        <div className="absolute inset-0">
          <img
            src="/images/campana_familiar.jpg"
            alt=""
            className="h-full w-full object-cover opacity-25"
            loading="lazy"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-dark-950 via-dark-950/90 to-dark-950/30" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_75%_20%,rgba(201,162,90,0.12),transparent_55%)]" />
        </div>

        <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:p-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-gold-500/30 bg-gold-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-300">
              <Sparkles size={11} />
              Fase {phase}
            </div>
            <h1 className="mt-4 font-display text-[clamp(2rem,4vw,3.2rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-arena-50">
              La mesa que vuelve<br />
              <span className="text-gold-300">por su propia voluntad.</span>
            </h1>
            <p className="mt-4 max-w-lg text-[13px] leading-relaxed text-arena-300/65">{description}</p>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <StatusBadge tone="gold" dot>En diseño</StatusBadge>
              <StatusBadge tone="neutral">Próxima fase</StatusBadge>
            </div>

            <div className="mt-7 flex flex-wrap gap-2">
              <a href="/formulario" target="_blank" rel="noreferrer" className="btn-primary px-4 py-2.5 text-[11.5px]">
                Captar nuevos leads
                <ArrowUpRight size={14} />
              </a>
              <a href="/customers" className="btn-secondary px-4 py-2.5 text-[11.5px]">
                Ver servicio actual
              </a>
            </div>
          </div>

          <div className="relative hidden min-h-[280px] lg:block">
            <div className="absolute right-0 top-0 h-56 w-64 overflow-hidden rounded-2xl border border-arena-200/10 shadow-2xl">
              <img src="/images/campana_eventos.jpg" alt="Salón privado de El Establo" className="h-full w-full object-cover" loading="lazy" decoding="async" />
              <div className="absolute inset-0 bg-gradient-to-t from-dark-950/60 to-transparent" />
            </div>
            <div className="absolute bottom-0 left-0 h-48 w-56 overflow-hidden rounded-2xl border border-arena-200/10 shadow-2xl">
              <img src="/images/campana_familiar.jpg" alt="Parrillada familiar" className="h-full w-full object-cover" loading="lazy" decoding="async" />
              <div className="absolute inset-0 bg-gradient-to-t from-dark-950/60 to-transparent" />
            </div>
            <span className="absolute right-10 bottom-16 grid h-14 w-14 place-items-center rounded-2xl border border-gold-500/25 bg-dark-900/90 text-gold-300 shadow-glow-gold backdrop-blur">
              <Star size={24} strokeWidth={1.4} />
            </span>
          </div>
        </div>
      </div>

      {comingSoon && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {[
            { icon: Repeat2, title: 'Recurrencia', text: 'Historial de visitas, frecuencia y ticket promedio por cliente.' },
            { icon: Gift, title: 'Beneficios', text: 'Cortesías, cumpleaños y campañas para clientes frecuentes.' },
            { icon: Crown, title: 'Embajadores', text: 'Reseñas, referidos y programas de lealtad medibles.' },
          ].map(item => {
            const Icon = item.icon
            return (
              <div key={item.title} className="card card-hover p-5">
                <span className="grid h-10 w-10 place-items-center rounded-xl border border-arena-200/10 bg-arena-200/[0.04] text-gold-400">
                  <Icon size={17} strokeWidth={1.6} />
                </span>
                <h2 className="mt-3 font-display text-base font-semibold text-arena-50">{item.title}</h2>
                <p className="mt-1 text-[11px] leading-relaxed text-arena-300/50">{item.text}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
