import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class VehicleHorometersService {
  constructor(private prisma: PrismaService) {}

  async listByVehicle(vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true, patente: true, empresa: true },
    });

    if (!vehicle) throw new NotFoundException("Vehículo no encontrado");

    // 👇 Esto trae lo que sube el trabajador + su snapshot (nombre, rut, email)
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
        trabajadorEmail: true,

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
}
