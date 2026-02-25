// ✅ Archivo: src/vehicles/vehicle-documents.service.ts
// (COMPLETO) ✅ Opción 1: 1 documento por tipo (excepto OTRO) => se REEMPLAZA (update) en vez de acumular
// ✅ CAMBIO: Al eliminar, se deja RESPALDO:
// - Se guarda snapshot completo en AuditLog (data.before)
// - Si el archivo era físico, se MUEVE a /uploads/archive/vehicle-docs/ (no se borra)
// - Luego se elimina el registro en BD (delete)
//
// ✅ PERMISOS (SOLO CAMIONES):
// - Roles permitidos: SUPERADMIN, CONTROL_FLOTA (FULL)
// - Cualquier otro rol: 403

import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuditAction, AuditEntity, DocumentType } from "@prisma/client";
import { unlink, rename, mkdir } from "fs/promises";
import { join, extname } from "path";

type Empresa = "GRUAS_THOMAS" | "INSPROTEL";

type ActorLike =
  | {
      id?: string;
      email?: string;
      role?: string;
      empresa?: Empresa | null;
    }
  | null;

type CreateDocDto = {
  type: DocumentType;
  nombre?: string;
  fechaVencimiento?: string; // ✅ opcional
  observacion?: string;

  archivoUrl?: string;

  filePath?: string;
  originalName?: string;
  mimeType?: string;
  sizeBytes?: number;
};

type UpdateDocDto = {
  type?: DocumentType;
  nombre?: string;
  fechaVencimiento?: string; // ✅ opcional
  observacion?: string;
  archivoUrl?: string;
};

type ReplaceFileDto = {
  type?: DocumentType;
  nombre?: string;
  fechaVencimiento?: string; // ✅ opcional
  observacion?: string;

  archivoUrl: string;
  filePath: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
};

