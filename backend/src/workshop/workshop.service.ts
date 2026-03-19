// ✅ Archivo: src/workshop/workshop.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  Prisma,
  VehicleIncidentStatus,
  WorkshopTaskStatus,
  WorkshopTaskAssignmentRole,
} from '@prisma/client';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { CreateWorkshopTaskDto } from './dto/create-workshop-task.dto';
import { UpdateWorkshopTaskDto } from './dto/update-workshop-task.dto';
import { CreateWorkshopTaskPartDto } from './dto/create-workshop-task-part.dto';

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
  constructor(private prisma: PrismaService) {}

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

    return this.prisma.vehicleIncident.create({
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

    return this.prisma.vehicleIncident.findUnique({
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
        status: WorkshopTaskStatus.ESPERANDO_REPUESTO,
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
    dto: CreateWorkshopTaskPartDto,
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
          observaciones: true,
          startedAt: true,
          incidentId: true,
        },
      });

      const extraObservation = dto.observacion?.trim()
        ? `REQUIERE REPUESTO: ${dto.observacion.trim()}`
        : `REQUIERE REPUESTO: ${dto.nombre}`;

      const mergedObservaciones = previousTask?.observaciones?.trim()
        ? `${previousTask.observaciones}\n${extraObservation}`
        : extraObservation;

      await tx.workshopTask.update({
        where: { id: dto.workshopTaskId },
        data: {
          status: WorkshopTaskStatus.ESPERANDO_REPUESTO,
          startedAt: previousTask?.startedAt ?? new Date(),
          closedAt: null,
          observaciones: mergedObservaciones,
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

      return part;
    });

    return result;
  }

  async finishWorkshopTaskByWorker(taskId: string, userId: string) {
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

    const updatedTask = await this.prisma.workshopTask.update({
      where: { id: taskId },
      data: {
        status: WorkshopTaskStatus.TERMINADA,
        startedAt: task.startedAt ?? new Date(),
        closedAt: new Date(),
        closedBy: {
          connect: { id: userId },
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
}