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

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
    private mailService: MailService
  ) {}

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user || !user.activo) {
      throw new UnauthorizedException("Credenciales inválidas");
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      throw new UnauthorizedException("Credenciales inválidas");
    }

    // ✅ IMPORTANTE: incluir empresa en JWT
    const payload = {
      sub: user.id,
      role: user.role,
      email: user.email,
      empresa: (user as any).empresa ?? null, // ✅ NUEVO
    };

    const access_token = await this.jwtService.signAsync(payload);

    return {
      access_token,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        apellido: user.apellido,
        role: user.role,
        empresa: (user as any).empresa ?? null, // ✅ NUEVO (para localStorage)
      },
    };
  }

  // ✅ Cambiar contraseña (usuario logueado)
  async changePassword(
    userId: string,
    dto: { currentPassword: string; newPassword: string }
  ) {
    if (!userId) throw new UnauthorizedException("No autorizado");

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true, activo: true },
    });

    if (!user || !user.activo) {
      throw new UnauthorizedException("No autorizado");
    }

    const ok = await bcrypt.compare(dto.currentPassword, user.password);
    if (!ok) {
      throw new BadRequestException("Contraseña actual incorrecta");
    }

    const same = await bcrypt.compare(dto.newPassword, user.password);
    if (same) {
      throw new BadRequestException(
        "La nueva contraseña no puede ser igual a la actual"
      );
    }

    const hashed = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });

    return { message: "Contraseña actualizada correctamente" };
  }

  // ✅ OLVIDÉ MI CONTRASEÑA (envía correo con token)
  async forgotPassword(email: string) {
    const cleanEmail = email.toLowerCase().trim();

    const user = await this.prisma.user.findUnique({
      where: { email: cleanEmail },
      select: { id: true, email: true, activo: true },
    });

    // ✅ Respuesta genérica siempre (seguridad)
    const generic = {
      message:
        "Si el correo existe, recibirás instrucciones para recuperar tu contraseña.",
    };

    if (!user || !user.activo) return generic;

    // 1) Crear token (texto) + hash (guardado)
    const token = randomBytes(32).toString("hex");
    const tokenHash = await bcrypt.hash(token, 10);

    // 2) Expira en 15 min
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // 3) Guardar en tabla PasswordResetToken
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    // 4) Construir URL y enviar correo
    const frontend = process.env.FRONTEND_URL || "http://localhost:5173";
    const resetUrl = `${frontend}/reset-password?token=${token}`;

    await this.mailService.sendResetPasswordEmail(user.email, resetUrl);

    return generic;
  }

  // ✅ RESET PASSWORD (token + newPassword)
  async resetPassword(token: string, newPassword: string) {
    if (!token) throw new BadRequestException("Token requerido");
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException(
        "La nueva contraseña debe tener al menos 8 caracteres"
      );
    }

    // 1) Traer tokens activos (no usados y no expirados)
    const candidates = await this.prisma.passwordResetToken.findMany({
      where: {
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // 2) Comparar el token real con los hashes guardados
    let match: { id: string; userId: string } | null = null;

    for (const t of candidates) {
      const ok = await bcrypt.compare(token, t.tokenHash);
      if (ok) {
        match = { id: t.id, userId: t.userId };
        break;
      }
    }

    if (!match) {
      throw new BadRequestException("Token inválido o expirado");
    }

    // 3) Cambiar password + marcar token usado
    const hashed = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: match.userId },
        data: { password: hashed },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: match.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { message: "Contraseña restablecida correctamente" };
  }
}




