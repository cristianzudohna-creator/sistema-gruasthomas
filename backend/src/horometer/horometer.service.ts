import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Empresa } from "@prisma/client";

type Actor = { id: string; email: string; role?: string } | null;

@Injectable()
export class HorometerService {
  constructor(private prisma: PrismaService) {}

  async createRecord(params: {
    vehicleId: string;
    horas: number;
    comentario?: string | null;
    file: Express.Multer.File;
    actor: Actor;
  }) {
    const { vehicleId, horas, comentario, file, actor } = params;

    if (!actor?.id) throw new BadRequestException("No autorizado");

    if (!vehicleId) throw new BadRequestException("vehicleId requerido");
    if (!Number.isInteger(horas) || horas < 0) throw new BadRequestException("horas debe ser entero >= 0");
    if (!file) throw new BadRequestException("Falta la foto");

    // 1) Buscar usuario (trabajador/admin)
    const usuario = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        rut: true,
        empresa: true,
        activo: true,
        role: true,
      },
    });

    if (!usuario || !usuario.activo) throw new BadRequestException("Usuario inválido o inactivo");

    // 2) Validar vehículo existe
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true, empresa: true, patente: true, activo: true },
    });

    if (!vehicle || !vehicle.activo) throw new NotFoundException("Vehículo no encontrado");

    // 3) Seguridad: si es TRABAJADOR, solo puede registrar en su empresa
    const isTrabajador = String(usuario.role || "").toUpperCase() === "TRABAJADOR";

    if (isTrabajador) {
      const empresaTrabajador = usuario.empresa;
      if (!empresaTrabajador) throw new BadRequestException("El trabajador no tiene empresa asignada");

      if (vehicle.empresa !== empresaTrabajador) {
        throw new BadRequestException("No puedes registrar horómetro en un vehículo de otra empresa");
      }
    }

    // 4) Guardar evidencia
    const fotoUrl = `/uploads/horometer/${file.filename}`;
    const filePath = `uploads/horometer/${file.filename}`;

    const comentarioClean = String(comentario ?? "").trim();

    return this.prisma.horometerRecord.create({
      data: {
        vehicleId: vehicle.id,
        trabajadorId: usuario.id,

        trabajadorNombre: usuario.nombre,
        trabajadorApellido: usuario.apellido,
        trabajadorRut: usuario.rut ?? null,
        trabajadorEmail: usuario.email,

        // empresa del registro: la del vehículo
        empresa: vehicle.empresa as Empresa,

        horas,
        comentario: comentarioClean ? comentarioClean : null,

        fotoUrl,
        filePath,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      },
      select: {
        id: true,
        createdAt: true,
        horas: true,
        comentario: true,
        fotoUrl: true,
        empresa: true,

        trabajadorNombre: true,
        trabajadorApellido: true,
        trabajadorRut: true,
        trabajadorEmail: true,

        vehicle: { select: { id: true, patente: true, empresa: true } },
      },
    });
  }

  async listAdmin(params: {
    q?: string;
    empresa?: "ALL" | "GRUAS_THOMAS" | "INSPROTEL";
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(params.page || 1, 1);
    const limit = Math.min(Math.max(params.limit || 10, 1), 50);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (params.empresa && params.empresa !== "ALL") {
      where.empresa = params.empresa;
    }

    if (params.q?.trim()) {
      const q = params.q.trim();
      where.OR = [
        { trabajadorNombre: { contains: q, mode: "insensitive" } },
        { trabajadorApellido: { contains: q, mode: "insensitive" } },
        { trabajadorEmail: { contains: q, mode: "insensitive" } },
        { trabajadorRut: { contains: q, mode: "insensitive" } },
        { vehicle: { patente: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.horometerRecord.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          createdAt: true,
          horas: true,
          comentario: true,
          fotoUrl: true,
          empresa: true,

          trabajadorNombre: true,
          trabajadorApellido: true,
          trabajadorRut: true,
          trabajadorEmail: true,

          vehicle: {
            select: {
              id: true,
              patente: true,
              marcaModelo: true,
              empresa: true,
            },
          },
        },
      }),
      this.prisma.horometerRecord.count({ where }),
    ]);

    return {
      items,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  // ✅ NUEVO: lo que necesita VehiclesController -> GET /vehicles/:id/horometers
  async listByVehicleAdmin(params: { vehicleId: string; page?: number; limit?: number }) {
    const vehicleId = String(params.vehicleId || "").trim();
    if (!vehicleId) throw new BadRequestException("vehicleId requerido");

    const page = Math.max(params.page || 1, 1);
    const limit = Math.min(Math.max(params.limit || 50, 1), 100);
    const skip = (page - 1) * limit;

    // Validar que el vehículo exista (mejor error que devolver lista vacía)
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true, patente: true, empresa: true, activo: true },
    });

    if (!vehicle || !vehicle.activo) throw new NotFoundException("Vehículo no encontrado");

    const where = { vehicleId };

    const [items, total] = await Promise.all([
      this.prisma.horometerRecord.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          createdAt: true,
          horas: true,
          comentario: true,
          fotoUrl: true,
          empresa: true,

          trabajadorNombre: true,
          trabajadorApellido: true,
          trabajadorRut: true,
          trabajadorEmail: true,

          vehicle: {
            select: {
              id: true,
              patente: true,
              marcaModelo: true,
              empresa: true,
            },
          },
        },
      }),
      this.prisma.horometerRecord.count({ where }),
    ]);

    return {
      vehicle,
      items,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }
}


