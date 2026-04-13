// ✅ Archivo: src/workshop/workshop-access.guard.ts
// ✅ COMPLETO + FIX PREVENCION + INSUMOS LIBRES
// ✅ NUEVO:
// - SUPERVISOR_TERRENO puede CREAR y VER incidentes
// - SUPERVISOR_TERRENO NO es supervisor de taller
// - SUPERVISOR_TERRENO NO puede gestionar tareas, horas extras ni solicitudes de insumos

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

function norm(value: any) {
  return String(value || '').trim().toUpperCase();
}

function getWorkerType(user: any) {
  return norm(
    user?.workerType ||
      user?.tipoTrabajador ||
      user?.worker_type ||
      user?.tipo_trabajador ||
      user?.cargo ||
      user?.type,
  );
}

function isWorkshopWorker(workerType: string) {
  return [
    'JEFE_TALLER',
    'SUPERVISOR',
    'MECANICO',
    'MECANICO_HIDRAULICO',
    'AYUDANTE_DE_MECANICO',
    'AYUDANTE_MECANICO',
  ].includes(norm(workerType));
}

function isExtraHoursWorker(workerType: string) {
  return [
    'JEFE_TALLER',
    'SUPERVISOR',
    'MECANICO',
    'MECANICO_HIDRAULICO',
    'AYUDANTE_DE_MECANICO',
    'AYUDANTE_MECANICO',
  ].includes(norm(workerType));
}

