import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { useEffect } from "react";
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

import WorkshopTasksWorker from "./pages/WorkshopTasksWorker";
import WorkshopMyTasks from "./pages/WorkshopMyTasks";

import WorkshopMaintenance from "./pages/WorkshopMaintenance";
import WorkshopMaintenanceManager from "./pages/WorkshopMaintenanceManager";
import MyWorkshopMaintenances from "./pages/MyWorkshopMaintenances";

import ExtraHours from "./pages/ExtraHours";
import AdminExtraHours from "./pages/AdminExtraHours";

import WorkshopSuppliesRequest from "./pages/WorkshopSuppliesRequest";
import PreventionSupplies from "./pages/PreventionSupplies";
import VehicleFailureReportsCreate from "./pages/VehicleFailureReportsCreate";

import { onMessage } from "firebase/messaging";
import { getMessagingInstance } from "./firebase";

function NotificationListener() {
  const navigate = useNavigate();

  useEffect(() => {
    let unsubscribe = null;

    const initForegroundNotifications = async () => {
      try {
        const messaging = await getMessagingInstance();
        if (!messaging) return;

        unsubscribe = onMessage(messaging, (payload) => {
          const rawUrl = payload?.data?.url || payload?.fcmOptions?.link || "";
          const finalUrl = String(rawUrl || "").trim();

          if (!finalUrl) return;

          try {
            const urlObj =
              finalUrl.startsWith("http://") || finalUrl.startsWith("https://")
                ? new URL(finalUrl)
                : new URL(finalUrl, window.location.origin);

            if (urlObj.origin !== window.location.origin) return;

            const pathToNavigate =
              `${urlObj.pathname}${urlObj.search}${urlObj.hash}`.trim();

            if (pathToNavigate) navigate(pathToNavigate);
          } catch (error) {
            console.error("❌ Error resolviendo URL de notificación:", error);
          }
        });
      } catch (error) {
        console.error("❌ Error configurando onMessage:", error);
      }
    };

    initForegroundNotifications();

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [navigate]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <NotificationListener />

      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />

        <Route
          path="/cambiar-contrasena"
          element={
            <ProtectedRoute>
              <ChangePassword />
            </ProtectedRoute>
          }
        />

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
            path="mantenimiento-taller"
            element={
              <ProtectedRoute role={["CONTROL_FLOTA", "SUPERADMIN"]}>
                <WorkshopMaintenance />
              </ProtectedRoute>
            }
          />

          <Route
            path="gestionar-mantenciones"
            element={
              <ProtectedRoute role={["SUPERADMIN", "TRABAJADOR"]}>
                <WorkshopMaintenanceManager />
              </ProtectedRoute>
            }
          />

          <Route
            path="firmar-mantenciones"
            element={
              <ProtectedRoute role={["ADMINISTRADORA", "SUPERADMIN"]}>
                <WorkshopMaintenance />
              </ProtectedRoute>
            }
          />

          <Route
            path="incidentes"
            element={
              <ProtectedRoute
                role={["CONTROL_FLOTA", "SUPERADMIN", "TRABAJADOR"]}
              >
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
            path="solicitud-insumos"
            element={
              <ProtectedRoute role={["SUPERADMIN", "TRABAJADOR"]}>
                <WorkshopSuppliesRequest />
              </ProtectedRoute>
            }
          />

          <Route
            path="prevencion-insumos"
            element={
              <ProtectedRoute role={["SUPERADMIN"]}>
                <PreventionSupplies />
              </ProtectedRoute>
            }
          />

          <Route
            path="reportes-fallas-vehiculos/nuevo"
            element={
              <ProtectedRoute role={["CONTROL_FLOTA", "SUPERADMIN"]}>
                <VehicleFailureReportsCreate />
              </ProtectedRoute>
            }
          />

          <Route
            path="clientes"
            element={
              <ProtectedRoute role={["SUPERADMIN", "ADMINISTRADORA"]}>
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

          <Route
            path="horas-extras-admin"
            element={
              <ProtectedRoute role={["ADMINISTRADORA", "SUPERADMIN"]}>
                <AdminExtraHours />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route
          path="/trabajador"
          element={
            <ProtectedRoute role={["TRABAJADOR"]}>
              <PortalTrabajador />
            </ProtectedRoute>
          }
        />

        <Route path="/trabajador/horometro" element={<Navigate to="/trabajador" replace />} />

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

        <Route
          path="/trabajador/gestionar-mantenciones"
          element={
            <ProtectedRoute role={["TRABAJADOR"]}>
              <WorkshopMaintenanceManager />
            </ProtectedRoute>
          }
        />

        <Route
          path="/trabajador/mis-mantenciones"
          element={
            <ProtectedRoute role={["TRABAJADOR"]}>
              <MyWorkshopMaintenances />
            </ProtectedRoute>
          }
        />

        <Route
          path="/trabajador/horas-extras"
          element={
            <ProtectedRoute role={["TRABAJADOR"]}>
              <ExtraHours />
            </ProtectedRoute>
          }
        />

        <Route
          path="/trabajador/prevencion-insumos"
          element={
            <ProtectedRoute role={["TRABAJADOR"]}>
              <PreventionSupplies />
            </ProtectedRoute>
          }
        />

        <Route path="/olvide-contrasena" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}












