// ✅ Archivo: backend/src/auth/jwt.strategy.ts (COMPLETO)
// ✅ FIX:
// - incluir workerType en select
// - dejarlo disponible en req.user para guards/permisos/UI

import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || "dev_secret",
    });
  }

  async validate(payload: any) {
    // payload viene de AuthService: { sub, role, email, rut?, empresa?, workerType? }
    if (!payload?.sub) throw new UnauthorizedException("Token inválido");

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        rut: true,
        role: true,
        activo: true,
        empresa: true,
        workerType: true, // ✅ CLAVE
      },
    });

    if (!user || !user.activo) {
      throw new UnauthorizedException("No autorizado");
    }

    // ✅ Esto queda disponible en req.user
    return user;
  }
}