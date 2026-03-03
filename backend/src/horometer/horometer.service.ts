import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuditAction, AuditEntity, Empresa } from "@prisma/client";
import { rename, mkdir } from "fs/promises";
import { join, extname } from "path";

// ✅ NUEVO: alertas horómetro
import { HorometerAlertsService } from "../alerts/horometer-alerts.service";

type Actor = { id: string; email: string; role?: string } | null;

@Injectable()
export class HorometerService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private horometerAlerts: HorometerAlertsService // ✅ NUEVO
  ) {}

  // =========================================================
  // HELPERS
  // =========================================================

  private safeActor(actor?: Actor) {
    return actor?.id && actor?.email ? { id: actor.id, email: actor.email } : null;
  }

  private async ensureArchiveDir() {
    const dir = join(process.cwd(), "uploads", "archive", "horometer");
    await mkdir(dir, { recursive: true });
  }

  private buildArchivePath(oldPath: string) {
    const ext = extname(oldPath || "").toLowerCase() || "";
    const stamp = Date.now();
    const rand = Math.random().toString(16).slice(2);
    // ✅ guardamos con slash inicial para que sea URL usable también
    return `/uploads/archive/horometer/${stamp}-${rand}${ext}`;
  }

  private toDiskPath(pathOrUrl: string) {
    // ✅ soporta "/uploads/..." o "uploads/..."
    const clean = String(pathOrUrl || "").replace(/^\/+/, "");
    return join(process.cwd(), clean);
  }

  private isPhysicalHorometerFile(pathOrUrl: string | null | undefined) {
    if (!pathOrUrl) return false;
    const p = String(pathOrUrl);
    return p.startsWith("/uploads/horometer/") || p.startsWith("uploads/horometer/");
  }

  // =========================================================
  // CREATE RECORD (AUDITA)
  // =========================================================

  async createRecord(params: {
    vehicleId: string;
    horas: number;
    comentario?: string | null;
    file: Express.Multer.File;
    actor: Actor;
  }) {
    const { vehicleId, horas, comentario, file, actor } = params;

    if (!actor?.id) throw new BadRequestException("No autorizado");
    if (!vehicleId) throw new BadRequestException("vehicleId requerido");
    if (!Number.isInteger(horas) || horas < 0)
      throw new BadRequestException("horas debe ser entero >= 0");
    if (!file) throw new BadRequestException("Falta la foto");

    const usuario = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        rut: true,
        empresa: true,
        activo: true,
        role: true,
      },
    });

    if (!usuario || !usuario.activo)
      throw new BadRequestException("Usuario inválido o inactivo");

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true, empresa: true, patente: true, activo: true },
    });

    if (!vehicle || !vehicle.activo)
      throw new NotFoundException("Vehículo no encontrado");

    const isTrabajador = String(usuario.role || "").toUpperCase() === "TRABAJADOR";

    if (isTrabajador) {
      if (!usuario.empresa) {
        throw new BadRequestException("El trabajador no tiene empresa asignada");
      }
      if (vehicle.empresa !== usuario.empresa) {
        throw new ForbiddenException("No puedes registrar horómetro en vehículo de otra empresa");
      }
    }

    // ✅ IMPORTANTE: url con slash para el frontend
    const fotoUrl = `/uploads/horometer/${file.filename}`;
    const filePath = fotoUrl;

    const created = await this.prisma.horometerRecord.create({
      data: {
        vehicleId: vehicle.id,
        trabajadorId: usuario.id,

        trabajadorNombre: usuario.nombre,
        trabajadorApellido: usuario.apellido,
        trabajadorRut: usuario.rut ?? null,
        trabajadorEmail: usuario.email,

        empresa: vehicle.empresa as Empresa,

        horas,
        comentario: String(comentario ?? "").trim() || null,

        fotoUrl,
        filePath,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      },
      include: {
        vehicle: { select: { id: true, patente: true, empresa: true } },
      },
    });

    // ✅ AUDITORÍA (bien “presentable”)
    await this.audit.log({
      entity: AuditEntity.VEHICLE,
      entityId: vehicle.id,
      action: AuditAction.CREATE,
      actor: this.safeActor(actor),
      meta: {
        title: "Registró Horómetro",
        targetLabel: vehicle.patente,
        after: {
          id: created.id,
          empresa: created.empresa,
          horas: created.horas,
          comentario: created.comentario,
          trabajador: {
            nombre: created.trabajadorNombre,
            apellido: created.trabajadorApellido,
            rut: created.trabajadorRut,
            email: created.trabajadorEmail,
          },
          fotoUrl: created.fotoUrl,
          originalName: created.originalName,
          mimeType: created.mimeType,
          sizeBytes: created.sizeBytes,
          createdAt: created.createdAt,
        },
      },
    });

    // ✅ NUEVO: disparar alerta automática (NO rompe el flujo si falla)
    try {
      await this.horometerAlerts.onHorometerCreated({
        vehicleId: vehicle.id,
        horas,
      });
    } catch {
      // silencioso: el registro de horómetro igual debe quedar creado
    }

    return created;
  }

  // =========================================================
  // LIST ADMIN GLOBAL
  // =========================================================

  async listAdmin(params: {
    q?: string;
    empresa?: "ALL" | "GRUAS_THOMAS" | "INSPROTEL";
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(params.page || 1, 1);
    const limit = Math.min(Math.max(params.limit || 10, 1), 50);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (params.empresa && params.empresa !== "ALL") {
      where.empresa = params.empresa;
    }

    if (params.q?.trim()) {
      const q = params.q.trim();
      where.OR = [
        { trabajadorNombre: { contains: q, mode: "insensitive" } },
        { trabajadorApellido: { contains: q, mode: "insensitive" } },
        { trabajadorEmail: { contains: q, mode: "insensitive" } },
        { trabajadorRut: { contains: q, mode: "insensitive" } },
        { vehicle: { patente: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.horometerRecord.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          vehicle: {
            select: {
              id: true,
              patente: true,
              marcaModelo: true,
              empresa: true,
            },
          },
        },
      }),
      this.prisma.horometerRecord.count({ where }),
    ]);

    return {
      items,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  // =========================================================
  // LIST POR VEHÍCULO (ADMIN)
  // =========================================================

  async listByVehicleAdmin(params: { vehicleId: string; page?: number; limit?: number }) {
    const vehicleId = String(params.vehicleId || "").trim();
    if (!vehicleId) throw new BadRequestException("vehicleId requerido");

    const page = Math.max(params.page || 1, 1);
    const limit = Math.min(Math.max(params.limit || 50, 1), 100);
    const skip = (page - 1) * limit;

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true, patente: true, empresa: true, activo: true },
    });

    if (!vehicle || !vehicle.activo) throw new NotFoundException("Vehículo no encontrado");

    const [items, total] = await Promise.all([
      this.prisma.horometerRecord.findMany({
        where: { vehicleId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.horometerRecord.count({ where: { vehicleId } }),
    ]);

    return {
      vehicle,
      items,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  // =========================================================
  // DELETE CON RESPALDO + AUDITORÍA
  // =========================================================

  async remove(id: string, actor: Actor) {
    if (!actor?.id) throw new BadRequestException("No autorizado");

    const current = await this.prisma.horometerRecord.findUnique({
      where: { id },
      include: {
        vehicle: { select: { id: true, patente: true, empresa: true } },
      },
    });

    if (!current) throw new NotFoundException("Registro no encontrado");

    const oldFilePath = (current as any).filePath || current.fotoUrl || null;

    let archivedUrl: string | null = null;

    // ✅ 1) mover archivo físico a archive si aplica
    try {
      if (this.isPhysicalHorometerFile(oldFilePath)) {
        await this.ensureArchiveDir();

        archivedUrl = this.buildArchivePath(String(oldFilePath));

        await rename(this.toDiskPath(String(oldFilePath)), this.toDiskPath(archivedUrl));
      }
    } catch {
      archivedUrl = null;
    }

    // ✅ 2) auditoría con snapshot completo
    await this.audit.log({
      entity: AuditEntity.VEHICLE,
      entityId: current.vehicleId,
      action: AuditAction.DELETE,
      actor: this.safeActor(actor),
      meta: {
        title: "Eliminó Registro de Horómetro (respaldo)",
        targetLabel: current.vehicle?.patente,
        before: {
          id: current.id,
          horas: current.horas,
          comentario: current.comentario,
          empresa: current.empresa,
          trabajador: {
            nombre: current.trabajadorNombre,
            apellido: current.trabajadorApellido,
            rut: current.trabajadorRut,
            email: current.trabajadorEmail,
          },
          fotoUrl: current.fotoUrl,
          filePath: (current as any).filePath ?? null,
          originalName: current.originalName,
          mimeType: current.mimeType,
          sizeBytes: current.sizeBytes,
          createdAt: current.createdAt,
          backup: {
            archivedUrl,
            oldFilePath,
          },
        },
      },
      data: {
        before: {
          ...(current as any),
          backup: { archivedUrl, oldFilePath },
        },
      },
    });

    // ✅ 3) borrar registro BD
    await this.prisma.horometerRecord.delete({ where: { id } });

    return { ok: true, archivedUrl };
  }
}



