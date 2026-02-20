// ✅ Archivo: src/clients/clients.service.ts (COMPLETO)
// ✅ Incluye Auditoría:
// - CREATE cliente
// - UPDATE cliente
// - DELETE cliente
//
// ✅ Seguridad por empresa:
// - SUPERADMIN / CONTROL_FLOTA => pueden ver/escribir ambas (elige empresa en body al crear)
// - ADMINISTRADORA => solo su empresa
//
// ✅ Validaciones:
// - Nombre obligatorio
// - RUT normalizado y único por empresa (si viene)
// - Nombre único por empresa (insensitive)

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Empresa, AuditAction, AuditEntity } from "@prisma/client";
import { CreateClientDto, EMPRESAS_VALIDAS } from "./dto/create-client.dto";
import { UpdateClientDto } from "./dto/update-client.dto";

// ✅ AUDIT
import { AuditService } from "../audit/audit.service";

function cleanStr(v: any): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

/**
 * ✅ Normaliza RUT:
 * - quita puntos/espacios
 * - DV en mayúscula
 * - asegura guion: 12345678-K
 */
function normalizeRut(rutRaw: any): string | null {
  const r = cleanStr(rutRaw);
  if (!r) return null;

  const v = r.replace(/\./g, "").replace(/\s/g, "");
  const m = v.match(/^(\d{7,8})-?([\dkK])$/);
  if (!m) return cleanStr(rutRaw);
  const num = m[1];
  const dv = String(m[2]).toUpperCase();
  return `${num}-${dv}`;
}

type SafeActor = { id: string; email: string } | null;

