import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

const ROLES_KEY = "roles";

function normRole(v: any) {
  const r = String(v ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_")
    .replace(/__+/g, "_");

  // ✅ alias fuerte: CONTROL DE FLOTA => CONTROL_FLOTA
  if (r === "CONTROL_DE_FLOTA") return "CONTROL_FLOTA";

  return r;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || [];

    if (!requiredRoles.length) return true;

    const req = context.switchToHttp().getRequest();
    const user = req?.user ?? null;

    const userRole = normRole(user?.role);
    const required = requiredRoles.map(normRole);

    // eslint-disable-next-line no-console
    console.log("[RolesGuard] required:", required, "| userRole:", userRole, "| rawUser:", user);

    if (!userRole) throw new ForbiddenException("No tienes permisos.");

    const ok = required.includes(userRole);
    if (!ok) throw new ForbiddenException("No tienes permisos.");

    return true;
  }
}
