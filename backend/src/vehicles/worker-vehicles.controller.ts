// ✅ Archivo: src/vehicles/worker-vehicles.controller.ts
import { Controller, Get, Req, UseGuards, ForbiddenException } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { VehiclesService } from "./vehicles.service";

type Empresa = "GRUAS_THOMAS" | "INSPROTEL";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("TRABAJADOR")
@Controller("worker")
export class WorkerVehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Get("vehicles")
  async list(@Req() req: any) {
    const raw = req.user?.empresa;

    if (!raw) {
      throw new ForbiddenException("Trabajador sin empresa asignada.");
    }

    const empresa = String(raw).toUpperCase().trim();

    if (empresa !== "GRUAS_THOMAS" && empresa !== "INSPROTEL") {
      throw new ForbiddenException("Empresa de trabajador inválida.");
    }

    return this.vehicles.listWorkerVehicles(empresa as Empresa);
  }
}

