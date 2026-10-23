import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MainLayout } from '@/components/layout/MainLayout'

// Buyers
import DashboardMarketing from '@/pages/buyers/DashboardMarketing'
import FormularioCaptacion from '@/pages/buyers/FormularioCaptacion'

// Leads
import NegociacionPage from '@/pages/leads/NegociacionPage'
import LeadsPage from '@/pages/leads/LeadsPage'

// Payers
import PayersPage from '@/pages/payers/PayersPage'

// Customers
import CustomersPage from '@/pages/customers/CustomersPage'

// Turned — placeholder
import { PlaceholderPage } from '@/components/ui/PlaceholderPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Ruta pública — sin layout */}
          <Route path="/formulario" element={<FormularioCaptacion />} />

          {/* Layout principal con sidebar */}
          <Route element={<MainLayout />}>
            <Route index element={<Navigate to="/buyers" replace />} />

            {/* ── BUYERS ──────────────────────────────── */}
            <Route path="/buyers" element={<DashboardMarketing />} />

            {/* ── LEADS ───────────────────────────────── */}
            <Route path="/leads" element={<LeadsPage />} />
            <Route path="/leads/:idLead/negociacion" element={<NegociacionPage />} />

            {/* ── PAYERS ──────────────────────────────── */}
            <Route path="/payers" element={<PayersPage />} />

            {/* ── CUSTOMERS ───────────────────────────── */}
            <Route path="/customers" element={<CustomersPage />} />

            {/* ── TURNED (placeholder visual) ─────────── */}
            <Route
              path="/turned"
              element={
                <PlaceholderPage
                  phase="TURNED"
                  emoji="⭐"
                  description="Fidelización y recuperación de clientes. Los mejores Customers se convierten en embajadores de la marca."
                  comingSoon
                />
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
