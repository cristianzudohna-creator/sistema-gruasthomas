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

    // deja este log mientras pruebas
    // eslint-disable-next-line no-console
    console.log("[RolesGuard] required:", required, "| userRole:", userRole, "| rawUser:", user);

    if (!userRole) throw new ForbiddenException(`No tienes permisos. [ROLES_GUARD role=${userRole} req=${required.join(",")}]`);
    if (!required.includes(userRole)) throw new ForbiddenException(`No tienes permisos. [ROLES_GUARD role=${userRole} req=${required.join(",")}]`);

    return true;
  }
}
