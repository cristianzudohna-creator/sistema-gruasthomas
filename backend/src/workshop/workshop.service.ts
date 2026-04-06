// ✅ Archivo: src/workshop/workshop.service.ts (COMPLETO + FOTO EN SOLICITUD DE REPUESTO + EXCEL GLOBAL + NOTIFICACIÓN A ADQUISICIONES)

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseService } from '../firebase/firebase.service';
import {
  Prisma,
  VehicleIncidentStatus,
  WorkshopTaskStatus,
  WorkshopTaskAssignmentRole,
  WorkshopExtraHourStatus,
  WorkerType,
  Empresa,
  Role,
} from '@prisma/client';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { CreateWorkshopTaskDto } from './dto/create-workshop-task.dto';
import { UpdateWorkshopTaskDto } from './dto/update-workshop-task.dto';
import { CreateWorkshopTaskPartDto } from './dto/create-workshop-task-part.dto';
import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';

const PDFDocument = require('pdfkit');

function normalizePlate(input: string) {
  return String(input || '')
    .trim()
    .toUpperCase()
    .replace(/\./g, '')
    .replace(/-/g, '')
    .replace(/\s+/g, '');
}

@Injectable()
export class WorkshopService {
  constructor(
    private prisma: PrismaService,
    private readonly firebaseService: FirebaseService,
  ) {}

  // ============================
  // HELPERS PRIVADOS
  // ============================

