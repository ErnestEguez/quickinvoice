import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { Dashboard } from './pages/Dashboard'
import { MesaGrid } from './pages/MesaGrid'
import { OrderTake } from './pages/OrderTake'
import { InvoicingPage } from './pages/InvoicingPage'
import { OrdersPage } from './pages/OrdersPage'
import { ProductsPage } from './pages/ProductsPage'
import { ClientsPage } from './pages/ClientsPage'
import { InvoicePrint } from './pages/InvoicePrint'
import { TicketPrint } from './pages/TicketPrint'
import { KitchenOrderPrint } from './pages/KitchenOrderPrint'
import { ConfigurationPage } from './pages/ConfigurationPage'
import { ProveedoresPage } from './pages/ProveedoresPage'
import { InventarioPage } from './pages/InventarioPage'
import { KardexPage } from './pages/KardexPage'
import { ProtectedRoute as RoleProtectedRoute } from './components/ProtectedRoute'

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}


function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route path="/" element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/mesas" element={
            <ProtectedRoute>
              <Layout>
                <MesaGrid />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/mesas/:mesaId/pedido" element={
            <ProtectedRoute>
              <Layout>
                <OrderTake />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/pedidos" element={
            <ProtectedRoute>
              <Layout>
                <OrdersPage />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/productos" element={
            <ProtectedRoute>
              <Layout>
                <ProductsPage />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/clientes" element={
            <ProtectedRoute>
              <Layout>
                <ClientsPage />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/facturacion" element={
            <ProtectedRoute>
              <Layout>
                <InvoicingPage />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/configuracion" element={
            <ProtectedRoute>
              <Layout>
                <ConfigurationPage />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/proveedores" element={
            <ProtectedRoute>
              <RoleProtectedRoute allowedRoles={['oficina']}>
                <Layout>
                  <ProveedoresPage />
                </Layout>
              </RoleProtectedRoute>
            </ProtectedRoute>
          } />

          <Route path="/inventario" element={
            <ProtectedRoute>
              <RoleProtectedRoute allowedRoles={['oficina']}>
                <Layout>
                  <InventarioPage />
                </Layout>
              </RoleProtectedRoute>
            </ProtectedRoute>
          } />

          <Route path="/kardex" element={
            <ProtectedRoute>
              <RoleProtectedRoute allowedRoles={['oficina']}>
                <Layout>
                  <KardexPage />
                </Layout>
              </RoleProtectedRoute>
            </ProtectedRoute>
          } />

          <Route path="/comprobante/:id/print" element={
            <ProtectedRoute>
              <InvoicePrint />
            </ProtectedRoute>
          } />

          <Route path="/comprobante/:id/ticket" element={
            <ProtectedRoute>
              <TicketPrint />
            </ProtectedRoute>
          } />

          <Route path="/pedido/:id/kitchen" element={
            <ProtectedRoute>
              <KitchenOrderPrint />
            </ProtectedRoute>
          } />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
