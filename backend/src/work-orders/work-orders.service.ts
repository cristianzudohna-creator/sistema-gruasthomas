// ✅ Archivo: src/work-orders/work-orders.service.ts (COMPLETO)
// ✅ FIX PRINCIPAL: SUPERADMIN/CONTROL_FLOTA puede crear OT sin empresa asignada (empresa se resuelve de forma robusta)
// ✅ FIX PRINCIPAL: al crear OT se guarda assignedToId = dto.conductorId (si viene)  <-- (lo usamos como "operadorId" por compatibilidad)
// ✅ FIX: NO asignamos empresa al trabajador automáticamente (evita cambios invisibles)
// ✅ FIX: si viene trabajador con empresa, esa empresa manda (y si dto.empresa viene distinta => error claro)
// ✅ FIX PDF: "Operador" muestra nombre del conductor si operador viene vacío
// ✅ FIX PDF: "Kilómetros" busca en múltiples claves del workerReport/detalleHoras
// ✅ FIX PDF: NO mostrar "Km colación" (celda vacía)
// ✅ CAMBIO: NO autocrear clientes. Solo usar dto.clientId si viene y validar empresa.
// ✅ CAMBIO NUEVO: Validación del asignado como OPERADOR (workerType)

import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateWorkOrderDto,
  DIAS_TRABAJO_VALIDOS,
} from "./dto/create-work-order.dto";
import { CompleteWorkOrderDto } from "./dto/complete-work-order.dto";
import {
  Empresa,
  WorkOrderStatus,
  AuditAction,
  AuditEntity,
} from "@prisma/client";

import { AuditService } from "../audit/audit.service";

import PDFDocument = require("pdfkit");

import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";

function cleanStr(v: any): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

function cleanDiasTrabajo(v: any): string[] {
  if (!Array.isArray(v)) return [];
  const cleaned = v
    .map((x) => String(x || "").trim().toUpperCase())
    .filter(Boolean)
    .filter((x) => DIAS_TRABAJO_VALIDOS.includes(x as any));
  return Array.from(new Set(cleaned));
}

function fmtDateOnly(d: any) {
  if (!d) return "";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "";
  const dd = String(x.getDate()).padStart(2, "0");
  const mm = String(x.getMonth() + 1).padStart(2, "0");
  const yy = String(x.getFullYear());
  return `${dd}/${mm}/${yy}`;
}

function fmtTimeIfHHMM(v: any) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) return s;
  return s;
}

function safeParseWorkerReport(v: any): any | null {
  if (!v) return null;
  if (typeof v === "object") return v;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  }
  return null;
}

function pdfBufferFromDoc(doc: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (e: any) => reject(e));
  });
}

function getLogoPath(): string | null {
  const p = join(process.cwd(), "uploads", "branding", "logo-thomas.png");
  return existsSync(p) ? p : null;
}

function isImageFilename(name: string) {
  const n = String(name || "").toLowerCase();
  return (
    n.endsWith(".jpg") ||
    n.endsWith(".jpeg") ||
    n.endsWith(".png") ||
    n.endsWith(".webp") ||
    n.endsWith(".gif")
  );
}

/**
 * ✅ Normaliza RUT:
 * - quita puntos/espacios
 * - deja DV en mayúscula
 * - asegura guion: 12345678-K
 */
function normalizeRut(rutRaw: any): string | null {
  const r = cleanStr(rutRaw);
  if (!r) return null;

  const v = r.replace(/\./g, "").replace(/\s/g, "");
  const m = v.match(/^(\d{7,8})-?([\dkK])$/);
  if (!m) return cleanStr(rutRaw);
  const num = m[1];
  const dv = String(m[2]).toUpperCase();
  return `${num}-${dv}`;
}

/**
 * ✅ FIRMA: obtiene Buffer de la firma desde:
 * - workerReport.signature.dataUrl (data:image/...;base64,...)
 * - base64 (data:image/...;base64,... o base64 pelado) guardado en campos comunes
 * - url o ruta /uploads/...
 * - archivo dentro de uploads/work-orders/{id}/ (firma.png, signature.png, etc.)
 */
function getSignatureBuffer(workOrder: any, id: string): Buffer | null {
  const wr = safeParseWorkerReport(workOrder?.workerReport);
  const dataUrl =
    typeof wr?.signature?.dataUrl === "string" ? wr.signature.dataUrl.trim() : "";
  if (dataUrl && /^data:image\/\w+;base64,/i.test(dataUrl)) {
    try {
      const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
      return Buffer.from(base64Data, "base64");
    } catch {}
  }

  const candidates = [
    workOrder?.clientSignature,
    workOrder?.firmaCliente,
    workOrder?.signature,
    workOrder?.signatureBase64,
    workOrder?.signatureUrl,
    workOrder?.firmaUrl,
  ]
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean);

  for (const s of candidates) {
    if (/^data:image\/\w+;base64,/i.test(s)) {
      try {
        const base64Data = s.replace(/^data:image\/\w+;base64,/, "");
        return Buffer.from(base64Data, "base64");
      } catch {}
    }

    if (s.length > 200 && /^[A-Za-z0-9+/=\s]+$/.test(s)) {
      try {
        return Buffer.from(s.replace(/\s/g, ""), "base64");
      } catch {}
    }

    if (s.startsWith("/uploads/") || s.startsWith("uploads/")) {
      const rel = s.startsWith("/") ? s.slice(1) : s;
      const abs = join(process.cwd(), rel);
      if (existsSync(abs)) {
        try {
          return readFileSync(abs);
        } catch {}
      }
    }
  }

  const dir = join(process.cwd(), "uploads", "work-orders", id);
  if (!existsSync(dir)) return null;

  const preferred = [
    "firma.png",
    "signature.png",
    "sign.png",
    "firma.jpg",
    "signature.jpg",
    "firma.jpeg",
    "signature.jpeg",
  ];
  for (const fname of preferred) {
    const p = join(dir, fname);
    if (existsSync(p)) {
      try {
        return readFileSync(p);
      } catch {}
    }
  }

  try {
    const files = readdirSync(dir).filter((f) => isImageFilename(f));
    const maybe = files.find((f) => /firma|sign|signature/i.test(f));
    if (maybe) return readFileSync(join(dir, maybe));
  } catch {}

  return null;
}

