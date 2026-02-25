import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "./roles.decorator";

/**
 * Normaliza roles para que calcen siempre con @Roles(...)
 * - "control de flota" -> "CONTROL_FLOTA"
 * - "CONTROL-FLOTA" -> "CONTROL_FLOTA"
 * - múltiples espacios -> "_"
 */
function norm(role: any) {
  const r = String(role || "").trim().toUpperCase();

  const base = r
    .replace(/[\s-]+/g, "_") // espacios/guiones => _
    .replace(/_+/g, "_")     // colapsa ____
    .replace(/^_+|_+$/g, ""); // quita _ al inicio/fin

  const ALIAS: Record<string, string> = {
    CONTROL_DE_FLOTA: "CONTROL_FLOTA",
    CONTROL_FLOTA: "CONTROL_FLOTA",

    SUPER_ADMIN: "SUPERADMIN",
    SUPERADMIN: "SUPERADMIN",

    ADMINISTRADORA: "ADMINISTRADORA",
    TRABAJADOR: "TRABAJADOR",
  };

  return ALIAS[base] || base;
}

// ✅ Jerarquía de roles (si un endpoint pide TRABAJADOR,
// también pasa ADMINISTRADORA/CONTROL_FLOTA/SUPERADMIN)
const ROLE_LEVEL: Record<string, number> = {
  TRABAJADOR: 1,
  ADMINISTRADORA: 2,
  CONTROL_FLOTA: 2,
  SUPERADMIN: 3,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()]
    );

    // Si no hay roles requeridos, pasa
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user;

    const userRole = norm(user?.role);
    if (!userRole) throw new ForbiddenException("No tienes permisos.");

    const required = requiredRoles.map(norm);

    // ✅ Match directo
    if (required.includes(userRole)) return true;

    // ✅ Match por jerarquía
    const userLevel = ROLE_LEVEL[userRole] || 0;

    for (const r of required) {
      const requiredLevel = ROLE_LEVEL[r] || 0;
      if (requiredLevel > 0 && userLevel >= requiredLevel) return true;
    }

    throw new ForbiddenException("No tienes permisos.");
  }
}

