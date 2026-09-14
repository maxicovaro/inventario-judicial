import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "../pages/Login";
import PrivateRoute from "../components/PrivateRoute";

const Dashboard = lazy(() => import("../pages/Dashboard"));
const Activos = lazy(() => import("../pages/Activos"));
const Insumos = lazy(() => import("../pages/Insumos"));
const Solicitudes = lazy(() => import("../pages/Solicitudes"));
const MovimientosStock = lazy(() => import("../pages/MovimientosStock"));
const Notificaciones = lazy(() => import("../pages/Notificaciones"));
const Adjuntos = lazy(() => import("../pages/Adjuntos"));
const PedidoMensual = lazy(() => import("../pages/PedidoMensual"));
const HistorialPedidos = lazy(() => import("../pages/HistorialPedidos"));
const ReportePedidos = lazy(() => import("../pages/ReportePedidos"));
const Usuarios = lazy(() => import("../pages/Usuarios"));
const Bitacora = lazy(() => import("../pages/Bitacora"));
const StockOficina = lazy(() => import("../pages/StockOficina"));
const ConsumoOficina = lazy(() => import("../pages/ConsumoOficina"));
const ReporteConsumoOficina = lazy(() => import("../pages/ReporteConsumoOficina"));
const DepositoActivos = lazy(() => import("../pages/DepositoActivos"));
const DepositoInsumos = lazy(() => import("../pages/DepositoInsumos"));
const DepositoSolicitudes = lazy(() => import("../pages/DepositoSolicitudes"));
const DepositoPedidos = lazy(() => import("../pages/DepositoPedidos"));
const DepositoAuditoria = lazy(() => import("../pages/DepositoAuditoria"));

function RouteFallback() {
  return (
    <div className="ui-empty-state" role="status" aria-live="polite">
      <p className="ui-empty-state-title">Cargando pantalla…</p>
    </div>
  );
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Login />} />

          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />

          <Route
            path="/activos"
            element={
              <PrivateRoute>
                <Activos />
              </PrivateRoute>
            }
          />

          <Route
            path="/solicitudes"
            element={
              <PrivateRoute>
                <Solicitudes />
              </PrivateRoute>
            }
          />

          <Route
            path="/notificaciones"
            element={
              <PrivateRoute>
                <Notificaciones />
              </PrivateRoute>
            }
          />

          <Route
            path="/adjuntos"
            element={
              <PrivateRoute>
                <Adjuntos />
              </PrivateRoute>
            }
          />

          <Route
            path="/pedido-mensual"
            element={
              <PrivateRoute>
                <PedidoMensual />
              </PrivateRoute>
            }
          />

          <Route
            path="/historial-pedidos"
            element={
              <PrivateRoute>
                <HistorialPedidos />
              </PrivateRoute>
            }
          />

          <Route
            path="/reportes-pedidos"
            element={
              <PrivateRoute rolesPermitidos={["ADMIN"]}>
                <ReportePedidos />
              </PrivateRoute>
            }
          />

          <Route
            path="/stock-oficina"
            element={
              <PrivateRoute>
                <StockOficina />
              </PrivateRoute>
            }
          />

          <Route
            path="/consumo-oficina"
            element={
              <PrivateRoute>
                <ConsumoOficina />
              </PrivateRoute>
            }
          />

          <Route
            path="/reporte-consumo-oficina"
            element={
              <PrivateRoute>
                <ReporteConsumoOficina />
              </PrivateRoute>
            }
          />

          <Route
            path="/deposito-central"
            element={<Navigate to="/deposito-central/activos" replace />}
          />

          <Route
            path="/deposito-central/activos"
            element={
              <PrivateRoute requiereGestionDeposito>
                <DepositoActivos />
              </PrivateRoute>
            }
          />

          <Route
            path="/deposito-central/insumos"
            element={
              <PrivateRoute requiereGestionDeposito>
                <DepositoInsumos />
              </PrivateRoute>
            }
          />

          <Route
            path="/deposito-central/solicitudes"
            element={
              <PrivateRoute requiereGestionDeposito>
                <DepositoSolicitudes />
              </PrivateRoute>
            }
          />

          <Route
            path="/deposito-central/pedidos"
            element={
              <PrivateRoute requiereGestionDeposito>
                <DepositoPedidos />
              </PrivateRoute>
            }
          />

          <Route
            path="/deposito-central/auditoria"
            element={
              <PrivateRoute requiereGestionDeposito>
                <DepositoAuditoria />
              </PrivateRoute>
            }
          />

          {/* RUTAS SOLO DIRECCIÓN DE POLICÍA JUDICIAL */}
          <Route
            path="/insumos"
            element={
              <PrivateRoute rolesPermitidos={["ADMIN"]}>
                <Insumos />
              </PrivateRoute>
            }
          />

          <Route
            path="/movimientos-stock"
            element={
              <PrivateRoute rolesPermitidos={["ADMIN"]}>
                <MovimientosStock />
              </PrivateRoute>
            }
          />

          <Route
            path="/usuarios"
            element={
              <PrivateRoute rolesPermitidos={["ADMIN"]}>
                <Usuarios />
              </PrivateRoute>
            }
          />

          <Route
            path="/bitacora"
            element={
              <PrivateRoute rolesPermitidos={["ADMIN"]}>
                <Bitacora />
              </PrivateRoute>
            }
          />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
