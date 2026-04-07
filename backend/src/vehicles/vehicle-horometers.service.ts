import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { HorometerAlertsService } from "../alerts/horometer-alerts.service";

type CreateHorometerInput = {
  horas: number;
  comentario?: string;
};

@Injectable()
export class VehicleHorometersService {
  constructor(
    private prisma: PrismaService,
    private horometerAlerts: HorometerAlertsService
  ) {}

  // =========================
  // LIST
  // =========================
  async listByVehicle(vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true, patente: true, empresa: true },
    });

    if (!vehicle) throw new NotFoundException("Vehículo no encontrado");

    const plan = await this.prisma.horometerMaintenancePlan.findUnique({
      where: { vehicleId },
      select: { intervalHours: true, nextDueHours: true },
    });

    const rows = await this.prisma.horometerRecord.findMany({
      where: { vehicleId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        horas: true,
        comentario: true,
        createdAt: true,
        trabajadorNombre: true,
        trabajadorApellido: true,
        trabajadorRut: true,
      },
    });

    const nextDue = plan?.nextDueHours ?? null;
    const intervalHours = plan?.intervalHours ?? 500;

    const records = rows.map((r) => {
      const faltanHoras = nextDue == null ? null : nextDue - r.horas;

      const faltanLabel =
        faltanHoras == null
          ? "—"
          : faltanHoras > 0
          ? `Faltan ${faltanHoras}h`
          : `Vencido ${Math.abs(faltanHoras)}h`;

      return {
        ...r,
        faltanHoras,
        faltanLabel,
        nextDueHours: nextDue,
        intervalHours,
      };
    });

    return {
      vehicle,
      plan: nextDue == null ? null : { nextDueHours: nextDue, intervalHours },
      total: records.length,
      records,
    };
  }

  // =========================
  // CREATE
  // =========================
  async create(vehicleId: string, actorId: string, input: CreateHorometerInput) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true, empresa: true },
    });
    if (!vehicle) throw new NotFoundException("Vehículo no encontrado");

    const actor = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: { id: true, nombre: true, apellido: true, rut: true, email: true },
    });
    if (!actor) throw new NotFoundException("Usuario actor no encontrado");

    const horas = Number(input?.horas);
    if (!Number.isFinite(horas) || horas < 0) {
      throw new BadRequestException("Campo 'horas' inválido.");
    }

    // =========================
    // CREAR REGISTRO
    // =========================
    const created = await this.prisma.horometerRecord.create({
      data: {
        vehicleId,
        trabajadorId: actor.id,
        trabajadorNombre: actor.nombre,
        trabajadorApellido: actor.apellido,
        trabajadorRut: actor.rut,
        trabajadorEmail: actor.email,
        empresa: vehicle.empresa,
        horas,
        comentario: String(input?.comentario ?? "").trim() || null,
      },
    });

    // =========================
    // PLAN 500H DESDE BASE REAL
    // =========================
    const interval = 500;

    const existingPlan = await this.prisma.horometerMaintenancePlan.findUnique({
      where: { vehicleId },
    });

    if (!existingPlan) {
      // 🔥 primer registro = base de mantención
      await this.prisma.horometerMaintenancePlan.create({
        data: {
          vehicleId,
          intervalHours: interval,
          nextDueHours: horas + interval,
          lastNotifiedDueHours: null,
        },
      });
    } else {
      let nextDue = existingPlan.nextDueHours;

      // 🔥 avanzar ciclos correctamente
      while (horas >= nextDue) {
        nextDue += interval;
      }

      if (nextDue !== existingPlan.nextDueHours) {
        await this.prisma.horometerMaintenancePlan.update({
          where: { vehicleId },
          data: {
            nextDueHours: nextDue,
          },
        });
      }
    }

    // =========================
    // ALERTAS
    // =========================
    await this.horometerAlerts.onHorometerCreated({
      vehicleId,
      horas,
    });

    return created;
  }

  // =========================
  // 🔥 REINICIAR CICLO (MANTENCIÓN REAL)
  // =========================
  async resetMaintenanceCycle(vehicleId: string, horas: number) {
    if (!Number.isFinite(horas) || horas < 0) {
      throw new BadRequestException("Horas inválidas");
    }

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true },
    });

    if (!vehicle) throw new NotFoundException("Vehículo no encontrado");

    const interval = 500;

    const existingPlan = await this.prisma.horometerMaintenancePlan.findUnique({
      where: { vehicleId },
    });

    if (!existingPlan) {
      await this.prisma.horometerMaintenancePlan.create({
        data: {
          vehicleId,
          intervalHours: interval,
          nextDueHours: horas + interval,
          lastNotifiedDueHours: null,
        },
      });
    } else {
      await this.prisma.horometerMaintenancePlan.update({
        where: { vehicleId },
        data: {
          intervalHours: interval,
          nextDueHours: horas + interval,
          lastNotifiedDueHours: null,
        },
      });
    }

    return {
      ok: true,
      nextDueHours: horas + interval,
      intervalHours: interval,
    };
  }

  // =========================
  // UPDATE
  // =========================
  async update(vehicleId: string, recordId: string, patch: any) {
    return this.prisma.horometerRecord.update({
      where: { id: recordId },
      data: patch,
    });
  }

  // =========================
  // DELETE
  // =========================
  async remove(vehicleId: string, recordId: string) {
    await this.prisma.horometerRecord.delete({
      where: { id: recordId },
    });

    return { ok: true };
  }
}