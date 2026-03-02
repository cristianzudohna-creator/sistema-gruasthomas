// ✅ Archivo: src/vehicles/vehicles.controller.ts (COMPLETO)

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
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import type { Request } from "express";

import { VehiclesService } from "./vehicles.service";
import { VehicleDocumentsService } from "./vehicle-documents.service";
import { VehicleMaintenancesService } from "./vehicle-maintenances.service";
import { HorometerService } from "../horometer/horometer.service";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

import {
  DocumentType,
  MaintenanceType,
  VehicleOperationalStatus,
  VehicleType,
} from "@prisma/client";

import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "path";

type Empresa = "GRUAS_THOMAS" | "INSPROTEL";

function fileNameFactory(
  _req: any,
  file: Express.Multer.File,
  cb: (err: any, filename: string) => void
) {
  const ext = extname(file.originalname || "").toLowerCase();
  const stamp = Date.now();
  const rand = Math.random().toString(16).slice(2);
  cb(null, `${stamp}-${rand}${ext}`);
}

function fileFilter(
  _req: any,
  file: Express.Multer.File,
  cb: (err: any, ok: boolean) => void
) {
  const allowed = [
    "application/pdf",
    "application/msword", // .doc
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  ];

  if (!allowed.includes(file.mimetype)) {
    return cb(
      new BadRequestException("Solo se permiten archivos PDF, DOC o DOCX"),
      false
    );
  }
  cb(null, true);
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("vehicles")
export class VehiclesController {
  constructor(
    private readonly vehicles: VehiclesService,
    private readonly vehicleDocs: VehicleDocumentsService,
    private readonly vehicleMaint: VehicleMaintenancesService,
    private readonly horometer: HorometerService
  ) {}

  private getActor(req: Request) {
    return (req as any).user ?? null;
  }

  // ✅ NUEVO: normaliza year desde string/number/null
  private normalizeYear(year: any): number | null | undefined {
    if (year === undefined) return undefined; // no venía => no tocar
    if (year === null || year === "") return null;

    // si viene string "2025"
    if (typeof year === "string") {
      const s = year.trim();
      if (!s) return null;
      if (!/^\d{4}$/.test(s)) {
        throw new BadRequestException("year debe ser un número entero (4 dígitos)");
      }
      return Number(s);
    }

    // si viene number
    if (typeof year === "number") return year;

    throw new BadRequestException("year debe ser un número entero");
  }

  private validateYear(year: any) {
    if (year === undefined || year === null || year === "") return;

    if (typeof year !== "number" || !Number.isInteger(year)) {
      throw new BadRequestException("year debe ser un número entero");
    }
    if (year < 1950 || year > 2100) {
      throw new BadRequestException("year debe estar entre 1950 y 2100");
    }
  }

  private normalizeVehicleBody(body: any) {
    const out = { ...(body || {}) };

    // ✅ year: convertir primero, luego validar
    if (out.year !== undefined) {
      out.year = this.normalizeYear(out.year);
    }
    this.validateYear(out.year);

    // Normalizar type:
    const validEnum = ["CAMION", "AUTO", "CAMIONETA"];
    const t = out.type;

    // ✅ si type viene string pero no es enum válido
    if (t && typeof t === "string" && !validEnum.includes(t)) {
      // type venía como texto libre => lo pasamos a tipoVehiculo
      out.tipoVehiculo = String(out.tipoVehiculo || t).trim() || null;
      out.type = "CAMION"; // default
    }

    // Limpiar tipoVehiculo
    if (out.tipoVehiculo !== undefined) {
      const s = String(out.tipoVehiculo || "").trim();
      out.tipoVehiculo = s ? s : null;
    }

    // Normalizar estadoOperativo si viene
    if (
      out.estadoOperativo !== undefined &&
      out.estadoOperativo !== null &&
      out.estadoOperativo !== ""
    ) {
      const s = String(out.estadoOperativo).trim().toUpperCase();
      const allowed = ["OPERATIVO", "EN_PANA", "PARADO"];
      if (!allowed.includes(s)) {
        throw new BadRequestException(
          "estadoOperativo debe ser OPERATIVO, EN_PANA o PARADO"
        );
      }
      out.estadoOperativo = s;
    }

    return out;
  }

  // =========================================================
  // ✅ LISTAR VEHÍCULOS PARA TRABAJADOR (dropdown horómetro)
  // GET /vehicles/worker
  // Devuelve solo activos de la empresa del usuario (según req.user.empresa)
  // =========================================================
  @Get("worker")
  @Roles("TRABAJADOR", "ADMINISTRADORA", "ADMIN", "CONTROL_FLOTA", "SUPERADMIN")
  async listForWorker(@Req() req: Request) {
    const actor = this.getActor(req);

    const empresa = String((actor as any)?.empresa || "").toUpperCase();

    if (empresa !== "GRUAS_THOMAS" && empresa !== "INSPROTEL") {
      throw new BadRequestException("No se pudo determinar la empresa del usuario.");
    }

    const items = await this.vehicles.listWorkerVehicles(empresa as any);

    return { items };
  }

  // =========================================================
  // ✅ LISTAR
  // =========================================================
  @Get()
  @Roles("SUPERADMIN", "CONTROL_FLOTA", "ADMINISTRADORA", "TRABAJADOR")
  async list(@Req() req: Request) {
    const actor = this.getActor(req);
    return this.vehicles.list(actor);
  }

  // =========================================================
  // ✅ SEARCH AUTOCOMPLETE (SOLO GRUAS_THOMAS)
  // GET /vehicles/search?q=ab&limit=8
  // =========================================================
  @Get("search")
  @Roles("SUPERADMIN", "CONTROL_FLOTA", "ADMINISTRADORA", "TRABAJADOR")
  async search(
    @Req() req: Request,
    @Query("q") q?: string,
    @Query("limit") limit?: string
  ) {
    const actor = this.getActor(req);
    const query = String(q || "").trim().toUpperCase();
    const lim = Math.min(Math.max(Number(limit || 8) || 8, 1), 30);

    if (!query) return { items: [] };

    const data: any = await this.vehicles.list(actor);

    const list: any[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.records)
      ? data.records
      : Array.isArray(data?.items)
      ? data.items
      : [];

    const items = list
      .filter((v) => String(v?.empresa || "").toUpperCase() === "GRUAS_THOMAS")
      .filter((v) => {
        const patente = String(v?.patente || "").toUpperCase();
        return patente.includes(query);
      })
      .slice(0, lim)
      .map((v) => ({
        id: v?.id,
        patente: v?.patente,
        empresa: v?.empresa,
        marcaModelo: v?.marcaModelo,
        type: v?.type,
        tipoVehiculo: v?.tipoVehiculo,
        year: v?.year,
        estadoOperativo: v?.estadoOperativo,
      }));

    return { items };
  }

  // =====================
  // SUMMARY
  // =====================
  @Get("summary")
  @Roles("SUPERADMIN", "CONTROL_FLOTA")
  async summary(@Req() req: Request) {
    const actor = this.getActor(req);
    return this.vehicles.summary(actor);
  }

  // =========================================================
  // ✅ LISTAR ELIMINADOS (solo SUPERADMIN)
  // GET /vehicles/deleted
  // =========================================================
  @Get("deleted")
  @Roles("SUPERADMIN")
  async listDeleted(@Req() req: Request) {
    const actor = this.getActor(req);
    return this.vehicles.listDeleted(actor);
  }

  // =========================================================
  // ✅ RESTAURAR (solo SUPERADMIN)
  // PATCH /vehicles/:id/restore
  // =========================================================
  @Patch(":id/restore")
  @Roles("SUPERADMIN")
  async restore(@Req() req: Request, @Param("id") id: string) {
    const actor = this.getActor(req);
    return this.vehicles.restore(id, actor);
  }

  // =====================
  // ✅ ESTADO OPERATIVO
  // =====================
  @Patch(":id/operational-status")
  @Roles("SUPERADMIN", "CONTROL_FLOTA")
  async setOperationalStatus(
    @Param("id") id: string,
    @Body() body: { status: "OPERATIVO" | "EN_PANA" | "PARADO" },
    @Req() req: Request
  ) {
    const status = body?.status ? String(body.status).trim().toUpperCase() : "";

    if (status !== "OPERATIVO" && status !== "EN_PANA" && status !== "PARADO") {
      throw new BadRequestException("status debe ser OPERATIVO, EN_PANA o PARADO");
    }

    const actor = this.getActor(req);
    return this.vehicles.setOperationalStatus(
      id,
      status as VehicleOperationalStatus,
      actor
    );
  }

  // =====================
  // ✅ HORÓMETRO (ADMIN / CONTROL_FLOTA)
  // =====================
  @Get(":id/horometers")
  @Roles("SUPERADMIN", "CONTROL_FLOTA")
  async listHorometersByVehicle(
    @Req() req: Request,
    @Param("id") id: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    const actor = this.getActor(req);

    await this.vehicles.ensureVehicleAccessOrThrow(id, actor);

    const pageNum = page ? Number(page) : 1;
    const limitNum = limit ? Number(limit) : 50;

    return this.horometer.listByVehicleAdmin({
      vehicleId: id,
      page: Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1,
      limit:
        Number.isFinite(limitNum) && limitNum > 0
          ? Math.min(limitNum, 100)
          : 50,
    });
  }

  // =====================
  // EXPORTS (Excel)
  // =====================
  @Get("exports/vehicles")
  @Roles("SUPERADMIN", "CONTROL_FLOTA")
  async exportVehicles(
    @Req() req: Request,
    @Query("empresa") empresa?: "ALL" | "GRUAS_THOMAS" | "INSPROTEL"
  ) {
    const actor = this.getActor(req);
    return this.vehicles.exportVehicles(actor, empresa || "ALL");
  }

  @Get("exports/documents")
  @Roles("SUPERADMIN", "CONTROL_FLOTA")
  async exportDocuments(
    @Req() req: Request,
    @Query("empresa") empresa?: "ALL" | "GRUAS_THOMAS" | "INSPROTEL"
  ) {
    const actor = this.getActor(req);
    return this.vehicles.exportDocuments(actor, empresa || "ALL");
  }

  @Get("exports/maintenances")
  @Roles("SUPERADMIN", "CONTROL_FLOTA")
  async exportMaintenances(
    @Req() req: Request,
    @Query("empresa") empresa?: "ALL" | "GRUAS_THOMAS" | "INSPROTEL"
  ) {
    const actor = this.getActor(req);
    return this.vehicles.exportMaintenances(actor, empresa || "ALL");
  }

  // =====================
  // EXPIRACIONES
  // =====================
  @Get("expirations/documents")
  @Roles("SUPERADMIN", "CONTROL_FLOTA")
  async expirationsDocs(
    @Req() req: Request,
    @Query("status") status: "VENCIDO" | "POR_VENCER",
    @Query("empresa") empresa?: "ALL" | "GRUAS_THOMAS" | "INSPROTEL"
  ) {
    if (status !== "VENCIDO" && status !== "POR_VENCER") {
      throw new BadRequestException("status debe ser VENCIDO o POR_VENCER");
    }
    const actor = this.getActor(req);
    return this.vehicles.listDocsExpirations(actor, status, empresa || "ALL");
  }

  @Get("expirations/maintenances")
  @Roles("SUPERADMIN", "CONTROL_FLOTA")
  async expirationsMaint(
    @Req() req: Request,
    @Query("status") status: "VENCIDO" | "POR_VENCER",
    @Query("empresa") empresa?: "ALL" | "GRUAS_THOMAS" | "INSPROTEL"
  ) {
    if (status !== "VENCIDO" && status !== "POR_VENCER") {
      throw new BadRequestException("status debe ser VENCIDO o POR_VENCER");
    }
    const actor = this.getActor(req);
    return this.vehicles.listMaintExpirations(actor, status, empresa || "ALL");
  }

  // =====================
  // VEHÍCULOS CRUD
  // =====================
  @Post()
  @Roles("SUPERADMIN", "CONTROL_FLOTA")
  async create(
    @Req() req: Request,
    @Body()
    body: {
      patente: string;
      marcaModelo: string;
      conductor?: string;
      type?: VehicleType | any;
      tipoVehiculo?: string;
      year?: number | string | null;
      empresa?: Empresa;
      estadoOperativo?: "OPERATIVO" | "EN_PANA" | "PARADO";
    }
  ) {
    const actor = this.getActor(req);
    const normalized = this.normalizeVehicleBody(body);

    if (String(actor?.role || "").toUpperCase() === "CONTROL_FLOTA") {
      if (actor?.empresa) normalized.empresa = actor.empresa as any;
    }

    return this.vehicles.create(normalized as any, actor);
  }

  @Patch(":id")
  @Roles("SUPERADMIN", "CONTROL_FLOTA")
  async update(
    @Req() req: Request,
    @Param("id") id: string,
    @Body()
    body: {
      patente?: string;
      marcaModelo?: string;
      conductor?: string;
      type?: VehicleType | any;
      tipoVehiculo?: string;
      year?: number | string | null;
      empresa?: Empresa;
      estadoOperativo?: "OPERATIVO" | "EN_PANA" | "PARADO";
    }
  ) {
    const actor = this.getActor(req);
    const normalized = this.normalizeVehicleBody(body);

    if (String(actor?.role || "").toUpperCase() === "CONTROL_FLOTA") {
      if (actor?.empresa) {
        if (normalized.empresa !== undefined && normalized.empresa !== actor.empresa) {
          throw new BadRequestException("CONTROL_FLOTA no puede cambiar empresa del vehículo.");
        }
      }
    }

    return this.vehicles.update(id, normalized as any, actor);
  }

  // ✅ SOFT DELETE: NO borra docs ni mantenciones
  @Delete(":id")
  @Roles("SUPERADMIN", "CONTROL_FLOTA")
  async remove(@Req() req: Request, @Param("id") id: string) {
    const actor = this.getActor(req);
    await this.vehicles.ensureVehicleAccessOrThrow(id, actor);
    return this.vehicles.remove(id, actor);
  }

  // =====================
  // DOCUMENTOS
  // =====================
  @Get(":id/documents")
  @Roles("SUPERADMIN", "CONTROL_FLOTA")
  async listDocs(@Req() req: Request, @Param("id") id: string) {
    const actor = this.getActor(req);
    await this.vehicles.ensureVehicleAccessOrThrow(id, actor);
    return this.vehicleDocs.listByVehicle(id, actor);
  }

  @Post(":id/documents")
  @Roles("SUPERADMIN", "CONTROL_FLOTA")
  async createDoc(
    @Req() req: Request,
    @Param("id") id: string,
    @Body()
    body: {
      type: DocumentType;
      nombre?: string;
      fechaVencimiento: string;
      observacion?: string;
      archivoUrl?: string;
    }
  ) {
    const actor = this.getActor(req);
    await this.vehicles.ensureVehicleAccessOrThrow(id, actor);
    return this.vehicleDocs.upsertByVehicleType(id, body as any, actor);
  }

  @Post(":id/documents/upload")
  @Roles("SUPERADMIN", "CONTROL_FLOTA")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: "uploads/vehicle-docs",
        filename: fileNameFactory,
      }),
      fileFilter,
      limits: { fileSize: 10 * 1024 * 1024 },
    })
  )
  async uploadDoc(
    @Req() req: Request,
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body()
    body: {
      type: DocumentType;
      nombre?: string;
      fechaVencimiento: string;
      observacion?: string;
    }
  ) {
    if (!file) throw new BadRequestException("Falta el archivo");

    const actor = this.getActor(req);
    await this.vehicles.ensureVehicleAccessOrThrow(id, actor);

    const archivoUrl = `/uploads/vehicle-docs/${file.filename}`;
    const filePath = archivoUrl;

    return this.vehicleDocs.upsertFileByVehicleType(
      id,
      {
        ...body,
        archivoUrl,
        filePath,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      } as any,
      actor
    );
  }

  @Patch("documents/:docId")
  @Roles("SUPERADMIN", "CONTROL_FLOTA")
  async updateDoc(
    @Req() req: Request,
    @Param("docId") docId: string,
    @Body()
    body: {
      type?: DocumentType;
      nombre?: string;
      fechaVencimiento?: string;
      observacion?: string;
      archivoUrl?: string;
    }
  ) {
    const actor = this.getActor(req);
    await this.vehicles.ensureDocAccessOrThrow(docId, actor);
    return this.vehicleDocs.update(docId, body as any, actor);
  }

  @Patch("documents/:docId/upload")
  @Roles("SUPERADMIN", "CONTROL_FLOTA")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: "uploads/vehicle-docs",
        filename: fileNameFactory,
      }),
      fileFilter,
      limits: { fileSize: 10 * 1024 * 1024 },
    })
  )
  async replaceDocFile(
    @Req() req: Request,
    @Param("docId") docId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body()
    body: {
      type?: DocumentType;
      nombre?: string;
      fechaVencimiento?: string;
      observacion?: string;
    }
  ) {
    if (!file) throw new BadRequestException("Falta el archivo");

    const actor = this.getActor(req);
    await this.vehicles.ensureDocAccessOrThrow(docId, actor);

    const archivoUrl = `/uploads/vehicle-docs/${file.filename}`;
    const filePath = archivoUrl;

    return this.vehicleDocs.replaceFile(
      docId,
      {
        ...body,
        archivoUrl,
        filePath,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      } as any,
      actor
    );
  }

  @Delete("documents/:docId")
  @Roles("SUPERADMIN", "CONTROL_FLOTA")
  async deleteDoc(@Req() req: Request, @Param("docId") docId: string) {
    const actor = this.getActor(req);
    await this.vehicles.ensureDocAccessOrThrow(docId, actor);
    return this.vehicleDocs.remove(docId, actor);
  }

  // =====================
  // ✅ MANTENCIONES (CAMBIADO)
  // =====================

  @Get(":id/maintenances")
  @Roles("SUPERADMIN", "CONTROL_FLOTA", "ADMIN", "ADMINISTRADORA", "TRABAJADOR")
  async listMaintenances(@Req() req: Request, @Param("id") id: string) {
    const actor = this.getActor(req);
    // ✅ ya valida empresa + activo dentro del service
    return this.vehicleMaint.listByVehicle(id, actor);
  }

  @Post(":id/maintenances/upload")
  @Roles("SUPERADMIN", "CONTROL_FLOTA", "ADMIN", "ADMINISTRADORA", "TRABAJADOR")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: "uploads/vehicle-maint",
        filename: fileNameFactory,
      }),
      fileFilter,
      limits: { fileSize: 10 * 1024 * 1024 },
    })
  )
  async uploadMaintenance(
    @Req() req: Request,
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body()
    body: {
      nombre: string;
      fechaRealizada: string;
      fechaProxima?: string;
      observacion?: string;
    }
  ) {
    if (!file) throw new BadRequestException("Falta el archivo");

    const actor = this.getActor(req);

    const archivoUrl = `/uploads/vehicle-maint/${file.filename}`;
    const filePath = archivoUrl;

    return this.vehicleMaint.create(
      id,
      {
        type: MaintenanceType.OTRO,
        nombre: body.nombre,
        fechaRealizada: body.fechaRealizada,
        fechaProxima: body.fechaProxima,
        observacion: body.observacion,
        archivoUrl,
        filePath,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      } as any,
      actor
    );
  }

  @Patch("maintenances/:maintenanceId/upload")
  @Roles("SUPERADMIN", "CONTROL_FLOTA", "ADMIN", "ADMINISTRADORA", "TRABAJADOR")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: "uploads/vehicle-maint",
        filename: fileNameFactory,
      }),
      fileFilter,
      limits: { fileSize: 10 * 1024 * 1024 },
    })
  )
  async replaceMaintenanceFile(
    @Req() req: Request,
    @Param("maintenanceId") maintenanceId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body()
    body: {
      nombre?: string;
      fechaRealizada?: string;
      fechaProxima?: string;
      observacion?: string;
    }
  ) {
    if (!file) throw new BadRequestException("Falta el archivo");

    const actor = this.getActor(req);

    const archivoUrl = `/uploads/vehicle-maint/${file.filename}`;
    const filePath = archivoUrl;

    return this.vehicleMaint.update(
      maintenanceId,
      {
        type: MaintenanceType.OTRO,
        nombre: body.nombre,
        fechaRealizada: body.fechaRealizada,
        fechaProxima: body.fechaProxima,
        observacion: body.observacion,
        archivoUrl,
        filePath,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      } as any,
      actor
    );
  }

  @Post(":id/maintenances")
  @Roles("SUPERADMIN", "CONTROL_FLOTA", "ADMIN", "ADMINISTRADORA", "TRABAJADOR")
  async createMaintenance(
    @Req() req: Request,
    @Param("id") id: string,
    @Body()
    body: {
      type: MaintenanceType;
      nombre?: string;
      fechaRealizada: string;
      fechaProxima?: string | null;
      observacion?: string;
      archivoUrl?: string;
    }
  ) {
    const actor = this.getActor(req);
    return this.vehicleMaint.create(id, body as any, actor);
  }

  @Patch("maintenances/:maintenanceId")
  @Roles("SUPERADMIN", "CONTROL_FLOTA", "ADMIN", "ADMINISTRADORA", "TRABAJADOR")
  async updateMaintenance(
    @Req() req: Request,
    @Param("maintenanceId") maintenanceId: string,
    @Body()
    body: {
      type?: MaintenanceType;
      nombre?: string;
      fechaRealizada?: string;
      fechaProxima?: string | null;
      observacion?: string;
      archivoUrl?: string;
    }
  ) {
    const actor = this.getActor(req);
    return this.vehicleMaint.update(maintenanceId, body as any, actor);
  }

  @Delete("maintenances/:maintenanceId")
  @Roles("SUPERADMIN", "CONTROL_FLOTA", "ADMIN", "ADMINISTRADORA", "TRABAJADOR")
  async deleteMaintenance(
    @Req() req: Request,
    @Param("maintenanceId") maintenanceId: string
  ) {
    const actor = this.getActor(req);
    return this.vehicleMaint.remove(maintenanceId, actor);
  }
}


























