import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname, join } from "path";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

import { VehicleHorometersService } from "./vehicle-horometers.service";

function safeFileName(originalName: string) {
  const base = (originalName || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.slice(0, 80);
}

function multerHorometerStorage() {
  return diskStorage({
    destination: join(process.cwd(), "uploads", "horometer"),
    filename: (_req, file, cb) => {
      const ext = extname(file.originalname || "").toLowerCase();
      const name = safeFileName(file.originalname);
      const unique = `${Date.now()}_${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}_${name}${ext}`);
    },
  });
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("SUPERADMIN", "CONTROL_FLOTA")
@Controller("vehicles")
export class VehicleHorometersController {
  constructor(private readonly horometers: VehicleHorometersService) {}

  // ✅ GET /vehicles/:id/horometers
  @Get(":id/horometers")
  async list(@Param("id") vehicleId: string) {
    return this.horometers.listByVehicle(vehicleId);
  }

  // ✅ POST /vehicles/:id/horometers (foto opcional)
  // ✅ OJO: el front manda el archivo como "file" (no "foto")
  @Post(":id/horometers")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: multerHorometerStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    })
  )
  async create(
    @Param("id") vehicleId: string,
    @Req() req: any,
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File
  ) {
    const actorId = req?.user?.id || req?.user?.sub;
    if (!actorId) throw new BadRequestException("JWT inválido: falta user.id/sub");

    const horas = Number(body?.horas);
    if (!Number.isFinite(horas) || horas < 0) throw new BadRequestException("Campo 'horas' inválido.");

    // comentario opcional (después lo quitamos del front si quieres)
    const comentario = String(body?.comentario ?? "").trim() || undefined;

    const fotoUrl = file ? `/uploads/horometer/${file.filename}` : "";
    const filePath = file ? join(process.cwd(), "uploads", "horometer", file.filename) : "";
    const originalName = file ? file.originalname : "";
    const mimeType = file ? file.mimetype : "";
    const sizeBytes = file ? file.size : 0;

    return this.horometers.create(vehicleId, actorId, {
      horas,
      comentario,
      fotoUrl,
      filePath,
      originalName,
      mimeType,
      sizeBytes,
    });
  }

  // ✅ PATCH /vehicles/:id/horometers/:recordId
  // ✅ OJO: el front manda el archivo como "file" (no "foto")
  @Patch(":id/horometers/:recordId")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: multerHorometerStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    })
  )
  async update(
    @Param("id") vehicleId: string,
    @Param("recordId") recordId: string,
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File
  ) {
    const patch: any = {};

    if (body?.horas !== undefined) {
      const horas = Number(body?.horas);
      if (!Number.isFinite(horas) || horas < 0) throw new BadRequestException("Campo 'horas' inválido.");
      patch.horas = horas;
    }

    if (body?.comentario !== undefined) {
      patch.comentario = String(body?.comentario ?? "");
    }

    if (file) {
      patch.fotoUrl = `/uploads/horometer/${file.filename}`;
      patch.filePath = join(process.cwd(), "uploads", "horometer", file.filename);
      patch.originalName = file.originalname;
      patch.mimeType = file.mimetype;
      patch.sizeBytes = file.size;
    }

    return this.horometers.update(vehicleId, recordId, patch);
  }

  // ✅ DELETE /vehicles/:id/horometers/:recordId
  @Delete(":id/horometers/:recordId")
  async remove(@Param("id") vehicleId: string, @Param("recordId") recordId: string) {
    return this.horometers.remove(vehicleId, recordId);
  }
}