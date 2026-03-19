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

    const isRequestedPartsRoute =
      originalUrl.includes('/workshop/tasks/requested-parts');

    const isTaskStartRoute =
      method === 'PATCH' && /\/workshop\/tasks\/[^/]+\/start(?:\?.*)?$/.test(originalUrl);

    const isTaskFinishRoute =
      method === 'PATCH' && /\/workshop\/tasks\/[^/]+\/finish(?:\?.*)?$/.test(originalUrl);

    const isTaskCloseRoute =
      method === 'PATCH' && /\/workshop\/tasks\/[^/]+\/close(?:\?.*)?$/.test(originalUrl);

    const isTaskRequestPartRoute =
      method === 'POST' && /\/workshop\/tasks\/request-part(?:\?.*)?$/.test(originalUrl);

    const isBaseTasksPostRoute =
      method === 'POST' && /\/workshop\/tasks(?:\?.*)?$/.test(originalUrl);

    const isBaseTasksPatchRoute =
      method === 'PATCH' && /\/workshop\/tasks\/[^/]+(?:\?.*)?$/.test(originalUrl);

    const isAdquisiciones =
      role === 'TRABAJADOR' && workerType === 'ADQUISICIONES';

    const isJefeTaller =
      role === 'TRABAJADOR' && workerType === 'JEFE_TALLER';

    const adquisicionesAllowedStatuses = [
      'EN_COMPRA',
      'COMPRADO',
      'ENTREGADO',
    ];

    // ============================
    // CREAR INCIDENTE
    // POST /workshop/incidents
    // CONTROL_FLOTA + OPERADOR/RIGGER + JEFE_TALLER
    // ============================
    if (method === 'POST' && isIncidentsRoute) {
      if (role === 'CONTROL_FLOTA') return true;

      if (isJefeTaller) return true;

      if (
        role === 'TRABAJADOR' &&
        (workerType === 'OPERADOR' || workerType === 'RIGGER')
      ) {
        return true;
      }

      throw new ForbiddenException(
        'No tienes permisos para crear incidentes',
      );
    }

    // ============================
    // VER INCIDENTES
    // GET /workshop/incidents*
    // CONTROL_FLOTA + trabajadores de taller
    // ============================
    if (method === 'GET' && isIncidentsRoute) {
      if (role === 'CONTROL_FLOTA') return true;

      if (role === 'TRABAJADOR' && isWorkshopWorker(workerType)) {
        return true;
      }

      throw new ForbiddenException(
        'No tienes permisos para visualizar incidentes',
      );
    }

    // ============================
    // ACTUALIZAR / CERRAR INCIDENTE
    // PATCH /workshop/incidents*
    // CONTROL_FLOTA + JEFE_TALLER
    // ============================
    if (method === 'PATCH' && isIncidentsRoute) {
      if (role === 'CONTROL_FLOTA') return true;

      if (isJefeTaller) {
        return true;
      }

      throw new ForbiddenException(
        'No tienes permisos para actualizar incidentes',
      );
    }

    // ============================
    // ELIMINAR INCIDENTE
    // DELETE /workshop/incidents/:id
    // CONTROL_FLOTA + JEFE_TALLER
    // ============================
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
    // VER SOLICITUDES DE REPUESTO
    // GET /workshop/tasks/requested-parts
    // ADQUISICIONES
    // ============================
    if (method === 'GET' && isRequestedPartsRoute) {
      if (isAdquisiciones) return true;

      throw new ForbiddenException(
        'No tienes permisos para visualizar solicitudes de repuestos',
      );
    }

    // ============================
    // CREAR TAREA DE TALLER
    // POST /workshop/tasks
    // JEFE_TALLER
    // ============================
    if (isBaseTasksPostRoute) {
      if (isJefeTaller) {
        return true;
      }

      throw new ForbiddenException(
        'No tienes permisos para crear tareas de taller',
      );
    }

    // ============================
    // ACCIONES DE TRABAJADOR SOBRE TAREA
    // PATCH /workshop/tasks/:id/start
    // PATCH /workshop/tasks/:id/finish
    // POST  /workshop/tasks/request-part
    //
    // Trabajadores de taller
    // La validación fina de RESPONSABLE vs APOYO
    // se hace en el service.
    // ============================
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

    // ============================
    // VER TAREAS
    // GET /workshop/tasks*
    // CONTROL_FLOTA + trabajadores de taller
    // ============================
    if (method === 'GET' && isTasksRoute) {
      if (role === 'CONTROL_FLOTA') return true;

      if (role === 'TRABAJADOR' && isWorkshopWorker(workerType)) {
        return true;
      }

      throw new ForbiddenException(
        'No tienes permisos para visualizar tareas de taller',
      );
    }

    // ============================
    // ACTUALIZAR TAREA BASE
    // PATCH /workshop/tasks/:id
    // CONTROL_FLOTA + JEFE_TALLER
    // ADQUISICIONES solo para estados de compra
    // ============================
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

    // ============================
    // CERRAR TAREA POR RUTA ADMIN
    // PATCH /workshop/tasks/:id/close
    // CONTROL_FLOTA + JEFE_TALLER
    // ============================
    if (isTaskCloseRoute) {
      if (role === 'CONTROL_FLOTA') return true;

      if (isJefeTaller) {
        return true;
      }

      throw new ForbiddenException(
        'No tienes permisos para cerrar tareas de taller',
      );
    }

    // ============================
    // ELIMINAR TAREAS
    // DELETE /workshop/tasks/:id
    // CONTROL_FLOTA + JEFE_TALLER
    // ============================
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
    // AGREGAR REPUESTOS POR RUTA ADMIN
    // POST /workshop/parts
    // CONTROL_FLOTA + JEFE_TALLER
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

    // ============================
    // ELIMINAR REPUESTOS
    // DELETE /workshop/parts/:id
    // JEFE_TALLER
    // ============================
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