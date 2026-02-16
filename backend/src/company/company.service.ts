import { Injectable, ForbiddenException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

type Empresa = "GRUAS_THOMAS" | "INSPROTEL";

type ActorLike = {
  id?: string;
  role?: string;
} | null;

type UpdateCompanyDto = {
  nombre?: string;
  emailContacto?: string;
  telefono?: string;
  direccion?: string;
  logoUrl?: string;
};

@Injectable()
export class CompanyService {
  constructor(private prisma: PrismaService) {}

  private async getEmpresaFromDbOrThrow(actor: ActorLike): Promise<Empresa> {
    if (actor?.role !== "ADMIN" && actor?.role !== "SUPERADMIN") {
  throw new ForbiddenException("Solo ADMIN puede modificar datos de la empresa.");
}


    const user = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: { id: true, empresa: true, role: true },
    });

    if (!user) {
      throw new ForbiddenException("No se pudo determinar el usuario de la sesión.");
    }

    const emp = (user as any).empresa as Empresa | null;

    if (!emp) {
      throw new ForbiddenException("No se pudo determinar la empresa del usuario.");
    }

    return emp;
  }

  private canEditCompany(actor: ActorLike) {
    const role = String(actor?.role || "").toUpperCase();
    return role === "ADMIN" || role === "SUPERADMIN";
  }

  async getMyCompany(actor: ActorLike) {
    const empresa = await this.getEmpresaFromDbOrThrow(actor);

    const existing = await this.prisma.companySettings.findUnique({
      where: { empresa: empresa as any },
    });

    if (existing) return existing;

    const defaultName = empresa === "INSPROTEL" ? "INSPROTEL" : "Grúas Thomas";

    return this.prisma.companySettings.create({
      data: {
        empresa: empresa as any,
        nombre: defaultName,
      },
    });
  }

  async updateMyCompany(actor: ActorLike, dto: UpdateCompanyDto) {
    if (!this.canEditCompany(actor)) {
      throw new ForbiddenException("No tienes permisos para modificar datos de la empresa.");
    }

    const empresa = await this.getEmpresaFromDbOrThrow(actor);

    // Asegura que exista
    const current =
      (await this.prisma.companySettings.findUnique({
        where: { empresa: empresa as any },
      })) ?? (await this.getMyCompany(actor));

    const nombre = (dto.nombre ?? current.nombre ?? "").trim();
    if (!nombre) throw new BadRequestException("El nombre de empresa no puede quedar vacío.");

    return this.prisma.companySettings.update({
      where: { id: current.id },
      data: {
        nombre,
        emailContacto: dto.emailContacto ?? current.emailContacto,
        telefono: dto.telefono ?? current.telefono,
        direccion: dto.direccion ?? current.direccion,
        logoUrl: dto.logoUrl ?? current.logoUrl,
      },
    });
  }
}

