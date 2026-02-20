// ✅ Archivo: src/auth/auth.service.ts (COMPLETO)
// ✅ Login por RUT + password
// ✅ Forzar cambio de clave cuando mustChangePassword = true
// ✅ Auditoría: LOGIN, CHANGE PASSWORD, FORGOT, RESET

import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { randomBytes } from "crypto";

import { UsersService } from "../users/users.service";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";

import { AuditService } from "../audit/audit.service";
import { AuditAction, AuditEntity } from "@prisma/client";

type SafeActor = { id: string; email: string } | null;

function safeActorFromUser(user: any): SafeActor {
  if (!user?.id || !user?.email) return null;
  return { id: String(user.id), email: String(user.email) };
}

function pickIp(req?: any): string | null {
  if (!req) return null;

  const xf = req.headers?.["x-forwarded-for"];
  if (typeof xf === "string" && xf.trim()) return xf.split(",")[0].trim();

  const ip =
    req.ip ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    null;

  return ip ? String(ip) : null;
}

function pickUserAgent(req?: any): string | null {
  const ua = req?.headers?.["user-agent"];
  return ua ? String(ua) : null;
}

function normalizeRut(input: any): string {
  return String(input ?? "")
    .trim()
    .toUpperCase()
    .replace(/\./g, "")
    .replace(/-/g, "")
    .replace(/\s+/g, "");
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
    private mailService: MailService,
    private audit: AuditService
  ) {}

  // ✅ Login por RUT
  async login(rut: string, password: string, req?: any) {
    const cleanRut = normalizeRut(rut);
    const cleanPass = String(password || "");

    if (!cleanRut) throw new UnauthorizedException("Credenciales inválidas");

    const user = await this.usersService.findByRut(cleanRut);

    if (!user || !user.activo) {
      throw new UnauthorizedException("Credenciales inválidas");
    }

    const ok = await bcrypt.compare(cleanPass, user.password);
    if (!ok) {
      throw new UnauthorizedException("Credenciales inválidas");
    }

    const mustChangePassword = !!(user as any).mustChangePassword;

    // ✅ incluir empresa en JWT (y opcional el flag si quieres)
    const payload: any = {
      sub: user.id,
      role: user.role,
      email: user.email,
      rut: (user as any).rut ?? null,
      empresa: (user as any).empresa ?? null,
      mustChangePassword, // opcional
    };

    const access_token = await this.jwtService.signAsync(payload);

    // ✅ AUDIT: Login exitoso
    try {
      await this.audit.log({
        entity: AuditEntity.USER,
        entityId: user.id,
        action: AuditAction.LOGIN,
        actorId: user.id,
        actorEmail: user.email,
        ip: pickIp(req),
        userAgent: pickUserAgent(req),
        meta: {
          title: "Login exitoso",
          kind: "AUTH_LOGIN",
          targetLabel: (user as any).rut ?? user.email,
          user: {
            id: user.id,
            email: user.email,
            rut: (user as any).rut ?? null,
            role: user.role,
            empresa: (user as any).empresa ?? null,
          },
          mustChangePassword,
        },
      });
    } catch {}

    return {
      access_token,
      mustChangePassword, // ✅ CLAVE: el frontend lo usa para obligar cambio
      user: {
        id: user.id,
        email: user.email,
        rut: (user as any).rut ?? null,
        nombre: user.nombre,
        apellido: user.apellido,
        role: user.role,
        empresa: (user as any).empresa ?? null,
        mustChangePassword,
      },
    };
  }

  // ✅ Cambiar contraseña (usuario logueado)
  // ✅ Al cambiarla, se apaga mustChangePassword
  async changePassword(
    userId: string,
    dto: { currentPassword: string; newPassword: string }
  ) {
    if (!userId) throw new UnauthorizedException("No autorizado");

    const currentPassword = String(dto?.currentPassword || "");
    const newPassword = String(dto?.newPassword || "");

    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException(
        "La nueva contraseña debe tener al menos 8 caracteres"
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        rut: true as any,
        password: true,
        activo: true,
        role: true,
        empresa: true as any,
        mustChangePassword: true as any,
      },
    });

    if (!user || !user.activo) throw new UnauthorizedException("No autorizado");

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) throw new BadRequestException("Contraseña actual incorrecta");

    const same = await bcrypt.compare(newPassword, user.password);
    if (same) {
      throw new BadRequestException(
        "La nueva contraseña no puede ser igual a la actual"
      );
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        mustChangePassword: false, // ✅ apaga el bloqueo
        passwordResetAt: null as any, // opcional (si existe en prisma)
      } as any,
    });

    // ✅ AUDIT: cambio contraseña (sin guardar password)
    try {
      await this.audit.log({
        entity: AuditEntity.USER,
        entityId: user.id,
        action: AuditAction.UPDATE,
        actor: safeActorFromUser(user),
        meta: {
          title: "Cambió su contraseña",
          kind: "AUTH_CHANGE_PASSWORD",
          targetLabel: (user as any).rut ?? user.email,
        },
      });
    } catch {}

    return { message: "Contraseña actualizada correctamente" };
  }

  // ✅ OLVIDÉ MI CONTRASEÑA (por email) - puedes dejarlo o desactivarlo
  async forgotPassword(email: string) {
    const cleanEmail = String(email || "").toLowerCase().trim();

    const user = await this.prisma.user.findUnique({
      where: { email: cleanEmail },
      select: { id: true, email: true, rut: true as any, activo: true },
    });

    const generic = {
      message:
        "Si el correo existe, recibirás instrucciones para recuperar tu contraseña.",
    };

    if (!user || !user.activo) return generic;

    const token = randomBytes(32).toString("hex");
    const tokenHash = await bcrypt.hash(token, 10);

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const createdTokenRow = await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
      select: { id: true, expiresAt: true },
    });

    const frontend = process.env.FRONTEND_URL || "http://localhost:5173";
    const resetUrl = `${frontend}/reset-password?token=${token}`;

    await this.mailService.sendResetPasswordEmail(user.email, resetUrl);

    try {
      await this.audit.log({
        entity: AuditEntity.USER,
        entityId: user.id,
        action: AuditAction.UPDATE,
        actor: safeActorFromUser(user),
        meta: {
          title: "Solicitó recuperación de contraseña",
          kind: "AUTH_FORGOT_PASSWORD",
          targetLabel: (user as any).rut ?? user.email,
          reset: {
            tokenId: createdTokenRow.id,
            expiresAt: createdTokenRow.expiresAt,
          },
        },
      });
    } catch {}

    return generic;
  }

  // ✅ RESET PASSWORD (token + newPassword)
  async resetPassword(token: string, newPassword: string) {
    const cleanToken = String(token || "").trim();
    const cleanNew = String(newPassword || "");

    if (!cleanToken) throw new BadRequestException("Token requerido");
    if (!cleanNew || cleanNew.length < 8) {
      throw new BadRequestException(
        "La nueva contraseña debe tener al menos 8 caracteres"
      );
    }

    const candidates = await this.prisma.passwordResetToken.findMany({
      where: { usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, userId: true, tokenHash: true },
    });

    let match: { id: string; userId: string } | null = null;

    for (const t of candidates) {
      const ok = await bcrypt.compare(cleanToken, t.tokenHash);
      if (ok) {
        match = { id: t.id, userId: t.userId };
        break;
      }
    }

    if (!match) throw new BadRequestException("Token inválido o expirado");

    const user = await this.prisma.user.findUnique({
      where: { id: match.userId },
      select: { id: true, email: true, rut: true as any, activo: true },
    });

    const hashed = await bcrypt.hash(cleanNew, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: match.userId },
        data: {
          password: hashed,
          mustChangePassword: false, // ✅ si venía forzado, se apaga
          passwordResetAt: null as any,
        } as any,
      }),
      this.prisma.passwordResetToken.update({
        where: { id: match.id },
        data: { usedAt: new Date() },
      }),
    ]);

    // ✅ AUDIT: reset completado (arregla TS5076)
    try {
      await this.audit.log({
        entity: AuditEntity.USER,
        entityId: match.userId,
        action: AuditAction.UPDATE,
        actor: safeActorFromUser(user),
        meta: {
          title: "Restableció contraseña con token",
          kind: "AUTH_RESET_PASSWORD",
          targetLabel: (((user as any)?.rut ?? user?.email) || match.userId) as any,
          reset: { tokenId: match.id },
        },
      });
    } catch {}

    return { message: "Contraseña restablecida correctamente" };
  }
}










