import { NavLink, useLocation } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  ArrowUpRight,
  CreditCard,
  Flame,
  Globe2,
  Megaphone,
  Star,
  Target,
  UtensilsCrossed,
  X,
  type LucideIcon,
} from 'lucide-react'

interface NavItem {
  phase: string
  label: string
  icon: LucideIcon
  description: string
  path: string
  disabled?: boolean
}

const navItems: NavItem[] = [
  { phase: 'B', label: 'Buyers',    icon: Megaphone,       description: 'Campañas y creativos',    path: '/buyers' },
  { phase: 'L', label: 'Leads',     icon: Target,          description: 'Negociación y pedidos',   path: '/leads' },
  { phase: 'P', label: 'Payers',    icon: CreditCard,      description: 'Caja y cobros',           path: '/payers' },
  { phase: 'C', label: 'Customers', icon: UtensilsCrossed, description: 'Servicio en salón',       path: '/customers' },
  { phase: 'T', label: 'Turned',    icon: Star,            description: 'Fidelización',            path: '/turned', disabled: true },
]

export function Sidebar({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const location = useLocation()

  return (
    <aside
      className={clsx(
        'flex h-dvh w-[276px] shrink-0 flex-col border-r border-arena-200/[0.07] bg-dark-900/95 backdrop-blur-xl',
        mobile ? 'animate-drawer-in' : 'sticky top-0 hidden lg:flex',
      )}
      aria-label="Navegación principal"
    >
      {/* Brand */}
      <div className="flex items-center gap-3 border-b border-arena-200/[0.07] px-5 py-[18px]">
        <div className="relative shrink-0">
          <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-2xl border border-gold-500/25 bg-dark-800 shadow-glow-vino-sm">
            <img src="/images/logo_emblema.png" alt="El Establo" className="h-9 w-9 object-contain" />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sage-400 opacity-60" />
            <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-dark-900 bg-sage-500" />
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[15px] font-semibold leading-tight tracking-wide text-arena-50">
            EL ESTABLO
          </h1>
          <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.26em] text-gold-500/80">
            Impulse System
          </p>
          <p className="text-[10px] text-arena-300/45">Parrilladas y cortes</p>
        </div>

        {mobile && (
          <button
            type="button"
            onClick={onNavigate}
            aria-label="Cerrar menú"
            className="btn-icon h-9 w-9 shrink-0"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-5">
        <div className="mb-3 flex items-center justify-between px-2">
          <p className="text-[9.5px] font-bold uppercase tracking-[0.22em] text-arena-400/55">
            Embudo comercial
          </p>
          <span className="text-[9px] font-medium uppercase tracking-widest text-arena-400/35">5 fases</span>
        </div>

        <div className="space-y-1">
          {navItems.map(item => {
            const isActive = location.pathname.startsWith(item.path)
            const Icon = item.icon

            if (item.disabled) {
              return (
                <div
                  key={item.phase}
                  className="flex select-none items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 opacity-40"
                  aria-disabled="true"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-arena-200/10 bg-dark-800 text-arena-300">
                    <Icon size={16} strokeWidth={1.6} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-arena-300">{item.label}</p>
                    <p className="truncate text-[10.5px] text-arena-300/50">{item.description}</p>
                  </div>
                  <span className="rounded-md border border-arena-200/10 bg-dark-800 px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wider text-arena-300/50">
                    Pronto
                  </span>
                </div>
              )
            }

            return (
              <NavLink
                key={item.phase}
                to={item.path}
                onClick={onNavigate}
                aria-current={isActive ? 'page' : undefined}
                className={clsx(
                  'group relative flex items-center gap-3 overflow-hidden rounded-xl border px-3 py-2.5 transition-all duration-200',
                  isActive
                    ? 'border-vino-800/50 bg-gradient-to-r from-vino-900/35 via-vino-900/10 to-transparent text-arena-50 shadow-glow-vino-sm'
                    : 'border-transparent text-arena-300/65 hover:border-arena-200/[0.06] hover:bg-arena-200/[0.04] hover:text-arena-100',
                )}
              >
                {isActive && (
                  <span className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-gold-500 shadow-[0_0_12px_rgba(201,162,90,0.65)]" />
                )}

                <span className={clsx(
                  'grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition-all duration-200',
                  isActive
                    ? 'border-gold-500/25 bg-gold-500/10 text-gold-300'
                    : 'border-arena-200/[0.07] bg-dark-800/70 text-arena-300/70 group-hover:border-arena-200/15 group-hover:text-arena-200',
                )}>
                  <Icon size={16} strokeWidth={1.7} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={clsx(
                      'rounded px-1 py-0.5 text-[8.5px] font-bold uppercase tracking-wider',
                      isActive ? 'bg-vino-900/60 text-arena-200' : 'bg-arena-200/[0.05] text-arena-400/60',
                    )}>
                      {item.phase}
                    </span>
                    <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em]">{item.label}</p>
                  </div>
                  <p className="mt-0.5 truncate text-[10.5px] text-arena-300/45">{item.description}</p>
                </div>

                {isActive && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400 shadow-[0_0_8px_rgba(201,162,90,0.8)]" />}
              </NavLink>
            )
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-arena-200/[0.07] p-3">
        <a
          href="/formulario"
          target="_blank"
          rel="noreferrer"
          onClick={onNavigate}
          className="mb-2 flex items-center gap-2.5 rounded-xl border border-arena-200/[0.08] bg-dark-800/60 px-3 py-2.5 text-[11px] font-semibold text-arena-300/75 transition-colors hover:border-arena-200/15 hover:bg-dark-800 hover:text-arena-100"
        >
          <Globe2 size={14} strokeWidth={1.7} className="text-gold-400" />
          <span className="flex-1">Landing pública</span>
          <ArrowUpRight size={13} className="text-arena-400/50" />
        </a>

        <div className="flex items-center gap-2.5 rounded-xl border border-arena-200/[0.08] bg-dark-800/60 p-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-vino-700/40 bg-vino-900/30 text-vino-300">
            <Flame size={15} strokeWidth={1.7} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold text-arena-200">El Establo POS</p>
            <p className="flex items-center gap-1.5 text-[9.5px] text-sage-400">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-sage-400" />
              Mercado Pago · Sandbox
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
