import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { VehicleHorometersService } from "./vehicle-horometers.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
@Controller("vehicles")
export class VehicleHorometersController {
  constructor(private readonly horometers: VehicleHorometersService) {}

  // ✅ GET /vehicles/:id/horometers
  @Get(":id/horometers")
  async list(@Param("id") vehicleId: string) {
    return this.horometers.listByVehicle(vehicleId);
  }
}
