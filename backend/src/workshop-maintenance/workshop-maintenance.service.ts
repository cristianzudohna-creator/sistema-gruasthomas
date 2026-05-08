import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Response } from "express";
import PDFDocument = require("pdfkit");
import * as path from "path";
import * as fs from "fs";

import {
  Role,
  WorkerType,
  WorkshopMaintenanceSignatureRole,
  WorkshopMaintenanceTaskStatus,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class WorkshopMaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  private isJefeTaller(user: any) {
    return (
      user?.role === Role.TRABAJADOR &&
      (user?.workerType === WorkerType.JEFE_TALLER ||
        user?.workerType === WorkerType.SUPERVISOR)
    );
  }

  private fmtDate(value: any) {
    if (!value) return "—";

    try {
      return new Date(value).toLocaleDateString("es-CL");
    } catch {
      return "—";
    }
  }

  private cleanFirmaDataUrl(value: string | null | undefined) {
    if (!value) return "";

    return String(value)
      .replace(/^data:image\/png;base64,/i, "")
      .replace(/^data:image\/jpeg;base64,/i, "")
      .replace(/^data:image\/jpg;base64,/i, "")
      .replace(/^data:image\/\w+;base64,/i, "")
      .trim();
  }

  private safeText(value: any, fallback = "—") {
    const text = String(value ?? "").trim();

    if (!text) return fallback;
    if (text.toLowerCase() === "undefined") return fallback;
    if (text.toLowerCase() === "null") return fallback;
    if (text.toLowerCase().includes("undefined undefined")) return fallback;
    if (text.includes("@")) return fallback;

    return text;
  }

  private userFullName(user: any) {
    const fullName = [user?.nombre, user?.apellido]
      .filter(Boolean)
      .join(" ")
      .trim();

    return this.safeText(fullName, "SIN NOMBRE");
  }

  private prettyCargo(value: any) {
    const v = String(value || "").trim().toUpperCase();

    const map: Record<string, string> = {
      SUPERADMIN: "Superadmin",
      CONTROL_FLOTA: "Control de flota",
      ADMINISTRADORA: "Administradora",
      TRABAJADOR: "Trabajador",
      MECANICO: "Mecánico",
      AYUDANTE_DE_MECANICO: "Ayudante mecánico",
      AYUDANTE_MECANICO: "Ayudante mecánico",
      MECANICO_HIDRAULICO: "Mecánico hidráulico",
      JEFE_TALLER: "Jefe de taller",
      SUPERVISOR: "Supervisor taller mecánico",
    };

    return map[v] || v.replace(/_/g, " ");
  }

  private async getSignerUser(user: any) {
    const userId = user?.id || user?.sub || user?.userId;

    if (!userId) return user;

    const dbUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    return dbUser || user;
  }

  private getSignerCargo(user: any) {
    if (user?.role === Role.TRABAJADOR && user?.workerType) {
      return this.prettyCargo(user.workerType);
    }

    return this.prettyCargo(user?.role);
  }

  async create(dto: any, user: any) {
    if (user.role !== Role.SUPERADMIN && user.role !== Role.CONTROL_FLOTA) {
      throw new ForbiddenException("Sin permisos");
    }

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: dto.vehicleId },
    });

    if (!vehicle) {
      throw new NotFoundException("Vehículo no encontrado");
    }

    const count = await this.prisma.workshopMaintenanceTask.count();
    const codigo = `MT-${String(count + 1).padStart(5, "0")}`;

    return this.prisma.workshopMaintenanceTask.create({
      data: {
        empresa: dto.empresa,
        vehicleId: dto.vehicleId,
        patenteSnapshot: vehicle.patente,
        codigo,
        titulo: "Mantención de taller",
        descripcion: dto.descripcion || null,
        kilometraje: null,
        horas: null,
        fecha: null,
        createdById: user.id,
        status: WorkshopMaintenanceTaskStatus.PENDIENTE_ASIGNACION,
      },
      include: {
        vehicle: true,
        createdBy: true,
        assignedTo: true,
        signatures: {
          include: {
            signedBy: true,
          },
        },
      },
    });
  }

  async findAll() {
    return this.prisma.workshopMaintenanceTask.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        vehicle: true,
        createdBy: true,
        assignedTo: true,
        signatures: {
          include: {
            signedBy: true,
          },
        },
      },
    });
  }

  async remove(id: string, user: any) {
    if (user.role !== Role.SUPERADMIN) {
      throw new ForbiddenException("Solo SUPERADMIN puede eliminar mantenciones");
    }

    const task = await this.prisma.workshopMaintenanceTask.findUnique({
      where: { id },
    });

    if (!task) {
      throw new NotFoundException("Mantención no encontrada");
    }

    await this.prisma.workshopMaintenanceSignature.deleteMany({
      where: { taskId: id },
    });

    await this.prisma.workshopMaintenanceTask.delete({
      where: { id },
    });

    return {
      ok: true,
      message: "Mantención eliminada correctamente",
      id,
    };
  }

  async assign(id: string, dto: any, user: any) {
    const task = await this.prisma.workshopMaintenanceTask.findUnique({
      where: { id },
    });

    if (!task) {
      throw new NotFoundException("Tarea no encontrada");
    }

    const allowed = user.role === Role.SUPERADMIN || this.isJefeTaller(user);

    if (!allowed) {
      throw new ForbiddenException("Sin permisos");
    }

    const assignedUser = await this.prisma.user.findUnique({
      where: { id: dto.assignedToId },
    });

    if (!assignedUser) {
      throw new NotFoundException("Usuario no encontrado");
    }

    return this.prisma.workshopMaintenanceTask.update({
      where: { id },
      data: {
        assignedToId: dto.assignedToId,
        assignedAt: new Date(),
        status: WorkshopMaintenanceTaskStatus.ASIGNADA,
      },
      include: {
        vehicle: true,
        createdBy: true,
        assignedTo: true,
        signatures: {
          include: {
            signedBy: true,
          },
        },
      },
    });
  }

  async start(id: string) {
    return this.prisma.workshopMaintenanceTask.update({
      where: { id },
      data: {
        startedAt: new Date(),
        status: WorkshopMaintenanceTaskStatus.EN_PROCESO,
      },
      include: {
        vehicle: true,
        createdBy: true,
        assignedTo: true,
        signatures: {
          include: {
            signedBy: true,
          },
        },
      },
    });
  }

  async complete(id: string, dto: any, user: any) {
    const task = await this.prisma.workshopMaintenanceTask.findUnique({
      where: { id },
    });

    if (!task) {
      throw new NotFoundException("Tarea no encontrada");
    }

    return this.prisma.workshopMaintenanceTask.update({
      where: { id },
      data: {
        kilometraje:
          dto.kilometraje !== undefined && dto.kilometraje !== null
            ? Number(dto.kilometraje)
            : task.kilometraje,

        horas:
          dto.horas !== undefined && dto.horas !== null
            ? Number(dto.horas)
            : task.horas,

        fecha: dto.fecha ? new Date(dto.fecha) : task.fecha,

        trabajosRealizados: dto.trabajosRealizados || [],
        repuestosLubricantes: dto.repuestosLubricantes || [],
        codigosFiltros: dto.codigosFiltros || [],
        observaciones: dto.observaciones || null,

        finishedAt: new Date(),
        status: WorkshopMaintenanceTaskStatus.ESPERANDO_FIRMA_TALLER,
      },
      include: {
        vehicle: true,
        createdBy: true,
        assignedTo: true,
        signatures: {
          include: {
            signedBy: true,
          },
        },
      },
    });
  }

  async signAsTaller(id: string, dto: any, user: any) {
    const signer = await this.getSignerUser(user);

    const allowed = signer.role === Role.SUPERADMIN || this.isJefeTaller(signer);

    if (!allowed) {
      throw new ForbiddenException("Sin permisos");
    }

    const task = await this.prisma.workshopMaintenanceTask.findUnique({
      where: { id },
    });

    if (!task) {
      throw new NotFoundException("Tarea no encontrada");
    }

    await this.prisma.workshopMaintenanceSignature.create({
      data: {
        taskId: id,
        role: WorkshopMaintenanceSignatureRole.TALLER,
        signedById: signer.id,
        firmaDataUrl: dto.firmaDataUrl,
        nombreFirmante: this.userFullName(signer),
        rutFirmante: signer.rut || null,
        cargoFirmante: this.getSignerCargo(signer),
      },
    });

    return this.prisma.workshopMaintenanceTask.update({
      where: { id },
      data: {
        status: WorkshopMaintenanceTaskStatus.ESPERANDO_FIRMA_CONTROL_FLOTA,
      },
      include: {
        vehicle: true,
        createdBy: true,
        assignedTo: true,
        signatures: {
          include: {
            signedBy: true,
          },
        },
      },
    });
  }

  async signAsControlFlota(id: string, dto: any, user: any) {
    const signer = await this.getSignerUser(user);

    if (signer.role !== Role.CONTROL_FLOTA && signer.role !== Role.SUPERADMIN) {
      throw new ForbiddenException("Sin permisos");
    }

    const task = await this.prisma.workshopMaintenanceTask.findUnique({
      where: { id },
    });

    if (!task) {
      throw new NotFoundException("Tarea no encontrada");
    }

    await this.prisma.workshopMaintenanceSignature.create({
      data: {
        taskId: id,
        role: WorkshopMaintenanceSignatureRole.CONTROL_FLOTA,
        signedById: signer.id,
        firmaDataUrl: dto.firmaDataUrl,
        nombreFirmante: this.userFullName(signer),
        rutFirmante: signer.rut || null,
        cargoFirmante: this.getSignerCargo(signer),
      },
    });

    return this.prisma.workshopMaintenanceTask.update({
      where: { id },
      data: {
        status: WorkshopMaintenanceTaskStatus.ESPERANDO_FIRMA_ADMINISTRADORA,
      },
      include: {
        vehicle: true,
        createdBy: true,
        assignedTo: true,
        signatures: {
          include: {
            signedBy: true,
          },
        },
      },
    });
  }

  async signAsAdministradora(id: string, dto: any, user: any) {
    const signer = await this.getSignerUser(user);

    if (signer.role !== Role.ADMINISTRADORA && signer.role !== Role.SUPERADMIN) {
      throw new ForbiddenException("Sin permisos");
    }

    const task = await this.prisma.workshopMaintenanceTask.findUnique({
      where: { id },
    });

    if (!task) {
      throw new NotFoundException("Tarea no encontrada");
    }

    await this.prisma.workshopMaintenanceSignature.create({
      data: {
        taskId: id,
        role: WorkshopMaintenanceSignatureRole.ADMINISTRADORA,
        signedById: signer.id,
        firmaDataUrl: dto.firmaDataUrl,
        nombreFirmante: this.userFullName(signer),
        rutFirmante: signer.rut || null,
        cargoFirmante: this.getSignerCargo(signer),
      },
    });

    return this.prisma.workshopMaintenanceTask.update({
      where: { id },
      data: {
        status: WorkshopMaintenanceTaskStatus.FINALIZADA,
      },
      include: {
        vehicle: true,
        createdBy: true,
        assignedTo: true,
        signatures: {
          include: {
            signedBy: true,
          },
        },
      },
    });
  }

  async generatePdf(id: string, res: Response) {
    const task = await this.prisma.workshopMaintenanceTask.findUnique({
      where: { id },
      include: {
        vehicle: true,
        createdBy: true,
        assignedTo: true,
        signatures: {
          include: {
            signedBy: true,
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException("Mantención no encontrada");
    }

    const tallerSignature = task.signatures.find(
      (s) => s.role === WorkshopMaintenanceSignatureRole.TALLER
    );

    const controlFlotaSignature = task.signatures.find(
      (s) => s.role === WorkshopMaintenanceSignatureRole.CONTROL_FLOTA
    );

    const adminSignature = task.signatures.find(
      (s) => s.role === WorkshopMaintenanceSignatureRole.ADMINISTRADORA
    );

    const doc = new PDFDocument({
      size: "A4",
      margin: 35,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="OT-TALLER-${task.codigo || id}.pdf"`
    );

    doc.pipe(res);

    const pageWidth = 595.28;
    const left = 35;
    const right = pageWidth - 35;
    const contentWidth = right - left;

    const drawBox = (x: number, y: number, w: number, h: number) => {
      doc.rect(x, y, w, h).stroke();
    };

    const logoPaths = [
      path.join(process.cwd(), "uploads", "branding", "logo-thomas.png"),
      path.join(
        process.cwd(),
        "src",
        "..",
        "uploads",
        "branding",
        "logo-thomas.png"
      ),
      path.join(__dirname, "..", "..", "uploads", "branding", "logo-thomas.png"),
      path.join(
        __dirname,
        "..",
        "..",
        "..",
        "uploads",
        "branding",
        "logo-thomas.png"
      ),
    ];

    const logoPath = logoPaths.find((p) => fs.existsSync(p));

    drawBox(left, 35, contentWidth, 70);
    doc.moveTo(left + 145, 35).lineTo(left + 145, 105).stroke();

    if (logoPath) {
      doc.image(logoPath, left + 40, 40, {
        width: 63,
      });
    } else {
      doc.fontSize(18).font("Helvetica-Bold").text("THOMAS", left + 30, 58);
    }

    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .text("ORDEN DE TRABAJO TALLER", left + 155, 58, {
        width: contentWidth - 165,
        align: "center",
      });

    const infoY = 125;
    const infoH = 88;

    drawBox(left, infoY, contentWidth, infoH);

    doc.moveTo(left + 130, infoY).lineTo(left + 130, infoY + infoH).stroke();
    doc.moveTo(left + 365, infoY).lineTo(left + 365, infoY + infoH).stroke();

    for (let i = 1; i <= 3; i++) {
      const y = infoY + 22 * i;
      doc.moveTo(left, y).lineTo(left + 365, y).stroke();
    }

    const patente = task.patenteSnapshot || task.vehicle?.patente || "—";

    doc.fontSize(10).font("Helvetica-Bold");
    doc.text("PATENTE", left + 12, infoY + 7);
    doc.text("KILOMETRAJE", left + 12, infoY + 29);
    doc.text("HORAS", left + 12, infoY + 51);
    doc.text("FECHA", left + 12, infoY + 73);

    doc.fontSize(13).font("Helvetica-Bold");
    doc.text(String(patente).toUpperCase(), left + 145, infoY + 5);
    doc.text(String(task.kilometraje || "—"), left + 145, infoY + 27);
    doc.text(String(task.horas || "—"), left + 145, infoY + 49);
    doc.text(this.fmtDate(task.fecha), left + 145, infoY + 71);

    doc.fontSize(10).font("Helvetica-Bold");
    doc.text("ORDEN DE TRABAJO N°", left + 380, infoY + 7, {
      width: 130,
      align: "center",
    });

    doc.font("Helvetica-Bold").fontSize(18).text(task.codigo || "—", left + 380, infoY + 35, {
      width: 130,
      align: "center",
    });

    const workY = 235;
    const workH = 185;

    drawBox(left, workY, contentWidth, workH);
    doc.moveTo(left, workY + 28).lineTo(right, workY + 28).stroke();
    doc.moveTo(left + 35, workY).lineTo(left + 35, workY + 28).stroke();

    doc.font("Helvetica-Bold").fontSize(13).text("I", left + 15, workY + 8);

    doc.font("Helvetica-Bold").fontSize(13).text(
      "DESCRIPCIÓN DEL TRABAJO REALIZADO",
      left + 45,
      workY + 8,
      {
        width: contentWidth - 55,
        align: "center",
      }
    );

    const trabajos = Array.isArray(task.trabajosRealizados)
      ? task.trabajosRealizados
      : [];

    doc.font("Helvetica").fontSize(10.5).text(trabajos.join("\n").toUpperCase(), left + 16, workY + 42, {
      width: contentWidth - 32,
      align: "left",
    });

    const partsY = 420;
    const partsH = 185;

    drawBox(left, partsY, contentWidth, partsH);
    doc.moveTo(left, partsY + 28).lineTo(right, partsY + 28).stroke();
    doc.moveTo(left + 35, partsY).lineTo(left + 35, partsY + 28).stroke();

    doc.font("Helvetica-Bold").fontSize(13).text("II", left + 13, partsY + 8);

    doc.font("Helvetica-Bold").fontSize(13).text(
      "DESCRIPCIÓN DE REPUESTOS Y LUBRICANTES UTILIZADOS",
      left + 45,
      partsY + 8,
      {
        width: contentWidth - 55,
        align: "center",
      }
    );

    const repuestos = Array.isArray(task.repuestosLubricantes)
      ? task.repuestosLubricantes
      : [];

    const filtros = Array.isArray(task.codigosFiltros)
      ? task.codigosFiltros
      : [];

    doc.font("Helvetica").fontSize(10.5).text([...repuestos, ...filtros].join("\n").toUpperCase(), left + 16, partsY + 42, {
      width: contentWidth - 32,
      align: "left",
    });

    const hasObservaciones = !!String(task.observaciones || "").trim();

    if (hasObservaciones) {
      const obsY = 632;

      drawBox(left, obsY, contentWidth, 35);

      doc.font("Helvetica-Bold").fontSize(9).text("OBSERVACIONES", left + 8, obsY + 5);

      doc.font("Helvetica").fontSize(9).text(String(task.observaciones), left + 8, obsY + 17, {
        width: contentWidth - 16,
        height: 15,
        ellipsis: true,
      });
    }

    const signY = hasObservaciones ? 680 : 650;
    const signH = 105;
    const signW = contentWidth / 3;

    drawBox(left, signY, contentWidth, signH);

    doc.moveTo(left + signW, signY).lineTo(left + signW, signY + signH).stroke();
    doc.moveTo(left + signW * 2, signY).lineTo(left + signW * 2, signY + signH).stroke();

    const drawSignature = (
      sig: any,
      x: number,
      fallbackCargo: string
    ) => {
      const centerX = x + signW / 2;

      try {
        if (sig?.firmaDataUrl) {
          const clean = this.cleanFirmaDataUrl(sig.firmaDataUrl);

          if (clean) {
            const imgWidth = 110;
            const imgHeight = 45;

            doc.image(Buffer.from(clean, "base64"), centerX - imgWidth / 2, signY + 8, {
              fit: [imgWidth, imgHeight],
              align: "center",
              valign: "center",
            });
          }
        }
      } catch {}

      doc.moveTo(x + 18, signY + 62).lineTo(x + signW - 18, signY + 62).stroke();

      const signerName = this.safeText(
        sig?.nombreFirmante || this.userFullName(sig?.signedBy),
        "PENDIENTE DE FIRMA"
      );

      doc.font("Helvetica-Bold").fontSize(8.8).text(String(signerName).toUpperCase(), x + 8, signY + 68, {
        width: signW - 16,
        align: "center",
        height: 12,
        ellipsis: true,
      });

      if (sig?.rutFirmante) {
        doc.font("Helvetica").fontSize(8).text(`RUT: ${sig.rutFirmante}`, x + 8, signY + 82, {
          width: signW - 16,
          align: "center",
        });
      }

      const cargo = this.safeText(sig?.cargoFirmante, fallbackCargo);

      doc.font("Helvetica-Bold").fontSize(8.8).text(String(cargo).toUpperCase(), x + 8, signY + 96, {
        width: signW - 16,
        align: "center",
      });
    };

    drawSignature(tallerSignature, left, "TALLER");
    drawSignature(controlFlotaSignature, left + signW, "CONTROL DE FLOTA");
    drawSignature(adminSignature, left + signW * 2, "ADMINISTRADORA");

    doc.end();
  }
}