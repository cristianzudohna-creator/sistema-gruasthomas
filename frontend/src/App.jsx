import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import Trabajador from "./pages/Trabajador";
import Camiones from "./pages/Camiones";
import ChangePassword from "./pages/ChangePassword";
import ProtectedRoute from "./auth/ProtectedRoute";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Auditoria from "./pages/Auditoria";
import Configuracion from "./pages/Configuracion";

// ✅ NUEVO
import Clientes from "./pages/Clientes";

// ✅ Portal trabajador
import PortalTrabajador from "./pages/PortalTrabajador";

// ✅ Órdenes de trabajo (Admin)
import WorkOrdersAdmin from "./pages/WorkOrdersAdmin";

// ✅ Órdenes de trabajo (Trabajador)
import WorkOrdersTrabajador from "./pages/WorkOrdersTrabajador";

// ✅ Papelera de camiones (SUPERADMIN)
import VehiclesDeleted from "./pages/VehiclesDeleted";

// ✅ Papelera de OT (SUPERADMIN)
import WorkOrdersDeleted from "./pages/WorkOrdersDeleted";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Login */}
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />

        {/* Cambiar contraseña */}
        <Route
          path="/cambiar-contrasena"
          element={
            <ProtectedRoute>
              <ChangePassword />
            </ProtectedRoute>
          }
        />

        {/* ================= ADMIN ================= */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute role={["CONTROL_FLOTA", "ADMINISTRADORA", "SUPERADMIN"]}>
              <Admin />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="camiones" replace />} />

          {/* Camiones */}
          <Route
            path="camiones"
            element={
              <ProtectedRoute role={["CONTROL_FLOTA", "SUPERADMIN"]}>
                <Camiones />
              </ProtectedRoute>
            }
          />

          {/* Camiones eliminados */}
          <Route
            path="camiones-eliminados"
            element={
              <ProtectedRoute role={["SUPERADMIN"]}>
                <VehiclesDeleted />
              </ProtectedRoute>
            }
          />

          {/* Trabajadores */}
          <Route
            path="trabajadores"
            element={
              <ProtectedRoute role={["ADMINISTRADORA", "SUPERADMIN"]}>
                <Trabajador />
              </ProtectedRoute>
            }
          />

          {/* Órdenes de trabajo */}
          <Route
            path="ordenes-trabajo"
            element={
              <ProtectedRoute role={["CONTROL_FLOTA", "ADMINISTRADORA", "SUPERADMIN"]}>
                <WorkOrdersAdmin />
              </ProtectedRoute>
            }
          />

          {/* Clientes */}
          <Route
            path="clientes"
            element={
              <ProtectedRoute role={["SUPERADMIN"]}>
                <Clientes />
              </ProtectedRoute>
            }
          />

          {/* Órdenes eliminadas */}
          <Route
            path="ordenes-trabajo-eliminadas"
            element={
              <ProtectedRoute role={["SUPERADMIN"]}>
                <WorkOrdersDeleted />
              </ProtectedRoute>
            }
          />

          {/* Auditoría */}
          <Route
            path="auditoria"
            element={
              <ProtectedRoute role={["SUPERADMIN"]}>
                <Auditoria />
              </ProtectedRoute>
            }
          />

          {/* Configuración */}
          <Route
            path="configuracion"
            element={
              <ProtectedRoute role={["SUPERADMIN", "CONTROL_FLOTA", "ADMINISTRADORA"]}>
                <Configuracion />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* ================= TRABAJADOR ================= */}
        <Route
          path="/trabajador"
          element={
            <ProtectedRoute role="TRABAJADOR">
              <PortalTrabajador />
            </ProtectedRoute>
          }
        />

        {/* ✅ BLOQUEADO: si alguien pega la URL antigua, lo mandamos al portal */}
        <Route path="/trabajador/horometro" element={<Navigate to="/trabajador" replace />} />

        <Route
          path="/trabajador/ordenes-trabajo"
          element={
            <ProtectedRoute role="TRABAJADOR">
              <WorkOrdersTrabajador />
            </ProtectedRoute>
          }
        />

        {/* Recuperación contraseña */}
        <Route path="/olvide-contrasena" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}















