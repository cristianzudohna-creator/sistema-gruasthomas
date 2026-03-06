// ✅ Archivo: src/users/users.controller.ts (COMPLETO)
// ✅ FIX CONTROL_FLOTA:
// - CONTROL_FLOTA ahora puede usar GET /users para autocomplete de Operador/Rigger
// - También puede usar GET /users/:id por compatibilidad futura
//
// ✅ Nuevo: endpoint SOLO SUPERADMIN para resetear contraseña de un usuario
// - PATCH /users/:id/reset-password
// - Puede: setear una contraseña temporal (si no se manda, el backend la genera)
// - Devuelve la contraseña temporal (para que el superadmin se la entregue al usuario)

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
  return actor?.id || actor?.sub || null; // según cómo armes el JWT
}

function pickSelfUpdate(dto: any) {
  // ✅ Campos que SÍ puede editar el usuario en "Mi cuenta"
  // (no role, no empresa, no activo, no email, no workerType, etc.)
  const allowed = ["nombre", "apellido", "rut", "telefono"];
  const out: any = {};
  for (const k of allowed) {
    if (dto?.[k] !== undefined) out[k] = dto[k];
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

  // ✅ cualquiera logueado puede ver su perfil
  @Get("me")
  @Roles("TRABAJADOR", "CONTROL_FLOTA", "ADMINISTRADORA", "SUPERADMIN")
  async me(@Req() req: Request) {
    const actor: any = (req as any).user ?? null;
    const id = getActorId(actor);
    if (!id) throw new BadRequestException("Actor inválido.");
    return this.usersService.findOne(String(id));
  }

  // ✅ cualquiera logueado puede editar SOLO SUS DATOS personales
  @Patch("me")
  @Roles("TRABAJADOR", "CONTROL_FLOTA", "ADMINISTRADORA", "SUPERADMIN")
  async updateMe(@Req() req: Request, @Body() dto: UpdateUserDto) {
    const actor: any = (req as any).user ?? null;
    const id = getActorId(actor);
    if (!id) throw new BadRequestException("Actor inválido.");

    const safeDto: any = pickSelfUpdate(dto);

    // ✅ si no mandó nada editable, no hacemos update “vacío”
    if (Object.keys(safeDto).length === 0) {
      throw new BadRequestException(
        "No enviaste campos editables (nombre, apellido, rut, telefono)."
      );
    }

    // ✅ CORRECTO: usar updateMe (aplica reglas de self)
    return this.usersService.updateMe(safeDto, { id: String(id) }, { self: true });
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

  // ✅ FIX: agregar CONTROL_FLOTA para autocomplete de operadores/riggers
  @Get()
  @Roles("CONTROL_FLOTA", "ADMINISTRADORA", "SUPERADMIN")
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

  // ✅ FIX: también permitir CONTROL_FLOTA en lectura puntual
  @Get(":id")
  @Roles("CONTROL_FLOTA", "ADMINISTRADORA", "SUPERADMIN")
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

  // ✅ NUEVO: RESET PASSWORD (SOLO SUPERADMIN)
  // Body opcional: { newPassword?: string }
  @Patch(":id/reset-password")
  @Roles("SUPERADMIN")
  resetPassword(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { newPassword?: string }
  ) {
    const actor = (req as any).user ?? null;
    return this.usersService.resetPasswordBySuperadmin(id, body?.newPassword, actor);
  }

  // ✅ ELIMINAR USUARIO (SOLO SUPERADMIN)
  @Delete(":id")
  @Roles("SUPERADMIN")
  remove(@Req() req: Request, @Param("id") id: string) {
    const actor = (req as any).user ?? null;
    return this.usersService.remove(id, actor);
  }
}