// ✅ Archivo: backend/src/auth/jwt.strategy.ts (COMPLETO)
// ✅ Cambio mínimo recomendado: incluir rut en select (útil para auditoría/UI)
// ✅ No afecta login, solo mejora req.user

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
    // payload viene de AuthService: { sub, role, email, rut?, empresa? }
    if (!payload?.sub) throw new UnauthorizedException("Token inválido");

    // ✅ Traemos el usuario REAL desde BD (incluye empresa)
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        rut: true,     // ✅ útil
        role: true,
        activo: true,
        empresa: true, // ✅ CLAVE
      },
    });

    if (!user || !user.activo) {
      throw new UnauthorizedException("No autorizado");
    }

    // ✅ Esto queda disponible en req.user
    return user;
  }
}


