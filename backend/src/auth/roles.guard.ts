import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "./roles.decorator";

function norm(role: any) {
  return String(role || "").trim().toUpperCase();
}

// ✅ Jerarquía de roles
// SUPERADMIN puede hacer lo de ADMIN y TRABAJADOR
// ADMIN puede hacer lo de TRABAJADOR
const ROLE_LEVEL: Record<string, number> = {
  TRABAJADOR: 1,
  ADMIN: 2,
  SUPERADMIN: 3,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si no hay roles requeridos, pasa
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user;

    const userRole = norm(user?.role);
    if (!userRole) throw new ForbiddenException("No tienes permisos.");

    // ✅ Normalizamos roles requeridos
    const required = requiredRoles.map(norm);

    // ✅ Match directo
    if (required.includes(userRole)) return true;

    // ✅ Match por jerarquía:
    // si el endpoint pide ADMIN, SUPERADMIN también pasa
    const userLevel = ROLE_LEVEL[userRole] || 0;

    for (const r of required) {
      const requiredLevel = ROLE_LEVEL[r] || 0;
      if (userLevel >= requiredLevel && requiredLevel > 0) return true;
    }

    throw new ForbiddenException("No tienes permisos.");
  }
}

