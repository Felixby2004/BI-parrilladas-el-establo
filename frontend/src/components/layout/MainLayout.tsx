import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'

const PHASE_TITLES: Record<string, { title: string; subtitle: string; icon: string }> = {
  '/buyers': { title: 'Fase BUYERS · Captación & Marketing', subtitle: 'Atrae prospectos mediante campañas y canaliza formularios', icon: '📣' },
  '/leads': { title: 'Fase LEADS · Negociación & Pedidos', subtitle: 'Negocia el menú por WhatsApp y asegura el adelanto del 10%', icon: '🎯' },
  '/payers': { title: 'Fase PAYERS · Caja & Cobranza', subtitle: 'Asignación de mesas, cobro de saldo del 90% y emisión de comprobantes', icon: '💳' },
  '/customers': { title: 'Fase CUSTOMERS · Servicio & Salón', subtitle: 'Control de comandas en cocina, alertas de consumo y reseñas 5 estrellas', icon: '🍽️' },
  '/turned': { title: 'Fase TURNED · Fidelización', subtitle: 'Próxima fase de retención comercial y marketing recurrente', icon: '⭐' },
}

export function MainLayout() {
  const location = useLocation()
  const currentKey = Object.keys(PHASE_TITLES).find(k => location.pathname.startsWith(k)) || '/buyers'
  const current = PHASE_TITLES[currentKey]

  return (
    <div className="flex min-h-screen bg-dark-900 bg-grill-pattern">
      <Sidebar />
      {/* contenido principal — compensar el ancho del sidebar fijo (w-64) */}
      <div
        className="flex-1 flex flex-col min-w-0"
        style={{ marginLeft: '16rem' }}
      >
        {/* Top Header Bar (Stitch style) */}
        <header className="sticky top-0 z-40 flex items-center justify-between px-8 py-3.5 bg-dark-800/80 backdrop-blur-md border-b border-dark-400/80">
          <div className="flex items-center gap-3">
            <span className="text-xl">{current.icon}</span>
            <div>
              <h2 className="text-xs font-display font-bold text-arena-200 tracking-wide">
                {current.title}
              </h2>
              <p className="text-[10px] text-dark-300">
                {current.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-3 text-[11px] px-3 py-1.5 rounded-xl bg-dark-700/70 border border-dark-400">
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                API v1 Conectada
              </span>
              <span className="text-dark-300">|</span>
              <span className="flex items-center gap-1.5 text-blue-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                MP Sandbox 10%
              </span>
            </div>

            <a
              href="/formulario"
              target="_blank"
              rel="noreferrer"
              className="btn-primary text-xs py-1.5 px-3.5"
            >
              🔥 Abrir Formulario Lead
            </a>
          </div>
        </header>

        <main className="flex-1 p-6 xl:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

