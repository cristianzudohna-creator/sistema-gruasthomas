// ✅ Archivo: src/audit/audit.controller.ts (COMPLETO)

import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { AuditService } from "./audit.service";
import { AuditAction, AuditEntity } from "@prisma/client";

function normalizeEnumValue<T extends Record<string, string>>(
  enumObj: T,
  value?: any
): T[keyof T] | undefined {
  const v = String(value || "").trim();
  if (!v) return undefined;

  // acepta "user" "USER"
  const up = v.toUpperCase();

  // si el enum tiene keys = values (como Prisma), esto funciona
  if ((enumObj as any)[up]) return (enumObj as any)[up];

  // fallback: buscar por values
  const values = Object.values(enumObj).map((x) => String(x).toUpperCase());
  if (values.includes(up)) return up as any;

  return undefined;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN", "SUPERADMIN") // ✅ admins del sistema
@Controller("audit")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  async list(
    @Query("page") pageStr?: string,
    @Query("limit") limitStr?: string,

    // filtros (vienen por query string)
    @Query("entity") entityRaw?: string,
    @Query("action") actionRaw?: string,
    @Query("q") q?: string,
    @Query("date") date?: string // YYYY-MM-DD
  ) {
    const page = Math.max(1, Number(pageStr || 1));
    const limit = Math.min(200, Math.max(1, Number(limitStr || 50)));

    const entity = normalizeEnumValue(AuditEntity as any, entityRaw) as
      | AuditEntity
      | undefined;

    const action = normalizeEnumValue(AuditAction as any, actionRaw) as
      | AuditAction
      | undefined;

    return this.audit.list({
      page,
      limit,
      entity,
      action,
      q: q?.trim() || undefined,
      date: date?.trim() || undefined,
    });
  }
}






