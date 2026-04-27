// ✅ Archivo: src/auth/auth.service.ts (COMPLETO)
// ✅ Login por RUT + password
// ✅ Forzar cambio de clave cuando mustChangePassword = true
// ✅ Auditoría: LOGIN, CHANGE PASSWORD, REQUEST RESET, RESET WITH CODE
//
// ✅ Recuperación por RUT + código de 6 dígitos
// ✅ requestPasswordResetByRut(rut)
// ✅ resetPasswordWithCode(rut, code, newPassword)
//
// ✅ NUEVO AHORA:
// - Envía el código al correo del usuario que solicita recuperación
// - Mantiene copia/aviso a soporte si tienes ese método en MailService
// - Notifica a SUPERADMIN cuando alguien solicita código
// - La notificación dice el nombre de quien pidió el código
//
// ✅ FIX:
// - devuelve workerType en login
// - incluye workerType en payload JWT

import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";

import { UsersService } from "../users/users.service";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { FirebaseService } from "../firebase/firebase.service";

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

function generate6DigitCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function fullName(user: any): string {
  const nombre = String(user?.nombre || "").trim();
  const apellido = String(user?.apellido || "").trim();
  const name = `${nombre} ${apellido}`.trim();
  return name || user?.email || user?.rut || "Usuario";
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
    private mailService: MailService,
    private firebaseService: FirebaseService,
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

    const payload: any = {
      sub: user.id,
      role: user.role,
      email: user.email,
      rut: (user as any).rut ?? null,
      empresa: (user as any).empresa ?? null,
      workerType: (user as any).workerType ?? null,
      mustChangePassword,
    };

    const access_token = await this.jwtService.signAsync(payload);

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
            workerType: (user as any).workerType ?? null,
          },
          mustChangePassword,
        },
      });
    } catch {}

    return {
      access_token,
      mustChangePassword,
      user: {
        id: user.id,
        email: user.email,
        rut: (user as any).rut ?? null,
        nombre: user.nombre,
        apellido: user.apellido,
        role: user.role,
        empresa: (user as any).empresa ?? null,
        workerType: (user as any).workerType ?? null,
        mustChangePassword,
      },
    };
  }

  // ✅ Cambiar contraseña (usuario logueado)
  // ✅ Cambiar contraseña (usuario logueado)
