// ✅ Archivo: src/auth/auth.controller.ts (COMPLETO)
// ✅ Login usa RUT + password
// ✅ Change password usa req.user.id
// ✅ NUEVO:
// - forgot-password => recuperación por RUT
// - reset-password => reset con RUT + código + nueva contraseña

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

  // ✅ Login
  @Post("login")
  login(@Req() req: Request, @Body() dto: LoginDto) {
    return this.authService.login(dto.rut, dto.password, req);
  }

  // ✅ Cambiar contraseña (usuario logueado)
  @UseGuards(AuthGuard("jwt"))
  @Post("change-password")
  async changePassword(@Req() req: Request, @Body() dto: ChangePasswordDto) {
    const user: any = (req as any).user;
    const userId: string = user?.id;

    if (!userId) throw new BadRequestException("Usuario inválido");

    return this.authService.changePassword(userId, dto);
  }

  // ✅ NUEVO: solicitar recuperación por RUT
  // body: { rut: "195657955" }
  @Post("forgot-password")
  forgotPassword(@Req() req: Request, @Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordResetByRut(dto.rut, req);
  }

  // ✅ NUEVO: restablecer con RUT + código
  // body: { rut, code, newPassword }
  @Post("reset-password")
  resetPassword(@Req() req: Request, @Body() dto: ResetPasswordDto) {
    return this.authService.resetPasswordWithCode(
      dto.rut,
      dto.code,
      dto.newPassword,
      req
    );
  }
}