@Injectable()
export class WorkOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  // =========================
  // ✅ SCOPING POR EMPRESA / ROLES
  // =========================
  private roleUpper(actor: any) {
    return String(actor?.role || "").toUpperCase();
  }

  private isGlobalRole(actor: any) {
    const r = this.roleUpper(actor);
    return r === "SUPERADMIN" || r === "CONTROL_FLOTA";
  }

  private isOtAdminRole(actor: any) {
    const r = this.roleUpper(actor);
    return r === "SUPERADMIN" || r === "CONTROL_FLOTA" || r === "ADMINISTRADORA";
  }

  private async getActorOrThrowById(userId?: string) {
    if (!userId) throw new BadRequestException("No se detectó el usuario logueado.");
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, empresa: true },
    });
    if (!user) throw new BadRequestException("Usuario logueado no existe.");
    return user;
  }

  private async getEmpresaForActorOrThrow(actor: any) {
    const emp = actor?.empresa as Empresa | undefined | null;
    if (emp) return emp;

    if (actor?.id) {
      const user = await this.prisma.user.findUnique({
        where: { id: actor.id },
        select: { empresa: true },
      });
      if (user?.empresa) return user.empresa as any;
    }

    throw new ForbiddenException("No se pudo determinar la empresa del usuario.");
  }

  private async empresaWhereByActor(actor: any) {
    if (this.isGlobalRole(actor)) return {};
    const emp = await this.getEmpresaForActorOrThrow(actor);
    return { empresa: emp };
  }

  private whereActivosOnly() {
    return { activo: true };
  }

  private whereInactivosOnly() {
    return { activo: false };
  }

  private async ensureAccessOrThrowActive(id: string, actor: any) {
    const wo = await this.prisma.workOrder.findUnique({
      where: { id },
      select: { id: true, empresa: true, activo: true, assignedToId: true },
    });

    if (!wo) throw new NotFoundException("OT no encontrada");
    if (wo.activo === false) throw new NotFoundException("OT no encontrada");

    if (!this.isGlobalRole(actor)) {
      const emp = await this.getEmpresaForActorOrThrow(actor);
      if (wo.empresa !== emp) throw new NotFoundException("OT no encontrada");
    }

    return wo;
  }

  // =========================
  // ✅ CLIENTES (AUTOCOMPLETE)
  // =========================
  async searchClients(search: string, actor?: any) {
    const q = cleanStr(search);
    if (!q) return { items: [] };

    const empresa = await this.getEmpresaForActorOrThrow(actor);

    const items = await this.prisma.client.findMany({
      where: {
        empresa,
        OR: [
          { nombre: { contains: q, mode: "insensitive" } },
          { rut: { contains: q } },
        ],
      },
      orderBy: { nombre: "asc" },
      take: 10,
      select: {
        id: true,
        nombre: true,
        rut: true,
        giro: true,
        telefono: true,
        direccion: true,
        comuna: true,
        ciudad: true,
      },
    });

    return { items };
  }

  // =========================
  // ✅ Helpers Cliente (RELACIÓN) - SIN AUTOCREAR
  // - Solo valida dto.clientId si viene
  // =========================
  private async resolveClientIdOrNull(dto: CreateWorkOrderDto, empresa: Empresa): Promise<string | null> {
    const cid = cleanStr((dto as any).clientId);
    if (!cid) return null;

    const client = await this.prisma.client.findUnique({
      where: { id: cid },
      select: { id: true, empresa: true },
    });

    if (!client) throw new BadRequestException("El cliente seleccionado no existe.");
    if (client.empresa !== empresa) {
      throw new BadRequestException("El cliente seleccionado pertenece a otra empresa.");
    }

    return client.id;
  }

  // =========================
  // ✅ FOTOS
  // =========================
  private listPhotosByWorkOrderId(id: string) {
    const dir = join(process.cwd(), "uploads", "work-orders", id);
    if (!existsSync(dir)) return [];

    const files = readdirSync(dir)
      .filter((f) => isImageFilename(f))
      .sort((a, b) => a.localeCompare(b));

    return files.map((filename) => ({
      filename,
      url: `/uploads/work-orders/${id}/${filename}`,
    }));
  }

  async uploadPhotos(id: string, files: Array<Express.Multer.File>) {
    if (!id) throw new BadRequestException("Falta id");
    if (!files || files.length === 0) return { ok: true, photos: [] };

    const photos = files
      .filter((f) => String(f.mimetype || "").startsWith("image/"))
      .map((f) => ({
        filename: f.filename,
        originalName: f.originalname,
        size: f.size,
        mimetype: f.mimetype,
        url: `/uploads/work-orders/${id}/${f.filename}`,
      }));

    return { ok: true, photos };
  }

  // =========================
  // ✅ ADMIN: CREATE / LIST / GET / UPDATE / DELETE
  // =========================
  async create(dto: CreateWorkOrderDto, createdById?: string) {
    const cliente = cleanStr((dto as any).cliente);
    const lugar = cleanStr((dto as any).lugar);

    if (!cliente && !lugar)
      throw new BadRequestException("Completa al menos Cliente o Lugar.");

    const createdBy = await this.getActorOrThrowById(createdById);

    const dtoEmpresaRaw = cleanStr((dto as any).empresa);
    const dtoEmpresa =
      dtoEmpresaRaw && ["GRUAS_THOMAS", "INSPROTEL"].includes(dtoEmpresaRaw)
        ? (dtoEmpresaRaw as Empresa)
        : null;

    // ⚠️ Compat: tu frontend manda conductorId, pero aquí lo tratamos como "operadorId" (asignado)
    const conductorId = cleanStr((dto as any).conductorId);

    let conductorUser: any = null;
    if (conductorId) {
      conductorUser = await this.prisma.user.findUnique({
        where: { id: conductorId },
        select: {
          id: true,
          activo: true,
          role: true,
          empresa: true,
          workerType: true,
          nombre: true,
          apellido: true,
        },
      });

      if (!conductorUser) {
        throw new BadRequestException("Operador seleccionado no existe.");
      }
      if (!conductorUser.activo) {
        throw new BadRequestException("Operador seleccionado está inactivo.");
      }
      if (String(conductorUser.role || "").toUpperCase() !== "TRABAJADOR") {
        throw new BadRequestException("Operador seleccionado no tiene rol TRABAJADOR.");
      }

      // ✅ CAMBIO CLAVE: validar como OPERADOR
      // - si workerType viene vacío/null, lo permitimos (no bloqueamos)
      const wt = String((conductorUser as any).workerType || "").toUpperCase();
      if (wt && wt !== "OPERADOR") {
        throw new BadRequestException("El usuario seleccionado no es tipo OPERADOR.");
      }
    }

    const isGlobal = this.isGlobalRole(createdBy);
    let empresaFinal: Empresa | null = null;

    if (isGlobal) {
      if (conductorUser?.empresa) {
        empresaFinal = conductorUser.empresa as Empresa;

        if (dtoEmpresa && dtoEmpresa !== empresaFinal) {
          throw new BadRequestException(
            "La empresa seleccionada no coincide con la empresa del operador. Cambia la empresa o el operador."
          );
        }
      } else {
        empresaFinal = (createdBy.empresa as any) || dtoEmpresa || null;
      }
    } else {
      empresaFinal = (await this.getEmpresaForActorOrThrow(createdBy)) as any;
    }

    if (!empresaFinal) {
      throw new BadRequestException(
        "Falta empresa. Selecciona Empresa (GRUAS_THOMAS / INSPROTEL) o el operador debe tener empresa asignada."
      );
    }

    if (conductorUser?.empresa && conductorUser.empresa !== empresaFinal) {
      throw new BadRequestException(
        "El operador seleccionado pertenece a otra empresa. Cambia la empresa o selecciona un operador de la empresa correcta."
      );
    }

    const empresa: Empresa = empresaFinal;

    const diasTrabajo = cleanDiasTrabajo((dto as any).diasTrabajo);
    const rutNorm = normalizeRut((dto as any).rut);

    // ✅ CAMBIO: ya NO se autocrea cliente. Solo se usa dto.clientId si viene y se valida.
    const clientId = await this.resolveClientIdOrNull(dto, empresa);

    // ✅ FIX: si no viene operador, lo derivamos del conductor (compat)
    const conductorNombre = cleanStr((dto as any).conductor) || null;
    const operadorDto = cleanStr((dto as any).operador);
    const operadorAuto =
      operadorDto ||
      conductorNombre ||
      (conductorUser
        ? `${conductorUser.nombre || ""}${conductorUser.apellido ? " " + conductorUser.apellido : ""}`.trim()
        : null);

    const data: any = {
      empresa,
      createdById: createdBy.id,

      // ✅ asignado = "operador" (pero viene en conductorId por compat)
      assignedToId: conductorId || null,

      status: WorkOrderStatus.ABIERTA,

      titulo: cliente || lugar || "OT",
      descripcion: cleanStr((dto as any).nota),

      clientId: clientId || null,

      cliente,
      rut: rutNorm || cleanStr((dto as any).rut),
      giro: cleanStr((dto as any).giro),

      solicitadoPor: cleanStr((dto as any).solicitadoPor),

      direccion: cleanStr((dto as any).direccion),
      comuna: cleanStr((dto as any).comuna),
      ciudad: cleanStr((dto as any).ciudad),

      telefonoCliente: cleanStr((dto as any).telefonoCliente),

      lugar,
      direccionFaena: cleanStr((dto as any).direccionFaena),

      horario: cleanStr((dto as any).horario),
      mapsLink: cleanStr((dto as any).mapsLink),

      camion: cleanStr((dto as any).camion),
      conductor: conductorNombre,
      operador: operadorAuto,
      rigger: cleanStr((dto as any).rigger),
      sinJib: !!(dto as any).sinJib,

      diasTrabajo,
      nota: cleanStr((dto as any).nota),

      activo: true,
      deletedAt: null,
    };

    return this.prisma.workOrder.create({ data });
  }

  async list(actor?: any) {
    const whereEmpresa = await this.empresaWhereByActor(actor);

    const items = await this.prisma.workOrder.findMany({
      where: { ...whereEmpresa, ...this.whereActivosOnly() },
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: {
          select: { id: true, email: true, nombre: true, apellido: true },
        },
        completedBy: {
          select: { id: true, email: true, nombre: true, apellido: true },
        },
        approvedBy: {
          select: { id: true, email: true, nombre: true, apellido: true },
        },
        client: { select: { id: true, nombre: true, rut: true } },
        assignedTo: {
          select: { id: true, email: true, nombre: true, apellido: true },
        },
      },
    });

    return { items };
  }

  async getById(id: string, actor?: any) {
    if (!id) throw new BadRequestException("Falta id");

    await this.ensureAccessOrThrowActive(id, actor);

    const wo = await this.prisma.workOrder.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, email: true, nombre: true, apellido: true } },
        completedBy: { select: { id: true, email: true, nombre: true, apellido: true } },
        approvedBy: { select: { id: true, email: true, nombre: true, apellido: true } },
        assignedTo: { select: { id: true, email: true, nombre: true, apellido: true } },
        client: {
          select: {
            id: true,
            nombre: true,
            rut: true,
            telefono: true,
            direccion: true,
            comuna: true,
            ciudad: true,
          },
        },
      },
    });

    if (!wo) throw new NotFoundException("OT no encontrada");
    if (wo.activo === false) throw new NotFoundException("OT no encontrada");

    const photos = this.listPhotosByWorkOrderId(id);
    return { ...wo, photos };
  }

  async update(id: string, dto: CreateWorkOrderDto, actor?: any) {
    if (!id) throw new BadRequestException("Falta id");

    const exists = await this.prisma.workOrder.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException("OT no encontrada");
    if (exists.activo === false) throw new NotFoundException("OT no encontrada");

    if (!this.isGlobalRole(actor)) {
      const emp = await this.getEmpresaForActorOrThrow(actor);
      if (exists.empresa !== emp) throw new NotFoundException("OT no encontrada");
    }

    const cliente = cleanStr((dto as any).cliente);
    const lugar = cleanStr((dto as any).lugar);
    if (!cliente && !lugar)
      throw new BadRequestException("Completa al menos Cliente o Lugar.");

    if (
      exists.status === WorkOrderStatus.APROBADA ||
      exists.status === WorkOrderStatus.CERRADA
    ) {
      throw new BadRequestException("No se puede editar una OT aprobada/cerrada.");
    }

    const rutNorm = normalizeRut((dto as any).rut);

    // ✅ CAMBIO: ya NO se autocrea cliente. Solo se usa dto.clientId si viene y se valida.
    const clientId = await this.resolveClientIdOrNull(dto, exists.empresa as any);

    const conductorNombre = cleanStr((dto as any).conductor);
    const operadorDto = cleanStr((dto as any).operador);

    const data: any = {
      titulo: cliente || lugar || "OT",
      descripcion: cleanStr((dto as any).nota),

      clientId: clientId || null,

      cliente,
      rut: rutNorm || cleanStr((dto as any).rut),
      giro: cleanStr((dto as any).giro),

      solicitadoPor: cleanStr((dto as any).solicitadoPor),

      direccion: cleanStr((dto as any).direccion),
      comuna: cleanStr((dto as any).comuna),
      ciudad: cleanStr((dto as any).ciudad),

      telefonoCliente: cleanStr((dto as any).telefonoCliente),

      lugar,
      direccionFaena: cleanStr((dto as any).direccionFaena),

      horario: cleanStr((dto as any).horario),
      mapsLink: cleanStr((dto as any).mapsLink),

      camion: cleanStr((dto as any).camion),
      conductor: conductorNombre,
      operador: operadorDto || conductorNombre || cleanStr((exists as any).operador),
      rigger: cleanStr((dto as any).rigger),
      sinJib: !!(dto as any).sinJib,

      diasTrabajo: cleanDiasTrabajo((dto as any).diasTrabajo),
      nota: cleanStr((dto as any).nota),
    };

    return this.prisma.workOrder.update({ where: { id }, data });
  }

  async remove(id: string, userId?: string) {
    if (!id) throw new BadRequestException("Falta id");

    const actor = await this.getActorOrThrowById(userId);

    if (!this.isOtAdminRole(actor)) {
      throw new ForbiddenException("No autorizado.");
    }

    const exists = await this.prisma.workOrder.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException("OT no encontrada");

    if (exists.activo === false) {
      return { ok: true, message: "OT ya estaba eliminada (inactiva)." };
    }

    if (!this.isGlobalRole(actor)) {
      const emp = await this.getEmpresaForActorOrThrow(actor);
      if (exists.empresa !== emp) throw new NotFoundException("OT no encontrada");
    }

    const before = exists;

    const after = await this.prisma.workOrder.update({
      where: { id },
      data: { activo: false, deletedAt: new Date() },
    });

    await this.audit.log({
      entity: AuditEntity.WORK_ORDER,
      entityId: id,
      action: AuditAction.DELETE,
      actor: { id: actor.id, email: actor.email },
      data: {
        targetLabel: after?.titulo || after?.cliente || `OT ${String(id).slice(0, 8)}`,
        title: after?.titulo || null,
        before,
        after,
      },
    });

    return { ok: true };
  }

  async listDeleted(actor?: any) {
    const role = this.roleUpper(actor);
    if (role !== "SUPERADMIN") throw new ForbiddenException("No tienes permisos.");

    const items = await this.prisma.workOrder.findMany({
      where: { ...this.whereInactivosOnly() },
      orderBy: { updatedAt: "desc" },
      include: {
        createdBy: { select: { id: true, email: true, nombre: true, apellido: true } },
        assignedTo: { select: { id: true, email: true, nombre: true, apellido: true } },
        client: { select: { id: true, nombre: true, rut: true } },
      },
    });

    return { items };
  }

  async restore(id: string, userId?: string) {
    if (!id) throw new BadRequestException("Falta id");

    const actor = await this.getActorOrThrowById(userId);

    const role = this.roleUpper(actor);
    if (role !== "SUPERADMIN") throw new ForbiddenException("No tienes permisos.");

    const exists = await this.prisma.workOrder.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException("OT no encontrada");

    if (exists.activo === true) {
      return { ok: true, message: "OT ya estaba activa." };
    }

    const before = exists;

    const after = await this.prisma.workOrder.update({
      where: { id },
      data: { activo: true, deletedAt: null },
    });

    await this.audit.log({
      entity: AuditEntity.WORK_ORDER,
      entityId: id,
      action: AuditAction.RESTORE,
      actor: { id: actor.id, email: actor.email },
      data: {
        targetLabel: after?.titulo || after?.cliente || `OT ${String(id).slice(0, 8)}`,
        title: after?.titulo || null,
        before,
        after,
      },
    });

    return { ok: true, workOrder: after };
  }

  private parseIncludeFinalizadas(v: any): boolean {
    if (v === undefined || v === null) return true;
    if (typeof v === "boolean") return v;

    if (typeof v === "object") {
      if ("includeFinalizadas" in v) {
        const x = (v as any).includeFinalizadas;
        if (x === undefined || x === null) return true;
        if (typeof x === "boolean") return x;
        const s = String(x).trim().toLowerCase();
        return s === "1" || s === "true" || s === "yes" || s === "on";
      }
      return true;
    }

    const s = String(v).trim().toLowerCase();
    return s === "1" || s === "true" || s === "yes" || s === "on";
  }

  async listForWorker(user: any, includeFinalizadas?: any) {
    if (!user?.id) throw new BadRequestException("No se detectó el usuario logueado.");

    const empresa = await this.getEmpresaForActorOrThrow(user);
    const include = this.parseIncludeFinalizadas(includeFinalizadas);

    const statusIn: WorkOrderStatus[] = [
      WorkOrderStatus.ABIERTA,
      WorkOrderStatus.EN_PROCESO,
      WorkOrderStatus.COMPLETADA,
      WorkOrderStatus.RECHAZADA,
      WorkOrderStatus.APROBADA,
    ];

    if (include) statusIn.push(WorkOrderStatus.CERRADA);

    return this.prisma.workOrder.findMany({
      where: {
        empresa,
        ...this.whereActivosOnly(),
        assignedToId: user.id,
        status: { in: statusIn },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        status: true,
        empresa: true,

        titulo: true,
        cliente: true,
        rut: true,
        giro: true,

        solicitadoPor: true,

        direccion: true,
        comuna: true,
        ciudad: true,

        telefonoCliente: true,
        direccionFaena: true,

        lugar: true,
        horario: true,
        mapsLink: true,

        diasTrabajo: true,

        camion: true,
        conductor: true,
        operador: true,
        rigger: true,
        sinJib: true,

        rejectReason: true,
        approvalComment: true,
        approvedAt: true,

        createdBy: { select: { id: true, email: true, nombre: true, apellido: true } },
        assignedTo: { select: { id: true, email: true, nombre: true, apellido: true } },
      },
    });
  }

  async complete(id: string, dto: CompleteWorkOrderDto, userId?: string) {
    if (!id) throw new BadRequestException("Falta id");
    if (!userId) throw new BadRequestException("No se detectó el usuario logueado.");

    const exists = await this.prisma.workOrder.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException("OT no encontrada");
    if (exists.activo === false) throw new NotFoundException("OT no encontrada");

    if (exists.assignedToId && exists.assignedToId !== userId) {
      throw new ForbiddenException("No tienes asignada esta OT.");
    }

    if (
      exists.status === WorkOrderStatus.APROBADA ||
      exists.status === WorkOrderStatus.CERRADA
    ) {
      throw new BadRequestException("Esta OT ya fue aprobada/cerrada.");
    }

    const workerReport = (dto as any)?.workerReport ?? null;
    if (!workerReport || typeof workerReport !== "object") {
      throw new BadRequestException("workerReport es obligatorio.");
    }

    const data: any = {
      workerReport,
      completedAt: new Date(),
      completedById: userId,
    };

    const comentarioFinal = cleanStr((dto as any)?.comentarioFinal);
    if (comentarioFinal) data.comentarioFinal = comentarioFinal;

    if ((dto as any)?.marcarCompletada) {
      data.status = WorkOrderStatus.COMPLETADA;
      data.finishedAt = new Date();
    } else {
      data.status = WorkOrderStatus.EN_PROCESO;
    }

    data.rejectReason = null;
    data.approvedAt = null;
    data.approvedById = null;
    data.approvalComment = null;

    return this.prisma.workOrder.update({ where: { id }, data });
  }

  async adminUpdateReport(id: string, workerReport: any, comentarioFinal?: string, userId?: string) {
    if (!id) throw new BadRequestException("Falta id");
    if (!userId) throw new BadRequestException("No se detectó el usuario logueado.");

    if (!workerReport || typeof workerReport !== "object") {
      throw new BadRequestException("workerReport es obligatorio.");
    }

    const exists = await this.prisma.workOrder.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException("OT no encontrada");
    if (exists.activo === false) throw new NotFoundException("OT no encontrada");

    if (
      exists.status === WorkOrderStatus.APROBADA ||
      exists.status === WorkOrderStatus.CERRADA
    ) {
      throw new BadRequestException("No se puede corregir una OT aprobada/cerrada.");
    }

    const data: any = {
      workerReport,
      comentarioFinal: cleanStr(comentarioFinal),
    };

    if (!exists.completedAt) data.completedAt = new Date();

    if (exists.status === WorkOrderStatus.RECHAZADA) {
      data.status = WorkOrderStatus.COMPLETADA;
      data.finishedAt = exists.finishedAt || new Date();

      data.rejectReason = null;
      data.approvedAt = null;
      data.approvedById = null;
      data.approvalComment = null;
    }

    if (exists.status === WorkOrderStatus.COMPLETADA && !exists.finishedAt) {
      data.finishedAt = new Date();
    }

    return this.prisma.workOrder.update({ where: { id }, data });
  }

  async approve(id: string, approvedById?: string, comment?: string) {
    if (!id) throw new BadRequestException("Falta id");
    if (!approvedById) throw new BadRequestException("No se detectó el usuario logueado.");

    const exists = await this.prisma.workOrder.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException("OT no encontrada");
    if (exists.activo === false) throw new NotFoundException("OT no encontrada");

    if (exists.status !== WorkOrderStatus.COMPLETADA) {
      throw new BadRequestException("Solo se puede aprobar una OT que esté COMPLETADA.");
    }
    if (!exists.workerReport) {
      throw new BadRequestException("No se puede aprobar: falta el reporte del trabajador.");
    }

    return this.prisma.workOrder.update({
      where: { id },
      data: {
        status: WorkOrderStatus.APROBADA,
        approvedAt: new Date(),
        approvedById,
        approvalComment: cleanStr(comment),
        rejectReason: null,
      },
    });
  }

  async reject(id: string, approvedById?: string, reason?: string) {
    if (!id) throw new BadRequestException("Falta id");
    if (!approvedById) throw new BadRequestException("No se detectó el usuario logueado.");

    const exists = await this.prisma.workOrder.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException("OT no encontrada");
    if (exists.activo === false) throw new NotFoundException("OT no encontrada");

    if (exists.status !== WorkOrderStatus.COMPLETADA) {
      throw new BadRequestException("Solo se puede rechazar una OT que esté COMPLETADA.");
    }
    if (!exists.workerReport) {
      throw new BadRequestException("No se puede rechazar: falta el reporte del trabajador.");
    }

    const motivo = cleanStr(reason);
    if (!motivo) throw new BadRequestException("Motivo de rechazo es obligatorio.");

    return this.prisma.workOrder.update({
      where: { id },
      data: {
        status: WorkOrderStatus.RECHAZADA,
        approvedAt: new Date(),
        approvedById,
        rejectReason: motivo,
      },
    });
  }

  // ✅ generatePdf (con fixes operador + kms)
  async generatePdf(id: string, actor?: any): Promise<{ buffer: Buffer; filename: string }> {
    if (!id) throw new BadRequestException("Falta id");

    await this.ensureAccessOrThrowActive(id, actor);

    const wo = await this.prisma.workOrder.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, email: true, nombre: true, apellido: true } },
        completedBy: { select: { id: true, email: true, nombre: true, apellido: true } },
        approvedBy: { select: { id: true, email: true, nombre: true, apellido: true } },
      },
    });

    if (!wo) throw new NotFoundException("OT no encontrada");
    if (wo.activo === false) throw new NotFoundException("OT no encontrada");

    const wr = safeParseWorkerReport(wo.workerReport);
    const dh = (wr as any)?.detalleHoras || {};
    const movimientos = cleanStr((wr as any)?.movimientos);

    const kmsObj = (wr as any)?.kilometros || (dh as any)?.kilometros || {};

    // ✅ helper kms robusto
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    const pickKm = (key: string): string | null => {
      const k = String(key || "").trim();
      if (!k) return null;

      const candidates = [
        (kmsObj as any)?.[k],
        (dh as any)?.[`km${cap(k)}`],
        (dh as any)?.[`${k}Km`],
        (dh as any)?.[`${k}Kms`],
        (wr as any)?.[`km${cap(k)}`],
        (wr as any)?.[`${k}Km`],
        (wr as any)?.[`${k}Kms`],
        (wr as any)?.[`kilometros${cap(k)}`],
        (dh as any)?.[`kilometros${cap(k)}`],
      ];

      for (const c of candidates) {
        const v = cleanStr(c);
        if (v) return v;
      }
      return null;
    };

    const otNum = `OT-${String(wo.id).slice(0, 6).toUpperCase()}`;
    const fecha = fmtDateOnly(wo.createdAt);

    const cliente = cleanStr(wo.cliente) || cleanStr((wo as any).lugar) || "—";
    const direccion = cleanStr((wo as any).direccion) || "—";
    const rut = cleanStr((wo as any).rut) || "—";
    const giro = cleanStr((wo as any).giro) || "—";
    const telefono = cleanStr((wo as any).telefonoCliente) || "—";
    const comuna = cleanStr((wo as any).comuna) || "—";
    const ciudad = cleanStr((wo as any).ciudad) || "—";

    const solicitadoPorManual = cleanStr((wo as any).solicitadoPor);
    const solicitadoPorAuto = cleanStr((wo as any).createdBy?.nombre)
      ? `${(wo as any).createdBy?.nombre || ""}${(wo as any).createdBy?.apellido ? " " + (wo as any).createdBy?.apellido : ""}`.trim()
      : cleanStr((wo as any).createdBy?.email) || null;
    const solicitadoPor = solicitadoPorManual || solicitadoPorAuto || "—";

    // ✅ FIX: operador = operador || conductor
    const operador = cleanStr((wo as any).operador) || cleanStr((wo as any).conductor) || "—";

    const equipo = cleanStr((wo as any).camion) || "—";
    const obraTramo = cleanStr((wo as any).direccionFaena) || cleanStr((wo as any).lugar) || "—";
    const rigger = cleanStr((wo as any).rigger) || "—";

    const doc = new (PDFDocument as any)({
      size: "A4",
      margin: 36,
      info: { Title: otNum },
    });

    const bufferPromise = pdfBufferFromDoc(doc);

    const pageW = doc.page.width;
    const left = doc.page.margins.left;
    const right = pageW - doc.page.margins.right;
    const w = right - left;

    const gap = 18;
    const colW = Math.floor((w - gap) / 2);

    const line = (x1: number, yy: number, x2: number) => {
      doc.save();
      doc.moveTo(x1, yy).lineTo(x2, yy).lineWidth(1).strokeColor("#111").stroke();
      doc.restore();
    };
    const fullLine = (yy: number) => line(left, yy, right);

    const box = (x: number, yy: number, ww: number, h: number) => {
      doc.save();
      doc.rect(x, yy, ww, h).lineWidth(1).strokeColor("#111").stroke();
      doc.restore();
    };

    const kvRow = (
      x: number,
      yy: number,
      ww: number,
      label: string,
      value: string,
      opts?: { valueBold?: boolean }
    ) => {
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#111");
      doc.text(label, x, yy, { width: ww });

      doc
        .font(opts?.valueBold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(10)
        .fillColor("#111");
      doc.text(value || "—", x, yy + 12, { width: ww });

      return yy + 28;
    };

    const twoColRow = (
      yy: number,
      lLabel: string,
      lVal: string,
      rLabel: string,
      rVal: string,
      lOpts?: { valueBold?: boolean },
      rOpts?: { valueBold?: boolean }
    ) => {
      const y1 = kvRow(left, yy, colW, lLabel, lVal, lOpts);
      const y2 = kvRow(left + colW + gap, yy, colW, rLabel, rVal, rOpts);
      return Math.max(y1, y2);
    };

    const oneColFull = (yy: number, label: string, value: string, opts?: { valueBold?: boolean }) => {
      return kvRow(left, yy, w, label, value, opts);
    };

    const sectionTitle = (title: string, yy: number) => {
      doc.font("Helvetica-Bold").fontSize(12).fillColor("#111");
      doc.text(String(title || "").toUpperCase(), left, yy, { width: w });
    };

    const drawHoursTable = (yy: number) => {
      const headerH = 22;
      const rowH = 20;

      const rows: Array<{
        label: string;
        hora: string;
        km?: string | null;
        showKm?: boolean;
      }> = [
        {
          label: "Hora Salida Planta",
          hora: fmtTimeIfHHMM((dh as any)?.salidaPlanta) || "—",
          km: pickKm("salidaPlanta") || "—",
          showKm: true,
        },
        {
          label: "Hora Llegada Faena",
          hora: fmtTimeIfHHMM((dh as any)?.llegadaFaena) || "—",
          km: pickKm("llegadaFaena") || "—",
          showKm: true,
        },
        {
          label: "Hora Salida Faena",
          hora: fmtTimeIfHHMM((dh as any)?.salidaFaena) || "—",
          km: pickKm("salidaFaena") || "—",
          showKm: true,
        },
        {
          label: "Hora Llegada Planta",
          hora: fmtTimeIfHHMM((dh as any)?.llegadaPlanta) || "—",
          km: pickKm("llegadaPlanta") || "—",
          showKm: true,
        },
        {
          label: "Horas de Colación",
          hora: fmtTimeIfHHMM((dh as any)?.colacion) || "—",
          km: "",
          showKm: false,
        },
      ];

      const tableH = headerH + rows.length * rowH;
      box(left, yy, w, tableH);

      const c1 = Math.floor(w * 0.6);
      const c2 = Math.floor(w * 0.2);
      const c3 = w - c1 - c2;

      doc.font("Helvetica-Bold").fontSize(9).fillColor("#111");
      doc.text("DETALLE", left + 8, yy + 6, { width: c1 - 16 });
      doc.text("HORA", left + c1, yy + 6, { width: c2, align: "center" });
      doc.text("KILÓMETROS", left + c1 + c2, yy + 6, { width: c3, align: "center" });

      line(left, yy + headerH, right);

      doc.save();
      doc.moveTo(left + c1, yy).lineTo(left + c1, yy + tableH).stroke();
      doc.moveTo(left + c1 + c2, yy).lineTo(left + c1 + c2, yy + tableH).stroke();
      doc.restore();

      let cy = yy + headerH;
      for (const r of rows) {
        doc.font("Helvetica-Bold").fontSize(9).fillColor("#111");
        doc.text(r.label, left + 8, cy + 6, { width: c1 - 16 });

        doc.font("Helvetica").fontSize(9).fillColor("#111");
        doc.text(r.hora, left + c1, cy + 6, { width: c2, align: "center" });

        const kmText = r.showKm === false ? "" : (r.km || "—");
        doc.text(kmText, left + c1 + c2, cy + 6, { width: c3, align: "center" });

        cy += rowH;
        if (cy < yy + tableH) line(left, cy, right);
      }

      return yy + tableH;
    };

    let y = doc.page.margins.top;

    doc.font("Helvetica").fontSize(9).fillColor("#111");
    doc.text("Sociedad de Transportes Thomas Limitada", left, y, { width: w - 160 });
    doc.text("Arriendo de equipos para transporte de carga y movimientos de izaje", left, y + 12, { width: w - 160 });
    doc.text("info@gruasthomas.cl  •  www.gruasthomas.cl", left, y + 24, { width: w - 160 });

    const logoPath = getLogoPath();
    if (logoPath) {
      doc.image(logoPath, right - 150, y - 6, { fit: [150, 52] });
    }

    y += 54;
    fullLine(y);
    y += 12;

    doc.font("Helvetica-Bold").fontSize(16).fillColor("#111");
    doc.text("ORDEN DE TRABAJO N°", left, y, { width: Math.floor(w * 0.6) });
    doc.text(otNum, left + Math.floor(w * 0.48), y, { width: Math.floor(w * 0.3) });

    doc.font("Helvetica-Bold").fontSize(11).fillColor("#111");
    doc.text("Fecha:", left + Math.floor(w * 0.78), y + 2, { width: 50 });
    doc.font("Helvetica").fontSize(11).fillColor("#111");
    doc.text(fecha || "—", left + Math.floor(w * 0.78) + 50, y + 2, {
      width: w - (Math.floor(w * 0.78) + 50),
    });

    y += 26;
    fullLine(y);
    y += 12;

    y = twoColRow(y, "Señores", cliente, "Comuna", comuna, { valueBold: true });
    y = twoColRow(y, "Dirección", direccion, "Fono", telefono);
    y = twoColRow(y, "R.U.T.", rut, "Ciudad", ciudad);
    y = oneColFull(y, "Giro", giro);
    y = oneColFull(y, "Solicitado por", solicitadoPor);
    y += 6;

    fullLine(y);
    y += 12;

    y = twoColRow(y, "Operador", operador, "Equipo", equipo);
    y = twoColRow(y, "Obra / Tramo", obraTramo, "Rigger Thomas", rigger);
    y += 6;

    fullLine(y);
    y += 14;

    sectionTitle("Detalle de horas", y);
    y += 16;
    y = drawHoursTable(y);
    y += 14;

    doc.font("Helvetica-Bold").fontSize(12).fillColor("#111");
    doc.text("Detalle de Movimientos", left, y);
    y += 14;

    const movH = 85;
    box(left, y, w, movH);
    doc.font("Helvetica").fontSize(10).fillColor("#111");
    doc.text(movimientos || cleanStr((wo as any).nota) || "—", left + 10, y + 10, {
      width: w - 20,
      height: movH - 20,
    });
    y += movH + 12;

    doc.font("Helvetica").fontSize(9).fillColor("#111");
    doc.text("Condiciones de Arrendamiento:", left, y);
    y += 12;
    doc.text("1.- La presente orden se considerará recibida conforme.", left, y);
    y += 12;
    doc.text("2.- Los traslados deben ser con guías de despacho proporcionada por el cliente.", left, y);
    y += 18;

    doc.font("Helvetica-Bold").fontSize(10).fillColor("#111");
    doc.text("Recibí Conforme", left, y);

    const rutX1 = left;
    const rutX2 = left + colW;
    const firmaX1 = left + colW + gap;
    const firmaX2 = right;

    const sigLineY = y + 26;
    line(rutX1, sigLineY, rutX2);
    line(firmaX1, sigLineY, firmaX2);

    doc.font("Helvetica").fontSize(10).fillColor("#111");
    doc.text(rut || "—", rutX1, sigLineY - 16, { width: rutX2 - rutX1, align: "center" });

    doc.font("Helvetica").fontSize(9).fillColor("#111");
    doc.text("R.U.T.", rutX1, sigLineY + 6, { width: rutX2 - rutX1 });
    doc.text("Firma", firmaX1, sigLineY + 6, { width: firmaX2 - firmaX1 });

    const sigBuf = getSignatureBuffer(wo as any, id);
    if (sigBuf) {
      try {
        doc.image(sigBuf, firmaX1 + 10, sigLineY - 54, { fit: [colW - 20, 70], align: "left", valign: "center" });
      } catch {}
    }

    doc.end();

    const buffer = await bufferPromise;
    const filename = `${otNum}-${fecha || "sin-fecha"}.pdf`.replace(/[^\w\-\.]/g, "_");
    return { buffer, filename };
  }
}






















































