// ✅ Archivo: src/work-orders/work-orders.controller.ts (COMPLETO)
// ✅ FIX: export-zip ahora llama al método real del service: exportPdfZipByFilters()
// ✅ FIX: mapeo correcto de filtros -> operatorId / riggerName
// ✅ NUEVO: export-excel para OTs APROBADAS
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Patch,
  Delete,
  UseGuards,
  Req,
  Res,
  ForbiddenException,
  BadRequestException,
  UseInterceptors,
  UploadedFiles,
  Query,
} from "@nestjs/common";

import type { Response } from "express";

import { WorkOrdersService } from "./work-orders.service";
import { CreateWorkOrderDto } from "./dto/create-work-order.dto";
import { CompleteWorkOrderDto } from "./dto/complete-work-order.dto";
import { SaveWorkOrderDraftDto } from "./dto/save-work-order-draft.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Role } from "@prisma/client";

// ✅ Multer
import { FilesInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname, join } from "path";
import { existsSync, mkdirSync } from "fs";

@Controller("work-orders")
@UseGuards(JwtAuthGuard)
export class WorkOrdersController {
  constructor(private readonly service: WorkOrdersService) {}

  // ✅ helper: roles admin OT
  private isOtAdmin(role?: Role) {
    return [Role.CONTROL_FLOTA, Role.ADMINISTRADORA, Role.SUPERADMIN].includes(
      role as any
    );
  }

  // ✅ helper: parse boolean query (1/true/yes/on)
  private parseBool(v: any): boolean {
    const s = String(v ?? "").trim().toLowerCase();
    return s === "1" || s === "true" || s === "yes" || s === "on";
  }

  // =========================================================
  // ✅ PAPELERA (SOLO SUPERADMIN)
  // GET /work-orders/deleted
  // ⚠️ IMPORTANTE: esto debe ir ANTES de rutas con ":id"
  // =========================================================
  @Get("deleted")
  async listDeleted(@Req() req: any) {
    const role = req.user?.role as Role | undefined;
    if (role !== Role.SUPERADMIN) {
      throw new ForbiddenException("Solo SUPERADMIN puede ver la papelera.");
    }
    return this.service.listDeleted(req.user);
  }

  // =========================================================
  // ✅ RESTAURAR (SOLO SUPERADMIN)
  // PATCH /work-orders/:id/restore
  // =========================================================
  @Patch(":id/restore")
  async restore(@Param("id") id: string, @Req() req: any) {
    const role = req.user?.role as Role | undefined;
    if (role !== Role.SUPERADMIN) {
      throw new ForbiddenException("Solo SUPERADMIN puede restaurar.");
    }

    const userId = req.user?.id;
    if (!userId)
      throw new BadRequestException("No se detectó el usuario logueado.");
    if (!id) throw new BadRequestException("Falta id");

    return this.service.restore(id, userId);
  }

  // =========================================================
  // ✅ CALENDARIO (ADMIN)
  // GET /work-orders/calendar?from=2026-02-01&to=2026-02-29
  // =========================================================
  @Get("calendar")
  async calendar(
    @Req() req: any,
    @Query("from") from: string,
    @Query("to") to: string
  ) {
    const role = req.user?.role as Role | undefined;
    if (!this.isOtAdmin(role)) throw new ForbiddenException("No autorizado.");

    return this.service.listCalendar(req.user, { from, to });
  }

  // =========================================================
  // ✅ EXPORT ZIP PDF MASIVO (ADMIN)
  // GET /work-orders/export-zip?from=2026-03-01&to=2026-03-31&operadorId=xxx&rigger=juan
  // =========================================================
  @Get("export-zip")
  async exportZip(
    @Query("from") from: string,
    @Query("to") to: string,
    @Query("operadorId") operadorId: string,
    @Query("rigger") rigger: string,
    @Req() req: any,
    @Res() res: Response
  ) {
    const role = req.user?.role as Role | undefined;

    if (!this.isOtAdmin(role)) {
      throw new ForbiddenException("No autorizado.");
    }

    const { buffer, filename } = await this.service.exportPdfZipByFilters(
      {
        from,
        to,
        operatorId: operadorId,
        riggerName: rigger,
      },
      req.user
    );

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", String(buffer.length));
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");

    return res.status(200).send(buffer);
  }

