import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "./roles.decorator";

// Normaliza fuerte: mayúsculas, sin tildes, espacios/guiones -> _
function normalizeRole(value: any) {
  let s = String(value || "").trim();

  // quita acentos/diacríticos
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // mayúsculas
  s = s.toUpperCase();

  // convierte separadores a underscore
  s = s.replace(/[\s\-]+/g, "_");

  // colapsa underscores múltiples
  s = s.replace(/_+/g, "_");

  return s;
}

// Aliases por si en token/BD viene distinto
function roleAliases(roleNorm: string): string[] {
  const r = roleNorm;

  // ejemplo: CONTROL DE FLOTA / CONTROL-FLOTA / CONTROLFLOTA => CONTROL_FLOTA
  if (r === "CONTROL_DE_FLOTA" || r === "CONTROL_FLOTA" || r === "CONTROLFLOTA") {
    return ["CONTROL_FLOTA", "CONTROL_DE_FLOTA", "CONTROLFLOTA"];
  }

  if (r === "ADMINISTRADORA" || r === "ADMINISTRACION") {
    return ["ADMINISTRADORA", "ADMINISTRACION"];
  }

  if (r === "SUPERADMIN" || r === "SUPER_ADMIN") {
    return ["SUPERADMIN", "SUPER_ADMIN"];
  }

  return [r];
}

// Jerarquía REAL (si quieres):
// SUPERADMIN > CONTROL_FLOTA > ADMINISTRADORA > TRABAJADOR
const ROLE_LEVEL: Record<string, number> = {
  TRABAJADOR: 1,
  ADMINISTRADORA: 2,
  CONTROL_FLOTA: 3,
  SUPERADMIN: 4,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user;

    const userRoleNorm = normalizeRole(user?.role);
    if (!userRoleNorm) throw new ForbiddenException("No tienes permisos.");

    const userRoleSet = new Set(roleAliases(userRoleNorm));

    // normaliza roles requeridos + expande aliases
    const requiredNorm = requiredRoles.map(normalizeRole);
    const requiredExpanded = requiredNorm.flatMap((r) => roleAliases(r));

    // ✅ Match directo (con aliases)
    for (const r of requiredExpanded) {
      if (userRoleSet.has(r)) return true;
    }

    // ✅ Match por jerarquía
    const userLevel =
      Math.max(...Array.from(userRoleSet).map((r) => ROLE_LEVEL[r] || 0)) || 0;

    for (const reqRole of requiredExpanded) {
      const requiredLevel = ROLE_LEVEL[reqRole] || 0;
      if (requiredLevel > 0 && userLevel >= requiredLevel) return true;
    }

    throw new ForbiddenException("No tienes permisos.");
  }
}