@Injectable()
export class VehicleDocumentsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  // =========================
  // Helpers
  // =========================

  private roleUpper(actor: ActorLike) {
    return String(actor?.role || "").toUpperCase();
  }

  private isGlobalRole(actor?: ActorLike) {
    const r = this.roleUpper(actor ?? null);
    return r === "SUPERADMIN" || r === "CONTROL_FLOTA";
  }

  private empresaFromActorOrThrow(actor: ActorLike): Empresa {
    const emp = actor?.empresa as Empresa | undefined | null;
    if (!emp)
      throw new ForbiddenException("No se pudo determinar la empresa del usuario.");
    return emp;
  }

  // ✅ AHORA: SOLO SUPERADMIN / CONTROL_FLOTA
  private assertEmpresaAccessOrThrow(actor: ActorLike, _resourceEmpresa: Empresa) {
    if (this.isGlobalRole(actor)) return;
    throw new ForbiddenException("No tienes permisos.");
  }

  private calcEstado(fechaVencimiento: Date | null) {
    if (!fechaVencimiento) return "VIGENTE";

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const fv = new Date(fechaVencimiento);
    fv.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil(
      (fv.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays < 0) return "VENCIDO";
    if (diffDays <= 30) return "POR_VENCER";
    return "VIGENTE";
  }

  private safeActor(actor?: ActorLike) {
    return actor?.id && actor?.email ? { id: actor.id, email: actor.email } : null;
  }

  private parseFechaOrThrow(value: string, fieldName = "fechaVencimiento") {
    const d = new Date(value);
    if (isNaN(d.getTime())) throw new BadRequestException(`${fieldName} inválida`);
    return d;
  }

  private validateTipoNombre(type: DocumentType, nombre?: string) {
    if (type === DocumentType.OTRO && !(nombre || "").trim()) {
      throw new BadRequestException("Para tipo OTRO debes indicar nombre");
    }
  }

  private normalizeFileMeta(dto: CreateDocDto) {
    const archivoUrl = dto.archivoUrl?.trim() || null;

    const filePath = (dto.filePath?.trim() || archivoUrl || "manual-url").trim();
    const originalName = (dto.originalName?.trim() || "manual-url").trim();
    const mimeType = (dto.mimeType?.trim() || "application/octet-stream").trim();
    const sizeBytes =
      typeof dto.sizeBytes === "number" && Number.isFinite(dto.sizeBytes)
        ? dto.sizeBytes
        : 0;

    return { archivoUrl, filePath, originalName, mimeType, sizeBytes };
  }

  private shouldDeletePhysicalFile(filePathOrUrl: string | null | undefined) {
    if (!filePathOrUrl) return false;
    return String(filePathOrUrl).startsWith("/uploads/vehicle-docs/");
  }

  private toDiskPath(filePathOrUrl: string) {
    const clean = String(filePathOrUrl).replace(/^\/+/, "");
    return join(process.cwd(), clean);
  }

  private normalizeEmpresaFromVehicleRow(empresaValue: any): Empresa {
    return String(empresaValue) === "INSPROTEL" ? "INSPROTEL" : "GRUAS_THOMAS";
  }

  // ✅ tipos que deben ser 1 por vehículo (NO acumular)
  private isSinglePerType(t: DocumentType) {
    return t !== DocumentType.OTRO;
  }

  private async ensureDir(dirAbs: string) {
    await mkdir(dirAbs, { recursive: true });
  }

  private buildArchiveUrlFromOld(oldUrlOrPath: string) {
    const oldExt = extname(oldUrlOrPath || "").toLowerCase() || "";
    const stamp = Date.now();
    const rand = Math.random().toString(16).slice(2);
    return `/uploads/archive/vehicle-docs/${stamp}-${rand}${oldExt}`;
  }

  // =========================
  // Listar documentos por vehículo
  // =========================
  async listByVehicle(vehicleId: string, actor?: ActorLike) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true, patente: true, empresa: true as any, activo: true as any },
    });
    if (!vehicle) throw new NotFoundException("Vehículo no existe");
    if ((vehicle as any).activo === false) throw new NotFoundException("Vehículo no existe");

    if (actor) {
      const vEmp = this.normalizeEmpresaFromVehicleRow((vehicle as any).empresa);
      this.assertEmpresaAccessOrThrow(actor, vEmp);
    }

    const docs = await this.prisma.vehicleDocument.findMany({
      where: { vehicleId },
      orderBy: [{ fechaVencimiento: "asc" }, { createdAt: "desc" }],
    });

    return docs.map((d) => ({
      ...d,
      estado: this.calcEstado(d.fechaVencimiento ?? null),
    }));
  }

  // =========================
  // ✅ NUEVO: upsert por vehicle + type (sin archivo)
  // - OTRO => CREATE (siempre)
  // - otros => si existe => UPDATE, si no => CREATE
  // =========================
  async upsertByVehicleType(vehicleId: string, dto: CreateDocDto, actor?: ActorLike) {
    // OTRO acumula
    if (!this.isSinglePerType(dto.type)) {
      return this.create(vehicleId, dto, actor);
    }

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true, patente: true, empresa: true as any, activo: true as any },
    });
    if (!vehicle) throw new NotFoundException("Vehículo no existe");
    if ((vehicle as any).activo === false) throw new NotFoundException("Vehículo no existe");

    if (actor) {
      const vEmp = this.normalizeEmpresaFromVehicleRow((vehicle as any).empresa);
      this.assertEmpresaAccessOrThrow(actor, vEmp);
    }

    const fecha = dto.fechaVencimiento ? this.parseFechaOrThrow(dto.fechaVencimiento) : null;
    this.validateTipoNombre(dto.type, dto.nombre);
    const meta = this.normalizeFileMeta(dto);

    const existing = await this.prisma.vehicleDocument.findFirst({
      where: { vehicleId, type: dto.type },
    });

    if (existing) {
      const updated = await this.prisma.vehicleDocument.update({
        where: { id: existing.id },
        data: {
          nombre: dto.nombre?.trim() || null,
          fechaVencimiento: fecha,
          observacion: dto.observacion?.trim() || null,
          archivoUrl: meta.archivoUrl,
          filePath: meta.filePath,
          originalName: meta.originalName,
          mimeType: meta.mimeType,
          sizeBytes: meta.sizeBytes,
        },
      });

      await this.audit.log({
        entity: AuditEntity.VEHICLE,
        entityId: vehicleId,
        action: AuditAction.UPDATE,
        actor: this.safeActor(actor),
        meta: {
          title: "Reemplazó documento (mismo tipo) en vehículo",
          vehicle: { id: vehicleId, patente: vehicle.patente },
          document: {
            id: updated.id,
            before: {
              type: existing.type,
              nombre: existing.nombre,
              fechaVencimiento: existing.fechaVencimiento,
              observacion: existing.observacion,
              archivoUrl: existing.archivoUrl,
              estado: this.calcEstado(existing.fechaVencimiento ?? null),
            },
            after: {
              type: updated.type,
              nombre: updated.nombre,
              fechaVencimiento: updated.fechaVencimiento,
              observacion: updated.observacion,
              archivoUrl: updated.archivoUrl,
              estado: this.calcEstado(updated.fechaVencimiento ?? null),
            },
          },
        },
      });

      return { ...updated, estado: this.calcEstado(updated.fechaVencimiento ?? null) };
    }

    return this.create(vehicleId, dto, actor);
  }

  // =========================
  // ✅ NUEVO: upsert por vehicle + type (CON archivo)
  // - OTRO => CREATE (siempre)
  // - otros => si existe => replaceFile(existing.id), si no => create
  // =========================
  async upsertFileByVehicleType(vehicleId: string, dto: ReplaceFileDto, actor?: ActorLike) {
    // OTRO acumula
    if (!this.isSinglePerType(dto.type as any)) {
      return this.create(
        vehicleId,
        {
          type: dto.type as any,
          nombre: dto.nombre,
          fechaVencimiento: dto.fechaVencimiento,
          observacion: dto.observacion,
          archivoUrl: dto.archivoUrl,
          filePath: dto.filePath,
          originalName: dto.originalName,
          mimeType: dto.mimeType,
          sizeBytes: dto.sizeBytes,
        } as any,
        actor
      );
    }

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true, patente: true, empresa: true as any, activo: true as any },
    });
    if (!vehicle) throw new NotFoundException("Vehículo no existe");
    if ((vehicle as any).activo === false) throw new NotFoundException("Vehículo no existe");

    if (actor) {
      const vEmp = this.normalizeEmpresaFromVehicleRow((vehicle as any).empresa);
      this.assertEmpresaAccessOrThrow(actor, vEmp);
    }

    this.validateTipoNombre(dto.type as any, dto.nombre);

    const existing = await this.prisma.vehicleDocument.findFirst({
      where: { vehicleId, type: dto.type as any },
    });

    if (existing) {
      return this.replaceFile(existing.id, dto, actor);
    }

    return this.create(
      vehicleId,
      {
        type: dto.type as any,
        nombre: dto.nombre,
        fechaVencimiento: dto.fechaVencimiento,
        observacion: dto.observacion,
        archivoUrl: dto.archivoUrl,
        filePath: dto.filePath,
        originalName: dto.originalName,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
      } as any,
      actor
    );
  }

  // =========================
  // ✅ Crear documento
  // =========================
  async create(vehicleId: string, dto: CreateDocDto, actor?: ActorLike) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true, patente: true, empresa: true as any, activo: true as any },
    });
    if (!vehicle) throw new NotFoundException("Vehículo no existe");
    if ((vehicle as any).activo === false) throw new NotFoundException("Vehículo no existe");

    if (actor) {
      const vEmp = this.normalizeEmpresaFromVehicleRow((vehicle as any).empresa);
      this.assertEmpresaAccessOrThrow(actor, vEmp);
    }

    const fecha = dto.fechaVencimiento ? this.parseFechaOrThrow(dto.fechaVencimiento) : null;
    this.validateTipoNombre(dto.type, dto.nombre);

    const meta = this.normalizeFileMeta(dto);

    // ✅ OTRO => SIEMPRE create
    if (!this.isSinglePerType(dto.type)) {
      const created = await this.prisma.vehicleDocument.create({
        data: {
          vehicleId,
          type: dto.type,
          nombre: dto.nombre?.trim() || null,
          fechaVencimiento: fecha,
          observacion: dto.observacion?.trim() || null,
          archivoUrl: meta.archivoUrl,
          filePath: meta.filePath,
          originalName: meta.originalName,
          mimeType: meta.mimeType,
          sizeBytes: meta.sizeBytes,
        },
      });

      await this.audit.log({
        entity: AuditEntity.VEHICLE,
        entityId: vehicleId,
        action: AuditAction.CREATE,
        actor: this.safeActor(actor),
        meta: {
          title: "Agregó documento a vehículo",
          vehicle: { id: vehicleId, patente: vehicle.patente },
          document: {
            id: created.id,
            type: created.type,
            nombre: created.nombre,
            fechaVencimiento: created.fechaVencimiento,
            estado: this.calcEstado(created.fechaVencimiento ?? null),
          },
        },
      });

      return { ...created, estado: this.calcEstado(created.fechaVencimiento ?? null) };
    }

    // ✅ 1) Buscar si ya existe doc para este vehículo + type
    const existing = await this.prisma.vehicleDocument.findFirst({
      where: { vehicleId, type: dto.type },
    });

    // ✅ 2) Si existe => UPDATE (reemplazo)
    if (existing) {
      const oldFilePath = (existing as any).filePath || existing.archivoUrl || null;

      const updated = await this.prisma.vehicleDocument.update({
        where: { id: existing.id },
        data: {
          nombre: dto.nombre?.trim() || null,
          fechaVencimiento: fecha,
          observacion: dto.observacion?.trim() || null,

          archivoUrl: meta.archivoUrl,

          filePath: meta.filePath,
          originalName: meta.originalName,
          mimeType: meta.mimeType,
          sizeBytes: meta.sizeBytes,
        },
      });

      // ✅ borrar archivo anterior si era físico y cambió
      try {
        const newFilePath = (updated as any).filePath || updated.archivoUrl || null;
        const changed = oldFilePath && newFilePath && String(oldFilePath) !== String(newFilePath);

        if (changed && this.shouldDeletePhysicalFile(oldFilePath)) {
          await unlink(this.toDiskPath(oldFilePath));
        }
      } catch (e) {}

      await this.audit.log({
        entity: AuditEntity.VEHICLE,
        entityId: vehicleId,
        action: AuditAction.UPDATE,
        actor: this.safeActor(actor),
        meta: {
          title: "Reemplazó documento (mismo tipo) en vehículo",
          vehicle: { id: vehicleId, patente: vehicle.patente },
          document: {
            id: updated.id,
            before: {
              type: existing.type,
              nombre: existing.nombre,
              fechaVencimiento: existing.fechaVencimiento,
              observacion: existing.observacion,
              archivoUrl: existing.archivoUrl,
              originalName: (existing as any).originalName,
              mimeType: (existing as any).mimeType,
              sizeBytes: (existing as any).sizeBytes,
              estado: this.calcEstado(existing.fechaVencimiento ?? null),
            },
            after: {
              type: updated.type,
              nombre: updated.nombre,
              fechaVencimiento: updated.fechaVencimiento,
              observacion: updated.observacion,
              archivoUrl: updated.archivoUrl,
              originalName: (updated as any).originalName,
              mimeType: (updated as any).mimeType,
              sizeBytes: (updated as any).sizeBytes,
              estado: this.calcEstado(updated.fechaVencimiento ?? null),
            },
          },
        },
      });

      return { ...updated, estado: this.calcEstado(updated.fechaVencimiento ?? null) };
    }

    // ✅ 3) Si NO existe => CREATE normal
    const created = await this.prisma.vehicleDocument.create({
      data: {
        vehicleId,
        type: dto.type,
        nombre: dto.nombre?.trim() || null,
        fechaVencimiento: fecha,
        observacion: dto.observacion?.trim() || null,

        archivoUrl: meta.archivoUrl,

        filePath: meta.filePath,
        originalName: meta.originalName,
        mimeType: meta.mimeType,
        sizeBytes: meta.sizeBytes,
      },
    });

    await this.audit.log({
      entity: AuditEntity.VEHICLE,
      entityId: vehicleId,
      action: AuditAction.CREATE,
      actor: this.safeActor(actor),
      meta: {
        title: "Agregó documento a vehículo",
        vehicle: { id: vehicleId, patente: vehicle.patente },
        document: {
          id: created.id,
          type: created.type,
          nombre: created.nombre,
          fechaVencimiento: created.fechaVencimiento,
          estado: this.calcEstado(created.fechaVencimiento ?? null),
        },
      },
    });

    return { ...created, estado: this.calcEstado(created.fechaVencimiento ?? null) };
  }

  // =========================
  // Actualizar documento (sin archivo)
  // =========================
  async update(docId: string, dto: UpdateDocDto, actor?: ActorLike) {
    const existing = await this.prisma.vehicleDocument.findUnique({
      where: { id: docId },
      include: { vehicle: true },
    });
    if (!existing) throw new NotFoundException("Documento no existe");
    if ((existing.vehicle as any)?.activo === false) throw new NotFoundException("Documento no existe");

    if (actor) {
      const vEmp = this.normalizeEmpresaFromVehicleRow((existing.vehicle as any)?.empresa);
      this.assertEmpresaAccessOrThrow(actor, vEmp);
    }

    let fecha: Date | null | undefined = undefined;
    if (dto.fechaVencimiento !== undefined) {
      if (!dto.fechaVencimiento) fecha = null;
      else fecha = this.parseFechaOrThrow(dto.fechaVencimiento);
    }

    const finalType = dto.type ?? existing.type;
    const finalNombre = dto.nombre !== undefined ? dto.nombre : existing.nombre ?? undefined;
    this.validateTipoNombre(finalType as any, finalNombre);

    const updated = await this.prisma.vehicleDocument.update({
      where: { id: docId },
      data: {
        type: dto.type ?? undefined,
        nombre: dto.nombre !== undefined ? (dto.nombre?.trim() || null) : undefined,
        fechaVencimiento: fecha !== undefined ? fecha : undefined,
        observacion: dto.observacion !== undefined ? (dto.observacion?.trim() || null) : undefined,
        archivoUrl: dto.archivoUrl !== undefined ? (dto.archivoUrl?.trim() || null) : undefined,
      },
    });

    await this.audit.log({
      entity: AuditEntity.VEHICLE,
      entityId: existing.vehicleId,
      action: AuditAction.UPDATE,
      actor: this.safeActor(actor),
      meta: {
        title: "Actualizó documento de vehículo",
        vehicle: { id: existing.vehicleId, patente: existing.vehicle?.patente },
        document: {
          id: updated.id,
          before: {
            type: existing.type,
            nombre: existing.nombre,
            fechaVencimiento: existing.fechaVencimiento,
            observacion: existing.observacion,
            archivoUrl: existing.archivoUrl,
            estado: this.calcEstado(existing.fechaVencimiento ?? null),
          },
          after: {
            type: updated.type,
            nombre: updated.nombre,
            fechaVencimiento: updated.fechaVencimiento,
            observacion: updated.observacion,
            archivoUrl: updated.archivoUrl,
            estado: this.calcEstado(updated.fechaVencimiento ?? null),
          },
        },
      },
    });

    return { ...updated, estado: this.calcEstado(updated.fechaVencimiento ?? null) };
  }

  // =========================
  // Reemplazar archivo + actualizar campos
  // =========================
  async replaceFile(docId: string, dto: ReplaceFileDto, actor?: ActorLike) {
    const existing = await this.prisma.vehicleDocument.findUnique({
      where: { id: docId },
      include: { vehicle: true },
    });
    if (!existing) throw new NotFoundException("Documento no existe");
    if ((existing.vehicle as any)?.activo === false) throw new NotFoundException("Documento no existe");

    if (actor) {
      const vEmp = this.normalizeEmpresaFromVehicleRow((existing.vehicle as any)?.empresa);
      this.assertEmpresaAccessOrThrow(actor, vEmp);
    }

    let fecha: Date | null | undefined = undefined;
    if (dto.fechaVencimiento !== undefined) {
      if (!dto.fechaVencimiento) fecha = null;
      else fecha = this.parseFechaOrThrow(dto.fechaVencimiento);
    }

    const finalType = dto.type ?? existing.type;
    const finalNombre = dto.nombre !== undefined ? dto.nombre : existing.nombre ?? undefined;
    this.validateTipoNombre(finalType as any, finalNombre);

    const oldFilePath = (existing as any).filePath || existing.archivoUrl || null;

    const updated = await this.prisma.vehicleDocument.update({
      where: { id: docId },
      data: {
        type: dto.type ?? undefined,
        nombre: dto.nombre !== undefined ? (dto.nombre?.trim() || null) : undefined,
        fechaVencimiento: fecha !== undefined ? fecha : undefined,
        observacion: dto.observacion !== undefined ? (dto.observacion?.trim() || null) : undefined,

        archivoUrl: dto.archivoUrl?.trim() || null,
        filePath: dto.filePath?.trim(),
        originalName: dto.originalName?.trim(),
        mimeType: dto.mimeType?.trim(),
        sizeBytes: dto.sizeBytes,
      },
    });

    // ✅ borra SIEMPRE el archivo anterior si era físico (porque es reemplazo explícito)
    try {
      if (this.shouldDeletePhysicalFile(oldFilePath)) {
        await unlink(this.toDiskPath(oldFilePath));
      }
    } catch (e) {}

    await this.audit.log({
      entity: AuditEntity.VEHICLE,
      entityId: existing.vehicleId,
      action: AuditAction.UPDATE,
      actor: this.safeActor(actor),
      meta: {
        title: "Reemplazó archivo de documento de vehículo",
        vehicle: { id: existing.vehicleId, patente: existing.vehicle?.patente },
        document: {
          id: updated.id,
          before: {
            type: existing.type,
            nombre: existing.nombre,
            fechaVencimiento: existing.fechaVencimiento,
            observacion: existing.observacion,
            archivoUrl: existing.archivoUrl,
            originalName: (existing as any).originalName,
            mimeType: (existing as any).mimeType,
            sizeBytes: (existing as any).sizeBytes,
            estado: this.calcEstado(existing.fechaVencimiento ?? null),
          },
          after: {
            type: updated.type,
            nombre: updated.nombre,
            fechaVencimiento: updated.fechaVencimiento,
            observacion: updated.observacion,
            archivoUrl: updated.archivoUrl,
            originalName: (updated as any).originalName,
            mimeType: (updated as any).mimeType,
            sizeBytes: (updated as any).sizeBytes,
            estado: this.calcEstado(updated.fechaVencimiento ?? null),
          },
        },
      },
    });

    return { ...updated, estado: this.calcEstado(updated.fechaVencimiento ?? null) };
  }

  // =========================
  // Eliminar documento
  // ✅ respaldo + archivo a carpeta archive
  // =========================
  async remove(docId: string, actor?: ActorLike) {
    const existing = await this.prisma.vehicleDocument.findUnique({
      where: { id: docId },
      include: { vehicle: true },
    });
    if (!existing) throw new NotFoundException("Documento no existe");
    if ((existing.vehicle as any)?.activo === false) throw new NotFoundException("Documento no existe");

    if (actor) {
      const vEmp = this.normalizeEmpresaFromVehicleRow((existing.vehicle as any)?.empresa);
      this.assertEmpresaAccessOrThrow(actor, vEmp);
    }

    const oldFilePath = (existing as any).filePath || existing.archivoUrl || null;

    // ✅ 1) Intentar respaldar archivo físico moviéndolo a /uploads/archive/vehicle-docs/
    let archivedUrl: string | null = null;
    try {
      if (this.shouldDeletePhysicalFile(oldFilePath)) {
        const destUrl = this.buildArchiveUrlFromOld(String(oldFilePath));
        const destAbsDir = join(process.cwd(), "uploads", "archive", "vehicle-docs");
        await this.ensureDir(destAbsDir);

        const srcAbs = this.toDiskPath(String(oldFilePath));
        const destAbs = this.toDiskPath(destUrl);

        await rename(srcAbs, destAbs);
        archivedUrl = destUrl;
      }
    } catch (e) {
      archivedUrl = null;
    }

    // ✅ 2) Guardar respaldo completo en auditoría ANTES de borrar
    await this.audit.log({
      entity: AuditEntity.VEHICLE,
      entityId: existing.vehicleId,
      action: AuditAction.DELETE,
      actor: this.safeActor(actor),
      meta: {
        title: "Eliminó documento de vehículo (respaldo)",
        vehicle: {
          id: existing.vehicleId,
          patente: existing.vehicle?.patente,
          empresa: (existing.vehicle as any)?.empresa ?? null,
        },
        document: {
          id: existing.id,
          type: existing.type,
          nombre: existing.nombre,
          fechaVencimiento: existing.fechaVencimiento,
          observacion: existing.observacion,
          archivoUrl: existing.archivoUrl,
          filePath: (existing as any).filePath,
          originalName: (existing as any).originalName,
          mimeType: (existing as any).mimeType,
          sizeBytes: (existing as any).sizeBytes,
          createdAt: (existing as any).createdAt ?? null,
          estado: this.calcEstado(existing.fechaVencimiento ?? null),
          backup: {
            archivedUrl,
            oldFilePath,
          },
        },
      },
    });

    // ✅ 3) Borrar registro en BD
    await this.prisma.vehicleDocument.delete({ where: { id: docId } });

    // ✅ 4) Si NO se pudo archivar y era físico, lo borramos (opcional).
    //     Si prefieres JAMÁS borrar, comenta este bloque.
    try {
      if (!archivedUrl && this.shouldDeletePhysicalFile(oldFilePath)) {
        await unlink(this.toDiskPath(String(oldFilePath)));
      }
    } catch (e) {}

    return { ok: true, deletedId: docId, archivedUrl };
  }
}