@Injectable()
export class WorkshopAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req?.user;

    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    const role = norm(
      user?.role || user?.rol || user?.perfil || user?.userRole,
    );
    const workerType = getWorkerType(user);

    const method = norm(req?.method);
    const originalUrl = String(
      req?.originalUrl || req?.url || req?.route?.path || '',
    ).toLowerCase();

    const bodyStatus = norm(req?.body?.status);

    console.log('[WorkshopAccessGuard]', {
      method,
      originalUrl,
      role,
      workerType,
      bodyStatus,
    });

    if (role === 'SUPERADMIN') return true;

    const isIncidentsRoute = originalUrl.includes('/workshop/incidents');
    const isTasksRoute = originalUrl.includes('/workshop/tasks');
    const isPartsRoute = originalUrl.includes('/workshop/parts');
    const isSuppliesRoute = originalUrl.includes('/workshop/supplies');

    const isExtraHoursRoute = originalUrl.includes('/workshop/extra-hours');
    const isExtraHoursMineRoute =
      method === 'GET' &&
      /\/workshop\/extra-hours\/mine(?:\?.*)?$/.test(originalUrl);

    const isExtraHoursJefeRoute =
      method === 'GET' &&
      /\/workshop\/extra-hours\/jefe(?:\?.*)?$/.test(originalUrl);

    const isExtraHoursAdminRoute =
      method === 'GET' &&
      /\/workshop\/extra-hours\/administracion(?:\?.*)?$/.test(originalUrl);

    const isExtraHoursPdfRoute =
      method === 'GET' &&
      /\/workshop\/extra-hours\/pdf\/[^/]+(?:\?.*)?$/.test(originalUrl);

    const isRequestedPartsRoute =
      originalUrl.includes('/workshop/tasks/requested-parts');

    const isTaskStartRoute =
      method === 'PATCH' &&
      /\/workshop\/tasks\/[^/]+\/start(?:\?.*)?$/.test(originalUrl);

    const isTaskFinishRoute =
      method === 'PATCH' &&
      /\/workshop\/tasks\/[^/]+\/finish(?:\?.*)?$/.test(originalUrl);

    const isTaskCloseRoute =
      method === 'PATCH' &&
      /\/workshop\/tasks\/[^/]+\/close(?:\?.*)?$/.test(originalUrl);

    const isTaskRequestPartRoute =
      method === 'POST' &&
      /\/workshop\/tasks\/request-part(?:\?.*)?$/.test(originalUrl);

    const isBaseTasksPostRoute =
      method === 'POST' && /\/workshop\/tasks(?:\?.*)?$/.test(originalUrl);

    const isBaseTasksPatchRoute =
      method === 'PATCH' &&
      /\/workshop\/tasks\/[^/]+(?:\?.*)?$/.test(originalUrl);

    // ✅ INSUMOS LIBRES
    const isSupplyRequestRoute =
      method === 'POST' &&
      /\/workshop\/supplies\/request(?:\?.*)?$/.test(originalUrl);

    const isSupplyListRoute =
      method === 'GET' &&
      /\/workshop\/supplies(?:\?.*)?$/.test(originalUrl);

    const isSupplyPurchaseRoute =
      method === 'PATCH' &&
      /\/workshop\/supplies\/[^/]+\/purchase(?:\?.*)?$/.test(originalUrl);

    const isSupplyCancelRoute =
      method === 'PATCH' &&
      /\/workshop\/supplies\/[^/]+\/cancel(?:\?.*)?$/.test(originalUrl);

    const isAdquisiciones =
      role === 'TRABAJADOR' && workerType === 'ADQUISICIONES';

    const isJefeTaller =
      role === 'TRABAJADOR' &&
      (workerType === 'JEFE_TALLER' || workerType === 'SUPERVISOR');

    const isControlFlota = role === 'CONTROL_FLOTA';
    const isAdministradora = role === 'ADMINISTRADORA';

    const isPrevencion =
      role === 'TRABAJADOR' && workerType === 'PREVENCION';

    const isSupervisorTerreno =
      role === 'TRABAJADOR' && workerType === 'SUPERVISOR_TERRENO';

    const adquisicionesAllowedStatuses = [
      'EN_COMPRA',
      'COMPRADO',
      'ENTREGADO',
    ];

    // ============================
    // HORAS EXTRAS
    // ============================

    if (isExtraHoursMineRoute) {
      if (role === 'TRABAJADOR' && isExtraHoursWorker(workerType)) {
        return true;
      }

      if (isControlFlota) {
        return true;
      }

      throw new ForbiddenException(
        'No tienes permisos para visualizar tus horas extras',
      );
    }

    if (isExtraHoursJefeRoute) {
      if (isJefeTaller || isControlFlota) {
        return true;
      }

      throw new ForbiddenException(
        'No tienes permisos para visualizar horas extras del taller',
      );
    }

    if (isExtraHoursAdminRoute) {
      if (isAdministradora) {
        return true;
      }

      throw new ForbiddenException(
        'No tienes permisos para visualizar horas extras firmadas',
      );
    }

    if (isExtraHoursPdfRoute) {
      if (isAdministradora) {
        return true;
      }

      throw new ForbiddenException(
        'No tienes permisos para descargar el PDF de horas extras',
      );
    }

    if (isExtraHoursRoute) {
      if (isControlFlota) return true;

      if (isJefeTaller) return true;

      if (role === 'TRABAJADOR' && isExtraHoursWorker(workerType)) {
        return true;
      }

      throw new ForbiddenException(
        'No tienes permisos para acceder a horas extras',
      );
    }

    // ============================
    // INCIDENTES
    // ============================

    if (method === 'POST' && isIncidentsRoute) {
      if (role === 'CONTROL_FLOTA') return true;

      if (isJefeTaller) return true;

      if (
        role === 'TRABAJADOR' &&
        (
          workerType === 'OPERADOR' ||
          workerType === 'RIGGER' ||
          workerType === 'PREVENCION' ||
          workerType === 'SUPERVISOR_TERRENO'
        )
      ) {
        return true;
      }

      throw new ForbiddenException(
        'No tienes permisos para crear incidentes',
      );
    }

    if (method === 'GET' && isIncidentsRoute) {
      if (role === 'CONTROL_FLOTA') return true;

      if (role === 'TRABAJADOR' && isWorkshopWorker(workerType)) {
        return true;
      }

      if (isPrevencion) {
        return true;
      }

      if (isSupervisorTerreno) {
        return true;
      }

      throw new ForbiddenException(
        'No tienes permisos para visualizar incidentes',
      );
    }

    if (method === 'PATCH' && isIncidentsRoute) {
      if (role === 'CONTROL_FLOTA') return true;

      if (isJefeTaller) {
        return true;
      }

      throw new ForbiddenException(
        'No tienes permisos para actualizar incidentes',
      );
    }

    if (method === 'DELETE' && isIncidentsRoute) {
      if (role === 'CONTROL_FLOTA') return true;

      if (isJefeTaller) {
        return true;
      }

      throw new ForbiddenException(
        'No tienes permisos para eliminar incidentes',
      );
    }

    // ============================
    // REPUESTOS / ADQUISICIONES
    // ============================

    if (method === 'GET' && isRequestedPartsRoute) {
      if (isAdquisiciones) return true;

      throw new ForbiddenException(
        'No tienes permisos para visualizar solicitudes de repuestos',
      );
    }

    // ============================
    // TAREAS
    // ============================

    if (isBaseTasksPostRoute) {
      if (isJefeTaller) {
        return true;
      }

      throw new ForbiddenException(
        'No tienes permisos para crear tareas de taller',
      );
    }

    if (isTaskStartRoute || isTaskFinishRoute || isTaskRequestPartRoute) {
      if (role === 'TRABAJADOR' && isWorkshopWorker(workerType)) {
        return true;
      }

      if (role === 'CONTROL_FLOTA') {
        return true;
      }

      throw new ForbiddenException(
        'No tienes permisos para ejecutar acciones de taller',
      );
    }

    if (method === 'GET' && isTasksRoute) {
      if (role === 'CONTROL_FLOTA') return true;

      if (role === 'TRABAJADOR' && isWorkshopWorker(workerType)) {
        return true;
      }

      throw new ForbiddenException(
        'No tienes permisos para visualizar tareas de taller',
      );
    }

    if (isBaseTasksPatchRoute) {
      if (role === 'CONTROL_FLOTA') return true;

      if (isJefeTaller) {
        return true;
      }

      if (isAdquisiciones) {
        if (adquisicionesAllowedStatuses.includes(bodyStatus)) {
          return true;
        }

        throw new ForbiddenException(
          'Adquisiciones solo puede actualizar estados de compra',
        );
      }

      throw new ForbiddenException(
        'No tienes permisos para actualizar tareas de taller',
      );
    }

    if (isTaskCloseRoute) {
      if (role === 'CONTROL_FLOTA') return true;

      if (isJefeTaller) {
        return true;
      }

      throw new ForbiddenException(
        'No tienes permisos para cerrar tareas de taller',
      );
    }

    if (method === 'DELETE' && isTasksRoute) {
      if (role === 'CONTROL_FLOTA') return true;

      if (isJefeTaller) {
        return true;
      }

      throw new ForbiddenException(
        'No tienes permisos para eliminar tareas de taller',
      );
    }

    // ============================
    // INSUMOS -> PREVENCION
    // ============================

    // POST /workshop/supplies/request
    // JEFE_TALLER + SUPERVISOR
    if (isSupplyRequestRoute) {
      if (isJefeTaller) {
        return true;
      }

      throw new ForbiddenException(
        'No tienes permisos para solicitar insumos',
      );
    }

    // GET /workshop/supplies
    // PREVENCION + JEFE_TALLER + SUPERVISOR + CONTROL_FLOTA
    if (isSupplyListRoute) {
      if (isPrevencion) return true;
      if (isJefeTaller) return true;
      if (isControlFlota) return true;

      throw new ForbiddenException(
        'No tienes permisos para visualizar solicitudes de insumos',
      );
    }

    // PATCH /workshop/supplies/:id/purchase
    // PREVENCION
    if (isSupplyPurchaseRoute) {
      if (isPrevencion) return true;

      throw new ForbiddenException(
        'No tienes permisos para marcar insumos como comprados',
      );
    }

    // PATCH /workshop/supplies/:id/cancel
    // JEFE_TALLER + SUPERVISOR + CONTROL_FLOTA
    if (isSupplyCancelRoute) {
      if (isJefeTaller) return true;
      if (isControlFlota) return true;

      throw new ForbiddenException(
        'No tienes permisos para cancelar solicitudes de insumos',
      );
    }

    // ============================
    // REPUESTOS ADMIN
    // ============================

    if (method === 'POST' && isPartsRoute) {
      if (role === 'CONTROL_FLOTA') return true;

      if (isJefeTaller) {
        return true;
      }

      throw new ForbiddenException(
        'No tienes permisos para agregar repuestos',
      );
    }

    if (method === 'DELETE' && isPartsRoute) {
      if (isJefeTaller) {
        return true;
      }

      throw new ForbiddenException(
        'No tienes permisos para eliminar repuestos',
      );
    }

    throw new ForbiddenException('No tienes permisos para esta acción');
  }
}