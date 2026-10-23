import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { ArrowUpRight, CreditCard, Megaphone, Menu, Star, Target, UtensilsCrossed } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { clsx } from 'clsx'

const PHASE_TITLES: Record<string, { label: string; title: string; subtitle: string; icon: LucideIcon }> = {
  '/buyers': {
    label: 'Buyers',
    title: 'Captación y marketing',
    subtitle: 'Atrae prospectos, activa campañas y canaliza formularios',
    icon: Megaphone,
  },
  '/leads': {
    label: 'Leads',
    title: 'Negociación y pedidos',
    subtitle: 'Conversa por WhatsApp y asegura el adelanto del 10%',
    icon: Target,
  },
  '/payers': {
    label: 'Payers',
    title: 'Caja y cobranza',
    subtitle: 'Asigna mesas, cobra el saldo y emite comprobantes',
    icon: CreditCard,
  },
  '/customers': {
    label: 'Customers',
    title: 'Servicio y salón',
    subtitle: 'Comandas en cocina, alertas y reseñas de la experiencia',
    icon: UtensilsCrossed,
  },
  '/turned': {
    label: 'Turned',
    title: 'Fidelización',
    subtitle: 'Próxima fase de retención y marketing recurrente',
    icon: Star,
  },
}

export function MainLayout() {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const currentKey = Object.keys(PHASE_TITLES).find(k => location.pathname.startsWith(k)) || '/buyers'
  const current = PHASE_TITLES[currentKey]
  const CurrentIcon = current.icon

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!mobileOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [mobileOpen])

  return (
    <div className="flex min-h-dvh bg-dark-950">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-gold-500 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-dark-950">
        Saltar al contenido
      </a>

      <Sidebar />

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
          />
          <div className="relative h-full w-[276px] shadow-2xl">
            <Sidebar mobile onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-arena-200/[0.07] bg-dark-950/80 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-[1600px] items-center gap-3 px-4 py-3 sm:px-6 xl:px-8">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menú"
              className="btn-icon h-10 w-10 lg:hidden"
            >
              <Menu size={18} />
            </button>

            <div className={clsx(
              'hidden h-9 w-9 place-items-center rounded-xl border border-arena-200/10 bg-dark-800 text-gold-400 sm:grid',
            )}>
              <CurrentIcon size={17} strokeWidth={1.6} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[9.5px] font-bold uppercase tracking-[0.2em] text-arena-400/55">
                <span>Impulse</span>
                <span className="text-arena-400/30">/</span>
                <span className="text-gold-500/85">{current.label}</span>
              </div>
              <h2 className="truncate font-display text-[15px] font-semibold leading-tight tracking-tight text-arena-100 sm:text-base">
                {current.title}
              </h2>
              <p className="hidden truncate text-[10.5px] text-arena-300/45 md:block">{current.subtitle}</p>
            </div>

            <div className="hidden items-center gap-3 rounded-xl border border-arena-200/[0.08] bg-dark-800/60 px-3 py-1.5 text-[10.5px] lg:flex">
              <span className="flex items-center gap-1.5 font-medium text-sage-400">
                <span className="h-1.5 w-1.5 rounded-full bg-sage-400" />
                API v1
              </span>
              <span className="h-3 w-px bg-arena-200/10" />
              <span className="flex items-center gap-1.5 font-medium text-gold-400">
                <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
                MP Sandbox 10%
              </span>
            </div>

            <a
              href="/formulario"
              target="_blank"
              rel="noreferrer"
              className="btn-primary hidden shrink-0 px-3.5 py-2 text-[11px] sm:inline-flex"
            >
              <span>Abrir formulario</span>
              <ArrowUpRight size={14} />
            </a>
          </div>
        </header>

        <main id="contenido" className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5 sm:px-6 sm:py-6 xl:px-8 xl:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