function safeActor(actor: any): SafeActor {
  if (!actor?.id || !actor?.email) return null;
  return { id: String(actor.id), email: String(actor.email) };
}

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  // =========================
  // ✅ ROLES / EMPRESA
  // =========================
  private roleUpper(actor: any) {
    return String(actor?.role || "").toUpperCase();
  }

  private isGlobalRole(actor: any) {
    const r = this.roleUpper(actor);
    return r === "SUPERADMIN" || r === "CONTROL_FLOTA";
  }

  private isAdminRole(actor: any) {
    const r = this.roleUpper(actor);
    return r === "SUPERADMIN" || r === "CONTROL_FLOTA" || r === "ADMINISTRADORA";
  }

  private async getEmpresaForActorOrThrow(actor: any): Promise<Empresa> {
    const emp = actor?.empresa as Empresa | undefined | null;
    if (emp) return emp;

    if (actor?.id) {
      const user = await this.prisma.user.findUnique({
        where: { id: actor.id },
        select: { empresa: true },
      });
      if (user?.empresa) return user.empresa as any;
    }

    throw new ForbiddenException("No se pudo determinar la empresa del usuario.");
  }

  private async resolveEmpresaForWrite(
    dtoEmpresaRaw: any,
    actor: any
  ): Promise<Empresa> {
    // GLOBAL: puede elegir empresa en body
    if (this.isGlobalRole(actor)) {
      const dtoEmp = cleanStr(dtoEmpresaRaw);
      if (!dtoEmp)
        throw new BadRequestException(
          "Falta empresa (GRUAS_THOMAS / INSPROTEL)."
        );
      if (!EMPRESAS_VALIDAS.includes(dtoEmp as any))
        throw new BadRequestException("Empresa inválida.");
      return dtoEmp as any;
    }

    // ADMINISTRADORA: siempre su empresa
    return this.getEmpresaForActorOrThrow(actor);
  }

  private async ensureAccessOrThrow(id: string, actor: any) {
    const c = await this.prisma.client.findUnique({
      where: { id },
      select: {
        id: true,
        empresa: true,
        nombre: true,
        rut: true,
        giro: true,
        telefono: true,
        direccion: true,
        comuna: true,
        ciudad: true,
      },
    });
    if (!c) throw new NotFoundException("Cliente no encontrado");

    if (!this.isGlobalRole(actor)) {
      const emp = await this.getEmpresaForActorOrThrow(actor);
      if (c.empresa !== emp) throw new NotFoundException("Cliente no encontrado");
    }

    return c;
  }

  // =========================
  // ✅ LISTAR / BUSCAR
  // GET /clients?search=fer&take=20
  // =========================
  async list(actor: any, search?: string, take?: any) {
    if (!this.isAdminRole(actor)) throw new ForbiddenException("No autorizado.");

    const q = cleanStr(search);
    const t = Math.min(Math.max(Number(take || 50), 1), 200);

    const whereEmpresa = this.isGlobalRole(actor)
      ? {}
      : { empresa: await this.getEmpresaForActorOrThrow(actor) };

    const items = await this.prisma.client.findMany({
      where: {
        ...whereEmpresa,
        ...(q
          ? {
              OR: [
                { nombre: { contains: q, mode: "insensitive" } },
                { rut: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: { nombre: "asc" },
      take: t,
      select: {
        id: true,
        empresa: true,
        nombre: true,
        rut: true,
        giro: true,
        telefono: true,
        direccion: true,
        comuna: true,
        ciudad: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return { items };
  }

  // =========================
  // ✅ OBTENER POR ID
  // GET /clients/:id
  // =========================
  async getById(id: string, actor: any) {
    if (!this.isAdminRole(actor)) throw new ForbiddenException("No autorizado.");
    if (!id) throw new BadRequestException("Falta id");

    await this.ensureAccessOrThrow(id, actor);

    const item = await this.prisma.client.findUnique({
      where: { id },
      select: {
        id: true,
        empresa: true,
        nombre: true,
        rut: true,
        giro: true,
        telefono: true,
        direccion: true,
        comuna: true,
        ciudad: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!item) throw new NotFoundException("Cliente no encontrado");
    return item;
  }

  // =========================
  // ✅ CREAR
  // POST /clients
  // =========================
  async create(dto: CreateClientDto, actor: any) {
    if (!this.isAdminRole(actor)) throw new ForbiddenException("No autorizado.");

    const nombre = cleanStr(dto.nombre);
    if (!nombre) throw new BadRequestException("Nombre es obligatorio.");

    const empresa = await this.resolveEmpresaForWrite((dto as any).empresa, actor);
    const rutNorm = normalizeRut((dto as any).rut);

    // ✅ Evitar duplicado por RUT (si viene) dentro de la empresa
    if (rutNorm) {
      const existsRut = await this.prisma.client.findFirst({
        where: { empresa, rut: rutNorm },
        select: { id: true },
      });
      if (existsRut)
        throw new BadRequestException(
          "Ya existe un cliente con ese RUT en la empresa."
        );
    }

    // ✅ Evitar duplicado exacto por nombre en empresa
    const existsName = await this.prisma.client.findFirst({
      where: { empresa, nombre: { equals: nombre, mode: "insensitive" } },
      select: { id: true },
    });
    if (existsName)
      throw new BadRequestException(
        "Ya existe un cliente con ese nombre en la empresa."
      );

    const created = await this.prisma.client.create({
      data: {
        empresa,
        nombre,
        rut: rutNorm || cleanStr((dto as any).rut),
        giro: cleanStr((dto as any).giro),
        telefono: cleanStr((dto as any).telefono),
        direccion: cleanStr((dto as any).direccion),
        comuna: cleanStr((dto as any).comuna),
        ciudad: cleanStr((dto as any).ciudad),
      },
      select: {
        id: true,
        empresa: true,
        nombre: true,
        rut: true,
        giro: true,
        telefono: true,
        direccion: true,
        comuna: true,
        ciudad: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // ✅ AUDIT CREATE
    try {
      await this.audit.log({
        entity: AuditEntity.CLIENT, // ⚠️ requiere agregar CLIENT en enum Prisma
        entityId: created.id,
        action: AuditAction.CREATE,
        actor: safeActor(actor),
        meta: {
          title: "Creó cliente",
          targetLabel: created.nombre,
          after: created,
        },
      });
    } catch {}

    return created;
  }

  // =========================
  // ✅ EDITAR
  // PATCH /clients/:id
  // =========================
  async update(id: string, dto: UpdateClientDto, actor: any) {
    if (!this.isAdminRole(actor)) throw new ForbiddenException("No autorizado.");
    if (!id) throw new BadRequestException("Falta id");

    const before = await this.ensureAccessOrThrow(id, actor);

    const nombre = dto.nombre !== undefined ? cleanStr(dto.nombre) : undefined;
    if (dto.nombre !== undefined && !nombre)
      throw new BadRequestException("Nombre no puede venir vacío.");

    // ✅ empresa solo si es global
    let empresaToSet: Empresa | undefined = undefined;
    if (this.isGlobalRole(actor) && (dto as any).empresa !== undefined) {
      const empRaw = cleanStr((dto as any).empresa);
      if (!empRaw) throw new BadRequestException("Empresa no puede venir vacía.");
      if (!EMPRESAS_VALIDAS.includes(empRaw as any))
        throw new BadRequestException("Empresa inválida.");
      empresaToSet = empRaw as any;
    }

    const rutNorm =
      dto.rut !== undefined ? normalizeRut((dto as any).rut) : undefined;

    const empresaFinal = empresaToSet || (before.empresa as any);

    // ✅ Si cambia RUT: validar duplicado
    if (dto.rut !== undefined && rutNorm) {
      const existsRut = await this.prisma.client.findFirst({
        where: { empresa: empresaFinal, rut: rutNorm, NOT: { id } },
        select: { id: true },
      });
      if (existsRut)
        throw new BadRequestException(
          "Ya existe otro cliente con ese RUT en la empresa."
        );
    }

    // ✅ Si cambia nombre: validar duplicado
    if (dto.nombre !== undefined && nombre) {
      const existsName = await this.prisma.client.findFirst({
        where: {
          empresa: empresaFinal,
          nombre: { equals: nombre, mode: "insensitive" },
          NOT: { id },
        },
        select: { id: true },
      });
      if (existsName)
        throw new BadRequestException(
          "Ya existe otro cliente con ese nombre en la empresa."
        );
    }

    const after = await this.prisma.client.update({
      where: { id },
      data: {
        ...(empresaToSet ? { empresa: empresaToSet } : {}),
        ...(dto.nombre !== undefined ? { nombre: nombre as any } : {}),
        ...(dto.rut !== undefined
          ? { rut: rutNorm || cleanStr((dto as any).rut) }
          : {}),
        ...(dto.giro !== undefined ? { giro: cleanStr((dto as any).giro) } : {}),
        ...(dto.telefono !== undefined
          ? { telefono: cleanStr((dto as any).telefono) }
          : {}),
        ...(dto.direccion !== undefined
          ? { direccion: cleanStr((dto as any).direccion) }
          : {}),
        ...(dto.comuna !== undefined
          ? { comuna: cleanStr((dto as any).comuna) }
          : {}),
        ...(dto.ciudad !== undefined
          ? { ciudad: cleanStr((dto as any).ciudad) }
          : {}),
      },
      select: {
        id: true,
        empresa: true,
        nombre: true,
        rut: true,
        giro: true,
        telefono: true,
        direccion: true,
        comuna: true,
        ciudad: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // ✅ AUDIT UPDATE
    try {
      await this.audit.log({
        entity: AuditEntity.CLIENT, // ⚠️ requiere agregar CLIENT en enum Prisma
        entityId: after.id,
        action: AuditAction.UPDATE,
        actor: safeActor(actor),
        meta: {
          title: "Editó cliente",
          targetLabel: after.nombre,
          before,
          after,
        },
      });
    } catch {}

    return after;
  }

  // =========================
  // ✅ ELIMINAR (DELETE REAL)
  // DELETE /clients/:id
  // =========================
  async remove(id: string, actor: any) {
    if (!this.isAdminRole(actor)) throw new ForbiddenException("No autorizado.");
    if (!id) throw new BadRequestException("Falta id");

    const before = await this.ensureAccessOrThrow(id, actor);

    // ✅ OJO: si WorkOrder referencia clientId, esto puede fallar por FK.
    // Si te pasa, lo cambiamos a soft delete (agregando "activo" en Client).
    await this.prisma.client.delete({ where: { id } });

    // ✅ AUDIT DELETE
    try {
      await this.audit.log({
        entity: AuditEntity.CLIENT, // ⚠️ requiere agregar CLIENT en enum Prisma
        entityId: id,
        action: AuditAction.DELETE,
        actor: safeActor(actor),
        meta: {
          title: "Eliminó cliente",
          targetLabel: before.nombre,
          before,
        },
      });
    } catch {}

    return { ok: true };
  }
}