  // =========================================================
  // ✅ EXPORT EXCEL (ADMIN)
  // GET /work-orders/export-excel?from=2026-03-01&to=2026-03-31
  // ✅ SOLO OTs APROBADAS
  // =========================================================
  @Get("export-excel")
  async exportExcel(
    @Query("from") from: string,
    @Query("to") to: string,
    @Req() req: any,
    @Res() res: Response
  ) {
    const role = req.user?.role as Role | undefined;

    if (!this.isOtAdmin(role)) {
      throw new ForbiddenException("No autorizado.");
    }

    const { buffer, filename } = await this.service.exportApprovedExcel(
      {
        from,
        to,
      },
      req.user
    );

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", String(buffer.length));
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");

    return res.status(200).send(buffer);
  }

  // =========================================================
  // ✅ CALENDARIO: actualizar SOLO diasProgramados (ADMIN)
  // PATCH /work-orders/:id/schedule
  // body: { diasProgramados: ["2026-02-19","2026-02-20"] }
  // =========================================================
  @Patch(":id/schedule")
  async updateSchedule(
    @Param("id") id: string,
    @Body() body: any,
    @Req() req: any
  ) {
    const role = req.user?.role as Role | undefined;
    if (!this.isOtAdmin(role)) throw new ForbiddenException("No autorizado.");
    if (!id) throw new BadRequestException("Falta id");

    const diasProgramados = Array.isArray(body?.diasProgramados)
      ? body.diasProgramados
      : [];

    return this.service.updateSchedule(id, diasProgramados, req.user);
  }

  // =========================================================
  // ✅ CREAR OT (ADMIN)
  // =========================================================
  @Post()
  async create(@Body() dto: CreateWorkOrderDto, @Req() req: any) {
    const role = req.user?.role as Role | undefined;
    if (!this.isOtAdmin(role)) throw new ForbiddenException("No autorizado.");

    const userId = req.user?.id;
    if (!userId)
      throw new BadRequestException("No se detectó el usuario logueado.");
    return this.service.create(dto, userId);
  }

  @Get()
  async list(@Req() req: any) {
    const role = req.user?.role as Role | undefined;
    if (!this.isOtAdmin(role)) throw new ForbiddenException("No autorizado.");

    return this.service.list(req.user);
  }

  // ✅ IMPORTANTE: "worker" debe ir ANTES que ":id"
  @Get("worker")
  async listForWorker(
    @Req() req: any,
    @Query("includeFinalizadas") includeFinalizadas: string
  ) {
    const role = req.user?.role as Role | undefined;
    if (role !== Role.TRABAJADOR) {
      throw new ForbiddenException("Solo TRABAJADOR puede ver esta lista.");
    }

    const include = this.parseBool(includeFinalizadas);

    try {
      return await this.service.listForWorker(req.user, {
        includeFinalizadas: include,
      });
    } catch {
      return await this.service.listForWorker(req.user, include);
    }
  }

  // =========================
  // ✅ AUTOCOMPLETE CLIENTES
  // GET /work-orders/clients/search?search=fer
  // =========================
  @Get("clients/search")
  async searchClients(@Query("search") search: string, @Req() req: any) {
    const role = req.user?.role as Role | undefined;
    if (!this.isOtAdmin(role)) throw new ForbiddenException("No autorizado.");

    if (!String(search || "").trim()) return { items: [] };

    return this.service.searchClients(search, req.user);
  }

