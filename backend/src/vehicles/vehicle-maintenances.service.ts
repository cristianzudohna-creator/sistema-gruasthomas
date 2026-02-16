// ✅ Archivo: src/vehicles/vehicle-maintenances.service.ts
// (COMPLETO) ✅ Mantenciones con respaldo al eliminar:
// - Si el archivo era físico: se MUEVE a /uploads/archive/vehicle-maint/
// - Se registra auditoría con snapshot completo (before) y archivedUrl
// - Luego se elimina el registro en BD

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuditAction, AuditEntity, MaintenanceType } from "@prisma/client";
import { unlink, rename, mkdir } from "fs/promises";
import { join, extname } from "path";

type ActorLike =
  | {
      id?: string;
      email?: string;
    }
  | null;

type CreateMaintenanceDto = {
  type: MaintenanceType;
  nombre?: string;

  fechaRealizada: string; // YYYY-MM-DD

  // ✅ AHORA OPCIONAL (puede ser "", null o undefined)
  fechaProxima?: string | null;

  observacion?: string;
  archivoUrl?: string;

  // ✅ NUEVO: metadata de archivo (para nombre real en Excel)
  filePath?: string;
  originalName?: string;
  mimeType?: string;
  sizeBytes?: number;
};

type UpdateMaintenanceDto = {
  type?: MaintenanceType;
  nombre?: string;
  fechaRealizada?: string;

  // ✅ AHORA OPCIONAL (puede ser "", null o undefined)
  fechaProxima?: string | null;

  observacion?: string;
  archivoUrl?: string;

  // ✅ NUEVO: metadata de archivo (para nombre real en Excel)
  filePath?: string;
  originalName?: string;
  mimeType?: string;
  sizeBytes?: number;
};

function safeActor(actor?: ActorLike) {
  return actor?.id && actor?.email ? { id: actor.id, email: actor.email } : null;
}

function parseDateOrThrow(value: string, fieldName: string) {
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    throw new BadRequestException(`${fieldName} no es una fecha válida`);
  }
  return d;
}

// ✅ Convierte "", null, undefined => null
function emptyToNull(value?: string | null) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

/**
 * Estado según fechaProxima:
 * - VENCIDA: fechaProxima < hoy (00:00)
 * - POR_VENCER: hoy <= fechaProxima <= hoy+30
 * - VIGENTE: > hoy+30
 * Si fechaProxima es null => VIGENTE
 */
function calcEstadoByProxima(fechaProxima: Date | null) {
  if (!fechaProxima) return "VIGENTE";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const limit = new Date(today);
  limit.setDate(limit.getDate() + 30);

  if (fechaProxima.getTime() < today.getTime()) return "VENCIDA";
  if (fechaProxima.getTime() <= limit.getTime()) return "POR_VENCER";
  return "VIGENTE";
}

