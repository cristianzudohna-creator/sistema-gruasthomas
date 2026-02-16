import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditAction, AuditEntity, Prisma, User } from "@prisma/client";

type ListParams = {
  page: number;
  limit: number;

  entity?: AuditEntity;
  action?: AuditAction;
  q?: string;     // buscar
  date?: string;  // YYYY-MM-DD
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

    const mergedData =
      params.data != null || params.meta != null
        ? { ...(params.data || {}), ...(params.meta || {}) }
        : null;

    return this.prisma.auditLog.create({
      data: {
        entity: params.entity,
        entityId: params.entityId,
        action: params.action,
        actorId,
        actorEmail,
        ip: params.ip ?? null,
        userAgent: params.userAgent ?? null,
        data: mergedData,
      },
    });
  }

  async list({ page, limit, entity, action, q, date }: ListParams) {
    const skip = (page - 1) * limit;

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
      // cámbialo a Date(`${date}T00:00:00`) sin Z
      where.createdAt = { gte: start, lte: end };
    }

    // ✅ búsqueda por texto
    // Buscamos en:
    // - actorEmail (quién)
    // - entityId (por si alguien pega un id)
    // - data.targetLabel (patente / email / nombre corto que guardas en meta)
    // - data.title (por si quieres)
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
        take: limit,
        orderBy: { createdAt: "desc" },
        where,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const pages = Math.max(1, Math.ceil(total / limit));

    return {
      page,
      limit,
      total,
      pages,
      items,
    };
  }
}





