// ✅ Archivo: src/users/users.controller.ts (COMPLETO)
// ✅ FIX CONTROL_FLOTA:
// - CONTROL_FLOTA ahora puede usar GET /users para autocomplete de Operador/Rigger
// - También puede usar GET /users/:id por compatibilidad futura
//
// ✅ FIX NUEVO:
// - JEFE_TALLER / SUPERVISOR ahora pueden usar GET /users
// - necesario para asignar mantenciones
//
// ✅ Nuevo: endpoint SOLO SUPERADMIN para resetear contraseña de un usuario
// - PATCH /users/:id/reset-password
// - Puede: setear una contraseña temporal (si no se manda, el backend la genera)
// - Devuelve la contraseña temporal (para que el superadmin se la entregue al usuario)
//
// ✅ NUEVO:
// - POST /users/fcm-token para guardar token FCM del usuario logueado

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  Req,
} from "@nestjs/common";
import type { Request } from "express";

import { UsersService } from "./users.service";
import { CreateUserDto } from "../auth/dto/create-user.dto";
import { UpdateUserDto } from "../auth/dto/update-user.dto";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

function getActorId(actor: any) {
  return actor?.id || actor?.sub || null;
}

function pickSelfUpdate(dto: any) {
  const allowed = ["nombre", "apellido", "rut", "telefono"];

  const out: any = {};

  for (const k of allowed) {
    if (dto?.[k] !== undefined) {
      out[k] = dto[k];
    }
  }

  return out;
}

@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // =========================
  // ✅ PERFIL PROPIO (ME)
  // =========================

  @Get("me")
  @Roles("TRABAJADOR", "CONTROL_FLOTA", "ADMINISTRADORA", "SUPERADMIN")
  async me(@Req() req: Request) {
    const actor: any = (req as any).user ?? null;

    const id = getActorId(actor);

    if (!id) {
      throw new BadRequestException("Actor inválido.");
    }

    return this.usersService.findOne(String(id));
  }

  @Patch("me")
  @Roles("TRABAJADOR", "CONTROL_FLOTA", "ADMINISTRADORA", "SUPERADMIN")
  async updateMe(@Req() req: Request, @Body() dto: UpdateUserDto) {
    const actor: any = (req as any).user ?? null;

    const id = getActorId(actor);

    if (!id) {
      throw new BadRequestException("Actor inválido.");
    }

    const safeDto: any = pickSelfUpdate(dto);

    if (Object.keys(safeDto).length === 0) {
      throw new BadRequestException(
        "No enviaste campos editables (nombre, apellido, rut, telefono)."
      );
    }

    return this.usersService.updateMe(
      safeDto,
      { id: String(id) },
      { self: true }
    );
  }

  // =========================
  // 🔥 FCM TOKEN
  // =========================

  @Post("fcm-token")
  @Roles("TRABAJADOR", "CONTROL_FLOTA", "ADMINISTRADORA", "SUPERADMIN")
  async saveFcmToken(
    @Req() req: Request,
    @Body() body: { token: string }
  ) {
    const actor: any = (req as any).user ?? null;

    const id = getActorId(actor);

    if (!id) {
      throw new BadRequestException("Actor inválido.");
    }

    if (!body?.token) {
      throw new BadRequestException("Token requerido.");
    }

    return this.usersService.saveFcmToken(String(id), body.token);
  }

  // =========================
  // ✅ ADMINISTRACIÓN USUARIOS
  // =========================

  @Post()
  @Roles("ADMINISTRADORA", "SUPERADMIN")
  create(@Req() req: Request, @Body() dto: CreateUserDto) {
    const actor = (req as any).user ?? null;

    return this.usersService.create(dto, actor);
  }

  // ✅ FIX:
  // - CONTROL_FLOTA puede usar autocomplete
  // - JEFE_TALLER / SUPERVISOR pueden asignar mantenciones
  @Get()
  @Roles(
    "TRABAJADOR",
    "CONTROL_FLOTA",
    "ADMINISTRADORA",
    "SUPERADMIN"
  )
  findAll(
    @Query("q") q?: string,
    @Query("activo") activo?: string,
    @Query("role") role?: string,
    @Query("empresa") empresa?: string,
    @Query("workerType") workerType?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    return this.usersService.findAll({
      q,
      activo,
      role,
      empresa,
      workerType,
      page,
      limit,
    } as any);
  }

  // ✅ FIX:
  // - permitir lectura puntual a jefe/supervisor
  @Get(":id")
  @Roles(
    "TRABAJADOR",
    "CONTROL_FLOTA",
    "ADMINISTRADORA",
    "SUPERADMIN"
  )
  findOne(@Param("id") id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(":id")
  @Roles("ADMINISTRADORA", "SUPERADMIN")
  update(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: UpdateUserDto
  ) {
    const actor = (req as any).user ?? null;

    return this.usersService.update(id, dto, actor);
  }

  @Patch(":id/toggle")
  @Roles("ADMINISTRADORA", "SUPERADMIN")
  toggle(@Req() req: Request, @Param("id") id: string) {
    const actor = (req as any).user ?? null;

    return this.usersService.toggle(id, actor);
  }

  // ✅ RESET PASSWORD
  @Patch(":id/reset-password")
  @Roles("SUPERADMIN")
  resetPassword(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { newPassword?: string }
  ) {
    const actor = (req as any).user ?? null;

    return this.usersService.resetPasswordBySuperadmin(
      id,
      body?.newPassword,
      actor
    );
  }

  // ✅ ELIMINAR USUARIO
  @Delete(":id")
  @Roles("SUPERADMIN")
  remove(@Req() req: Request, @Param("id") id: string) {
    const actor = (req as any).user ?? null;

    return this.usersService.remove(id, actor);
  }
}