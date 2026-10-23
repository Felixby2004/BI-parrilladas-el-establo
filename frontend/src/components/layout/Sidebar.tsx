import { NavLink, useLocation } from 'react-router-dom'
import { clsx } from 'clsx'

interface NavItem {
  phase: string; label: string; icon: string
  description: string; path: string
  disabled?: boolean; gradient: string
}

const navItems: NavItem[] = [
  { phase: 'B', label: 'BUYERS',    icon: '📣', description: 'Captación & Marketing', path: '/buyers',    gradient: 'from-blue-600 to-indigo-700'    },
  { phase: 'L', label: 'LEADS',     icon: '🎯', description: 'Negociación & Pedidos', path: '/leads',     gradient: 'from-yellow-600 to-amber-700'    },
  { phase: 'P', label: 'PAYERS',    icon: '💳', description: 'Caja & Cobros',         path: '/payers',    gradient: 'from-green-600 to-emerald-700'   },
  { phase: 'C', label: 'CUSTOMERS', icon: '🍽️', description: 'Servicio en Salón',    path: '/customers', gradient: 'from-purple-600 to-violet-700'   },
  { phase: 'T', label: 'TURNED',    icon: '⭐', description: 'Próximamente',          path: '/turned',    gradient: 'from-dark-400 to-dark-500', disabled: true },
]

export function Sidebar() {
  const location = useLocation()

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-64 flex flex-col"
      style={{ background: 'linear-gradient(180deg, #150c0c 0%, #0d0909 100%)', borderRight: '1px solid #2e1a1a' }}>

      {/* ── Logo ─────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-5" style={{ borderBottom: '1px solid #2e1a1a' }}>
        <div className="relative">
          <img
            src="/images/logo_establo.jpg"
            alt="Parrilladas El Establo"
            className="w-12 h-12 rounded-2xl object-cover border border-amber-500/40 shadow-glow-vino-sm"
          />
          <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
        </div>
        <div className="min-w-0">
          <h1 className="font-display font-bold text-sm text-arena-200 leading-tight tracking-wide truncate">
            EL ESTABLO
          </h1>
          <p className="text-[9px] text-vino-400 font-bold tracking-[2.5px] uppercase mt-0.5">
            IMPULSE SYSTEM
          </p>
          <span className="inline-block text-[8px] text-amber-300/80 font-medium">Parrillada Gourmet</span>
        </div>
      </div>

      {/* ── Nav ──────────────────────────────────────── */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="flex items-center justify-between px-2 mb-3">
          <p className="text-[9px] font-bold text-dark-300 uppercase tracking-[3px]">
            Embudo de Ventas
          </p>
          <span className="text-[9px] text-dark-300 font-mono">5 Fases</span>
        </div>

        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path)

          if (item.disabled) {
            return (
              <div key={item.phase}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl opacity-35 cursor-not-allowed select-none border border-transparent">
                <div className={clsx('w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center text-sm flex-shrink-0', item.gradient)}>
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-dark-500 text-dark-300">
                      {item.phase}
                    </span>
                    <p className="text-[11px] font-bold text-dark-300 truncate">{item.label}</p>
                  </div>
                  <p className="text-[10px] text-dark-300/70 truncate">{item.description}</p>
                </div>
                <span className="text-[8px] font-bold bg-dark-500 text-dark-300 px-1.5 py-0.5 rounded border border-dark-400">
                  PRONTO
                </span>
              </div>
            )
          }

          return (
            <NavLink key={item.phase} to={item.path}
              className={clsx(
                'flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 group border',
                isActive
                  ? 'bg-vino-900/35 border-vino-700/60 text-arena-200 shadow-glow-vino-sm'
                  : 'border-transparent text-arena-300/60 hover:bg-dark-600/60 hover:border-dark-400/50 hover:text-arena-200'
              )}
            >
              <div className={clsx(
                'w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center text-sm flex-shrink-0 transition-transform duration-200',
                item.gradient,
                isActive ? 'scale-110 shadow-glow-sm' : 'group-hover:scale-105'
              )}>
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={clsx(
                    'text-[9px] font-mono px-1 py-0.2 rounded',
                    isActive ? 'bg-vino-800 text-arena-200 font-bold' : 'bg-dark-500 text-dark-300'
                  )}>
                    {item.phase}
                  </span>
                  <p className={clsx('text-[11px] font-bold tracking-wider truncate', isActive ? 'text-arena-200' : 'text-arena-300/80 group-hover:text-arena-200')}>
                    {item.label}
                  </p>
                </div>
                <p className="text-[10px] text-dark-300 group-hover:text-dark-300/90 truncate">{item.description}</p>
              </div>
              {isActive && <div className="w-1.5 h-1.5 rounded-full bg-vino-400 shadow-[0_0_8px_#ec7591]" />}
            </NavLink>
          )
        })}
      </nav>

      {/* ── Footer ───────────────────────────────────── */}
      <div className="p-3" style={{ borderTop: '1px solid #2e1a1a' }}>
        <a
          href="/formulario"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-xl bg-dark-600 hover:bg-dark-500 border border-dark-400 text-arena-300 text-[11px] font-semibold mb-2 transition-colors"
        >
          <span>🌐</span>
          <span>Ver Landing Pública</span>
        </a>

        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-dark-700/80 border border-dark-400/80">
          <div className="w-7 h-7 rounded-lg bg-vino-gradient flex items-center justify-center text-xs font-bold text-arena-200 shadow-glow-vino-sm">
            🔥
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-arena-200 truncate">El Establo POS</p>
            <p className="text-[9px] text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
              Mercado Pago Sandbox
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
