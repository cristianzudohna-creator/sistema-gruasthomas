// ✅ Archivo: src/workshop/workshop.controller.ts
// ✅ COMPLETO + FIX PREVENCION INCIDENTES
// ✅ NUEVO AHORA:
// - solicitar insumos a PREVENCION (libre, sin tarea)
// - listar solicitudes de insumos
// - marcar insumo como comprado
// - cancelar solicitud de insumo
// ✅ NUEVO AHORA:
// - updateIncident envía userId al service para notificación de resolución
// - closeIncident envía userId al service para notificación de resolución

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
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkshopService } from './workshop.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { CreateWorkshopTaskDto } from './dto/create-workshop-task.dto';
import { UpdateWorkshopTaskDto } from './dto/update-workshop-task.dto';
import { CreateWorkshopTaskPartDto } from './dto/create-workshop-task-part.dto';
import { WorkshopAccessGuard } from './workshop-access.guard';

@Controller('workshop')
@UseGuards(JwtAuthGuard, WorkshopAccessGuard)
export class WorkshopController {
  constructor(private readonly workshopService: WorkshopService) {}

  // ============================
  // HORAS EXTRAS
  // ============================

  @Delete('extra-hours/:id')
  removeExtraHourReport(@Param('id') id: string, @Req() req: any) {
    const userId = req?.user?.id || req?.user?.sub;
    return this.workshopService.removeExtraHourReport(id, userId);
  }

  @Post('extra-hours')
  createExtraHourReport(@Body() dto: any, @Req() req: any) {
    const userId = req?.user?.id || req?.user?.sub;
    return this.workshopService.createExtraHourReport(userId, dto);
  }

  @Get('extra-hours/mine')
  getMyExtraHourReports(@Req() req: any) {
    const userId = req?.user?.id || req?.user?.sub;
    return this.workshopService.getMyExtraHourReports(userId);
  }

  @Get('extra-hours/jefe')
  getExtraHourReportsForJefe(@Req() req: any) {
    const userId = req?.user?.id || req?.user?.sub;
    return this.workshopService.getExtraHourReportsForJefe(userId);
  }

  @Get('extra-hours/administracion')
  getExtraHoursForAdmin(@Req() req: any) {
    const userId = req?.user?.id || req?.user?.sub;

    const from =
      typeof req?.query?.from === 'string' ? req.query.from.trim() : undefined;
    const to =
      typeof req?.query?.to === 'string' ? req.query.to.trim() : undefined;

    return this.workshopService.getExtraHoursForAdmin(userId, from, to);
  }

  // ============================
  // PDF POR TRABAJADOR
  // ============================

  @Get('extra-hours/pdf/:workerId')
  generatePdf(
    @Param('workerId') workerId: string,
    @Req() req: any,
    @Res() res: any,
  ) {
    const userId = req?.user?.id || req?.user?.sub;

    const from =
      typeof req?.query?.from === 'string' ? req.query.from.trim() : undefined;
    const to =
      typeof req?.query?.to === 'string' ? req.query.to.trim() : undefined;

    return this.workshopService.generateExtraHoursPdfForWorker(
      userId,
      workerId,
      res,
      from,
      to,
    );
  }

  // ============================
  // EXCEL GLOBAL
  // ============================

  @Get('extra-hours/excel')
  generateExcel(@Req() req: any, @Res() res: any) {
    const userId = req?.user?.id || req?.user?.sub;

    const from =
      typeof req?.query?.from === 'string' ? req.query.from.trim() : undefined;
    const to =
      typeof req?.query?.to === 'string' ? req.query.to.trim() : undefined;

    return this.workshopService.generateExtraHoursExcel(
      userId,
      res,
      from,
      to,
    );
  }

  @Get('extra-hours/:id')
  getExtraHourReportById(@Param('id') id: string, @Req() req: any) {
    const userId = req?.user?.id || req?.user?.sub;
    return this.workshopService.getExtraHourReportById(id, userId);
  }

  @Patch('extra-hours/:id/sign')
  signExtraHourReport(
    @Param('id') id: string,
    @Body() dto: any,
    @Req() req: any,
  ) {
    const userId = req?.user?.id || req?.user?.sub;

    return this.workshopService.signExtraHourReport(
      id,
      userId,
      dto?.firmaDataUrl,
    );
  }

  @Patch('extra-hours/:id/reject')
  rejectExtraHourReport(
    @Param('id') id: string,
    @Body() dto: any,
    @Req() req: any,
  ) {
    const userId = req?.user?.id || req?.user?.sub;

    return this.workshopService.rejectExtraHourReport(
      id,
      userId,
      dto?.observacionRechazo,
    );
  }

  // ============================
  // INCIDENTES
  // ============================

  @Post('incidents')
  createIncident(@Body() dto: CreateIncidentDto) {
    return this.workshopService.createIncident(dto);
  }

