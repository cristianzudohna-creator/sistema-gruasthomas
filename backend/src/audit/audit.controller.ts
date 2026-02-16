import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { AuditService } from "./audit.service";
import { AuditAction, AuditEntity } from "@prisma/client";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN", "SUPERADMIN") // ✅ FIX CLAVE
@Controller("audit")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  async list(
    @Query("page") pageStr?: string,
    @Query("limit") limitStr?: string,

    // filtros
    @Query("entity") entity?: AuditEntity,
    @Query("action") action?: AuditAction,
    @Query("q") q?: string,
    @Query("date") date?: string // YYYY-MM-DD
  ) {
    const page = Math.max(1, Number(pageStr || 1));
    const limit = Math.min(200, Math.max(1, Number(limitStr || 50)));

    return this.audit.list({
      page,
      limit,
      entity: entity || undefined,
      action: action || undefined,
      q: q || undefined,
      date: date || undefined,
    });
  }
}





