import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { Request } from "express";

import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";

@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  // ✅ Cambiar contraseña (usuario logueado)
  @UseGuards(AuthGuard("jwt"))
  @Post("change-password")
  async changePassword(@Req() req: Request, @Body() dto: ChangePasswordDto) {
    const user: any = (req as any).user;
    const userId: string = user?.sub ?? user?.id;
    return this.authService.changePassword(userId, dto);
  }

  // ✅ Olvidé mi contraseña (no requiere login)
  @Post("forgot-password")
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  // ✅ Reset contraseña con token
  @Post("reset-password")
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }
}