  // ✅ FIX:
  // Quitamos WorkshopAccessGuard SOLO para listar incidentes.
  // Así PREVENCION autenticado puede consultar sin caer en 403.
  @UseGuards(JwtAuthGuard)
  @Get('incidents')
  getIncidents() {
    return this.workshopService.getIncidents();
  }

  @Get('incidents/:id')
  getIncidentById(@Param('id') id: string) {
    return this.workshopService.getIncidentById(id);
  }

  @Patch('incidents/:id')
  updateIncident(
    @Param('id') id: string,
    @Body() dto: UpdateIncidentDto,
    @Req() req: any,
  ) {
    const userId = req?.user?.id || req?.user?.sub;
    return this.workshopService.updateIncident(id, dto, userId);
  }

  @Patch('incidents/:id/close')
  closeIncident(@Param('id') id: string, @Req() req: any) {
    const userId = req?.user?.id || req?.user?.sub;
    return this.workshopService.closeIncident(id, userId);
  }

  @Patch('incidents/:id/assign')
  assignIncident(@Param('id') id: string, @Body() dto: any) {
    return this.workshopService.assignIncident(id, dto);
  }

  @Delete('incidents/:id')
  removeIncident(@Param('id') id: string) {
    return this.workshopService.removeIncident(id);
  }

  // ============================
  // TAREAS
  // ============================

  @Post('tasks')
  createWorkshopTask(@Body() dto: CreateWorkshopTaskDto) {
    return this.workshopService.createWorkshopTask(dto);
  }

  @Get('tasks/requested-parts')
  getRequestedPartsTasks() {
    return this.workshopService.getRequestedPartsTasks();
  }

  @Get('tasks')
  getWorkshopTasks() {
    return this.workshopService.getWorkshopTasks();
  }

  @Get('tasks/:id')
  getWorkshopTaskById(@Param('id') id: string) {
    return this.workshopService.getWorkshopTaskById(id);
  }

  @Patch('tasks/:id')
  updateWorkshopTask(
    @Param('id') id: string,
    @Body() dto: UpdateWorkshopTaskDto,
  ) {
    return this.workshopService.updateWorkshopTask(id, dto);
  }

  @Patch('tasks/:id/close')
  closeWorkshopTask(@Param('id') id: string) {
    return this.workshopService.closeWorkshopTask(id);
  }

  @Delete('tasks/:id')
  removeWorkshopTask(@Param('id') id: string) {
    return this.workshopService.removeWorkshopTask(id);
  }

  // ============================
  // TRABAJADOR
  // ============================

  @Patch('tasks/:id/start')
  startWorkshopTaskByWorker(@Param('id') id: string, @Req() req: any) {
    const userId = req?.user?.id || req?.user?.sub;
    return this.workshopService.startWorkshopTaskByWorker(id, userId);
  }

  @Post('tasks/request-part')
  requestPartForTaskByWorker(
    @Body() dto: CreateWorkshopTaskPartDto,
    @Req() req: any,
  ) {
    const userId = req?.user?.id || req?.user?.sub;
    return this.workshopService.requestPartForTaskByWorker(userId, dto);
  }

  @Patch('tasks/:id/finish')
  finishWorkshopTaskByWorker(
    @Param('id') id: string,
    @Body()
    dto: {
      trabajoRealizado?: string;
      fotoEvidencia?: string;
    },
    @Req() req: any,
  ) {
    const userId = req?.user?.id || req?.user?.sub;

    return this.workshopService.finishWorkshopTaskByWorker(id, userId, dto);
  }

  // ============================
  // INSUMOS -> PREVENCION
  // ============================

  @Post('supplies/request')
  requestSupply(
    @Body()
    dto: {
      nombre: string;
      observacion?: string;
      fotoDataUrl?: string;
      fotoNombre?: string;
    },
    @Req() req: any,
  ) {
    const userId = req?.user?.id || req?.user?.sub;
    return this.workshopService.requestSupply(userId, dto);
  }

  @Get('supplies')
  getSupplyRequests(@Req() req: any) {
    const userId = req?.user?.id || req?.user?.sub;
    return this.workshopService.getSupplyRequests(userId);
  }

  @Patch('supplies/:id/purchase')
  markSupplyAsPurchased(@Param('id') id: string, @Req() req: any) {
    const userId = req?.user?.id || req?.user?.sub;
    return this.workshopService.markSupplyAsPurchased(id, userId);
  }

  @Patch('supplies/:id/cancel')
  cancelSupplyRequest(@Param('id') id: string, @Req() req: any) {
    const userId = req?.user?.id || req?.user?.sub;
    return this.workshopService.cancelSupplyRequest(id, userId);
  }

  // ============================
  // REPUESTOS
  // ============================

  @Post('parts')
  addPartToTask(@Body() dto: CreateWorkshopTaskPartDto) {
    return this.workshopService.addPartToTask(dto);
  }

  @Delete('parts/:id')
  removePart(@Param('id') id: string) {
    return this.workshopService.removePart(id);
  }
}