  private async generateWorkshopCode(tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma;

    const tasks = await db.workshopTask.findMany({
      where: {
        codigo: {
          startsWith: 'TALLER-',
        },
      },
      select: {
        codigo: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    let maxNumber = 0;

    for (const task of tasks) {
      const code = String(task.codigo || '');
      const match = code.match(/^TALLER-(\d+)$/i);
      if (!match) continue;

      const num = Number(match[1]);
      if (Number.isFinite(num) && num > maxNumber) {
        maxNumber = num;
      }
    }

    const nextNumber = maxNumber + 1;
    return `TALLER-${String(nextNumber).padStart(4, '0')}`;
  }

  private async ensureWorkshopTaskExists(
    id: string,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prisma;

    const task = await db.workshopTask.findUnique({
      where: { id },
      select: {
        id: true,
        incidentId: true,
        status: true,
        startedAt: true,
        closedAt: true,
        observaciones: true,
        trabajoRealizado: true,
      },
    });

    if (!task) {
      throw new NotFoundException('Tarea de taller no encontrada');
    }

    return task;
  }

  private async getTaskAssignmentForUser(
    workshopTaskId: string,
    userId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prisma;

    const assignment = await db.workshopTaskAssignment.findFirst({
      where: {
        workshopTaskId,
        userId,
      },
      select: {
        id: true,
        role: true,
        userId: true,
        workshopTaskId: true,
      },
    });

    if (!assignment) {
      throw new BadRequestException(
        'No estás asignado a esta tarea de taller',
      );
    }

    return assignment;
  }

  private async ensureResponsibleAssignment(
    workshopTaskId: string,
    userId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const assignment = await this.getTaskAssignmentForUser(
      workshopTaskId,
      userId,
      tx,
    );

    if (assignment.role !== WorkshopTaskAssignmentRole.RESPONSABLE) {
      throw new BadRequestException(
        'Solo el responsable puede iniciar, pedir repuesto o terminar esta tarea',
      );
    }

    return assignment;
  }

  private isHHMM(value: any) {
    const s = String(value || '').trim();
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
  }

  private calcExtraHours(horaEntrada: string, horaSalida: string) {
    if (!this.isHHMM(horaEntrada)) {
      throw new BadRequestException(
        'Hora entrada inválida. Formato requerido: HH:MM',
      );
    }

    if (!this.isHHMM(horaSalida)) {
      throw new BadRequestException(
        'Hora salida inválida. Formato requerido: HH:MM',
      );
    }

    const [h1, m1] = horaEntrada.split(':').map(Number);
    const [h2, m2] = horaSalida.split(':').map(Number);

    const startMinutes = h1 * 60 + m1;
    const endMinutes = h2 * 60 + m2;

    if (endMinutes <= startMinutes) {
      throw new BadRequestException(
        'La hora salida debe ser mayor que la hora entrada',
      );
    }

    const diffMinutes = endMinutes - startMinutes;
    return Math.round((diffMinutes / 60) * 100) / 100;
  }

  private parseExtraHourDate(fecha: any) {
    const raw = String(fecha || '').trim();
    if (!raw) {
      throw new BadRequestException('La fecha es obligatoria');
    }

    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException('Fecha inválida');
    }

    return d;
  }

  private formatDateOnly(value: Date | string | null | undefined) {
    if (!value) return '—';

    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '—';

    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();

    return `${dd}-${mm}-${yyyy}`;
  }

  private safeText(value: any) {
    return String(value || '').trim();
  }

  private getFullName(user: any) {
    const full = [user?.nombre, user?.apellido].filter(Boolean).join(' ').trim();
    return full || user?.email || '—';
  }

  private parseImageDataUrl(dataUrl?: string | null): Buffer | null {
    const raw = String(dataUrl || '').trim();
    if (!raw) return null;

    const match = raw.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
    if (!match) return null;

    try {
      return Buffer.from(match[1], 'base64');
    } catch {
      return null;
    }
  }

  private drawCellTextCentered(
    doc: any,
    text: string,
    x: number,
    y: number,
    w: number,
    h: number,
    options?: {
      font?: string;
      fontSize?: number;
      color?: string;
      align?: 'left' | 'center' | 'right';
      paddingX?: number;
    },
  ) {
    const content = String(text || '').trim() || ' ';
    const font = options?.font || 'Helvetica';
    const fontSize = options?.fontSize ?? 8;
    const color = options?.color || '#000000';
    const align = options?.align || 'center';
    const paddingX = options?.paddingX ?? 4;

    doc.font(font).fontSize(fontSize).fillColor(color);

    const textHeight = doc.heightOfString(content, {
      width: w - paddingX * 2,
      align,
      lineGap: 0,
    });

    const textY = y + Math.max(0, (h - textHeight) / 2);

    doc.text(content, x + paddingX, textY, {
      width: w - paddingX * 2,
      align,
      lineGap: 0,
    });
  }

  private drawExtraHoursPdfHeader(doc: any) {
    const blue = '#2d8fbd';

    doc
      .save()
      .fillColor('#ffffff')
      .rect(24, 24, 547, 770)
      .fill()
      .restore();

    doc
      .save()
      .fillColor(blue)
      .rect(24, 24, 547, 34)
      .fill()
      .restore();

    doc
      .font('Helvetica-Bold')
      .fontSize(10.8)
      .fillColor('#ffffff')
      .text(
        'AUTORIZACION DE TRABAJOS HORAS EXTRAS, SABADOS, DOMINGOS Y FESTIVOS',
        32,
        35,
        {
          width: 531,
          align: 'center',
          lineGap: 0,
        },
      );

    const y = 64;
    const cols = this.getPdfColumns();
    const headerHeight = 30;

    cols.forEach((col) => {
      doc.lineWidth(0.7).rect(col.x, y, col.w, headerHeight).stroke('#000000');
      this.drawCellTextCentered(doc, col.label, col.x, y, col.w, headerHeight, {
        font: 'Helvetica-Bold',
        fontSize: 7.2,
        color: '#111111',
        align: 'center',
        paddingX: 3,
      });
    });

    return y + headerHeight;
  }

  private getPdfColumns() {
    return [
      { key: 'trabajador', label: 'TRABAJADOR', x: 24, w: 132 },
      { key: 'fecha', label: 'FECHA', x: 156, w: 82 },
      {
        key: 'descripcion',
        label: 'DESCRIPCION DEL TRABAJO',
        x: 238,
        w: 176,
      },
      { key: 'entrada', label: 'HORA\nENTRADA', x: 414, w: 54 },
      { key: 'salida', label: 'HORA DE\nSALIDA', x: 468, w: 54 },
      { key: 'firma', label: 'FIRMA JEFE\nDE TALLER', x: 522, w: 49 },
    ];
  }

  private ensurePdfPageSpace(doc: any, y: number, rowHeight: number) {
    if (y + rowHeight <= 780) {
      return y;
    }

    doc.addPage();
    return this.drawExtraHoursPdfHeader(doc);
  }

  private drawPdfRow(doc: any, y: number, report: any) {
    const cols = this.getPdfColumns();

    const trabajador = this.getFullName(report?.trabajador);
    const fecha = this.formatDateOnly(report?.fecha);
    const descripcion = this.safeText(report?.descripcionTrabajo) || ' ';
    const horaEntrada = this.safeText(report?.horaEntrada) || ' ';
    const horaSalida = this.safeText(report?.horaSalida) || ' ';
    const signatureBuffer = this.parseImageDataUrl(report?.firmaDataUrl);

    const rowHeight = 40;

    doc
      .save()
      .fillColor('#ffffff')
      .rect(24, y, 547, rowHeight)
      .fill()
      .restore();

    cols.forEach((col) => {
      doc.lineWidth(0.5).rect(col.x, y, col.w, rowHeight).stroke('#000000');
    });

    this.drawCellTextCentered(
      doc,
      trabajador === '—' ? '—' : trabajador,
      cols[0].x,
      y,
      cols[0].w,
      rowHeight,
      {
        font: 'Helvetica',
        fontSize: 8,
        color: '#000000',
        align: 'left',
        paddingX: 6,
      },
    );

    this.drawCellTextCentered(
      doc,
      fecha === '—' ? '—' : fecha,
      cols[1].x,
      y,
      cols[1].w,
      rowHeight,
      {
        font: 'Helvetica',
        fontSize: 8,
        color: '#000000',
        align: 'center',
        paddingX: 4,
      },
    );

    this.drawCellTextCentered(
      doc,
      descripcion,
      cols[2].x,
      y,
      cols[2].w,
      rowHeight,
      {
        font: 'Helvetica',
        fontSize: 8,
        color: '#000000',
        align: 'left',
        paddingX: 6,
      },
    );

    this.drawCellTextCentered(
      doc,
      horaEntrada,
      cols[3].x,
      y,
      cols[3].w,
      rowHeight,
      {
        font: 'Helvetica',
        fontSize: 8,
        color: '#000000',
        align: 'center',
        paddingX: 2,
      },
    );

    this.drawCellTextCentered(
      doc,
      horaSalida,
      cols[4].x,
      y,
      cols[4].w,
      rowHeight,
      {
        font: 'Helvetica',
        fontSize: 8,
        color: '#000000',
        align: 'center',
        paddingX: 2,
      },
    );

    if (signatureBuffer) {
      try {
        doc.image(signatureBuffer, cols[5].x + 4, y + 6, {
          fit: [cols[5].w - 8, rowHeight - 12],
          align: 'center',
          valign: 'center',
        });
      } catch {
        const firmadoPor = this.getFullName(report?.firmadoPor);
        if (firmadoPor && firmadoPor !== '—') {
          this.drawCellTextCentered(
            doc,
            firmadoPor,
            cols[5].x,
            y,
            cols[5].w,
            rowHeight,
            {
              font: 'Helvetica',
              fontSize: 7,
              color: '#000000',
              align: 'center',
              paddingX: 3,
            },
          );
        }
      }
    } else {
      const firmadoPor = this.getFullName(report?.firmadoPor);
      if (firmadoPor && firmadoPor !== '—') {
        this.drawCellTextCentered(
          doc,
          firmadoPor,
          cols[5].x,
          y,
          cols[5].w,
          rowHeight,
          {
            font: 'Helvetica',
            fontSize: 7,
            color: '#000000',
            align: 'center',
            paddingX: 3,
          },
        );
      }
    }

    return y + rowHeight;
  }

  private async getUserForExtraHours(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        activo: true,
        empresa: true,
        email: true,
        nombre: true,
        apellido: true,
        rut: true,
        role: true,
        workerType: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (!user.activo) {
      throw new BadRequestException('El usuario está inactivo');
    }

    if (user.role === 'SUPERADMIN') {
      return user;
    }

    if (user.role !== 'TRABAJADOR') {
      throw new BadRequestException(
        'Solo trabajadores o superadmin pueden usar este módulo',
      );
    }

    return user;
  }

  private async ensureExtraHourReportExists(id: string) {
    const report = await this.prisma.workshopExtraHourReport.findUnique({
      where: { id },
      include: {
        trabajador: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
            workerType: true,
            empresa: true,
            rut: true,
          },
        },
        firmadoPor: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
            workerType: true,
            role: true,
            empresa: true,
          },
        },
      },
    });

    if (!report) {
      throw new NotFoundException('Reporte de horas extras no encontrado');
    }

    return report;
  }

  private async ensureJefeTaller(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        activo: true,
        empresa: true,
        workerType: true,
        role: true,
        nombre: true,
        apellido: true,
        email: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (!user.activo) {
      throw new BadRequestException('Usuario inactivo');
    }

    if (user.role === 'SUPERADMIN') {
      return user;
    }

    if (
      user.role === 'TRABAJADOR' &&
      (
        user.workerType === WorkerType.JEFE_TALLER ||
        user.workerType === WorkerType.SUPERVISOR
      )
    ) {
      return user;
    }

    throw new BadRequestException(
      'Solo jefe de taller, supervisor o superadmin pueden firmar/revisar reportes',
    );
  }

  private async ensureExtraHoursAdminAccess(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        activo: true,
        empresa: true,
        role: true,
        workerType: true,
        nombre: true,
        apellido: true,
        email: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (!user.activo) {
      throw new BadRequestException('Usuario inactivo');
    }

    if (
      user.role === Role.SUPERADMIN ||
      user.role === Role.ADMINISTRADORA
    ) {
      return user;
    }

    throw new BadRequestException(
      'Solo superadmin o administradora pueden acceder a esta vista',
    );
  }

  // ============================
  // HORAS EXTRAS TALLER
  // ============================

  async createExtraHourReport(
    userId: string,
    dto: {
      fecha: string;
      descripcionTrabajo: string;
      horaEntrada: string;
      horaSalida: string;
    },
  ) {
    const user = await this.getUserForExtraHours(userId);

    const allowedWorkerTypes: WorkerType[] = [
      WorkerType.MECANICO,
      WorkerType.AYUDANTE_DE_MECANICO,
      WorkerType.JEFE_TALLER,
      WorkerType.SUPERVISOR,
    ];

    if (user.role !== 'SUPERADMIN') {
      if (!user.workerType || !allowedWorkerTypes.includes(user.workerType)) {
        throw new BadRequestException(
          'Solo mecánico, ayudante de mecánico, jefe de taller o supervisor pueden crear reportes de horas extras',
        );
      }

      if (!user.empresa) {
        throw new BadRequestException(
          'El trabajador no tiene empresa asignada',
        );
      }
    }

    const descripcionTrabajo = String(dto?.descripcionTrabajo || '').trim();
    if (!descripcionTrabajo) {
      throw new BadRequestException(
        'La descripción del trabajo es obligatoria',
      );
    }

    const fecha = this.parseExtraHourDate(dto?.fecha);
    const horaEntrada = String(dto?.horaEntrada || '').trim();
    const horaSalida = String(dto?.horaSalida || '').trim();
    const totalHoras = this.calcExtraHours(horaEntrada, horaSalida);

    return this.prisma.workshopExtraHourReport.create({
      data: {
        empresa: (user.empresa ?? Empresa.GRUAS_THOMAS) as Empresa,
        trabajador: {
          connect: { id: user.id },
        },
        trabajadorNombre: user.nombre,
        trabajadorApellido: user.apellido,
        trabajadorRut: user.rut,
        trabajadorEmail: user.email,
        workerType:
          (user.workerType ??
            (user.role === 'SUPERADMIN'
              ? WorkerType.JEFE_TALLER
              : undefined)) as WorkerType,
        fecha,
        descripcionTrabajo,
        horaEntrada,
        horaSalida,
        totalHoras,
        estado: WorkshopExtraHourStatus.ENVIADO,
      },
      include: {
        trabajador: true,
        firmadoPor: true,
      },
    });
  }

  async getMyExtraHourReports(userId: string) {
    const user = await this.getUserForExtraHours(userId);

    return this.prisma.workshopExtraHourReport.findMany({
      where:
        user.role === 'SUPERADMIN'
          ? {}
          : {
              trabajadorId: userId,
            },
      include: {
        trabajador: true,
        firmadoPor: true,
      },
      orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getExtraHourReportById(id: string, userId: string) {
    const report = await this.ensureExtraHourReportExists(id);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        activo: true,
        role: true,
        workerType: true,
        empresa: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (!user.activo) {
      throw new BadRequestException('Usuario inactivo');
    }

    if (user.role === 'SUPERADMIN') {
      return report;
    }

    if (
      user.role === 'TRABAJADOR' &&
      (
        user.workerType === WorkerType.JEFE_TALLER ||
        user.workerType === WorkerType.SUPERVISOR
      )
    ) {
      if (user.empresa && report.empresa && user.empresa !== report.empresa) {
        throw new BadRequestException(
          'No puedes ver reportes de otra empresa',
        );
      }

      return report;
    }

    if (report.trabajadorId !== user.id) {
      throw new BadRequestException(
        'No tienes permisos para ver este reporte',
      );
    }

    return report;
  }

  async getExtraHourReportsForJefe(jefeId: string) {
    const jefe = await this.ensureJefeTaller(jefeId);

    if (jefe.role === 'SUPERADMIN') {
      return this.prisma.workshopExtraHourReport.findMany({
        include: {
          trabajador: true,
          firmadoPor: true,
        },
        orderBy: [{ estado: 'asc' }, { fecha: 'desc' }, { createdAt: 'desc' }],
      });
    }

    if (!jefe.empresa) {
      throw new BadRequestException(
        'El jefe de taller no tiene empresa asignada',
      );
    }

    return this.prisma.workshopExtraHourReport.findMany({
      where: {
        empresa: jefe.empresa,
      },
      include: {
        trabajador: true,
        firmadoPor: true,
      },
      orderBy: [{ estado: 'asc' }, { fecha: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getExtraHoursForAdmin(userId: string, from?: string, to?: string) {
    const admin = await this.ensureExtraHoursAdminAccess(userId);

    let fromDate: Date | undefined;
    let toDate: Date | undefined;

    if (from) {
      const d = new Date(from);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(0, 0, 0, 0);
        fromDate = d;
      }
    }

    if (to) {
      const d = new Date(to);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        toDate = d;
      }
    }

    const where: Prisma.WorkshopExtraHourReportWhereInput = {
      estado: WorkshopExtraHourStatus.FIRMADO,
      ...(admin.role === Role.ADMINISTRADORA && admin.empresa
        ? { empresa: admin.empresa }
        : {}),
      ...(fromDate || toDate
        ? {
            fecha: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
    };

    return this.prisma.workshopExtraHourReport.findMany({
      where,
      include: {
        trabajador: true,
        firmadoPor: true,
      },
      orderBy: [
        { trabajadorNombre: 'asc' },
        { fecha: 'asc' },
        { createdAt: 'asc' },
      ],
    });
  }

  async generateExtraHoursPdfForWorker(
    requesterUserId: string,
    workerId: string,
    res: any,
    from?: string,
    to?: string,
  ) {
    const admin = await this.ensureExtraHoursAdminAccess(requesterUserId);

    const worker = await this.prisma.user.findUnique({
      where: { id: workerId },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        email: true,
        rut: true,
        empresa: true,
        workerType: true,
        activo: true,
      },
    });

    if (!worker) {
      throw new NotFoundException('Trabajador no encontrado');
    }

    if (!worker.activo) {
      throw new BadRequestException('El trabajador está inactivo');
    }

    if (
      admin.role === Role.ADMINISTRADORA &&
      admin.empresa &&
      worker.empresa &&
      admin.empresa !== worker.empresa
    ) {
      throw new BadRequestException(
        'No puedes generar PDF de trabajadores de otra empresa',
      );
    }

    let fromDate: Date | undefined;
    let toDate: Date | undefined;

    if (from) {
      const d = new Date(from);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(0, 0, 0, 0);
        fromDate = d;
      }
    }

    if (to) {
      const d = new Date(to);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        toDate = d;
      }
    }

    const where: Prisma.WorkshopExtraHourReportWhereInput = {
      trabajadorId: workerId,
      estado: WorkshopExtraHourStatus.FIRMADO,
      ...(admin.role === Role.ADMINISTRADORA && admin.empresa
        ? { empresa: admin.empresa }
        : {}),
      ...(fromDate || toDate
        ? {
            fecha: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
    };

    const reports = await this.prisma.workshopExtraHourReport.findMany({
      where,
      include: {
        trabajador: true,
        firmadoPor: true,
      },
      orderBy: [{ fecha: 'asc' }, { createdAt: 'asc' }],
    });

    if (!reports.length) {
      throw new BadRequestException(
        'No hay horas extras firmadas en este rango',
      );
    }

    const safeName = this
      .getFullName(worker)
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '_')
      .replace(/^_+|_+$/g, '');

    const formatFileDate = (val?: string) => {
      if (!val) return '';
      const [y, m, d] = String(val).split('-');
      if (!y || !m || !d) return val;
      return `${d}-${m}-${y}`;
    };

    const fromLabel = formatFileDate(from);
    const toLabel = formatFileDate(to);

    const fileName =
      from && to
        ? `horas_extras_${safeName}_${fromLabel}_al_${toLabel}.pdf`
        : `horas_extras_${safeName}.pdf`;

    const doc = new PDFDocument({
      size: 'A4',
      margin: 24,
      layout: 'portrait',
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

    doc.pipe(res);

    let y = this.drawExtraHoursPdfHeader(doc);

    for (const report of reports) {
      const rowHeight = 40;
      y = this.ensurePdfPageSpace(doc, y, rowHeight);
      y = this.drawPdfRow(doc, y, report);
    }

    const minRowsPerSheet = 15;
    if (reports.length < minRowsPerSheet) {
      for (let i = reports.length; i < minRowsPerSheet; i++) {
        const rowHeight = 40;
        y = this.ensurePdfPageSpace(doc, y, rowHeight);
        y = this.drawPdfRow(doc, y, {});
      }
    }

    doc.end();
  }

  async generateExtraHoursExcel(
    requesterUserId: string,
    res: any,
    from?: string,
    to?: string,
  ) {
    const admin = await this.ensureExtraHoursAdminAccess(requesterUserId);

    let fromDate: Date | undefined;
    let toDate: Date | undefined;

    if (from) {
      const d = new Date(from);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(0, 0, 0, 0);
        fromDate = d;
      }
    }

    if (to) {
      const d = new Date(to);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        toDate = d;
      }
    }

    const where: Prisma.WorkshopExtraHourReportWhereInput = {
      estado: WorkshopExtraHourStatus.FIRMADO,
      ...(admin.role === Role.ADMINISTRADORA && admin.empresa
        ? { empresa: admin.empresa }
        : {}),
      ...(fromDate || toDate
        ? {
            fecha: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
    };

    const reports = await this.prisma.workshopExtraHourReport.findMany({
      where,
      include: {
        trabajador: true,
        firmadoPor: true,
      },
      orderBy: [
        { trabajadorNombre: 'asc' },
        { fecha: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    if (!reports.length) {
      throw new BadRequestException(
        'No hay horas extras firmadas en este rango',
      );
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Horas Extras');

    sheet.columns = [
      { header: 'Trabajador', key: 'trabajador', width: 30 },
      { header: 'RUT', key: 'rut', width: 18 },
      { header: 'Fecha', key: 'fecha', width: 15 },
      { header: 'Descripción', key: 'descripcion', width: 40 },
      { header: 'Hora Entrada', key: 'entrada', width: 15 },
      { header: 'Hora Salida', key: 'salida', width: 15 },
      { header: 'Total Horas', key: 'total', width: 15 },
      { header: 'Firmado Por', key: 'firmado', width: 30 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };

    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2D8FBD' },
      };
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    for (const r of reports) {
      sheet.addRow({
        trabajador: this.getFullName(r.trabajador),
        rut: r.trabajador?.rut || '',
        fecha: this.formatDateOnly(r.fecha),
        descripcion: r.descripcionTrabajo || '',
        entrada: r.horaEntrada || '',
        salida: r.horaSalida || '',
        total: r.totalHoras || '',
        firmado: this.getFullName(r.firmadoPor),
      });
    }

    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
          left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
          bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
          right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        };
      });
    });

    const formatFileDate = (val?: string) => {
      if (!val) return '';
      const [y, m, d] = String(val).split('-');
      if (!y || !m || !d) return val;
      return `${d}-${m}-${y}`;
    };

    const fromLabel = formatFileDate(from) || 'inicio';
    const toLabel = formatFileDate(to) || 'fin';
    const fileName = `horas_extras_${fromLabel}_al_${toLabel}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=${fileName}`,
    );

    await workbook.xlsx.write(res);
    res.end();
  }

  async signExtraHourReport(
    reportId: string,
    jefeId: string,
    firmaDataUrl: string,
  ) {
    const jefe = await this.ensureJefeTaller(jefeId);
    const report = await this.ensureExtraHourReportExists(reportId);

    const firma = String(firmaDataUrl || '').trim();
    if (!firma) {
      throw new BadRequestException('La firma es obligatoria');
    }

    if (!/^data:image\/\w+;base64,/i.test(firma) && firma.length < 50) {
      throw new BadRequestException('La firma enviada no es válida');
    }

    if (
      jefe.role !== 'SUPERADMIN' &&
      jefe.empresa &&
      report.empresa &&
      jefe.empresa !== report.empresa
    ) {
      throw new BadRequestException(
        'No puedes firmar reportes de otra empresa',
      );
    }

    if (report.estado === WorkshopExtraHourStatus.FIRMADO) {
      throw new BadRequestException('Este reporte ya fue firmado');
    }

    return this.prisma.workshopExtraHourReport.update({
      where: { id: reportId },
      data: {
        estado: WorkshopExtraHourStatus.FIRMADO,
        firmadoPor: {
          connect: { id: jefe.id },
        },
        firmadoAt: new Date(),
        firmaDataUrl: firma,
        observacionRechazo: null,
      },
      include: {
        trabajador: true,
        firmadoPor: true,
      },
    });
  }

  async rejectExtraHourReport(
    reportId: string,
    jefeId: string,
    observacionRechazo: string,
  ) {
    const jefe = await this.ensureJefeTaller(jefeId);
    const report = await this.ensureExtraHourReportExists(reportId);

    const motivo = String(observacionRechazo || '').trim();
    if (!motivo) {
      throw new BadRequestException('La observación de rechazo es obligatoria');
    }

    if (
      jefe.role !== 'SUPERADMIN' &&
      jefe.empresa &&
      report.empresa &&
      jefe.empresa !== report.empresa
    ) {
      throw new BadRequestException(
        'No puedes rechazar reportes de otra empresa',
      );
    }

    if (report.estado === WorkshopExtraHourStatus.FIRMADO) {
      throw new BadRequestException(
        'No se puede rechazar un reporte que ya fue firmado',
      );
    }

    return this.prisma.workshopExtraHourReport.update({
      where: { id: reportId },
      data: {
        estado: WorkshopExtraHourStatus.RECHAZADO,
        firmadoPor: {
          connect: { id: jefe.id },
        },
        firmadoAt: new Date(),
        observacionRechazo: motivo,
      },
      include: {
        trabajador: true,
        firmadoPor: true,
      },
    });
  }

  async removeExtraHourReport(id: string, userId: string) {
    const report = await this.prisma.workshopExtraHourReport.findUnique({
      where: { id },
      include: {
        trabajador: true,
        firmadoPor: true,
      },
    });

    if (!report) {
      throw new NotFoundException('Reporte de horas extras no encontrado');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        activo: true,
        role: true,
        workerType: true,
        empresa: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (!user.activo) {
      throw new BadRequestException('Usuario inactivo');
    }

    const canDeleteOwnReport = report.trabajadorId === user.id;

    const canDeleteAsManager =
      user.role === Role.SUPERADMIN ||
      (user.role === Role.TRABAJADOR &&
        (
          user.workerType === WorkerType.JEFE_TALLER ||
          user.workerType === WorkerType.SUPERVISOR
        ));

    if (!canDeleteOwnReport && !canDeleteAsManager) {
      throw new BadRequestException(
        'No tienes permisos para eliminar este reporte',
      );
    }

    if (
      user.role !== Role.SUPERADMIN &&
      user.empresa &&
      report.empresa &&
      user.empresa !== report.empresa
    ) {
      throw new BadRequestException(
        'No puedes eliminar reportes de otra empresa',
      );
    }

    await this.prisma.workshopExtraHourReport.delete({
      where: { id },
    });

    return { message: 'Reporte eliminado correctamente' };
  }

  // ============================
  // INCIDENTES
  // ============================

  async createIncident(dto: CreateIncidentDto) {
    const patente = normalizePlate(dto.patente);

    if (!patente) {
      throw new BadRequestException('La patente es obligatoria');
    }

    const vehicles = await this.prisma.vehicle.findMany({
      where: {
        activo: true,
      },
      select: {
        id: true,
        patente: true,
      },
    });

    const vehicle = vehicles.find(
      (v) => normalizePlate(v.patente) === patente,
    );

    if (!vehicle) {
      throw new NotFoundException('No se encontró un vehículo con esa patente');
    }

    let fotoUrl: string | null = null;

    if (dto.foto) {
      const buffer = this.parseImageDataUrl(dto.foto);

      if (buffer) {
        const uploadDir = path.join(process.cwd(), 'uploads', 'incidents');

        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        const fileName = `incident_${Date.now()}.jpg`;
        const filePath = path.join(uploadDir, fileName);

        fs.writeFileSync(filePath, buffer);

        fotoUrl = `/uploads/incidents/${fileName}`;
      }
    }

    const incident = await this.prisma.vehicleIncident.create({
      data: {
        vehicle: {
          connect: { id: vehicle.id },
        },
        reportedBy: {
          connect: { id: dto.reportedById },
        },
        empresa: dto.empresa,
        type: 'OTRO',
        severity: 'MEDIA',
        descripcion: dto.descripcion,
        ubicacionTexto: dto.ubicacionTexto,
        fotoUrl,
      },
      include: {
        vehicle: true,
        reportedBy: true,
        workshopTasks: {
          include: {
            assignedTo: true,
            assignments: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    await this.notifyIncidentCreated(incident);

    return incident;
  }

  async getIncidents() {
    return this.prisma.vehicleIncident.findMany({
      include: {
        vehicle: true,
        reportedBy: true,
        workshopTasks: {
          include: {
            assignedTo: true,
            assignments: {
              include: {
                user: true,
              },
            },
            partsUsed: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getIncidentById(id: string) {
    const incident = await this.prisma.vehicleIncident.findUnique({
      where: { id },
      include: {
        vehicle: true,
        reportedBy: true,
        workshopTasks: {
          include: {
            assignedTo: true,
            assignments: {
              include: {
                user: true,
              },
            },
            partsUsed: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!incident) {
      throw new NotFoundException('Incidente no encontrado');
    }

    return incident;
  }

  async updateIncident(id: string, dto: UpdateIncidentDto) {
    await this.ensureIncidentExists(id);

    const data: Prisma.VehicleIncidentUpdateInput = {
      empresa: dto.empresa,
      type: dto.type,
      severity: dto.severity,
      status: dto.status,
      titulo: dto.titulo,
      descripcion: dto.descripcion,
      ubicacionTexto: dto.ubicacionTexto,
      kilometraje: dto.kilometraje,
      horometro: dto.horometro,
    };

    if (dto.vehicleId) {
      data.vehicle = {
        connect: { id: dto.vehicleId },
      };
    }

    if (dto.reportedById) {
      data.reportedBy = {
        connect: { id: dto.reportedById },
      };
    }

    return this.prisma.vehicleIncident.update({
      where: { id },
      data,
      include: {
        vehicle: true,
        reportedBy: true,
        workshopTasks: {
          include: {
            assignedTo: true,
            assignments: {
              include: {
                user: true,
              },
            },
            partsUsed: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
  }

  async closeIncident(id: string) {
    await this.ensureIncidentExists(id);

    return this.prisma.vehicleIncident.update({
      where: { id },
      data: {
        status: VehicleIncidentStatus.CERRADO,
        cerradoEn: new Date(),
      },
      include: {
        vehicle: true,
        reportedBy: true,
        workshopTasks: {
          include: {
            assignedTo: true,
            assignments: {
              include: {
                user: true,
              },
            },
            partsUsed: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
  }

  async assignIncident(
    id: string,
    dto: {
      workerId: string;
      helperIds?: string[];
      note?: string;
      status?: string;
    },
  ) {
    if (!dto?.workerId) {
      throw new BadRequestException('El responsable principal es obligatorio');
    }

    const helperIds = Array.isArray(dto.helperIds)
      ? dto.helperIds.filter(Boolean)
      : [];

    const uniqueUserIds = Array.from(
      new Set(
        [dto.workerId, ...helperIds].filter(
          (id): id is string => typeof id === 'string' && id.trim().length > 0,
        ),
      ),
    );

    const incident = await this.prisma.vehicleIncident.findUnique({
      where: { id },
      include: {
        vehicle: true,
        reportedBy: true,
        workshopTasks: {
          include: {
            assignedTo: true,
            assignments: {
              include: {
                user: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!incident) {
      throw new NotFoundException('Incidente no encontrado');
    }

    const users = await this.prisma.user.findMany({
      where: {
        id: {
          in: uniqueUserIds,
        },
      },
      select: {
        id: true,
        activo: true,
      },
    });

    if (users.length !== uniqueUserIds.length) {
      throw new NotFoundException(
        'Uno o más técnicos seleccionados no existen',
      );
    }

    const inactiveUser = users.find((u) => !u.activo);
    if (inactiveUser) {
      throw new BadRequestException(
        'Uno o más técnicos seleccionados están inactivos',
      );
    }

    const openTask = incident.workshopTasks.find(
      (task) =>
        task.status !== WorkshopTaskStatus.TERMINADA &&
        task.status !== WorkshopTaskStatus.CANCELADA,
    );

    let workshopTaskId: string;

    if (openTask) {
      const updatedTask = await this.prisma.workshopTask.update({
        where: { id: openTask.id },
        data: {
          assignedTo: {
            connect: { id: dto.workerId },
          },
          status: WorkshopTaskStatus.EN_REVISION,
          observaciones: dto.note?.trim() || openTask.observaciones,
        },
        select: {
          id: true,
        },
      });

      workshopTaskId = updatedTask.id;

      await this.prisma.workshopTaskAssignment.deleteMany({
        where: {
          workshopTaskId,
        },
      });
    } else {
      const codigo = await this.generateWorkshopCode();

      const createdTask = await this.prisma.workshopTask.create({
        data: {
          incident: {
            connect: { id: incident.id },
          },
          vehicle: {
            connect: { id: incident.vehicle.id },
          },
          empresa: incident.empresa,
          createdBy: {
            connect: { id: incident.reportedBy.id },
          },
          assignedTo: {
            connect: { id: dto.workerId },
          },
          codigo,
          titulo: incident.titulo?.trim() || 'Incidente reportado',
          descripcion: incident.descripcion || 'Sin descripción',
          priority: 'MEDIA',
          status: WorkshopTaskStatus.EN_REVISION,
          observaciones: dto.note?.trim() || undefined,
        },
        select: {
          id: true,
        },
      });

      workshopTaskId = createdTask.id;
    }

    await this.prisma.workshopTaskAssignment.createMany({
      data: [
        {
          workshopTaskId,
          userId: dto.workerId,
          role: WorkshopTaskAssignmentRole.RESPONSABLE,
        },
        ...helperIds
          .filter((helperId) => helperId !== dto.workerId)
          .map((helperId) => ({
            workshopTaskId,
            userId: helperId,
            role: WorkshopTaskAssignmentRole.APOYO,
          })),
      ],
      skipDuplicates: true,
    });

    await this.prisma.vehicleIncident.update({
      where: { id: incident.id },
      data: {
        status: VehicleIncidentStatus.EN_REVISION,
        cerradoEn: null,
      },
    });

    const result = await this.prisma.vehicleIncident.findUnique({
      where: { id: incident.id },
      include: {
        vehicle: true,
        reportedBy: true,
        workshopTasks: {
          include: {
            assignedTo: true,
            assignments: {
              include: {
                user: true,
              },
            },
            partsUsed: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    const task = result?.workshopTasks?.[0];

    if (task) {
      await this.notifyWorkshopTaskAssigned(task);
    }

    return result;
  }

  async removeIncident(id: string) {
    const incident = await this.prisma.vehicleIncident.findUnique({
      where: { id },
      include: {
        workshopTasks: {
          include: {
            assignments: true,
            partsUsed: true,
          },
        },
      },
    });

    if (!incident) {
      throw new NotFoundException('Incidente no encontrado');
    }

    await this.prisma.$transaction(async (tx) => {
      for (const task of incident.workshopTasks) {
        await tx.workshopTaskAssignment.deleteMany({
          where: { workshopTaskId: task.id },
        });

        await tx.workshopTaskPart.deleteMany({
          where: { workshopTaskId: task.id },
        });
      }

      await tx.workshopTask.deleteMany({
        where: { incidentId: id },
      });

      await tx.vehicleIncident.delete({
        where: { id },
      });
    });

    return {
      message: 'Incidente eliminado correctamente',
    };
  }

  // ============================
  // TAREAS DE TALLER
  // ============================

  async createWorkshopTask(dto: CreateWorkshopTaskDto) {
    const helperIds = Array.isArray(dto.helperIds)
      ? dto.helperIds.filter(Boolean)
      : [];

    const uniqueUserIds = Array.from(
      new Set(
        [dto.assignedToId, ...helperIds].filter(
          (id): id is string => typeof id === 'string' && id.trim().length > 0,
        ),
      ),
    );

    if (!dto.vehicleId) {
      throw new BadRequestException('El vehículo es obligatorio');
    }

    if (!dto.createdById) {
      throw new BadRequestException('El creador de la tarea es obligatorio');
    }

    if (!dto.empresa) {
      throw new BadRequestException('La empresa es obligatoria');
    }

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: dto.vehicleId },
      select: {
        id: true,
        empresa: true,
        activo: true,
      },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehículo no encontrado');
    }

    if (!vehicle.activo) {
      throw new BadRequestException('El vehículo seleccionado está inactivo');
    }

    const creator = await this.prisma.user.findUnique({
      where: { id: dto.createdById },
      select: {
        id: true,
        activo: true,
      },
    });

    if (!creator) {
      throw new NotFoundException('Usuario creador no encontrado');
    }

    if (!creator.activo) {
      throw new BadRequestException('El usuario creador está inactivo');
    }

    if (uniqueUserIds.length > 0) {
      const users = await this.prisma.user.findMany({
        where: {
          id: {
            in: uniqueUserIds,
          },
        },
        select: {
          id: true,
          activo: true,
        },
      });

      if (users.length !== uniqueUserIds.length) {
        throw new NotFoundException(
          'Uno o más técnicos seleccionados no existen',
        );
      }

      const inactiveUser = users.find((u) => !u.activo);
      if (inactiveUser) {
        throw new BadRequestException(
          'Uno o más técnicos seleccionados están inactivos',
        );
      }
    }

    if (dto.incidentId) {
      const incident = await this.prisma.vehicleIncident.findUnique({
        where: { id: dto.incidentId },
        select: { id: true },
      });

      if (!incident) {
        throw new NotFoundException('Incidente relacionado no encontrado');
      }
    }

    const titulo = dto.titulo?.trim() || 'Tarea de taller';

    const createdTask = await this.prisma.$transaction(async (tx) => {
      const codigo = await this.generateWorkshopCode(tx);

      const task = await tx.workshopTask.create({
        data: {
          incident: dto.incidentId
            ? {
                connect: { id: dto.incidentId },
              }
            : undefined,
          vehicle: {
            connect: { id: dto.vehicleId },
          },
          empresa: dto.empresa,
          createdBy: {
            connect: { id: dto.createdById },
          },
          assignedTo: dto.assignedToId
            ? {
                connect: { id: dto.assignedToId },
              }
            : undefined,
          codigo,
          titulo,
          descripcion: dto.descripcion,
          priority: dto.priority ?? 'MEDIA',
          status: dto.status ?? 'PENDIENTE',
          diagnostico: dto.diagnostico,
          trabajoRealizado: dto.trabajoRealizado,
          observaciones: dto.observaciones,
          estimatedCost: dto.estimatedCost,
          actualCost: dto.actualCost,
        },
        include: {
          vehicle: true,
          incident: true,
          createdBy: true,
          assignedTo: true,
          assignments: {
            include: {
              user: true,
            },
          },
          partsUsed: true,
        },
      });

      if (dto.assignedToId || helperIds.length > 0) {
        await tx.workshopTaskAssignment.createMany({
          data: [
            ...(dto.assignedToId
              ? [
                  {
                    workshopTaskId: task.id,
                    userId: dto.assignedToId,
                    role: WorkshopTaskAssignmentRole.RESPONSABLE,
                  },
                ]
              : []),
            ...helperIds
              .filter((helperId) => helperId !== dto.assignedToId)
              .map((helperId) => ({
                workshopTaskId: task.id,
                userId: helperId,
                role: WorkshopTaskAssignmentRole.APOYO,
              })),
          ],
          skipDuplicates: true,
        });
      }

      return tx.workshopTask.findUnique({
        where: { id: task.id },
        include: {
          vehicle: true,
          incident: true,
          createdBy: true,
          assignedTo: true,
          closedBy: true,
          assignments: {
            include: {
              user: true,
            },
          },
          partsUsed: true,
        },
      });
    });

    await this.notifyWorkshopTaskAssigned(createdTask);

    return createdTask;
  }

  async getWorkshopTasks() {
    return this.prisma.workshopTask.findMany({
      include: {
        vehicle: true,
        incident: true,
        createdBy: true,
        assignedTo: true,
        closedBy: true,
        assignments: {
          include: {
            user: true,
          },
        },
        partsUsed: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getRequestedPartsTasks() {
    return this.prisma.workshopTask.findMany({
      where: {
        OR: [
          { status: WorkshopTaskStatus.ESPERANDO_REPUESTO },
          { status: WorkshopTaskStatus.EN_COMPRA },
          { status: WorkshopTaskStatus.COMPRADO },
          { status: WorkshopTaskStatus.ENTREGADO },
        ],
        observaciones: {
          contains: 'REQUIERE REPUESTO',
        },
      },
      include: {
        vehicle: true,
        incident: true,
        createdBy: true,
        assignedTo: true,
        closedBy: true,
        assignments: {
          include: {
            user: true,
          },
        },
        partsUsed: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  async getWorkshopTaskById(id: string) {
    const task = await this.prisma.workshopTask.findUnique({
      where: { id },
      include: {
        vehicle: true,
        incident: true,
        createdBy: true,
        assignedTo: true,
        closedBy: true,
        assignments: {
          include: {
            user: true,
          },
        },
        partsUsed: true,
      },
    });

    if (!task) {
      throw new NotFoundException('Tarea de taller no encontrada');
    }

    return task;
  }

  async updateWorkshopTask(id: string, dto: UpdateWorkshopTaskDto) {
    const existingTask = await this.prisma.workshopTask.findUnique({
      where: { id },
      include: {
        incident: true,
      },
    });

    if (!existingTask) {
      throw new NotFoundException('Tarea de taller no encontrada');
    }

    const nextStatus = dto.status
      ? (dto.status as WorkshopTaskStatus)
      : existingTask.status;

    const normalizedObservaciones =
      typeof dto.observaciones === 'string'
        ? dto.observaciones.trim()
        : undefined;

    const data: Prisma.WorkshopTaskUpdateInput = {
      empresa: dto.empresa,
      titulo: dto.titulo,
      descripcion: dto.descripcion,
      priority: dto.priority,
      status: dto.status,
      diagnostico: dto.diagnostico,
      trabajoRealizado: dto.trabajoRealizado,
      observaciones:
        normalizedObservaciones !== undefined
          ? normalizedObservaciones
          : dto.observaciones,
      estimatedCost: dto.estimatedCost,
      actualCost: dto.actualCost,
    };

    if (nextStatus === WorkshopTaskStatus.EN_REPARACION) {
      data.startedAt = existingTask.startedAt ?? new Date();
      data.closedAt = null;
    }

    if (nextStatus === WorkshopTaskStatus.ESPERANDO_REPUESTO) {
      data.startedAt = existingTask.startedAt ?? new Date();
      data.closedAt = null;
    }

    if (nextStatus === WorkshopTaskStatus.TERMINADA) {
      data.closedAt = new Date();
    }

    if (nextStatus === WorkshopTaskStatus.CANCELADA) {
      data.closedAt = new Date();
    }

    if (dto.incidentId) {
      data.incident = {
        connect: { id: dto.incidentId },
      };
    }

    if (dto.vehicleId) {
      data.vehicle = {
        connect: { id: dto.vehicleId },
      };
    }

    if (dto.createdById) {
      data.createdBy = {
        connect: { id: dto.createdById },
      };
    }

    if (dto.assignedToId) {
      data.assignedTo = {
        connect: { id: dto.assignedToId },
      };
    }

    if (dto.closedById) {
      data.closedBy = {
        connect: { id: dto.closedById },
      };
    }

    const updatedTask = await this.prisma.workshopTask.update({
      where: { id },
      data,
      include: {
        vehicle: true,
        incident: true,
        createdBy: true,
        assignedTo: true,
        closedBy: true,
        assignments: {
          include: {
            user: true,
          },
        },
        partsUsed: true,
      },
    });

    if (existingTask.incidentId) {
      if (nextStatus === WorkshopTaskStatus.TERMINADA) {
        await this.prisma.vehicleIncident.update({
          where: { id: existingTask.incidentId },
          data: {
            status: VehicleIncidentStatus.RESUELTO,
            cerradoEn: new Date(),
          },
        });
      } else if (
        nextStatus === WorkshopTaskStatus.EN_REVISION ||
        nextStatus === WorkshopTaskStatus.EN_REPARACION ||
        nextStatus === WorkshopTaskStatus.ESPERANDO_REPUESTO ||
        nextStatus === WorkshopTaskStatus.PENDIENTE
      ) {
        await this.prisma.vehicleIncident.update({
          where: { id: existingTask.incidentId },
          data: {
            status: VehicleIncidentStatus.EN_REVISION,
            cerradoEn: null,
          },
        });
      } else if (nextStatus === WorkshopTaskStatus.CANCELADA) {
        await this.prisma.vehicleIncident.update({
          where: { id: existingTask.incidentId },
          data: {
            status: VehicleIncidentStatus.CANCELADO,
            cerradoEn: new Date(),
          },
        });
      }
    }

    return updatedTask;
  }

  async closeWorkshopTask(id: string) {
    const existingTask = await this.prisma.workshopTask.findUnique({
      where: { id },
      include: {
        incident: true,
      },
    });

    if (!existingTask) {
      throw new NotFoundException('Tarea de taller no encontrada');
    }

    const updatedTask = await this.prisma.workshopTask.update({
      where: { id },
      data: {
        status: WorkshopTaskStatus.TERMINADA,
        closedAt: new Date(),
      },
      include: {
        vehicle: true,
        incident: true,
        createdBy: true,
        assignedTo: true,
        closedBy: true,
        assignments: {
          include: {
            user: true,
          },
        },
        partsUsed: true,
      },
    });

    if (existingTask.incidentId) {
      await this.prisma.vehicleIncident.update({
        where: { id: existingTask.incidentId },
        data: {
          status: VehicleIncidentStatus.RESUELTO,
          cerradoEn: new Date(),
        },
      });
    }

    return updatedTask;
  }

  async removeWorkshopTask(id: string) {
    const existingTask = await this.prisma.workshopTask.findUnique({
      where: { id },
      include: {
        incident: true,
        assignments: true,
        partsUsed: true,
      },
    });

    if (!existingTask) {
      throw new NotFoundException('Tarea de taller no encontrada');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.workshopTaskAssignment.deleteMany({
        where: {
          workshopTaskId: id,
        },
      });

      await tx.workshopTaskPart.deleteMany({
        where: {
          workshopTaskId: id,
        },
      });

      await tx.workshopTask.delete({
        where: { id },
      });

      if (existingTask.incidentId) {
        const openTasks = await tx.workshopTask.count({
          where: {
            incidentId: existingTask.incidentId,
            status: {
              notIn: [
                WorkshopTaskStatus.TERMINADA,
                WorkshopTaskStatus.CANCELADA,
              ],
            },
          },
        });

        await tx.vehicleIncident.update({
          where: { id: existingTask.incidentId },
          data: {
            status:
              openTasks > 0
                ? VehicleIncidentStatus.EN_REVISION
                : VehicleIncidentStatus.ABIERTO,
            cerradoEn: null,
          },
        });
      }
    });

    return {
      message: 'Tarea eliminada correctamente',
    };
  }

  // ============================
  // ACCIONES DE TRABAJADOR
  // SOLO RESPONSABLE
  // ============================

  async startWorkshopTaskByWorker(taskId: string, userId: string) {
    const task = await this.ensureWorkshopTaskExists(taskId);
    await this.ensureResponsibleAssignment(taskId, userId);

    if (
      task.status === WorkshopTaskStatus.TERMINADA ||
      task.status === WorkshopTaskStatus.CANCELADA
    ) {
      throw new BadRequestException(
        'No se puede iniciar una tarea terminada o cancelada',
      );
    }

    const updatedTask = await this.prisma.workshopTask.update({
      where: { id: taskId },
      data: {
        status: WorkshopTaskStatus.EN_REPARACION,
        startedAt: task.startedAt ?? new Date(),
        closedAt: null,
      },
      include: {
        vehicle: true,
        incident: true,
        createdBy: true,
        assignedTo: true,
        closedBy: true,
        assignments: {
          include: {
            user: true,
          },
        },
        partsUsed: true,
      },
    });

    if (updatedTask.incidentId) {
      await this.prisma.vehicleIncident.update({
        where: { id: updatedTask.incidentId },
        data: {
          status: VehicleIncidentStatus.EN_REVISION,
          cerradoEn: null,
        },
      });
    }

    return updatedTask;
  }

  async requestPartForTaskByWorker(
    userId: string,
    dto: CreateWorkshopTaskPartDto & {
      fotoDataUrl?: string;
      fotoNombre?: string;
    },
  ) {
    if (!dto.workshopTaskId) {
      throw new BadRequestException('La tarea de taller es obligatoria');
    }

    const task = await this.ensureWorkshopTaskExists(dto.workshopTaskId);
    await this.ensureResponsibleAssignment(dto.workshopTaskId, userId);

    if (
      task.status === WorkshopTaskStatus.TERMINADA ||
      task.status === WorkshopTaskStatus.CANCELADA
    ) {
      throw new BadRequestException(
        'No se puede pedir repuesto para una tarea terminada o cancelada',
      );
    }

    let imagePath: string | null = null;

    if (dto.fotoDataUrl) {
      const buffer = this.parseImageDataUrl(dto.fotoDataUrl);

      if (buffer) {
        const uploadDir = path.join(process.cwd(), 'uploads/workshop-parts');

        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        const safeOriginalName = String(dto.fotoNombre || '')
          .trim()
          .toLowerCase();
        const originalExt = safeOriginalName.includes('.')
          ? safeOriginalName.split('.').pop()
          : '';

        const allowedExts = ['jpg', 'jpeg', 'png', 'webp'];
        const ext = allowedExts.includes(String(originalExt))
          ? String(originalExt)
          : 'jpg';

        const fileName = `part_${Date.now()}_${Math.random()
          .toString(36)
          .substring(2, 8)}.${ext}`;

        const fullPath = path.join(uploadDir, fileName);

        fs.writeFileSync(fullPath, buffer);

        imagePath = `/uploads/workshop-parts/${fileName}`;
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const part = await tx.workshopTaskPart.create({
        data: {
          workshopTask: {
            connect: { id: dto.workshopTaskId },
          },
          nombre: dto.nombre,
          cantidad: dto.cantidad ?? 1,
          costoUnitario: dto.costoUnitario,
          costoTotal: dto.costoTotal,
          observacion: dto.observacion,
        },
        include: {
          workshopTask: true,
        },
      });

      const previousTask = await tx.workshopTask.findUnique({
        where: { id: dto.workshopTaskId },
        select: {
          id: true,
          codigo: true,
          titulo: true,
          empresa: true,
          observaciones: true,
          startedAt: true,
          incidentId: true,
        },
      });

      const extraObservationBase = dto.observacion?.trim()
        ? `REQUIERE REPUESTO: ${dto.observacion.trim()}`
        : `REQUIERE REPUESTO: ${dto.nombre}`;

      const extraObservation = imagePath
        ? `${extraObservationBase}\n📸 Foto: ${imagePath}`
        : extraObservationBase;

      const mergedObservaciones = previousTask?.observaciones?.trim()
        ? `${previousTask.observaciones}\n${extraObservation}`
        : extraObservation;

      const updatedTask = await tx.workshopTask.update({
        where: { id: dto.workshopTaskId },
        data: {
          status: WorkshopTaskStatus.ESPERANDO_REPUESTO,
          startedAt: previousTask?.startedAt ?? new Date(),
          closedAt: null,
          observaciones: mergedObservaciones,
        },
        include: {
          vehicle: true,
          incident: true,
          createdBy: true,
          assignedTo: true,
          closedBy: true,
          assignments: {
            include: {
              user: true,
            },
          },
          partsUsed: true,
        },
      });

      if (previousTask?.incidentId) {
        await tx.vehicleIncident.update({
          where: { id: previousTask.incidentId },
          data: {
            status: VehicleIncidentStatus.EN_REVISION,
            cerradoEn: null,
          },
        });
      }

      return {
        part,
        updatedTask,
      };
    });

    await this.notifyPartRequested(result.updatedTask);

    return result.part;
  }

  async finishWorkshopTaskByWorker(
    taskId: string,
    userId: string,
    dto?: {
      trabajoRealizado?: string;
      fotoEvidencia?: string;
    },
  ) {
    const task = await this.ensureWorkshopTaskExists(taskId);
    await this.ensureResponsibleAssignment(taskId, userId);

    if (task.status === WorkshopTaskStatus.CANCELADA) {
      throw new BadRequestException(
        'No se puede terminar una tarea cancelada',
      );
    }

    if (task.status === WorkshopTaskStatus.TERMINADA) {
      throw new BadRequestException('La tarea ya está terminada');
    }

    let imagePath: string | null = null;

    if (dto?.fotoEvidencia) {
      const buffer = this.parseImageDataUrl(dto.fotoEvidencia);

      if (buffer) {
        const uploadDir = path.join(process.cwd(), 'uploads/workshop-evidence');

        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        const fileName = `evidence_${Date.now()}_${Math.random()
          .toString(36)
          .substring(2, 8)}.jpg`;

        const fullPath = path.join(uploadDir, fileName);

        fs.writeFileSync(fullPath, buffer);

        imagePath = `/uploads/workshop-evidence/${fileName}`;
      }
    }

    const trabajoRealizado = String(dto?.trabajoRealizado || '').trim();

    const updatedTask = await this.prisma.workshopTask.update({
      where: { id: taskId },
      data: {
        status: WorkshopTaskStatus.TERMINADA,
        startedAt: task.startedAt ?? new Date(),
        closedAt: new Date(),
        closedBy: {
          connect: { id: userId },
        },
        trabajoRealizado: trabajoRealizado || undefined,
        observaciones: imagePath
          ? task.observaciones?.trim()
            ? `${task.observaciones}\n📸 Evidencia: ${imagePath}`
            : `📸 Evidencia: ${imagePath}`
          : task.observaciones,
      },
      include: {
        vehicle: true,
        incident: true,
        createdBy: true,
        assignedTo: true,
        closedBy: true,
        assignments: {
          include: {
            user: true,
          },
        },
        partsUsed: true,
      },
    });

    if (updatedTask.incidentId) {
      await this.prisma.vehicleIncident.update({
        where: { id: updatedTask.incidentId },
        data: {
          status: VehicleIncidentStatus.RESUELTO,
          cerradoEn: new Date(),
        },
      });
    }

    return updatedTask;
  }

  // ============================
  // REPUESTOS
  // ============================

  async addPartToTask(dto: CreateWorkshopTaskPartDto) {
    return this.prisma.workshopTaskPart.create({
      data: {
        workshopTask: {
          connect: { id: dto.workshopTaskId },
        },
        nombre: dto.nombre,
        cantidad: dto.cantidad ?? 1,
        costoUnitario: dto.costoUnitario,
        costoTotal: dto.costoTotal,
        observacion: dto.observacion,
      },
      include: {
        workshopTask: true,
      },
    });
  }

  async removePart(id: string) {
    return this.prisma.workshopTaskPart.delete({
      where: { id },
    });
  }

  // ============================
  // HELPERS
  // ============================

  private async ensureIncidentExists(id: string) {
    const incident = await this.prisma.vehicleIncident.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!incident) {
      throw new NotFoundException('Incidente no encontrado');
    }

    return incident;
  }

  private async notifyIncidentCreated(incident: any) {
    try {
      const superAdmins = await this.prisma.user.findMany({
        where: {
          activo: true,
          role: Role.SUPERADMIN,
        },
        select: {
          id: true,
          role: true,
          workerType: true,
          nombre: true,
          apellido: true,
          email: true,
        },
      });

      const tallerLeads = await this.prisma.user.findMany({
        where: {
          activo: true,
          role: Role.TRABAJADOR,
          workerType: {
            in: [WorkerType.JEFE_TALLER, WorkerType.SUPERVISOR],
          },
          ...(incident?.empresa ? { empresa: incident.empresa } : {}),
        },
        select: {
          id: true,
          role: true,
          workerType: true,
          nombre: true,
          apellido: true,
          email: true,
        },
      });

      const destinatariosMap = new Map<string, any>();

      [...superAdmins, ...tallerLeads].forEach((u) => {
        destinatariosMap.set(u.id, u);
      });

      const destinatarios = Array.from(destinatariosMap.values());

      if (!destinatarios.length) {
        console.log(
          `⚠️ No se encontraron usuarios para notificar incidente ${incident?.id}`,
        );
        return;
      }

      const patente = String(incident?.vehicle?.patente || '').trim() || 'SIN PATENTE';
      const descripcion = String(incident?.descripcion || '').trim() || 'Sin descripción';

      const body = `Incidente en ${patente}: ${descripcion}`;

      for (const user of destinatarios) {
        try {
          await this.firebaseService.sendNotificationToUser(
            user.id,
            '🚨 Nuevo incidente',
            body,
            '/admin/incidentes',
          );

          console.log(
            `✅ Notificación de incidente enviada a ${user.role}${user.workerType ? `/${user.workerType}` : ''}: ${user.id}`,
          );
        } catch (error) {
          console.error(
            `❌ Error notificando incidente a ${user.role}${user.workerType ? `/${user.workerType}` : ''} (${user.id}):`,
            error,
          );
        }
      }
    } catch (error) {
      console.error('❌ Error general notifyIncidentCreated:', error);
    }
  }

  private async notifyWorkshopTaskAssigned(task: any) {
    try {
      const assignedUsers =
        task?.assignments
          ?.map((a: any) => a.user)
          ?.filter(Boolean)
          ?.filter((u: any) =>
            u.workerType === WorkerType.MECANICO ||
            u.workerType === WorkerType.AYUDANTE_DE_MECANICO ||
            u.workerType === WorkerType.JEFE_TALLER
          ) || [];

      const uniqueUsersMap = new Map<string, any>();
      assignedUsers.forEach((u: any) => uniqueUsersMap.set(u.id, u));
      const users = Array.from(uniqueUsersMap.values());

      if (!users.length) {
        console.log('⚠️ No hay usuarios asignados para notificar tarea de taller');
        return;
      }

      const codigo = String(task?.codigo || '').trim() || 'SIN CÓDIGO';
      const titulo = String(task?.titulo || '').trim() || 'Tarea de taller';

      const body = `Se te asignó la tarea ${codigo}: ${titulo}`;

      for (const user of users) {
        try {
          await this.firebaseService.sendNotificationToUser(
            user.id,
            '🛠️ Nueva tarea asignada',
            body,
            '/trabajador/taller',
          );

          console.log(
            `✅ Notificación de tarea enviada a ${user.id} (${codigo})`,
          );
        } catch (error) {
          console.error(
            `❌ Error notificando tarea a ${user.id} (${codigo}):`,
            error,
          );
        }
      }
    } catch (error) {
      console.error('❌ Error general notifyWorkshopTaskAssigned:', error);
    }
  }

  private async notifyPartRequested(task: any) {
  try {
    const users = await this.prisma.user.findMany({
      where: {
        activo: true,
        role: Role.TRABAJADOR,
        workerType: WorkerType.ADQUISICIONES,
      },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        empresa: true,
      },
    });

    console.log(
      '👀 Usuarios ADQUISICIONES encontrados:',
      users.map((u) => ({
        id: u.id,
        nombre: `${u.nombre || ''} ${u.apellido || ''}`.trim(),
        empresa: u.empresa,
      })),
    );

    if (!users.length) {
      console.log('⚠️ No hay usuarios de ADQUISICIONES para notificar');
      return;
    }

    const codigo = String(task?.codigo || '').trim() || 'SIN CÓDIGO';
    const titulo = String(task?.titulo || '').trim() || 'Tarea de taller';

    for (const user of users) {
      try {
        await this.firebaseService.sendNotificationToUser(
          user.id,
          '🛠️ Repuesto solicitado',
          `La tarea ${codigo} solicitó repuesto: ${titulo}`,
          '/admin/repuestos',
        );

        console.log(`✅ Notificación de repuesto enviada a ${user.id} (${codigo})`);
      } catch (error) {
        console.error(
          `❌ Error notificando repuesto a ${user.id} (${codigo}):`,
          error,
        );
      }
    }
  } catch (error) {
    console.error('❌ Error general notifyPartRequested:', error);
  }
}
}