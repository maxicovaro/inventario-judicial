import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "../pages/Login";
import Dashboard from "../pages/Dashboard";
import Activos from "../pages/Activos";
import Insumos from "../pages/Insumos";
import Solicitudes from "../pages/Solicitudes";
import PrivateRoute from "../components/PrivateRoute";
import MovimientosStock from "../pages/MovimientosStock";
import Notificaciones from "../pages/Notificaciones";
import Adjuntos from "../pages/Adjuntos";
import PedidoMensual from "../pages/PedidoMensual";
import HistorialPedidos from "../pages/HistorialPedidos";

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
          path="/insumos"
          element={
            <PrivateRoute>
              <Insumos />
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
          path="/movimientos-stock"
          element={
            <PrivateRoute>
              <MovimientosStock />
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
      </Routes>
    </BrowserRouter>
  );
}