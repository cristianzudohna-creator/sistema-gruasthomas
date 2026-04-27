// ✅ Archivo: src/horometer/horometer.controller.ts (COMPLETO)
// ✅ NUEVO: GET /horometer/export para exportar Excel de horómetros

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import type { Response } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname, join } from "path";
import * as fs from "fs";

import { HorometerService } from "./horometer.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

function ensureUploadsFolder() {
  const dir = join(process.cwd(), "uploads", "horometer");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function safeImageExt(file: Express.Multer.File) {
  const byMime: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
  };
  const raw = extname(file.originalname || "").toLowerCase();
  return raw || byMime[file.mimetype] || "";
}

function photoNameFactory(
  _req: any,
  file: Express.Multer.File,
  cb: (err: any, filename: string) => void
) {
  const ext = safeImageExt(file);
  const stamp = Date.now();
  const rand = Math.random().toString(16).slice(2);
  cb(null, `${stamp}-${rand}${ext}`);
}

function photoFilter(
  _req: any,
  file: Express.Multer.File,
  cb: (err: any, ok: boolean) => void
) {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.mimetype)) {
    return cb(
      new BadRequestException("Solo se permiten imágenes JPG, PNG o WEBP"),
      false
    );
  }
  cb(null, true);
}

@Controller("horometer")
@UseGuards(JwtAuthGuard, RolesGuard)
export class HorometerController {
  constructor(private readonly horometer: HorometerService) {
    ensureUploadsFolder();
  }

  @Post()
  @Roles("TRABAJADOR", "ADMIN", "SUPERADMIN", "CONTROL_FLOTA")
  @UseInterceptors(
    FileInterceptor("photo", {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, ensureUploadsFolder()),
        filename: photoNameFactory,
      }),
      fileFilter: photoFilter,
      limits: { fileSize: 8 * 1024 * 1024 },
    })
  )
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { vehicleId: string; horas: string; comentario?: string },
    @Req() req: any
  ) {
    if (!file) throw new BadRequestException("Falta la foto (photo)");
    if (!body?.vehicleId) throw new BadRequestException("Falta vehicleId");

    const horasNum = Number(String(body?.horas ?? "").trim());
    if (!Number.isFinite(horasNum) || horasNum < 0) {
      throw new BadRequestException(
        "horas debe ser un número entero válido (>= 0)"
      );
    }

    return this.horometer.createRecord({
      vehicleId: body.vehicleId,
      horas: Math.floor(horasNum),
      comentario: body?.comentario,
      file,
      actor: req.user
        ? { id: req.user.id, email: req.user.email, role: req.user.role }
        : null,
    });
  }

  // ✅ IMPORTANTE: export va antes de @Get() para evitar conflicto
  @Get("export")
  @Roles("SUPERADMIN", "CONTROL_FLOTA", "ADMIN")
  async exportExcel(
    @Res() res: Response,
    @Query("q") q?: string,
    @Query("empresa") empresa?: "ALL" | "GRUAS_THOMAS" | "INSPROTEL"
  ) {
    const buffer = await this.horometer.exportAdminExcel({
      q,
      empresa: empresa || "ALL",
    });

    const fileName = `horometros-${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Length", buffer.length);

    return res.send(buffer);
  }

  @Get()
  @Roles("SUPERADMIN", "CONTROL_FLOTA", "ADMIN")
  async list(
    @Query("q") q?: string,
    @Query("empresa") empresa?: "ALL" | "GRUAS_THOMAS" | "INSPROTEL",
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    const pageNum = page ? Number(page) : 1;
    const limitNum = limit ? Number(limit) : 10;

    return this.horometer.listAdmin({
      q,
      empresa: empresa || "ALL",
      page: Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1,
      limit:
        Number.isFinite(limitNum) && limitNum > 0
          ? Math.min(limitNum, 50)
          : 10,
    });
  }
}


