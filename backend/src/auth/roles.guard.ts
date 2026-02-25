import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "./roles.decorator";

function norm(role: any) {
  let r = String(role || "").trim().toUpperCase();

  // normaliza separadores
  r = r.replace(/[-\s]+/g, "_"); // "CONTROL DE FLOTA" -> "CONTROL_DE_FLOTA"

  // aliases / mapeos
  const ALIASES: Record<string, string> = {
    CONTROL_DE_FLOTA: "CONTROL_FLOTA",
    CONTROLFLOTA: "CONTROL_FLOTA",
    CONTROL_FLOTA: "CONTROL_FLOTA",
    ADMINISTRADORA: "ADMINISTRADORA",
    SUPERADMIN: "SUPERADMIN",
  };

  return ALIASES[r] || r;
}

// Jerarquía (ajústala si quieres otra)
// SUPERADMIN > CONTROL_FLOTA > ADMINISTRADORA
const ROLE_LEVEL: Record<string, number> = {
  ADMINISTRADORA: 1,
  CONTROL_FLOTA: 2,
  SUPERADMIN: 3,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || [];

    if (requiredRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user;

    const userRole = norm(user?.role);
    if (!userRole) throw new ForbiddenException("No tienes permisos.");

    const required = requiredRoles.map(norm);

    // match directo
    if (required.includes(userRole)) return true;

    // match por jerarquía
    const userLevel = ROLE_LEVEL[userRole] || 0;
    for (const r of required) {
      const requiredLevel = ROLE_LEVEL[r] || 0;
      if (requiredLevel > 0 && userLevel >= requiredLevel) return true;
    }

    throw new ForbiddenException("No tienes permisos.");
  }
}
