import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { FirebaseService } from "../firebase/firebase.service";
import {
  Empresa,
  Role,
  VehicleFailureReportStatus,
  WorkerType,
  WorkshopTaskPriority,
  WorkshopTaskStatus,
} from "@prisma/client";

type AuthUserLike = {
  id: string;
  role?: Role | string | null;
  workerType?: WorkerType | string | null;
  empresa?: Empresa | string | null;
  nombre?: string | null;
  apellido?: string | null;
  email?: string | null;
};

type CreateVehicleFailureReportInput = {
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
};

type ListVehicleFailureReportsQuery = {
  status?: VehicleFailureReportStatus;
  vehicleId?: string;
  patente?: string;
  assignedToId?: string;
  createdById?: string;
  from?: string;
  to?: string;
};

type AssignVehicleFailureReportInput = {
  assignedToId: string;
  status?: VehicleFailureReportStatus;
};

type EvidenceInput = {
  fileUrl: string;
  filePath: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
};

@Injectable()
export class VehicleFailureReportsService {
  private readonly logger = new Logger(VehicleFailureReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebaseService: FirebaseService,
  ) {}

  private norm(value: unknown): string {
    return String(value || "").trim().toUpperCase();
  }

  private getEmpresaFromUser(user: AuthUserLike): Empresa {
    const empresa = this.norm(user?.empresa);
    if (empresa === Empresa.INSPROTEL) return Empresa.INSPROTEL;
    return Empresa.GRUAS_THOMAS;
  }

  private canCreate(user: AuthUserLike): boolean {
    const role = this.norm(user?.role);
    return role === Role.SUPERADMIN || role === Role.CONTROL_FLOTA;
  }

  private canViewAll(user: AuthUserLike): boolean {
    const role = this.norm(user?.role);
    const workerType = this.norm(user?.workerType);

    if (role === Role.SUPERADMIN || role === Role.CONTROL_FLOTA) {
      return true;
    }

    if (
      workerType === WorkerType.JEFE_TALLER ||
      workerType === WorkerType.SUPERVISOR ||
      workerType === "SUPERVISOR_TALLER_MECANICO" ||
      workerType === "SUPERVISOR_TALLER"
    ) {
      return true;
    }

    return false;
  }

  private canAssign(user: AuthUserLike): boolean {
    const role = this.norm(user?.role);
    const workerType = this.norm(user?.workerType);

    if (role === Role.SUPERADMIN) {
      return true;
    }

    if (
      workerType === WorkerType.JEFE_TALLER ||
      workerType === WorkerType.SUPERVISOR ||
      workerType === "SUPERVISOR_TALLER_MECANICO" ||
      workerType === "SUPERVISOR_TALLER"
    ) {
      return true;
    }

    return false;
  }

