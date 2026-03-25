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

import Clientes from "./pages/Clientes";
import Incidents from "./pages/Incidents";
import Repuestos from "./pages/Repuestos";
import ReportIncidentWorker from "./pages/ReportIncidentWorker";
import PortalTrabajador from "./pages/PortalTrabajador";

import WorkOrdersAdmin from "./pages/WorkOrdersAdmin";
import WorkOrdersTrabajador from "./pages/WorkOrdersTrabajador";

import VehiclesDeleted from "./pages/VehiclesDeleted";
import WorkOrdersDeleted from "./pages/WorkOrdersDeleted";

// ✅ Taller
import WorkshopTasksWorker from "./pages/WorkshopTasksWorker";
import WorkshopMyTasks from "./pages/WorkshopMyTasks";

// ✅ Horas Extras (trabajador / jefe)
import ExtraHours from "./pages/ExtraHours";

// ✅ NUEVO: ADMINISTRADORA
import AdminExtraHours from "./pages/AdminExtraHours";

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
            <ProtectedRoute
              role={[
                "CONTROL_FLOTA",
                "ADMINISTRADORA",
                "SUPERADMIN",
                "TRABAJADOR",
              ]}
            >
              <Admin />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="camiones" replace />} />

          <Route
            path="camiones"
            element={
              <ProtectedRoute role={["CONTROL_FLOTA", "SUPERADMIN"]}>
                <Camiones />
              </ProtectedRoute>
            }
          />

          <Route
            path="camiones-eliminados"
            element={
              <ProtectedRoute role={["SUPERADMIN"]}>
                <VehiclesDeleted />
              </ProtectedRoute>
            }
          />

          <Route
            path="trabajadores"
            element={
              <ProtectedRoute role={["ADMINISTRADORA", "SUPERADMIN"]}>
                <Trabajador />
              </ProtectedRoute>
            }
          />

          <Route
            path="ordenes-trabajo"
            element={
              <ProtectedRoute
                role={["CONTROL_FLOTA", "ADMINISTRADORA", "SUPERADMIN"]}
              >
                <WorkOrdersAdmin />
              </ProtectedRoute>
            }
          />

          <Route
            path="incidentes"
            element={
              <ProtectedRoute role={["CONTROL_FLOTA", "SUPERADMIN"]}>
                <Incidents />
              </ProtectedRoute>
            }
          />

          <Route
            path="repuestos"
            element={
              <ProtectedRoute role={["SUPERADMIN", "TRABAJADOR"]}>
                <Repuestos />
              </ProtectedRoute>
            }
          />

          <Route
            path="clientes"
            element={
              <ProtectedRoute role={["SUPERADMIN"]}>
                <Clientes />
              </ProtectedRoute>
            }
          />

          <Route
            path="ordenes-trabajo-eliminadas"
            element={
              <ProtectedRoute role={["SUPERADMIN"]}>
                <WorkOrdersDeleted />
              </ProtectedRoute>
            }
          />

          <Route
            path="auditoria"
            element={
              <ProtectedRoute role={["SUPERADMIN"]}>
                <Auditoria />
              </ProtectedRoute>
            }
          />

          <Route
            path="configuracion"
            element={
              <ProtectedRoute
                role={[
                  "SUPERADMIN",
                  "CONTROL_FLOTA",
                  "ADMINISTRADORA",
                  "TRABAJADOR",
                ]}
              >
                <Configuracion />
              </ProtectedRoute>
            }
          />

          {/* ================= HORAS EXTRAS ================= */}

          {/* ✅ Crear / Firmar */}
          <Route
            path="horas-extras"
            element={
              <ProtectedRoute
                role={["SUPERADMIN", "CONTROL_FLOTA", "TRABAJADOR"]}
              >
                <ExtraHours />
              </ProtectedRoute>
            }
          />

          {/* ✅ ADMINISTRADORA */}
          <Route
            path="horas-extras-admin"
            element={
              <ProtectedRoute role={["ADMINISTRADORA", "SUPERADMIN"]}>
                <AdminExtraHours />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* ================= TRABAJADOR ================= */}
        <Route
          path="/trabajador"
          element={
            <ProtectedRoute role={["TRABAJADOR"]}>
              <PortalTrabajador />
            </ProtectedRoute>
          }
        />

        <Route
          path="/trabajador/horometro"
          element={<Navigate to="/trabajador" replace />}
        />

        <Route
          path="/trabajador/ordenes-trabajo"
          element={
            <ProtectedRoute role={["TRABAJADOR"]}>
              <WorkOrdersTrabajador />
            </ProtectedRoute>
          }
        />

        <Route
          path="/trabajador/reportar-incidente"
          element={
            <ProtectedRoute role={["TRABAJADOR"]}>
              <ReportIncidentWorker />
            </ProtectedRoute>
          }
        />

        {/* Taller trabajador */}
        <Route
          path="/trabajador/tareas-taller"
          element={
            <ProtectedRoute role={["TRABAJADOR"]}>
              <WorkshopTasksWorker />
            </ProtectedRoute>
          }
        />

        <Route
          path="/trabajador/mis-tareas-taller"
          element={
            <ProtectedRoute role={["TRABAJADOR"]}>
              <WorkshopMyTasks />
            </ProtectedRoute>
          }
        />

        {/* Horas extras trabajador */}
        <Route
          path="/trabajador/horas-extras"
          element={
            <ProtectedRoute role={["TRABAJADOR"]}>
              <ExtraHours />
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














