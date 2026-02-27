import { Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
import { CompanyService } from "./company.service";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("company")
export class CompanyController {
  constructor(private service: CompanyService) {}

  @Get("me")
  @Roles("SUPERADMIN", "CONTROL_FLOTA", "ADMINISTRADORA", "TRABAJADOR")
  async getMe(@Req() req: any) {
    return this.service.getMyCompany(req.user);
  }

  @Put("me")
  @Roles("SUPERADMIN", "CONTROL_FLOTA", "ADMINISTRADORA")
  async updateMe(@Req() req: any, @Body() body: any) {
    return this.service.updateMyCompany(req.user, body);
  }
}
