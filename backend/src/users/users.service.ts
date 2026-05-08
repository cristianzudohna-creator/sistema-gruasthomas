// ✅ Archivo: src/users/users.service.ts (COMPLETO)
// ✅ Agregado: resetPasswordBySuperadmin()
// ✅ FIX: al resetear o setear password por admin => mustChangePassword=true + passwordResetAt=now
// - SOLO SUPERADMIN puede resetear contraseña
// - Genera contraseña temporal si no viene una
// - Guarda auditoría (sin password/hash)
// - Devuelve password temporal (para entregarla al usuario)
// ✅ NUEVO:
// - saveFcmToken() para guardar token FCM por usuario
// ✅ NUEVO AHORA:
// - soporte workerTypesExtra WorkerType[]
// - crear/editar/listar usuario con funciones extra
// - filtro workerType ahora busca workerType principal O workerTypesExtra

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
  WorkerType,
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
    if (value === undefined) return undefined as any;
    if (value === null || value === "") return null;

    const emp = String(value).trim().toUpperCase();
    if (emp !== "GRUAS_THOMAS" && emp !== "INSPROTEL") {
      throw new BadRequestException("empresa debe ser GRUAS_THOMAS o INSPROTEL");
    }
    return emp as Empresa;
  }

  private normalizeWorkerType(value: any): WorkerType | null {
    if (value === undefined) return undefined as any;
    if (value === null || value === "") return null;

    const wt = String(value).trim().toUpperCase();

    const allowed = Object.values(WorkerType).map((x) =>
      String(x).toUpperCase()
    );

    if (!allowed.includes(wt)) {
      throw new BadRequestException(
        `workerType inválido. Debe ser uno de: ${allowed.join(", ")}`
      );
    }

    return wt as WorkerType;
  }

  private normalizeWorkerTypesExtra(value: any, mainWorkerType?: WorkerType | null): WorkerType[] {
    if (value === undefined) return undefined as any;
    if (value === null || value === "") return [];

    const raw = Array.isArray(value) ? value : [value];

    const allowed = Object.values(WorkerType).map((x) =>
      String(x).toUpperCase()
    );

    const normalized = raw
      .map((x) => String(x || "").trim().toUpperCase())
      .filter(Boolean);

    for (const wt of normalized) {
      if (!allowed.includes(wt)) {
        throw new BadRequestException(
          `workerTypesExtra inválido. Debe ser uno de: ${allowed.join(", ")}`
        );
      }
    }

    const unique = Array.from(new Set(normalized)) as WorkerType[];

    if (mainWorkerType) {
      return unique.filter((x) => x !== mainWorkerType);
    }

    return unique;
  }

  private assertSuperadmin(actor: any) {
    const role = String(actor?.role || "").toUpperCase();
    if (role !== "SUPERADMIN") {
      throw new BadRequestException(
        "No autorizado. Solo SUPERADMIN puede realizar esta acción."
      );
    }
  }

  private snapshotUser(u: any) {
    if (!u) return null;
    return {
      id: u.id,
      email: u.email,
      nombre: u.nombre,
      apellido: u.apellido,
      rut: u.rut ?? null,
      role: u.role,
      activo: u.activo,
      empresa: (u as any).empresa ?? null,
      workerType: (u as any).workerType ?? null,
      workerTypesExtra: (u as any).workerTypesExtra ?? [],

      mustChangePassword: (u as any).mustChangePassword ?? false,
      passwordResetAt: (u as any).passwordResetAt ?? null,
    };
  }

  private normalizeRut(input: any): string {
    return String(input ?? "")
      .trim()
      .toUpperCase()
      .replace(/\./g, "")
      .replace(/-/g, "")
      .replace(/\s+/g, "");
  }

  private generateTempPassword() {
    const n = Math.floor(100000 + Math.random() * 900000);
    return `GT-${n}`;
  }

  // ======================
  // Finds
  // ======================

  findByEmail(email: string) {
    const clean = email?.trim().toLowerCase();
    return this.prisma.user.findUnique({
      where: { email: clean },
    });
  }

  findByRut(rut: string) {
    const cleanRut = this.normalizeRut(rut);
    if (!cleanRut) return null as any;

    return this.prisma.user.findFirst({
      where: {
        OR: [
          {
            rut: {
              equals: cleanRut,
              mode: "insensitive",
            },
          },
          {
            rut: {
              contains: cleanRut,
              mode: "insensitive",
            },
          },
        ],
      },
    });
  }

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
        workerTypesExtra: [],

        mustChangePassword: false,
        passwordResetAt: null,
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
        workerTypesExtra: [],

        mustChangePassword: false,
        passwordResetAt: null,
      } as any,
    });
  }

  // ======================
  // ✅ SELF
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
        workerTypesExtra: true as any,
        mustChangePassword: true as any,
        passwordResetAt: true as any,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) throw new NotFoundException("Usuario no encontrado.");
    return user;
  }

  async updateMe(dto: UpdateUserDto, actor: any = null, meta: any = null) {
    const id = actor?.id;
    if (!id) throw new BadRequestException("Actor inválido.");

    const beforeRaw = await this.prisma.user.findUnique({
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
        workerTypesExtra: true as any,
        mustChangePassword: true as any,
        passwordResetAt: true as any,
      },
    });

    if (!beforeRaw) throw new NotFoundException("Usuario no encontrado.");

    const before = this.snapshotUser(beforeRaw);

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
      data.rut =
        (dto as any).rut === null ? null : this.normalizeRut((dto as any).rut);
    }

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

    if ((dto as any).workerType !== undefined) {
      throw new BadRequestException("No puedes modificar tu tipo de trabajador.");
    }

    if ((dto as any).workerTypesExtra !== undefined) {
      throw new BadRequestException(
        "No puedes modificar tus funciones extra de trabajador."
      );
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
          workerTypesExtra: true as any,
          mustChangePassword: true as any,
          passwordResetAt: true as any,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    const afterRaw = await this.prisma.user.update({
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
        workerTypesExtra: true as any,
        mustChangePassword: true as any,
        passwordResetAt: true as any,
        createdAt: true,
        updatedAt: true,
      },
    });

    const after = this.snapshotUser(afterRaw);

    await this.auditService.log({
      entity: AuditEntity.USER,
      entityId: id,
      action: AuditAction.UPDATE,
      actor,
      meta,
      data: { before, after, selfUpdate: true },
    });

    return afterRaw;
  }

  // ======================
  // CREATE
  // ======================

  async create(dto: CreateUserDto, actor: any = null, meta: any = null) {
  const rutClean = this.normalizeRut(dto.rut);

  if (!rutClean) {
    throw new BadRequestException("El RUT es obligatorio.");
  }

  const email =
    dto.email?.trim()?.toLowerCase() ||
    `${rutClean}@sin-correo.local`;

  const passwordHash = await bcrypt.hash(dto.password, 10);
  const role = (dto.role ?? Role.TRABAJADOR) as Role;

    const empresa = this.normalizeEmpresa((dto as any).empresa);
    const workerTypeInput = this.normalizeWorkerType((dto as any).workerType);

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

    let workerTypeFinal: WorkerType | null = null;
    let workerTypesExtraFinal: WorkerType[] = [];

    if (role === Role.TRABAJADOR) {
      workerTypeFinal =
        workerTypeInput === undefined ? null : (workerTypeInput ?? null);

      workerTypesExtraFinal = this.normalizeWorkerTypesExtra(
        (dto as any).workerTypesExtra,
        workerTypeFinal
      );

      if (workerTypesExtraFinal === (undefined as any)) {
        workerTypesExtraFinal = [];
      }
    } else {
      workerTypeFinal = null;
      workerTypesExtraFinal = [];
    }

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          password: passwordHash,
          nombre: dto.nombre.trim(),
          apellido: dto.apellido.trim(),
          rut: rutClean,
          role,
          activo: dto.activo ?? true,
          empresa: role === Role.SUPERADMIN ? null : (empresa ?? null),
          workerType: workerTypeFinal,
          workerTypesExtra: workerTypesExtraFinal,

          mustChangePassword: false,
          passwordResetAt: null,
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
          workerTypesExtra: true as any,
          mustChangePassword: true as any,
          passwordResetAt: true as any,
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
        data: { created: this.snapshotUser(user) },
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
    const and: any[] = [];

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

    if (params.workerType !== undefined) {
      const wt = this.normalizeWorkerType(params.workerType);

      if (wt === null) {
        where.workerType = null;
        where.role = Role.TRABAJADOR;
      } else if (wt !== (undefined as any)) {
        where.role = Role.TRABAJADOR;

        and.push({
          OR: [
            { workerType: wt },
            { workerTypesExtra: { has: wt } },
          ],
        });
      }
    }

    if (q) {
      and.push({
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { nombre: { contains: q, mode: "insensitive" } },
          { apellido: { contains: q, mode: "insensitive" } },
          { rut: { contains: q, mode: "insensitive" } },
        ],
      });
    }

    if (and.length) {
      where.AND = and;
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
          workerTypesExtra: true as any,
          mustChangePassword: true as any,
          passwordResetAt: true as any,
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
        workerTypesExtra: true as any,
        mustChangePassword: true as any,
        passwordResetAt: true as any,
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
    const beforeRaw = await this.prisma.user.findUnique({
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
        workerTypesExtra: true as any,
        mustChangePassword: true as any,
        passwordResetAt: true as any,
      },
    });

    if (!beforeRaw) throw new NotFoundException("Trabajador no encontrado.");

    const before = this.snapshotUser(beforeRaw);

    const data: any = {};
    let passwordChanged = false;

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
      data.rut =
        (dto as any).rut === null ? null : this.normalizeRut((dto as any).rut);
    }

    if ((dto as any).password) {
      data.password = await bcrypt.hash((dto as any).password, 10);
      passwordChanged = true;

      data.mustChangePassword = true;
      data.passwordResetAt = new Date();
    }

    if ((dto as any).empresa !== undefined) {
      const empNormalized = this.normalizeEmpresa((dto as any).empresa);
      data.empresa = empNormalized;
    }

    if ((dto as any).workerType !== undefined) {
      const wt = this.normalizeWorkerType((dto as any).workerType);
      data.workerType = wt;
    }

    const nextRole: Role = (data.role ?? beforeRaw.role) as Role;

    const nextEmpresaFinal =
      data.empresa !== undefined
        ? data.empresa
        : ((beforeRaw as any).empresa ?? null);

    const nextWorkerTypeFinal =
      data.workerType !== undefined
        ? data.workerType
        : ((beforeRaw as any).workerType ?? null);

    if ((dto as any).workerTypesExtra !== undefined) {
      data.workerTypesExtra = this.normalizeWorkerTypesExtra(
        (dto as any).workerTypesExtra,
        nextWorkerTypeFinal
      );
    }

    if (nextRole === Role.SUPERADMIN) {
      data.empresa = null;
      data.workerType = null;
      data.workerTypesExtra = [];

      data.mustChangePassword = false;
    } else {
      if (!nextEmpresaFinal) {
        throw new BadRequestException(
          "empresa es obligatoria para roles distintos de SUPERADMIN."
        );
      }
    }

    if (nextRole !== Role.TRABAJADOR) {
      data.workerType = null;
      data.workerTypesExtra = [];
    }

    try {
      const afterRaw = await this.prisma.user.update({
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
          workerTypesExtra: true as any,
          mustChangePassword: true as any,
          passwordResetAt: true as any,
          createdAt: true,
          updatedAt: true,
        },
      });

      const after = this.snapshotUser(afterRaw);

      await this.auditService.log({
        entity: AuditEntity.USER,
        entityId: id,
        action: AuditAction.UPDATE,
        actor,
        meta,
        data: { before, after, passwordChanged },
      });

      return afterRaw;
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
  // ✅ RESET PASSWORD BY SUPERADMIN
  // ======================

  async resetPasswordBySuperadmin(
    targetUserId: string,
    newPassword?: string,
    actor: any = null,
    meta: any = null
  ) {
    this.assertSuperadmin(actor);

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
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
        workerTypesExtra: true as any,
        mustChangePassword: true as any,
        passwordResetAt: true as any,
      },
    });

    if (!target) throw new NotFoundException("Usuario no encontrado.");

    if (actor?.id && String(actor.id) === String(targetUserId)) {
      throw new BadRequestException(
        "No puedes resetear tu propia contraseña desde este endpoint."
      );
    }

    const pass =
      String(newPassword || "").trim() || this.generateTempPassword();

    if (pass.length < 8) {
      throw new BadRequestException(
        "La nueva contraseña debe tener al menos 8 caracteres (o deja vacío para generar una temporal)."
      );
    }

    const hashed = await bcrypt.hash(pass, 10);

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        password: hashed,

        mustChangePassword: true,
        passwordResetAt: new Date(),
      },
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
        workerTypesExtra: true as any,
        mustChangePassword: true as any,
        passwordResetAt: true as any,
        createdAt: true,
        updatedAt: true,
      },
    });

    try {
      await this.auditService.log({
        entity: AuditEntity.USER,
        entityId: targetUserId,
        action: AuditAction.UPDATE,
        actor,
        meta,
        data: {
          kind: "RESET_PASSWORD_BY_SUPERADMIN",
          before: this.snapshotUser(target),
          after: this.snapshotUser(updated),
          passwordChanged: true,
        },
      });
    } catch {}

    return {
      ok: true,
      message: "Contraseña reseteada correctamente.",
      userId: updated.id,
      email: updated.email,
      rut: updated.rut ?? null,
      tempPassword: pass,
      mustChangePassword: updated.mustChangePassword ?? true,
    };
  }

  // ======================
  // TOGGLE
  // ======================

  async toggle(id: string, actor: any = null, meta: any = null) {
    const beforeRaw = await this.prisma.user.findUnique({
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
        workerTypesExtra: true as any,
        mustChangePassword: true as any,
        passwordResetAt: true as any,
      },
    });

    if (!beforeRaw) throw new NotFoundException("Trabajador no encontrado.");

    const updated = await this.prisma.user.update({
      where: { id },
      data: { activo: !beforeRaw.activo },
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
        workerTypesExtra: true as any,
        mustChangePassword: true as any,
        passwordResetAt: true as any,
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
        before: this.snapshotUser(beforeRaw),
        after: this.snapshotUser(updated),
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
        workerTypesExtra: true as any,
        mustChangePassword: true as any,
        passwordResetAt: true as any,
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
      data: { deleted: this.snapshotUser(target) },
    });

    return { ok: true, message: "Usuario eliminado correctamente." };
  }

  // ======================
  // 🔥 FCM TOKEN
  // ======================

  async saveFcmToken(userId: string, token: string) {
    if (!userId) {
      throw new BadRequestException("UserId requerido");
    }

    if (!token) {
      throw new BadRequestException("Token requerido");
    }

    try {
      const existing = await this.prisma.userFcmToken.findUnique({
        where: { token },
      });

      if (existing) {
        return this.prisma.userFcmToken.update({
          where: { token },
          data: { userId },
        });
      }

      return this.prisma.userFcmToken.create({
        data: {
          userId,
          token,
        },
      });
    } catch (error) {
      console.error("❌ Error guardando token FCM:", error);
      throw new BadRequestException("No se pudo guardar token FCM");
    }
  }
}














