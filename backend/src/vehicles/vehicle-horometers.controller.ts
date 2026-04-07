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
  UseGuards,
} from "@nestjs/common";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

import { VehicleHorometersService } from "./vehicle-horometers.service";

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

  // ✅ POST /vehicles/:id/horometers
  // ✅ recibe JSON { horas } y sin foto
  @Post(":id/horometers")
  async create(
    @Param("id") vehicleId: string,
    @Req() req: any,
    @Body() body: any
  ) {
    const actorId = req?.user?.id || req?.user?.sub;
    if (!actorId) {
      throw new BadRequestException("JWT inválido: falta user.id/sub");
    }

    const horas = Number(body?.horas);
    if (!Number.isFinite(horas) || horas < 0) {
      throw new BadRequestException("Campo 'horas' inválido.");
    }

    const comentario = String(body?.comentario ?? "").trim() || undefined;

    return this.horometers.create(vehicleId, actorId, {
      horas,
      comentario,
    });
  }

  // ✅ NUEVO: POST /vehicles/:id/horometers/reset-cycle
  // ✅ reinicia el ciclo tomando este valor como última mantención
  @Post(":id/horometers/reset-cycle")
  async resetCycle(@Param("id") vehicleId: string, @Body() body: any) {
    const horas = Number(body?.horas);

    if (!Number.isFinite(horas) || horas < 0) {
      throw new BadRequestException("Campo 'horas' inválido.");
    }

    return this.horometers.resetMaintenanceCycle(vehicleId, horas);
  }

  // ✅ PATCH /vehicles/:id/horometers/:recordId
  @Patch(":id/horometers/:recordId")
  async update(
    @Param("id") vehicleId: string,
    @Param("recordId") recordId: string,
    @Body() body: any
  ) {
    const patch: any = {};

    if (body?.horas !== undefined) {
      const horas = Number(body?.horas);
      if (!Number.isFinite(horas) || horas < 0) {
        throw new BadRequestException("Campo 'horas' inválido.");
      }
      patch.horas = horas;
    }

    if (body?.comentario !== undefined) {
      patch.comentario = String(body?.comentario ?? "");
    }

    return this.horometers.update(vehicleId, recordId, patch);
  }

  // ✅ DELETE /vehicles/:id/horometers/:recordId
  @Delete(":id/horometers/:recordId")
  async remove(
    @Param("id") vehicleId: string,
    @Param("recordId") recordId: string
  ) {
    return this.horometers.remove(vehicleId, recordId);
  }
}