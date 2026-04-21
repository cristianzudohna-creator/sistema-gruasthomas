import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Empresa, VehicleFailureReportStatus } from "@prisma/client";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { VehicleFailureReportsService } from "./vehicle-failure-reports.service";

type RequestWithUser = {
  user: {
    id: string;
    role?: string;
    workerType?: string;
    empresa?: string;
    nombre?: string;
    apellido?: string;
    email?: string;
  };
};

@Controller("vehicle-failure-reports")
@UseGuards(JwtAuthGuard)
export class VehicleFailureReportsController {
  constructor(
    private readonly vehicleFailureReportsService: VehicleFailureReportsService,
  ) {}

  @Post()
  async create(
    @Req() req: RequestWithUser,
    @Body()
    body: {
      vehicleId: string;
      patente?: string;
      traidoPorNombre: string;
      descripcion: string;
      empresa?: Empresa;
      evidences?: Array<{
        fileUrl: string;
        filePath: string;
        originalName: string;
        mimeType: string;
        sizeBytes: number;
      }>;
    },
  ) {
    return this.vehicleFailureReportsService.create(req.user, body);
  }

  @Get()
  async findAll(
    @Req() req: RequestWithUser,
    @Query("status") status?: VehicleFailureReportStatus,
    @Query("vehicleId") vehicleId?: string,
    @Query("patente") patente?: string,
    @Query("assignedToId") assignedToId?: string,
    @Query("createdById") createdById?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.vehicleFailureReportsService.findAll(req.user, {
      status,
      vehicleId,
      patente,
      assignedToId,
      createdById,
      from,
      to,
    });
  }

  @Get(":id")
  async findOne(@Req() req: RequestWithUser, @Param("id") id: string) {
    return this.vehicleFailureReportsService.findOne(req.user, id);
  }

  @Patch(":id/assign")
  async assign(
    @Req() req: RequestWithUser,
    @Param("id") id: string,
    @Body()
    body: {
      assignedToId: string;
      status?: VehicleFailureReportStatus;
    },
  ) {
    return this.vehicleFailureReportsService.assign(req.user, id, body);
  }

  @Patch(":id/status")
  async updateStatus(
    @Req() req: RequestWithUser,
    @Param("id") id: string,
    @Body()
    body: {
      status: VehicleFailureReportStatus;
    },
  ) {
    return this.vehicleFailureReportsService.updateStatus(
      req.user,
      id,
      body.status,
    );
  }

  @Delete(":id")
  async remove(@Req() req: RequestWithUser, @Param("id") id: string) {
    return this.vehicleFailureReportsService.remove(req.user, id);
  }
}