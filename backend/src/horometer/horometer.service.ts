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
import * as ExcelJS from "exceljs";

// ✅ NUEVO: alertas horómetro
import { HorometerAlertsService } from "../alerts/horometer-alerts.service";

type Actor = { id: string; email: string; role?: string } | null;

@Injectable()
export class HorometerService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private horometerAlerts: HorometerAlertsService
  ) {}

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
    return `/uploads/archive/horometer/${stamp}-${rand}${ext}`;
  }

  private toDiskPath(pathOrUrl: string) {
    const clean = String(pathOrUrl || "").replace(/^\/+/, "");
    return join(process.cwd(), clean);
  }

  private isPhysicalHorometerFile(pathOrUrl: string | null | undefined) {
    if (!pathOrUrl) return false;
    const p = String(pathOrUrl);
    return p.startsWith("/uploads/horometer/") || p.startsWith("uploads/horometer/");
  }

  private fmtDate(value: any) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";

    return d.toLocaleDateString("es-CL", {
      timeZone: "America/Santiago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }

  private fmtTime(value: any) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";

    return d.toLocaleTimeString("es-CL", {
      timeZone: "America/Santiago",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

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

    try {
      await this.horometerAlerts.onHorometerCreated({
        vehicleId: vehicle.id,
        horas,
      });
    } catch {}

    return created;
  }

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

  // ✅ NUEVO: EXPORTAR EXCEL HORÓMETROS
  async exportAdminExcel(params: {
    q?: string;
    empresa?: "ALL" | "GRUAS_THOMAS" | "INSPROTEL";
  }) {
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

    const rows = await this.prisma.horometerRecord.findMany({
      where,
      orderBy: { createdAt: "desc" },
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
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Sistema Grúas Thomas";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Horómetros");

    sheet.columns = [
  { header: "EMPRESA", key: "empresa", width: 18 },
  { header: "PATENTE", key: "patente", width: 18 },
  { header: "MARCA / MODELO", key: "marcaModelo", width: 32 },
  { header: "FECHA INGRESO", key: "fecha", width: 18 },
  { header: "HORA INGRESO", key: "hora", width: 16 },
  { header: "HORAS", key: "horas", width: 12 },
];

    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F2937" },
    };
    sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

    rows.forEach((item: any) => {
  sheet.addRow({
    empresa: item.empresa || item.vehicle?.empresa || "",
    patente: item.vehicle?.patente || "",
    marcaModelo: item.vehicle?.marcaModelo || "",
    fecha: this.fmtDate(item.createdAt),
    hora: this.fmtTime(item.createdAt),
    horas: item.horas ?? "",
  });

      sheet.addRow({
        empresa: item.empresa || item.vehicle?.empresa || "",
        patente: item.vehicle?.patente || "",
        marcaModelo: item.vehicle?.marcaModelo || "",
        fecha: this.fmtDate(item.createdAt),
        hora: this.fmtTime(item.createdAt),
        horas: item.horas ?? "",
        rut: item.trabajadorRut || "",
        correo: item.trabajadorEmail || "",
        comentario: item.comentario || "",
      });
    });

    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE5E7EB" } },
          left: { style: "thin", color: { argb: "FFE5E7EB" } },
          bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
          right: { style: "thin", color: { argb: "FFE5E7EB" } },
        };
        cell.alignment = { vertical: "middle", wrapText: true };
      });
    });

    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = {
      from: "A1",
      to: "F1",
    };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer as ArrayBuffer);
  }

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

    try {
      if (this.isPhysicalHorometerFile(oldFilePath)) {
        await this.ensureArchiveDir();

        archivedUrl = this.buildArchivePath(String(oldFilePath));

        await rename(this.toDiskPath(String(oldFilePath)), this.toDiskPath(archivedUrl));
      }
    } catch {
      archivedUrl = null;
    }

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

    await this.prisma.horometerRecord.delete({ where: { id } });

    return { ok: true, archivedUrl };
  }
}



