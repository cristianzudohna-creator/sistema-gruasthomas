// ✅ Archivo: src/users/users.service.ts
// (COMPLETO) - ✅ workerType (tipo de trabajador) + filtros en findAll

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import * as bcrypt from "bcrypt";
import {
  Role,
  Empresa,
  AuditAction,
  AuditEntity,
  WorkerType, // ✅ IMPORTANTE
} from "@prisma/client";
import { CreateUserDto } from "../auth/dto/create-user.dto";
import { UpdateUserDto } from "../auth/dto/update-user.dto";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService
  ) {}

  // ======================
  // Helpers
  // ======================

  private normalizeEmpresa(value: any): Empresa | null {
    // undefined = "no vino" (ojo: no es null)
    if (value === undefined) return undefined as any;
    if (value === null || value === "") return null;

    const emp = String(value).trim().toUpperCase();
    if (emp !== "GRUAS_THOMAS" && emp !== "INSPROTEL") {
      throw new BadRequestException("empresa debe ser GRUAS_THOMAS o INSPROTEL");
    }
    return emp as Empresa;
  }

  // ✅ workerType
  // - undefined = no vino
  // - null / "" = limpiar
  // - valida contra ENUM REAL de Prisma (WorkerType)
  private normalizeWorkerType(value: any): WorkerType | null {
    if (value === undefined) return undefined as any;
    if (value === null || value === "") return null;

    const wt = String(value).trim().toUpperCase();

    // ✅ Lista permitida desde el enum real (evita hardcode viejo)
    const allowed = Object.values(WorkerType).map((x) => String(x).toUpperCase());

    if (!allowed.includes(wt)) {
      throw new BadRequestException(
        `workerType inválido. Debe ser uno de: ${allowed.join(", ")}`
      );
    }

    return wt as WorkerType;
  }

  private assertSuperadmin(actor: any) {
    const role = String(actor?.role || "").toUpperCase();
    if (role !== "SUPERADMIN") {
      throw new BadRequestException(
        "No autorizado. Solo SUPERADMIN puede realizar esta acción."
      );
    }
  }

  findByEmail(email: string) {
    const clean = email?.trim().toLowerCase();
    return this.prisma.user.findUnique({
      where: { email: clean },
    });
  }

  /**
   * ✅ Admin del sistema (root)
   */
  async ensureAdmin() {
    const email = "admin@empresa.cl";
    const hash = await bcrypt.hash("Admin1234*", 10);

    await this.prisma.user.upsert({
      where: { email },
      update: {
        password: hash,
        role: Role.SUPERADMIN,
        activo: true,
        nombre: "Admin",
        apellido: "Sistema",
        empresa: null,
        workerType: null as any,
      } as any,
      create: {
        email,
        password: hash,
        nombre: "Admin",
        apellido: "Sistema",
        role: Role.SUPERADMIN,
        activo: true,
        empresa: null,
        workerType: null as any,
      } as any,
    });
  }

  // ======================
  // ✅ SELF (MI CUENTA)
  // ======================

  async me(actor: any) {
    const id = actor?.id;
    if (!id) throw new BadRequestException("Actor inválido.");

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        rut: true,
        role: true,
        activo: true,
        empresa: true as any,
        workerType: true as any,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) throw new NotFoundException("Usuario no encontrado.");
    return user;
  }

  /**
   * ✅ Cada usuario puede editar SUS datos (NO empresa, NO rol, NO activo, NO password)
   * Campos permitidos:
   * - nombre
   * - apellido
   * - rut
   */
  async updateMe(dto: UpdateUserDto, actor: any = null, meta: any = null) {
    const id = actor?.id;
    if (!id) throw new BadRequestException("Actor inválido.");

    const before = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        rut: true,
        role: true,
        activo: true,
        empresa: true as any,
        workerType: true as any,
      },
    });

    if (!before) throw new NotFoundException("Usuario no encontrado.");

    const data: any = {};

    if (dto.nombre !== undefined) {
      if ((dto as any).nombre === null)
        throw new BadRequestException("Nombre no puede ser null.");
      data.nombre = String(dto.nombre).trim();
    }

    if (dto.apellido !== undefined) {
      if ((dto as any).apellido === null)
        throw new BadRequestException("Apellido no puede ser null.");
      data.apellido = String(dto.apellido).trim();
    }

    if (dto.rut !== undefined) {
      data.rut = (dto as any).rut === null ? null : String(dto.rut).trim();
    }

    // ❌ Bloqueos explícitos
    if ((dto as any).empresa !== undefined)
      throw new BadRequestException("No puedes modificar la empresa.");
    if ((dto as any).role !== undefined)
      throw new BadRequestException("No puedes modificar el rol.");
    if ((dto as any).activo !== undefined)
      throw new BadRequestException("No puedes modificar el estado (activo).");
    if ((dto as any).email !== undefined)
      throw new BadRequestException("No puedes modificar el email desde aquí.");
    if ((dto as any).password)
      throw new BadRequestException(
        "No puedes cambiar la contraseña desde aquí. Usa 'Cambiar contraseña'."
      );

    // ✅ IMPORTANTÍSIMO: el trabajador NO cambia su tipo
    if ((dto as any).workerType !== undefined) {
      throw new BadRequestException("No puedes modificar tu tipo de trabajador.");
    }

    if (!Object.keys(data).length) {
      return this.prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          nombre: true,
          apellido: true,
          rut: true,
          role: true,
          activo: true,
          empresa: true as any,
          workerType: true as any,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    const after = await this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        rut: true,
        role: true,
        activo: true,
        empresa: true as any,
        workerType: true as any,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.auditService.log({
      entity: AuditEntity.USER,
      entityId: id,
      action: AuditAction.UPDATE,
      actor,
      meta,
      data: { before, after, selfUpdate: true },
    });

    return after;
  }

  // ======================
  // CREATE
  // ======================

  async create(dto: CreateUserDto, actor: any = null, meta: any = null) {
    const email = dto.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const role = (dto.role ?? Role.TRABAJADOR) as Role;

    const empresa = this.normalizeEmpresa((dto as any).empresa);
    const workerTypeInput = this.normalizeWorkerType((dto as any).workerType);

    // ✅ reglas por rol (empresa)
    if (role === Role.SUPERADMIN) {
      if (empresa !== undefined && empresa !== null) {
        throw new BadRequestException("SUPERADMIN no debe tener empresa.");
      }
    } else {
      if (!empresa) {
        throw new BadRequestException(
          "empresa es obligatoria para roles distintos de SUPERADMIN."
        );
      }
    }

    // ✅ reglas workerType
    let workerTypeFinal: WorkerType | null = null;

    if (role === Role.TRABAJADOR) {
      workerTypeFinal =
        workerTypeInput === undefined ? null : (workerTypeInput ?? null);
    } else {
      workerTypeFinal = null;
    }

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          password: passwordHash,
          nombre: dto.nombre.trim(),
          apellido: dto.apellido.trim(),
          rut: dto.rut ? dto.rut.trim() : null,
          role,
          activo: dto.activo ?? true,

          empresa: role === Role.SUPERADMIN ? null : (empresa ?? null),

          workerType: workerTypeFinal,
        } as any,
        select: {
          id: true,
          email: true,
          nombre: true,
          apellido: true,
          rut: true,
          role: true,
          activo: true,
          empresa: true as any,
          workerType: true as any,
          createdAt: true,
          updatedAt: true,
        },
      });

      await this.auditService.log({
        entity: AuditEntity.USER,
        entityId: user.id,
        action: AuditAction.CREATE,
        actor,
        meta,
        data: {
          created: {
            email: user.email,
            role: user.role,
            activo: user.activo,
            empresa: (user as any).empresa ?? null,
            workerType: (user as any).workerType ?? null,
          },
        },
      });

      return user;
    } catch (e: any) {
      if (e?.code === "P2002") {
        const fields = e?.meta?.target?.join(", ") ?? "campo único";
        throw new BadRequestException(
          `Ya existe un usuario con el mismo ${fields}.`
        );
      }
      throw e;
    }
  }

  // ======================
  // READ
  // ======================

  async findAll(params: {
    q?: string;
    activo?: string;
    role?: string;
    empresa?: string;

    workerType?: string;

    page?: string;
    limit?: string;
  }) {
    const q = params.q?.trim();
    const page = Math.max(parseInt(params.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(params.limit || "10", 10), 1), 50);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (typeof params.activo === "string") {
      if (params.activo === "true") where.activo = true;
      if (params.activo === "false") where.activo = false;
    }

    if (params.role) {
      where.role = params.role as any;
    }

    if (params.empresa) {
      const emp = this.normalizeEmpresa(params.empresa);
      if (emp !== null && emp !== (undefined as any)) {
        where.empresa = emp as any;
      }
    }

    // ✅ filtro workerType
    if (params.workerType !== undefined) {
      const wt = this.normalizeWorkerType(params.workerType);

      if (wt === null) {
        where.workerType = null;
        where.role = Role.TRABAJADOR;
      } else if (wt !== (undefined as any)) {
        where.workerType = wt;
        where.role = Role.TRABAJADOR;
      }
    }

    if (q) {
      where.OR = [
        { email: { contains: q, mode: "insensitive" } },
        { nombre: { contains: q, mode: "insensitive" } },
        { apellido: { contains: q, mode: "insensitive" } },
        { rut: { contains: q, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          nombre: true,
          apellido: true,
          rut: true,
          role: true,
          activo: true,
          empresa: true as any,
          workerType: true as any,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        rut: true,
        role: true,
        activo: true,
        empresa: true as any,
        workerType: true as any,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) throw new NotFoundException("Trabajador no encontrado.");
    return user;
  }

  // ======================
  // UPDATE (ADMINISTRADORA / SUPERADMIN)
  // ======================

  async update(
    id: string,
    dto: UpdateUserDto,
    actor: any = null,
    meta: any = null
  ) {
    const before = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        rut: true,
        role: true,
        activo: true,
        empresa: true as any,
        workerType: true as any,
      },
    });

    if (!before) throw new NotFoundException("Trabajador no encontrado.");

    const data: any = {};

    if (dto.email !== undefined) {
      if ((dto as any).email === null)
        throw new BadRequestException("Email no puede ser null.");
      data.email = dto.email.trim().toLowerCase();
    }

    if (dto.nombre !== undefined) {
      if ((dto as any).nombre === null)
        throw new BadRequestException("Nombre no puede ser null.");
      data.nombre = dto.nombre.trim();
    }

    if (dto.apellido !== undefined) {
      if ((dto as any).apellido === null)
        throw new BadRequestException("Apellido no puede ser null.");
      data.apellido = dto.apellido.trim();
    }

    if (dto.role !== undefined) {
      if ((dto as any).role === null)
        throw new BadRequestException("Role no puede ser null.");
      data.role = dto.role;
    }

    if (dto.activo !== undefined) {
      if ((dto as any).activo === null)
        throw new BadRequestException("Activo no puede ser null.");
      data.activo = dto.activo;
    }

    if (dto.rut !== undefined) {
      data.rut = (dto as any).rut === null ? null : dto.rut.trim();
    }

    if ((dto as any).password) {
      data.password = await bcrypt.hash((dto as any).password, 10);
    }

    if ((dto as any).empresa !== undefined) {
      const empNormalized = this.normalizeEmpresa((dto as any).empresa);
      data.empresa = empNormalized;
    }

    if ((dto as any).workerType !== undefined) {
      const wt = this.normalizeWorkerType((dto as any).workerType);
      data.workerType = wt;
    }

    const nextRole: Role = (data.role ?? before.role) as Role;

    const nextEmpresaFinal =
      data.empresa !== undefined
        ? data.empresa
        : ((before as any).empresa ?? null);

    if (nextRole === Role.SUPERADMIN) {
      data.empresa = null;
      data.workerType = null;
    } else {
      if (!nextEmpresaFinal) {
        throw new BadRequestException(
          "empresa es obligatoria para roles distintos de SUPERADMIN."
        );
      }
    }

    if (nextRole !== Role.TRABAJADOR) {
      data.workerType = null;
    }

    try {
      const after = await this.prisma.user.update({
        where: { id },
        data,
        select: {
          id: true,
          email: true,
          nombre: true,
          apellido: true,
          rut: true,
          role: true,
          activo: true,
          empresa: true as any,
          workerType: true as any,
          createdAt: true,
          updatedAt: true,
        },
      });

      await this.auditService.log({
        entity: AuditEntity.USER,
        entityId: id,
        action: AuditAction.UPDATE,
        actor,
        meta,
        data: { before, after },
      });

      return after;
    } catch (e: any) {
      if (e?.code === "P2025")
        throw new NotFoundException("Trabajador no encontrado.");
      if (e?.code === "P2002") {
        const fields = e?.meta?.target?.join(", ") ?? "campo único";
        throw new BadRequestException(
          `Ya existe un usuario con el mismo ${fields}.`
        );
      }
      throw e;
    }
  }

  // ======================
  // TOGGLE
  // ======================

  async toggle(id: string, actor: any = null, meta: any = null) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, activo: true },
    });

    if (!user) throw new NotFoundException("Trabajador no encontrado.");

    const updated = await this.prisma.user.update({
      where: { id },
      data: { activo: !user.activo },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        rut: true,
        role: true,
        activo: true,
        empresa: true as any,
        workerType: true as any,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.auditService.log({
      entity: AuditEntity.USER,
      entityId: id,
      action: AuditAction.TOGGLE,
      actor,
      meta,
      data: {
        before: { activo: user.activo },
        after: { activo: updated.activo },
      },
    });

    return updated;
  }

  // ======================
  // DELETE
  // ======================

  async remove(id: string, actor: any = null, meta: any = null) {
    this.assertSuperadmin(actor);

    if (!actor?.id) {
      throw new BadRequestException("Actor inválido.");
    }

    if (actor.id === id) {
      throw new BadRequestException("No puedes eliminar tu propio usuario.");
    }

    const target = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        rut: true,
        role: true,
        activo: true,
        empresa: true as any,
        workerType: true as any,
      },
    });

    if (!target) throw new NotFoundException("Trabajador no encontrado.");

    if (target.role === Role.SUPERADMIN) {
      throw new BadRequestException("No se puede eliminar un SUPERADMIN.");
    }

    await this.prisma.user.delete({ where: { id } });

    await this.auditService.log({
      entity: AuditEntity.USER,
      entityId: id,
      action: AuditAction.DELETE,
      actor,
      meta,
      data: {
        deleted: {
          id: target.id,
          email: target.email,
          nombre: target.nombre,
          apellido: target.apellido,
          rut: target.rut,
          role: target.role,
          activo: target.activo,
          empresa: (target as any).empresa ?? null,
          workerType: (target as any).workerType ?? null,
        },
      },
    });

    return { ok: true, message: "Usuario eliminado correctamente." };
  }
}