@Injectable()
export class VehicleMaintenancesService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  // =========================
  // ✅ helpers archivo físico
  // =========================

  private shouldArchivePhysicalFile(filePathOrUrl: string | null | undefined) {
    if (!filePathOrUrl) return false;
    return String(filePathOrUrl).startsWith("/uploads/vehicle-maint/");
  }

  private toDiskPath(filePathOrUrl: string) {
    const clean = String(filePathOrUrl).replace(/^\/+/, "");
    return join(process.cwd(), clean);
  }

  private async ensureDir(dirAbs: string) {
    await mkdir(dirAbs, { recursive: true });
  }

  private buildArchiveUrlFromOld(oldUrlOrPath: string) {
    const oldExt = extname(oldUrlOrPath || "").toLowerCase() || "";
    const stamp = Date.now();
    const rand = Math.random().toString(16).slice(2);
    return `/uploads/archive/vehicle-maint/${stamp}-${rand}${oldExt}`;
  }

  // =========================
  // List
  // =========================
  async listByVehicle(vehicleId: string) {
    const v = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!v) throw new NotFoundException("Vehículo no encontrado");

    const items = await this.prisma.vehicleMaintenance.findMany({
      where: { vehicleId },
      orderBy: [
        // @ts-ignore (según versión de Prisma/TS)
        { fechaProxima: { sort: "asc", nulls: "last" } },
      ],
    });

    return items.map((m) => ({
      ...m,
      estado: calcEstadoByProxima(m.fechaProxima),
    }));
  }

  // =========================
  // Create
  // =========================
  async create(vehicleId: string, dto: CreateMaintenanceDto, actor?: ActorLike) {
    const v = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!v) throw new NotFoundException("Vehículo no encontrado");

    if (!dto.fechaRealizada) {
      throw new BadRequestException("Fecha realizada es obligatoria");
    }

    const fechaProximaStr = emptyToNull(dto.fechaProxima);

    const fechaRealizada = parseDateOrThrow(dto.fechaRealizada, "Fecha realizada");
    const fechaProxima = fechaProximaStr
      ? parseDateOrThrow(fechaProximaStr, "Fecha próxima")
      : null;

    if (dto.type === "OTRO" && !(dto.nombre || "").trim()) {
      throw new BadRequestException("Para tipo OTRO debes indicar un nombre");
    }

    const created = await this.prisma.vehicleMaintenance.create({
      data: {
        vehicleId,
        type: dto.type,
        nombre: dto.nombre?.trim() || null,
        fechaRealizada,
        fechaProxima,
        observacion: dto.observacion?.trim() || null,
        archivoUrl: dto.archivoUrl?.trim() || null,

        filePath: dto.filePath?.trim() || null,
        originalName: dto.originalName?.trim() || null,
        mimeType: dto.mimeType?.trim() || null,
        sizeBytes: typeof dto.sizeBytes === "number" ? dto.sizeBytes : null,
      } as any,
    });

    await this.audit.log({
      entity: AuditEntity.VEHICLE,
      entityId: vehicleId,
      action: AuditAction.CREATE,
      actor: safeActor(actor),
      meta: {
        title: "Creó Mantención",
        targetLabel: v.patente,
        after: {
          id: created.id,
          type: created.type,
          nombre: created.nombre,
          fechaRealizada: created.fechaRealizada,
          fechaProxima: created.fechaProxima,
          estado: calcEstadoByProxima(created.fechaProxima),

          originalName: (created as any).originalName ?? null,
          archivoUrl: created.archivoUrl ?? null,
        },
      },
    });

    return {
      ...created,
      estado: calcEstadoByProxima(created.fechaProxima),
    };
  }

  // =========================
  // Update
  // =========================
  async update(id: string, dto: UpdateMaintenanceDto, actor?: ActorLike) {
    const current = await this.prisma.vehicleMaintenance.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Mantención no encontrada");

    const v = await this.prisma.vehicle.findUnique({ where: { id: current.vehicleId } });

    const nextType = dto.type ?? current.type;

    const nextNombre =
      dto.nombre !== undefined ? dto.nombre?.trim() || null : current.nombre;

    const nextFechaRealizada =
      dto.fechaRealizada !== undefined
        ? parseDateOrThrow(dto.fechaRealizada, "Fecha realizada")
        : current.fechaRealizada;

    let nextFechaProxima: Date | null = current.fechaProxima;
    if (dto.fechaProxima !== undefined) {
      const fp = emptyToNull(dto.fechaProxima);
      nextFechaProxima = fp ? parseDateOrThrow(fp, "Fecha próxima") : null;
    }

    const nextObservacion =
      dto.observacion !== undefined
        ? dto.observacion?.trim() || null
        : current.observacion;

    const nextArchivoUrl =
      dto.archivoUrl !== undefined ? dto.archivoUrl?.trim() || null : current.archivoUrl;

    const nextFilePath =
      dto.filePath !== undefined
        ? dto.filePath?.trim() || null
        : (current as any).filePath ?? null;

    const nextOriginalName =
      dto.originalName !== undefined
        ? dto.originalName?.trim() || null
        : (current as any).originalName ?? null;

    const nextMimeType =
      dto.mimeType !== undefined
        ? dto.mimeType?.trim() || null
        : (current as any).mimeType ?? null;

    const nextSizeBytes =
      dto.sizeBytes !== undefined
        ? typeof dto.sizeBytes === "number"
          ? dto.sizeBytes
          : null
        : (current as any).sizeBytes ?? null;

    if (nextType === "OTRO" && !(nextNombre || "").trim()) {
      throw new BadRequestException("Para tipo OTRO debes indicar un nombre");
    }

    const updated = await this.prisma.vehicleMaintenance.update({
      where: { id },
      data: {
        type: nextType,
        nombre: nextNombre,
        fechaRealizada: nextFechaRealizada,
        fechaProxima: nextFechaProxima,
        observacion: nextObservacion,
        archivoUrl: nextArchivoUrl,

        filePath: nextFilePath,
        originalName: nextOriginalName,
        mimeType: nextMimeType,
        sizeBytes: nextSizeBytes,
      } as any,
    });

    await this.audit.log({
      entity: AuditEntity.VEHICLE,
      entityId: updated.vehicleId,
      action: AuditAction.UPDATE,
      actor: safeActor(actor),
      meta: {
        title: "Editó Mantención",
        targetLabel: v?.patente || updated.vehicleId,
        before: {
          id: current.id,
          type: current.type,
          nombre: current.nombre,
          fechaRealizada: current.fechaRealizada,
          fechaProxima: current.fechaProxima,
          estado: calcEstadoByProxima(current.fechaProxima),

          originalName: (current as any).originalName ?? null,
          archivoUrl: current.archivoUrl ?? null,
          filePath: (current as any).filePath ?? null,
          mimeType: (current as any).mimeType ?? null,
          sizeBytes: (current as any).sizeBytes ?? null,
        },
        after: {
          id: updated.id,
          type: updated.type,
          nombre: updated.nombre,
          fechaRealizada: updated.fechaRealizada,
          fechaProxima: updated.fechaProxima,
          estado: calcEstadoByProxima(updated.fechaProxima),

          originalName: (updated as any).originalName ?? null,
          archivoUrl: updated.archivoUrl ?? null,
          filePath: (updated as any).filePath ?? null,
          mimeType: (updated as any).mimeType ?? null,
          sizeBytes: (updated as any).sizeBytes ?? null,
        },
      },
    });

    return {
      ...updated,
      estado: calcEstadoByProxima(updated.fechaProxima),
    };
  }

  // =========================
  // Remove
  // ✅ CAMBIO: respaldo + mover archivo a archive
  // =========================
  async remove(id: string, actor?: ActorLike) {
    const current = await this.prisma.vehicleMaintenance.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Mantención no encontrada");

    const v = await this.prisma.vehicle.findUnique({ where: { id: current.vehicleId } });

    const oldFilePath = (current as any).filePath || current.archivoUrl || null;

    // ✅ 1) mover archivo físico a archive si aplica
    let archivedUrl: string | null = null;
    try {
      if (this.shouldArchivePhysicalFile(oldFilePath)) {
        const destUrl = this.buildArchiveUrlFromOld(String(oldFilePath));
        const destAbsDir = join(process.cwd(), "uploads", "archive", "vehicle-maint");
        await this.ensureDir(destAbsDir);

        const srcAbs = this.toDiskPath(String(oldFilePath));
        const destAbs = this.toDiskPath(destUrl);

        await rename(srcAbs, destAbs);
        archivedUrl = destUrl;
      }
    } catch (e) {
      archivedUrl = null;
    }

    // ✅ 2) auditoría con snapshot completo
    await this.audit.log({
      entity: AuditEntity.VEHICLE,
      entityId: current.vehicleId,
      action: AuditAction.DELETE,
      actor: safeActor(actor),
      meta: {
        title: "Eliminó Mantención (respaldo)",
        targetLabel: v?.patente || current.vehicleId,
        before: {
          id: current.id,
          type: current.type,
          nombre: current.nombre,
          fechaRealizada: current.fechaRealizada,
          fechaProxima: current.fechaProxima,
          estado: calcEstadoByProxima(current.fechaProxima),

          observacion: current.observacion ?? null,
          archivoUrl: current.archivoUrl ?? null,

          filePath: (current as any).filePath ?? null,
          originalName: (current as any).originalName ?? null,
          mimeType: (current as any).mimeType ?? null,
          sizeBytes: (current as any).sizeBytes ?? null,

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
    await this.prisma.vehicleMaintenance.delete({ where: { id } });

    // ✅ 4) si no se pudo archivar y era físico, lo borramos (opcional)
    //     Si prefieres JAMÁS borrar, comenta este bloque.
    try {
      if (!archivedUrl && this.shouldArchivePhysicalFile(oldFilePath)) {
        await unlink(this.toDiskPath(String(oldFilePath)));
      }
    } catch (e) {}

    return { ok: true, archivedUrl };
  }
}




