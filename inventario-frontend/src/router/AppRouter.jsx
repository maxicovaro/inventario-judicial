import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "../pages/Login";
import Dashboard from "../pages/Dashboard";
import Activos from "../pages/Activos";
import Insumos from "../pages/Insumos";
import Solicitudes from "../pages/Solicitudes";
import MovimientosStock from "../pages/MovimientosStock";
import Notificaciones from "../pages/Notificaciones";
import Adjuntos from "../pages/Adjuntos";
import PedidoMensual from "../pages/PedidoMensual";
import HistorialPedidos from "../pages/HistorialPedidos";
import ReportePedidos from "../pages/ReportePedidos";
import Usuarios from "../pages/Usuarios";
import Bitacora from "../pages/Bitacora";
import StockOficina from "../pages/StockOficina";
import ConsumoOficina from "../pages/ConsumoOficina";
import ReporteConsumoOficina from "../pages/ReporteConsumoOficina";

import PrivateRoute from "../components/PrivateRoute";

export default function AppRouter() {
  return (
    <BrowserRouter>
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
            <PrivateRoute>
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
    </BrowserRouter>
  );
}