// ✅ Archivo: src/audit/audit.service.ts (COMPLETO)
// ✅ FIX TS/Prisma: Json? NO acepta null directo => usar undefined (no enviar) o Prisma.JsonNull/DbNull
// ✅ Mantiene: filtros por entity/action/date + search en actorEmail/entityId + data.targetLabel/data.title

import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditAction, AuditEntity, Prisma, User } from "@prisma/client";

type ListParams = {
  page: number;
  limit: number;

  entity?: AuditEntity;
  action?: AuditAction;
  q?: string; // buscar
  date?: string; // YYYY-MM-DD
};

type LogParams = {
  entity: AuditEntity;
  entityId: string;
  action: AuditAction;

  actor?: Pick<User, "id" | "email"> | null;
  actorId?: string | null;
  actorEmail?: string | null;

  meta?: any;
  ip?: string | null;
  userAgent?: string | null;
  data?: any;
};

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(params: LogParams) {
    const actorId = params.actorId ?? params.actor?.id ?? null;
    const actorEmail = params.actorEmail ?? params.actor?.email ?? null;

    // ✅ Unificamos "data" + "meta" en un solo JSON
    // Importante: Prisma Json? NO acepta null directo en TS => si no hay nada, usamos undefined.
    const hasSomething = params.data != null || params.meta != null;

    const merged =
      hasSomething
        ? { ...(params.data || {}), ...(params.meta || {}) }
        : undefined;

    // ✅ Si merged existe pero NO es objeto (por error), lo envolvemos igual como JSON válido
    const safeJson: Prisma.InputJsonValue | undefined =
      merged === undefined
        ? undefined
        : (merged as Prisma.InputJsonValue);

    return this.prisma.auditLog.create({
      data: {
        entity: params.entity,
        entityId: params.entityId,
        action: params.action,
        actorId,
        actorEmail,
        ip: params.ip ?? null,
        userAgent: params.userAgent ?? null,

        // ✅ clave: si no hay datos, NO enviar "data"
        ...(safeJson === undefined ? {} : { data: safeJson }),
      },
    });
  }

  async list({ page, limit, entity, action, q, date }: ListParams) {
    const safePage = Math.max(page || 1, 1);
    const safeLimit = Math.min(Math.max(limit || 10, 1), 100);
    const skip = (safePage - 1) * safeLimit;

    const where: Prisma.AuditLogWhereInput = {};

    // ✅ entity
    if (entity) where.entity = entity;

    // ✅ action
    if (action) where.action = action;

    // ✅ date (día completo)
    if (date) {
      // date esperado: "YYYY-MM-DD"
      const start = new Date(`${date}T00:00:00.000Z`);
      const end = new Date(`${date}T23:59:59.999Z`);

      // Si tu servidor está en otra zona horaria y se descuadra:
      // usa Date(`${date}T00:00:00`) sin Z
      where.createdAt = { gte: start, lte: end };
    }

    // ✅ búsqueda por texto
    const search = (q || "").trim();
    if (search) {
      where.OR = [
        { actorEmail: { contains: search, mode: "insensitive" } },
        { entityId: { contains: search, mode: "insensitive" } },

        // JSON: data.targetLabel contiene "AB-CD-12" o "prueba@..."
        {
          data: {
            path: ["targetLabel"],
            string_contains: search,
          } as any,
        },

        // JSON: data.title
        {
          data: {
            path: ["title"],
            string_contains: search,
          } as any,
        },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        skip,
        take: safeLimit,
        orderBy: { createdAt: "desc" },
        where,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const pages = Math.max(1, Math.ceil(total / safeLimit));

    return {
      page: safePage,
      limit: safeLimit,
      total,
      pages,
      items,
    };
  }
}






