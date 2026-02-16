// ✅ Archivo: src/users/users.controller.ts
// ✅ PERFIL PROPIO (ME) + ✅ Administración usuarios
// - /users/me (GET + PATCH) disponible para cualquier rol logueado
// - Los endpoints de administración quedan SOLO para ADMINISTRADORA / SUPERADMIN
//
// ✅ NUEVO: workerType (tipo de trabajador):
// - Se usa solo si role === TRABAJADOR
// - Valores sugeridos (en frontend/back): CONDUCTOR | RIGGER | OPERADOR | MECANICO | OTRO

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

    return this.usersService.update(String(id), safeDto, actor, { self: true });
  }

  // =========================
  // ✅ ADMINISTRACIÓN USUARIOS
  // =========================
  // ✅ NOTA: aquí sí se permite workerType (tipo de trabajador),
  // porque lo define administración.

  @Post()
  @Roles("ADMINISTRADORA", "SUPERADMIN")
  create(@Req() req: Request, @Body() dto: CreateUserDto) {
    const actor = (req as any).user ?? null;
    return this.usersService.create(dto, actor);
  }

  @Get()
  @Roles("ADMINISTRADORA", "SUPERADMIN")
  findAll(
    @Query("q") q?: string,
    @Query("activo") activo?: string,
    @Query("role") role?: string,
    @Query("empresa") empresa?: string,

    // ✅ NUEVO: filtrar por tipo trabajador
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

  @Get(":id")
  @Roles("ADMINISTRADORA", "SUPERADMIN")
  findOne(@Param("id") id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(":id")
  @Roles("ADMINISTRADORA", "SUPERADMIN")
  update(@Req() req: Request, @Param("id") id: string, @Body() dto: UpdateUserDto) {
    const actor = (req as any).user ?? null;
    return this.usersService.update(id, dto, actor);
  }

  @Patch(":id/toggle")
  @Roles("ADMINISTRADORA", "SUPERADMIN")
  toggle(@Req() req: Request, @Param("id") id: string) {
    const actor = (req as any).user ?? null;
    return this.usersService.toggle(id, actor);
  }

  // ✅ ELIMINAR USUARIO (SOLO SUPERADMIN)
  @Delete(":id")
  @Roles("SUPERADMIN")
  remove(@Req() req: Request, @Param("id") id: string) {
    const actor = (req as any).user ?? null;
    return this.usersService.remove(id, actor);
  }
}