  // =========================
  // ✅ SUBIR FOTOS A LA OT
  // =========================
  @Post(":id/photos")
  @UseInterceptors(
    FilesInterceptor("photos", 20, {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const ok = String(file.mimetype || "").startsWith("image/");
        if (!ok)
          return cb(
            new BadRequestException("Solo se permiten imágenes.") as any,
            false
          );
        cb(null, true);
      },
      storage: diskStorage({
        destination: (req, file, cb) => {
          const idRaw: any = req.params?.id;
          const id = Array.isArray(idRaw) ? idRaw[0] : idRaw;

          if (!id) return cb(new Error("Falta id"), "");

          const dir = join(process.cwd(), "uploads", "work-orders", String(id));
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

          cb(null, dir);
        },
        filename: (req, file, cb) => {
          const idRaw: any = req.params?.id;
          const id = Array.isArray(idRaw) ? idRaw[0] : idRaw;

          const safeId = String(id || "workorder");
          const ext = extname(file.originalname || "").toLowerCase() || ".jpg";

          cb(
            null,
            `${safeId}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`
          );
        },
      }),
    })
  )
  async uploadPhotos(
    @Param("id") id: string,
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Req() req: any
  ) {
    const role = req.user?.role as Role | undefined;

    if (
      ![
        Role.TRABAJADOR,
        Role.CONTROL_FLOTA,
        Role.ADMINISTRADORA,
        Role.SUPERADMIN,
      ].includes(role as any)
    ) {
      throw new ForbiddenException("No autorizado.");
    }
    if (!id) throw new BadRequestException("Falta id");

    if (!files || files.length === 0) return { ok: true, photos: [] };

    return this.service.uploadPhotos(id, files);
  }

  // =========================
  // ✅ DESCARGAR PDF INDIVIDUAL
  // =========================
  @Get(":id/pdf")
  async downloadPdf(
    @Param("id") id: string,
    @Req() req: any,
    @Res({ passthrough: false }) res: Response
  ) {
    const role = req.user?.role as Role | undefined;

    if (
      ![
        Role.TRABAJADOR,
        Role.CONTROL_FLOTA,
        Role.ADMINISTRADORA,
        Role.SUPERADMIN,
      ].includes(role as any)
    ) {
      throw new ForbiddenException("No autorizado.");
    }
    if (!id) throw new BadRequestException("Falta id");

    const { buffer, filename } = await this.service.generatePdf(id, req.user);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", String(buffer.length));
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");

    return res.status(200).send(buffer);
  }

  @Get(":id")
  async get(@Param("id") id: string, @Req() req: any) {
    const role = req.user?.role as Role | undefined;
    if (
      ![
        Role.TRABAJADOR,
        Role.CONTROL_FLOTA,
        Role.ADMINISTRADORA,
        Role.SUPERADMIN,
      ].includes(role as any)
    ) {
      throw new ForbiddenException("No autorizado.");
    }
    return this.service.getById(id, req.user);
  }

  // =========================
  // ✅ GUARDAR BORRADOR (TRABAJADOR)
  // PATCH /work-orders/:id/draft
  // =========================
  @Patch(":id/draft")
  async saveDraft(
    @Param("id") id: string,
    @Body() dto: SaveWorkOrderDraftDto,
    @Req() req: any
  ) {
    if (req.user?.role !== Role.TRABAJADOR) {
      throw new ForbiddenException("Solo TRABAJADOR puede guardar borrador de una OT.");
    }
    if (!id) throw new BadRequestException("Falta id");

    return this.service.saveDraft(id, dto, req.user.id);
  }

  @Patch(":id/complete")
  async complete(
    @Param("id") id: string,
    @Body() dto: CompleteWorkOrderDto,
    @Req() req: any
  ) {
    if (req.user?.role !== Role.TRABAJADOR) {
      throw new ForbiddenException("Solo TRABAJADOR puede completar una OT.");
    }
    if (!id) throw new BadRequestException("Falta id");

    return this.service.complete(id, dto, req.user.id);
  }

  @Patch(":id/admin-report")
  async adminUpdateReport(
    @Param("id") id: string,
    @Body() body: any,
    @Req() req: any
  ) {
    const role = req.user?.role as Role | undefined;
    if (!this.isOtAdmin(role)) throw new ForbiddenException("No autorizado.");
    return this.service.adminUpdateReport(
      id,
      body.workerReport,
      body.comentarioFinal,
      req.user.id
    );
  }

  @Patch(":id/approve")
  async approve(@Param("id") id: string, @Body() body: any, @Req() req: any) {
    const role = req.user?.role as Role | undefined;
    if (!this.isOtAdmin(role)) throw new ForbiddenException("No autorizado.");
    return this.service.approve(id, req.user.id, body?.comentario);
  }

  @Patch(":id/reject")
  async reject(@Param("id") id: string, @Body() body: any, @Req() req: any) {
    const role = req.user?.role as Role | undefined;
    if (!this.isOtAdmin(role)) throw new ForbiddenException("No autorizado.");
    return this.service.reject(id, req.user.id, body?.motivo);
  }

  @Put(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: CreateWorkOrderDto,
    @Req() req: any
  ) {
    const role = req.user?.role as Role | undefined;
    if (!this.isOtAdmin(role)) throw new ForbiddenException("No autorizado.");
    return this.service.update(id, dto, req.user);
  }

  // ✅ SOFT DELETE
  @Delete(":id")
  async remove(@Param("id") id: string, @Req() req: any) {
    const role = req.user?.role as Role | undefined;
    if (!this.isOtAdmin(role)) throw new ForbiddenException("No autorizado.");

    const userId = req.user?.id;
    if (!userId)
      throw new BadRequestException("No se detectó el usuario logueado.");
    if (!id) throw new BadRequestException("Falta id");

    return this.service.remove(id, userId);
  }
}

























