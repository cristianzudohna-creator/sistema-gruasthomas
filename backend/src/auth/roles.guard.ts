import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { normRole } from "../common/utils/norm-role";

const ROLES_KEY = "roles";

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
    const required = requiredRoles.map(normRole);

    // eslint-disable-next-line no-console
    console.log("[RolesGuard] required:", required, "| userRole:", userRole, "| rawUser:", user);

    if (!userRole) {
      throw new ForbiddenException(
        `No tienes permisos (sin rol). required=${required.join(",")}`
      );
    }

    if (!required.includes(userRole)) {
      throw new ForbiddenException(
        `No tienes permisos. role=${userRole} required=${required.join(",")}`
      );
    }

    return true;
  }
}
