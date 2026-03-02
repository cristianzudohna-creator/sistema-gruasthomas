import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

type CreateHorometerInput = {
  horas: number;
  comentario?: string;

  fotoUrl: string;
  filePath: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
};

@Injectable()
export class VehicleHorometersService {
  constructor(private prisma: PrismaService) {}

  // ✅ LIST (sin email)
  async listByVehicle(vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true, patente: true, empresa: true },
    });

    if (!vehicle) throw new NotFoundException("Vehículo no encontrado");

    const rows = await this.prisma.horometerRecord.findMany({
      where: { vehicleId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        horas: true,
        comentario: true,
        createdAt: true,

        // ✅ SIN email
        trabajadorNombre: true,
        trabajadorApellido: true,
        trabajadorRut: true,

        // ✅ evidencia
        fotoUrl: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
      },
    });

    return {
      vehicle: {
        id: vehicle.id,
        patente: vehicle.patente,
        empresa: vehicle.empresa,
      },
      total: rows.length,
      records: rows,
    };
  }

  // ✅ CREATE (actorId = SUPERADMIN / CONTROL_FLOTA)
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
    if (!Number.isFinite(horas) || horas < 0) throw new BadRequestException("Campo 'horas' inválido.");

    const created = await this.prisma.horometerRecord.create({
      data: {
        vehicleId,
        trabajadorId: actor.id,

        trabajadorNombre: actor.nombre,
        trabajadorApellido: actor.apellido,
        trabajadorRut: actor.rut,
        trabajadorEmail: actor.email, // se guarda en DB, pero NO se expone en list

        empresa: vehicle.empresa,

        horas,
        comentario: String(input?.comentario ?? "").trim() || null,

        fotoUrl: input.fotoUrl ?? "",
        filePath: input.filePath ?? "",
        originalName: input.originalName ?? "",
        mimeType: input.mimeType ?? "",
        sizeBytes: Number(input.sizeBytes ?? 0),
      },
      select: {
        id: true,
        horas: true,
        comentario: true,
        createdAt: true,
        trabajadorNombre: true,
        trabajadorApellido: true,
        trabajadorRut: true,
        fotoUrl: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
      },
    });

    return created;
  }

  // ✅ UPDATE
  async update(vehicleId: string, recordId: string, patch: Partial<CreateHorometerInput> & { comentario?: string }) {
    const existing = await this.prisma.horometerRecord.findFirst({
      where: { id: recordId, vehicleId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException("Registro de horómetro no encontrado");

    const data: any = {};

    if (patch?.horas !== undefined) {
      const horas = Number(patch.horas);
      if (!Number.isFinite(horas) || horas < 0) throw new BadRequestException("Campo 'horas' inválido.");
      data.horas = horas;
    }

    if (patch?.comentario !== undefined) {
      const c = String(patch.comentario ?? "").trim();
      data.comentario = c ? c : null;
    }

    if (patch?.fotoUrl !== undefined) data.fotoUrl = patch.fotoUrl || "";
    if (patch?.filePath !== undefined) data.filePath = patch.filePath || "";
    if (patch?.originalName !== undefined) data.originalName = patch.originalName || "";
    if (patch?.mimeType !== undefined) data.mimeType = patch.mimeType || "";
    if (patch?.sizeBytes !== undefined) data.sizeBytes = Number(patch.sizeBytes || 0);

    return this.prisma.horometerRecord.update({
      where: { id: recordId },
      data,
      select: {
        id: true,
        horas: true,
        comentario: true,
        createdAt: true,
        trabajadorNombre: true,
        trabajadorApellido: true,
        trabajadorRut: true,
        fotoUrl: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
      },
    });
  }

  // ✅ DELETE
  async remove(vehicleId: string, recordId: string) {
    const existing = await this.prisma.horometerRecord.findFirst({
      where: { id: recordId, vehicleId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException("Registro de horómetro no encontrado");

    await this.prisma.horometerRecord.delete({ where: { id: recordId } });
    return { ok: true };
  }
}