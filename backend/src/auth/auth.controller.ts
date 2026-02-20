// ✅ Archivo: src/auth/auth.controller.ts (COMPLETO)
// ✅ Login usa RUT + password (dto.rut)
// ✅ Change password usa req.user.id (porque JwtStrategy retorna el usuario real desde BD)
// ✅ Forgot/Reset deshabilitados (porque "solo SUPERADMIN resetea")

import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { Request } from "express";

import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ✅ Login (auditoría se hace en AuthService.login)
  // ✅ IMPORTANTE: pasar req para guardar ip/userAgent
  @Post("login")
  login(@Req() req: Request, @Body() dto: LoginDto) {
    return this.authService.login(dto.rut, dto.password, req);
  }

  // ✅ Cambiar contraseña (usuario logueado)
  @UseGuards(AuthGuard("jwt"))
  @Post("change-password")
  async changePassword(@Req() req: Request, @Body() dto: ChangePasswordDto) {
    const user: any = (req as any).user;

    // JwtStrategy.validate retorna { id, email, role, activo, empresa }
    const userId: string = user?.id;

    if (!userId) throw new BadRequestException("Usuario inválido");

    return this.authService.changePassword(userId, dto);
  }

  // ❌ Olvidé mi contraseña (DESHABILITADO)
  // ✅ Política del sistema: "solo SUPERADMIN resetea"
  @Post("forgot-password")
  forgotPassword(@Body() _dto: ForgotPasswordDto) {
    throw new BadRequestException(
      "Recuperación por correo deshabilitada. Solicita al SUPERADMIN un reset de clave."
    );
  }

  // ❌ Reset contraseña con token (DESHABILITADO)
  @Post("reset-password")
  resetPassword(@Body() _dto: ResetPasswordDto) {
    throw new BadRequestException(
      "Reset por token deshabilitado. Solicita al SUPERADMIN un reset de clave."
    );
  }
}






