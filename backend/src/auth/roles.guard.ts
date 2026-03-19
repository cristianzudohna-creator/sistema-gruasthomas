import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { normRole } from "../common/utils/norm-role";

const ROLES_KEY = "roles";

function norm(value: any) {
  return String(value || "").trim().toUpperCase();
}

function getWorkerType(user: any) {
  return norm(
    user?.workerType ||
      user?.tipoTrabajador ||
      user?.worker_type ||
      user?.tipo_trabajador ||
      user?.cargo ||
      user?.type
  );
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  private pickRole(user: any) {
    return (
      normRole(user?.role) ||
      normRole(user?.rol) ||
      normRole(user?.perfil) ||
      normRole(user?.tipo) ||
      normRole(user?.userRole)
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || [];

    if (!requiredRoles.length) return true;

    const req = context.switchToHttp().getRequest();
    const user = req?.user ?? null;

    const userRole = this.pickRole(user);
    const workerType = getWorkerType(user);
    const required = requiredRoles.map(normRole);

    console.log("[RolesGuard]", {
      required,
      userRole,
      workerType,
    });

    if (!userRole) {
      throw new ForbiddenException(
        `No tienes permisos (sin rol). required=${required.join(",")}`
      );
    }

    // ✅ SUPERADMIN siempre pasa
    if (userRole === "SUPERADMIN") return true;

    // 🔥 FIX CLAVE: permitir JEFE_TALLER en módulos admin
    if (
      userRole === "TRABAJADOR" &&
      workerType === "JEFE_TALLER" &&
      required.includes("SUPERADMIN")
    ) {
      return true;
    }

    if (!required.includes(userRole)) {
      throw new ForbiddenException(
        `No tienes permisos. role=${userRole} required=${required.join(",")}`
      );
    }

    return true;
  }
}