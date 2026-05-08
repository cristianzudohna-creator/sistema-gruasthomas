import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { WorkshopMaintenanceService } from "./workshop-maintenance.service";

import { CreateWorkshopMaintenanceDto } from "./dto/create-workshop-maintenance.dto";
import { AssignWorkshopMaintenanceDto } from "./dto/assign-workshop-maintenance.dto";
import { CompleteWorkshopMaintenanceDto } from "./dto/complete-workshop-maintenance.dto";
import { SignWorkshopMaintenanceDto } from "./dto/sign-workshop-maintenance.dto";

@Controller("workshop-maintenance")
@UseGuards(JwtAuthGuard)
export class WorkshopMaintenanceController {
  constructor(private readonly service: WorkshopMaintenanceService) {}

  @Post()
  create(@Body() dto: CreateWorkshopMaintenanceDto, @Req() req: any) {
    return this.service.create(dto, req.user);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(":id/pdf")
  generatePdf(@Param("id") id: string, @Res() res: Response) {
    return this.service.generatePdf(id, res);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @Req() req: any) {
    return this.service.remove(id, req.user);
  }

  @Patch(":id/assign")
  assign(
    @Param("id") id: string,
    @Body() dto: AssignWorkshopMaintenanceDto,
    @Req() req: any
  ) {
    return this.service.assign(id, dto, req.user);
  }

  @Patch(":id/start")
  start(@Param("id") id: string) {
    return this.service.start(id);
  }

  @Patch(":id/complete")
  complete(
    @Param("id") id: string,
    @Body() dto: CompleteWorkshopMaintenanceDto,
    @Req() req: any
  ) {
    return this.service.complete(id, dto, req.user);
  }

  @Patch(":id/sign/taller")
  signAsTaller(
    @Param("id") id: string,
    @Body() dto: SignWorkshopMaintenanceDto,
    @Req() req: any
  ) {
    return this.service.signAsTaller(id, dto, req.user);
  }

  @Patch(":id/sign/control-flota")
  signAsControlFlota(
    @Param("id") id: string,
    @Body() dto: SignWorkshopMaintenanceDto,
    @Req() req: any
  ) {
    return this.service.signAsControlFlota(id, dto, req.user);
  }

  @Patch(":id/sign/administradora")
  signAsAdministradora(
    @Param("id") id: string,
    @Body() dto: SignWorkshopMaintenanceDto,
    @Req() req: any
  ) {
    return this.service.signAsAdministradora(id, dto, req.user);
  }
}