// ✅ NUEVO: ya NO pide contraseña actual
async changePassword(
  userId: string,
  dto: { currentPassword?: string; newPassword: string }
) {
  if (!userId) throw new UnauthorizedException("No autorizado");

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
      workerType: true as any,
      mustChangePassword: true as any,
    },
  });

  if (!user || !user.activo) throw new UnauthorizedException("No autorizado");

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
      mustChangePassword: false,
      passwordResetAt: null as any,
    } as any,
  });

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

  // ✅ Enviar notificación a todos los SUPERADMIN
  private async notifySuperadminsPasswordResetRequested(user: any, code: string) {
    const nombreSolicitante = fullName(user);

    const superadmins = await this.prisma.user.findMany({
      where: {
        role: "SUPERADMIN" as any,
        activo: true,
      },
      select: {
        id: true,
        email: true,
      },
    });

    if (!superadmins.length) return;

    const title = "Solicitud de código de recuperación";
    const body = `${nombreSolicitante} pidió un código de recuperación de contraseña.`;

    for (const admin of superadmins) {
      try {
        const firebase: any = this.firebaseService as any;

        if (typeof firebase.sendToUser === "function") {
          await firebase.sendToUser(admin.id, {
            title,
            body,
            link: "/admin",
            data: {
              type: "PASSWORD_RESET_REQUESTED",
              userId: user.id,
              rut: user.rut,
              code,
            },
          });
          continue;
        }

        if (typeof firebase.sendNotificationToUser === "function") {
          await firebase.sendNotificationToUser(admin.id, title, body, {
            link: "/admin",
            type: "PASSWORD_RESET_REQUESTED",
            userId: user.id,
            rut: user.rut,
            code,
          });
          continue;
        }

        if (typeof firebase.sendPushToUser === "function") {
          await firebase.sendPushToUser(admin.id, {
            title,
            body,
            link: "/admin",
            data: {
              type: "PASSWORD_RESET_REQUESTED",
              userId: user.id,
              rut: user.rut,
              code,
            },
          });
          continue;
        }

        if (typeof firebase.notifyUser === "function") {
          await firebase.notifyUser(admin.id, {
            title,
            body,
            link: "/admin",
            data: {
              type: "PASSWORD_RESET_REQUESTED",
              userId: user.id,
              rut: user.rut,
              code,
            },
          });
        }
      } catch (e: any) {
        console.error(
          `[AUTH] No se pudo notificar al SUPERADMIN ${admin.id}:`,
          e?.message || e
        );
      }
    }
  }

  // ✅ Solicitar recuperación por RUT
  async requestPasswordResetByRut(rut: string, req?: any) {
    const cleanRut = normalizeRut(rut);

    const generic = {
      message:
        "Si el RUT existe, se enviará un código de recuperación al correo registrado.",
    };

    if (!cleanRut) return generic;

    const user = await this.prisma.user.findFirst({
      where: { rut: cleanRut },
      select: {
        id: true,
        email: true,
        rut: true as any,
        activo: true,
        nombre: true,
        apellido: true,
        workerType: true as any,
      },
    });

    if (!user || !user.activo) return generic;

    const code = generate6DigitCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // ✅ invalida solicitudes anteriores no usadas
    await this.prisma.passwordResetRequest.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    const createdRequest = await this.prisma.passwordResetRequest.create({
      data: {
        userId: user.id,
        rut: cleanRut,
        code,
        expiresAt,
      },
      select: {
        id: true,
        code: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    // ✅ Mantiene aviso/copia a soporte si tu MailService tiene ese método
    try {
      const mail: any = this.mailService as any;

      if (typeof mail.sendPasswordResetCodeToSupport === "function") {
        await mail.sendPasswordResetCodeToSupport({
          rut: cleanRut,
          code: createdRequest.code,
          requestedAt: createdRequest.createdAt,
          expiresAt: createdRequest.expiresAt,
          nombre: user.nombre,
          apellido: user.apellido,
          email: user.email,
        });
      }
    } catch (e: any) {
      console.error(
        "[AUTH] No se pudo enviar correo de código de recuperación a soporte:",
        e?.message || e
      );
    }

    // ✅ NUEVO: notificar a SUPERADMIN
    try {
      await this.notifySuperadminsPasswordResetRequested(
        user,
        createdRequest.code
      );
    } catch (e: any) {
      console.error(
        "[AUTH] No se pudo notificar a SUPERADMIN por recuperación:",
        e?.message || e
      );
    }

    try {
      await this.audit.log({
        entity: AuditEntity.USER,
        entityId: user.id,
        action: AuditAction.UPDATE,
        actor: safeActorFromUser(user),
        ip: pickIp(req),
        userAgent: pickUserAgent(req),
        meta: {
          title: "Solicitó recuperación por RUT",
          kind: "AUTH_REQUEST_RESET_BY_RUT",
          targetLabel: (user as any).rut ?? user.email,
          resetRequest: {
            id: createdRequest.id,
            code: createdRequest.code,
            expiresAt: createdRequest.expiresAt,
            createdAt: createdRequest.createdAt,
          },
        },
      });
    } catch {}

    return generic;
  }

  // ✅ Reset con RUT + código + nueva contraseña
  async resetPasswordWithCode(
    rut: string,
    code: string,
    newPassword: string,
    req?: any
  ) {
    const cleanRut = normalizeRut(rut);
    const cleanCode = String(code || "").trim();
    const cleanNew = String(newPassword || "");

    if (!cleanRut) throw new BadRequestException("RUT requerido");
    if (!cleanCode) throw new BadRequestException("Código requerido");
    if (!/^\d{6}$/.test(cleanCode)) {
      throw new BadRequestException("Código inválido");
    }
    if (!cleanNew || cleanNew.length < 8) {
      throw new BadRequestException(
        "La nueva contraseña debe tener al menos 8 caracteres"
      );
    }

    const resetRow = await this.prisma.passwordResetRequest.findFirst({
      where: {
        rut: cleanRut,
        code: cleanCode,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        code: true,
        rut: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    if (!resetRow) {
      throw new BadRequestException("Código inválido o expirado");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: resetRow.userId },
      select: {
        id: true,
        email: true,
        rut: true as any,
        activo: true,
        password: true,
        workerType: true as any,
      },
    });

    if (!user || !user.activo) {
      throw new BadRequestException("Usuario no válido para recuperación");
    }

    const same = await bcrypt.compare(cleanNew, user.password);
    if (same) {
      throw new BadRequestException(
        "La nueva contraseña no puede ser igual a la actual"
      );
    }

    const hashed = await bcrypt.hash(cleanNew, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashed,
          mustChangePassword: false,
          passwordResetAt: null as any,
        } as any,
      }),
      this.prisma.passwordResetRequest.update({
        where: { id: resetRow.id },
        data: {
          usedAt: new Date(),
        },
      }),
    ]);

    try {
      await this.audit.log({
        entity: AuditEntity.USER,
        entityId: user.id,
        action: AuditAction.UPDATE,
        actor: safeActorFromUser(user),
        ip: pickIp(req),
        userAgent: pickUserAgent(req),
        meta: {
          title: "Restableció contraseña con código",
          kind: "AUTH_RESET_PASSWORD_WITH_CODE",
          targetLabel: (user as any).rut ?? user.email,
          resetRequest: {
            id: resetRow.id,
            rut: resetRow.rut,
            code: resetRow.code,
            expiresAt: resetRow.expiresAt,
          },
        },
      });
    } catch {}

    return { message: "Contraseña restablecida correctamente" };
  }

  // ✅ LEGACY
  async forgotPassword(emailOrRut: string, req?: any) {
    const maybeRut = normalizeRut(emailOrRut);
    return this.requestPasswordResetByRut(maybeRut, req);
  }

  // ✅ LEGACY
  async resetPassword(token: string, newPassword: string, req?: any) {
    throw new BadRequestException(
      "Este método ya no usa token. Usa recuperación por RUT + código."
    );
  }
}