  private async validateAssignee(assignedToId: string, empresa: Empresa) {
    const assignee = await this.prisma.user.findFirst({
      where: {
        id: assignedToId,
        activo: true,
        empresa,
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

    if (!assignee) {
      throw new NotFoundException("El usuario a asignar no existe.");
    }

    const role = this.norm(assignee.role);
    const workerType = this.norm(assignee.workerType);

    const allowed =
      role === Role.SUPERADMIN ||
      workerType === WorkerType.JEFE_TALLER ||
      workerType === WorkerType.SUPERVISOR ||
      workerType === WorkerType.MECANICO ||
      workerType === WorkerType.AYUDANTE_DE_MECANICO ||
      workerType === "SUPERVISOR_TALLER_MECANICO" ||
      workerType === "SUPERVISOR_TALLER";

    if (!allowed) {
      throw new BadRequestException(
        "Solo se puede asignar a jefe de taller, supervisor de taller, mecánico o ayudante de mecánico.",
      );
    }

    return assignee;
  }

  private async generateWorkshopCode(tx?: any) {
    const db = tx || this.prisma;

    const tasks = await db.workshopTask.findMany({
      where: {
        codigo: {
          startsWith: "TALLER-",
        },
      },
      select: {
        codigo: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    let maxNumber = 0;

    for (const task of tasks) {
      const code = String(task.codigo || "");
      const match = code.match(/^TALLER-(\d+)$/i);
      if (!match) continue;

      const num = Number(match[1]);
      if (Number.isFinite(num) && num > maxNumber) {
        maxNumber = num;
      }
    }

    const nextNumber = maxNumber + 1;
    return `TALLER-${String(nextNumber).padStart(4, "0")}`;
  }

  private buildWorkshopTitle(empresa: Empresa) {
    return empresa === Empresa.INSPROTEL
      ? "Ingreso vehículo INSPROTEL"
      : "Ingreso vehículo GRUAS THOMAS";
  }

  private normalizeEvidences(evidences?: EvidenceInput[]): EvidenceInput[] {
    if (!Array.isArray(evidences)) return [];

    return evidences
      .map((file) => ({
        fileUrl: String(file?.fileUrl || "").trim(),
        filePath: String(file?.filePath || "").trim(),
        originalName: String(file?.originalName || "").trim(),
        mimeType: String(file?.mimeType || "").trim(),
        sizeBytes: Number(file?.sizeBytes || 0),
      }))
      .filter((file) => file.fileUrl);
  }

  private buildWorkshopObservaciones(
    traidoPorNombre: string,
    evidences: EvidenceInput[],
  ) {
    const lines: string[] = [];

    const traido = String(traidoPorNombre || "").trim();
    if (traido) {
      lines.push(`Vehículo ingresado por: ${traido}`);
    }

    const validEvidences = this.normalizeEvidences(evidences);

    for (const file of validEvidences) {
      lines.push(`📸 Foto vehículo: ${file.fileUrl}`);
    }

    const finalText = lines.join("\n").trim();
    return finalText || null;
  }

  private async createWorkshopTaskFromReport(
    tx: any,
    params: {
      empresa: Empresa;
      vehicleId: string;
      createdById: string;
      descripcion: string;
      traidoPorNombre: string;
      evidences: EvidenceInput[];
    },
  ) {
    const codigo = await this.generateWorkshopCode(tx);
    const titulo = this.buildWorkshopTitle(params.empresa);
    const observaciones = this.buildWorkshopObservaciones(
      params.traidoPorNombre,
      params.evidences,
    );

    return tx.workshopTask.create({
      data: {
        vehicle: {
          connect: { id: params.vehicleId },
        },
        empresa: params.empresa,
        createdBy: {
          connect: { id: params.createdById },
        },
        codigo,
        titulo,
        descripcion: params.descripcion,
        priority: WorkshopTaskPriority.MEDIA,
        status: WorkshopTaskStatus.PENDIENTE,
        observaciones,
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
  }

  private async notifyWorkshopLeadsOnCreate(reportId: string) {
    try {
      const report = await this.prisma.vehicleFailureReport.findUnique({
        where: { id: reportId },
        include: {
          createdBy: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              email: true,
            },
          },
        },
      });

      if (!report) return;

      const recipients = await this.prisma.user.findMany({
        where: {
          activo: true,
          empresa: report.empresa,
          OR: [
            { role: Role.SUPERADMIN },
            { workerType: WorkerType.JEFE_TALLER },
            { workerType: WorkerType.SUPERVISOR },
            { workerType: "SUPERVISOR_TALLER_MECANICO" as WorkerType },
            { workerType: "SUPERVISOR_TALLER" as WorkerType },
          ],
        },
        select: {
          id: true,
        },
      });

      if (!recipients.length) return;

      const fullName =
        `${report.createdBy?.nombre || ""} ${report.createdBy?.apellido || ""}`.trim() ||
        "usuario";

      const title = "Vehículo ingresado con fallas";
      const body = `Patente ${report.patente} reportada por ${fullName}.`;

      for (const recipient of recipients) {
        try {
          await this.firebaseService.sendNotificationToUser(
            recipient.id,
            title,
            body,
            "/admin/reportes-fallas-vehiculos",
          );
        } catch (error) {
          this.logger.warn(
            `No se pudo notificar al usuario ${recipient.id}: ${String(
              (error as Error)?.message || error,
            )}`,
          );
        }
      }
    } catch (error) {
      this.logger.warn(
        `No se pudo enviar notificación de creación de reporte: ${String(
          (error as Error)?.message || error,
        )}`,
      );
    }
  }

  private async notifyAssignee(reportId: string) {
    try {
      const report = await this.prisma.vehicleFailureReport.findUnique({
        where: { id: reportId },
        include: {
          assignedTo: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
            },
          },
        },
      });

      if (!report?.assignedToId) return;

      const title = "Nuevo reporte asignado";
      const body = `Se te asignó el reporte de fallas del vehículo ${report.patente}.`;

      await this.firebaseService.sendNotificationToUser(
        report.assignedToId,
        title,
        body,
        "/admin/reportes-fallas-vehiculos",
      );
    } catch (error) {
      this.logger.warn(
        `No se pudo enviar notificación de asignación: ${String(
          (error as Error)?.message || error,
        )}`,
      );
    }
  }

  async create(
    authUser: AuthUserLike,
    input: CreateVehicleFailureReportInput,
  ) {
    if (!authUser?.id) {
      throw new ForbiddenException("Usuario no autenticado.");
    }

    if (!this.canCreate(authUser)) {
      throw new ForbiddenException(
        "No tienes permisos para crear reportes de ingreso con fallas.",
      );
    }

    const vehicleId = String(input?.vehicleId || "").trim();
    const traidoPorNombre = String(input?.traidoPorNombre || "").trim();
    const descripcion = String(input?.descripcion || "").trim();

    if (!vehicleId) {
      throw new BadRequestException("vehicleId es obligatorio.");
    }

    if (!traidoPorNombre) {
      throw new BadRequestException("El nombre de quien lo trajo es obligatorio.");
    }

    if (!descripcion) {
      throw new BadRequestException("La descripción es obligatoria.");
    }

    const vehicle = await this.prisma.vehicle.findUnique({
      where: {
        id: vehicleId,
      },
      select: {
        id: true,
        patente: true,
        empresa: true,
        activo: true,
      },
    });

    if (!vehicle) {
      throw new NotFoundException("Vehículo no encontrado.");
    }

    if (!vehicle.activo) {
      throw new BadRequestException("El vehículo seleccionado está inactivo.");
    }

    const empresa = vehicle.empresa;
    const patente = String(input?.patente || vehicle.patente || "").trim();

    if (!patente) {
      throw new BadRequestException("No se pudo determinar la patente del vehículo.");
    }

    const evidences = this.normalizeEvidences(input?.evidences);

    const created = await this.prisma.$transaction(async (tx) => {
      const report = await tx.vehicleFailureReport.create({
        data: {
          empresa,
          vehicleId: vehicle.id,
          patente,
          traidoPorNombre,
          descripcion,
          status: VehicleFailureReportStatus.PENDIENTE,
          createdById: authUser.id,
          evidences: evidences.length
            ? {
                create: evidences.map((file) => ({
                  uploadedById: authUser.id,
                  fileUrl: file.fileUrl,
                  filePath: file.filePath,
                  originalName: file.originalName,
                  mimeType: file.mimeType,
                  sizeBytes: file.sizeBytes,
                })),
              }
            : undefined,
        },
        include: {
          vehicle: true,
          createdBy: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              email: true,
              role: true,
              workerType: true,
            },
          },
          assignedTo: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              email: true,
              role: true,
              workerType: true,
            },
          },
          evidences: {
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      });

      await this.createWorkshopTaskFromReport(tx, {
        empresa,
        vehicleId: vehicle.id,
        createdById: authUser.id,
        descripcion,
        traidoPorNombre,
        evidences,
      });

      return report;
    });

    await this.notifyWorkshopLeadsOnCreate(created.id);

    return created;
  }

  async findAll(authUser: AuthUserLike, query: ListVehicleFailureReportsQuery = {}) {
    if (!authUser?.id) {
      throw new ForbiddenException("Usuario no autenticado.");
    }

    const empresa = this.getEmpresaFromUser(authUser);
    const canViewAll = this.canViewAll(authUser);

    const where: any = {
      empresa,
    };

    if (query.status) {
        where.status = query.status;
    }

    if (query.vehicleId) {
      where.vehicleId = String(query.vehicleId).trim();
    }

    if (query.assignedToId) {
      where.assignedToId = String(query.assignedToId).trim();
    }

    if (query.createdById) {
      where.createdById = String(query.createdById).trim();
    }

    if (query.patente) {
      where.patente = {
        contains: String(query.patente).trim(),
        mode: "insensitive",
      };
    }

    if (query.from || query.to) {
      where.createdAt = {};

      if (query.from) {
        const fromDate = new Date(query.from);
        if (!Number.isNaN(fromDate.getTime())) {
          where.createdAt.gte = fromDate;
        }
      }

      if (query.to) {
        const toDate = new Date(query.to);
        if (!Number.isNaN(toDate.getTime())) {
          where.createdAt.lte = toDate;
        }
      }
    }

    if (!canViewAll) {
      where.OR = [{ createdById: authUser.id }, { assignedToId: authUser.id }];
    }

    return this.prisma.vehicleFailureReport.findMany({
      where,
      include: {
        vehicle: {
          select: {
            id: true,
            patente: true,
            marcaModelo: true,
            type: true,
            tipoVehiculo: true,
            empresa: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
            role: true,
            workerType: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
            role: true,
            workerType: true,
          },
        },
        evidences: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async findOne(authUser: AuthUserLike, id: string) {
    if (!authUser?.id) {
      throw new ForbiddenException("Usuario no autenticado.");
    }

    const report = await this.prisma.vehicleFailureReport.findUnique({
      where: { id },
      include: {
        vehicle: {
          select: {
            id: true,
            patente: true,
            marcaModelo: true,
            type: true,
            tipoVehiculo: true,
            empresa: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
            role: true,
            workerType: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
            role: true,
            workerType: true,
          },
        },
        evidences: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!report) {
      throw new NotFoundException("Reporte no encontrado.");
    }

    const sameEmpresa = this.getEmpresaFromUser(authUser) === report.empresa;
    if (!sameEmpresa) {
      throw new ForbiddenException("No puedes acceder a este reporte.");
    }

    const canViewAll = this.canViewAll(authUser);
    const canViewThis =
      canViewAll ||
      report.createdById === authUser.id ||
      report.assignedToId === authUser.id;

    if (!canViewThis) {
      throw new ForbiddenException("No tienes permisos para ver este reporte.");
    }

    return report;
  }

  async assign(
    authUser: AuthUserLike,
    id: string,
    input: AssignVehicleFailureReportInput,
  ) {
    if (!authUser?.id) {
      throw new ForbiddenException("Usuario no autenticado.");
    }

    if (!this.canAssign(authUser)) {
      throw new ForbiddenException(
        "No tienes permisos para asignar este reporte.",
      );
    }

    const report = await this.prisma.vehicleFailureReport.findUnique({
      where: { id },
      select: {
        id: true,
        empresa: true,
        status: true,
        assignedToId: true,
      },
    });

    if (!report) {
      throw new NotFoundException("Reporte no encontrado.");
    }

    const sameEmpresa = this.getEmpresaFromUser(authUser) === report.empresa;
    if (!sameEmpresa) {
      throw new ForbiddenException("No puedes asignar un reporte de otra empresa.");
    }

    const assignedToId = String(input?.assignedToId || "").trim();
    if (!assignedToId) {
      throw new BadRequestException("assignedToId es obligatorio.");
    }

    await this.validateAssignee(assignedToId, report.empresa);

    const nextStatus =
      input?.status && Object.values(VehicleFailureReportStatus).includes(input.status)
        ? input.status
        : VehicleFailureReportStatus.ASIGNADO;

    const updated = await this.prisma.vehicleFailureReport.update({
      where: { id },
      data: {
        assignedToId,
        assignedAt: new Date(),
        status: nextStatus,
      },
      include: {
        vehicle: {
          select: {
            id: true,
            patente: true,
            marcaModelo: true,
            type: true,
            tipoVehiculo: true,
            empresa: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
            role: true,
            workerType: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
            role: true,
            workerType: true,
          },
        },
        evidences: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    await this.notifyAssignee(updated.id);

    return updated;
  }

  async updateStatus(
    authUser: AuthUserLike,
    id: string,
    status: VehicleFailureReportStatus,
  ) {
    if (!authUser?.id) {
      throw new ForbiddenException("Usuario no autenticado.");
    }

    const report = await this.prisma.vehicleFailureReport.findUnique({
      where: { id },
      select: {
        id: true,
        empresa: true,
        createdById: true,
        assignedToId: true,
        status: true,
      },
    });

    if (!report) {
      throw new NotFoundException("Reporte no encontrado.");
    }

    const sameEmpresa = this.getEmpresaFromUser(authUser) === report.empresa;
    if (!sameEmpresa) {
      throw new ForbiddenException("No puedes modificar este reporte.");
    }

    const canTouch =
      this.canAssign(authUser) ||
      report.createdById === authUser.id ||
      report.assignedToId === authUser.id;

    if (!canTouch) {
      throw new ForbiddenException("No tienes permisos para actualizar este reporte.");
    }

    const data: any = { status };

    if (status === VehicleFailureReportStatus.RESUELTO) {
      data.resolvedAt = new Date();
    }

    const updated = await this.prisma.vehicleFailureReport.update({
      where: { id },
      data,
      include: {
        vehicle: {
          select: {
            id: true,
            patente: true,
            marcaModelo: true,
            type: true,
            tipoVehiculo: true,
            empresa: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
            role: true,
            workerType: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
            role: true,
            workerType: true,
          },
        },
        evidences: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    return updated;
  }

  async remove(authUser: AuthUserLike, id: string) {
    if (!authUser?.id) {
      throw new ForbiddenException("Usuario no autenticado.");
    }

    const role = this.norm(authUser?.role);
    if (role !== Role.SUPERADMIN) {
      throw new ForbiddenException("Solo el superadmin puede eliminar reportes.");
    }

    const report = await this.prisma.vehicleFailureReport.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!report) {
      throw new NotFoundException("Reporte no encontrado.");
    }

    await this.prisma.vehicleFailureReport.delete({
      where: { id },
    });

    return {
      ok: true,
      message: "Reporte eliminado correctamente.",
    };
  }
}