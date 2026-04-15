import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import {
  AuditAction,
  AuditEntity,
  VehicleType,
  VehicleOperationalStatus,
} from "@prisma/client";

// ✅ NUEVO: normalización de roles (mismo criterio que el RolesGuard)
import { normRole } from "../common/utils/norm-role";

type Empresa = "GRUAS_THOMAS" | "INSPROTEL";
type EmpresaFilter = "ALL" | Empresa;

type CreateVehicleDto = {
  empresa?: Empresa;
  patente: string;

  // ✅ frontend manda marca / modelo separados
  marca?: string;
  modelo?: string;

  // ✅ compat
  marcaModelo?: string;

  conductor?: string;
  type?: VehicleType;
  tipoVehiculo?: string;
  year?: number | null;
  estadoOperativo?: VehicleOperationalStatus;
};

type UpdateVehicleDto = {
  empresa?: Empresa;
  patente?: string;

  // ✅ frontend manda marca / modelo separados
  marca?: string;
  modelo?: string;

  // ✅ compat
  marcaModelo?: string;

  conductor?: string;
  type?: VehicleType;
  tipoVehiculo?: string | null;
  year?: number | null;
  estadoOperativo?: VehicleOperationalStatus;
};

type ActorLike =
  | {
      id?: string;
      email?: string;
      role?: string;
      empresa?: Empresa;
      workerType?: string;
      tipoTrabajador?: string;
      worker_type?: string;
      tipo_trabajador?: string;
      cargo?: string;
      type?: string;
    }
  | null;

type VehicleEstado = "VENCIDO" | "POR_VENCER" | "VIGENTE";

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function diffDaysFromToday(target: Date) {
  const today0 = startOfToday();
  const due0 = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffMs = due0.getTime() - today0.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function calcEstadoByFechaProxima(
  fechaProxima: Date | null
): { estado: VehicleEstado; detalle: string } {
  if (!fechaProxima) {
    return { estado: "VIGENTE", detalle: "Sin próxima mantención registrada" };
  }

  const diffDays = diffDaysFromToday(fechaProxima);

  if (diffDays < 0) {
    return {
      estado: "VENCIDO",
      detalle: `Mantención vencida (${Math.abs(diffDays)} día(s) atrasada)`,
    };
  }

  if (diffDays <= 30) {
    return {
      estado: "POR_VENCER",
      detalle: `Mantención próxima en ${diffDays} día(s)`,
    };
  }

  return { estado: "VIGENTE", detalle: `Mantención al día (faltan ${diffDays} día(s))` };
}

function calcEstadoByFechaVencimiento(fechaVencimiento: Date | null): VehicleEstado {
  if (!fechaVencimiento) return "VIGENTE";
  const diffDays = diffDaysFromToday(fechaVencimiento);
  if (diffDays < 0) return "VENCIDO";
  if (diffDays <= 30) return "POR_VENCER";
  return "VIGENTE";
}

function calcEstadoFromCounts(criticos: number, porVencer: number): VehicleEstado {
  if (criticos > 0) return "VENCIDO";
  if (porVencer > 0) return "POR_VENCER";
  return "VIGENTE";
}

function calcEstadoGeneral(
  estadoDocs: VehicleEstado,
  estadoMaint: VehicleEstado
): VehicleEstado {
  if (estadoDocs === "VENCIDO" || estadoMaint === "VENCIDO") return "VENCIDO";
  if (estadoDocs === "POR_VENCER" || estadoMaint === "POR_VENCER") return "POR_VENCER";
  return "VIGENTE";
}

function empresaLabel(code: Empresa) {
  return code === "INSPROTEL" ? "INSPROTEL" : "GRÚAS THOMAS";
}

function estadoLabel(estado: VehicleEstado) {
  if (estado === "VENCIDO") return "Crítico";
  if (estado === "POR_VENCER") return "Por vencer";
  return "Vigente";
}

function safeActor(actor?: ActorLike) {
  return actor?.id && actor?.email ? { id: actor.id, email: actor.email } : null;
}

function sTrim(v: any) {
  return String(v ?? "").trim();
}

@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  // ======================
  // 🔒 SCOPING POR EMPRESA
  // ======================

  private roleUpper(actor?: ActorLike) {
    return normRole(actor?.role);
  }

  private workerTypeUpper(actor?: ActorLike) {
    return String(
      actor?.workerType ||
        actor?.tipoTrabajador ||
        actor?.worker_type ||
        actor?.tipo_trabajador ||
        actor?.cargo ||
        actor?.type ||
        ""
    )
      .trim()
      .toUpperCase();
  }

  private isGlobalFleetRole(actor?: ActorLike) {
    const role = this.roleUpper(actor);
    return role === "SUPERADMIN" || role === "CONTROL_FLOTA";
  }

  // ✅ NUEVO:
  // JEFE_TALLER y SUPERVISOR deben poder ver vehículos de ambas empresas
  // para crear incidentes y tareas de taller.
  private isWorkshopCrossCompanyViewer(actor?: ActorLike) {
    const role = this.roleUpper(actor);
    const workerType = this.workerTypeUpper(actor);

    if (role !== "TRABAJADOR") return false;

    return (
      workerType === "JEFE_TALLER" ||
      workerType === "SUPERVISOR" ||
      workerType === "SUPERVISOR_TERRENO"
    );
  }

  private isScopedFleetViewer(actor?: ActorLike) {
    const role = this.roleUpper(actor);
    return role === "TRABAJADOR" || role === "ADMINISTRADORA" || role === "ADMIN";
  }

  // ✅ FIX REAL:
  // primero usa actor.empresa si viene
  // si NO viene, la busca en base de datos usando actor.id
  private async empresaFromActorOrThrow(actor?: ActorLike): Promise<Empresa> {
    const emp = actor?.empresa as Empresa | undefined | null;

    if (emp === "GRUAS_THOMAS" || emp === "INSPROTEL") {
      return emp;
    }

    const userId = String(actor?.id || "").trim();
    if (!userId) {
      throw new ForbiddenException("No se pudo determinar la empresa del usuario.");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { empresa: true },
    });

    const dbEmpresa = user?.empresa as Empresa | undefined | null;

    if (dbEmpresa === "GRUAS_THOMAS" || dbEmpresa === "INSPROTEL") {
      return dbEmpresa;
    }

    throw new ForbiddenException("No se pudo determinar la empresa del usuario.");
  }

  private assertEmpresaAccess(actor: ActorLike | undefined, _empresa: Empresa) {
    const role = this.roleUpper(actor ?? null);

    console.log("[FLEET] actor:", actor);
    console.log("[FLEET] roleUpper:", role);

    if (role === "SUPERADMIN" || role === "CONTROL_FLOTA") return;

    throw new ForbiddenException(`No tienes permisos. [VEHICLES_SERVICE role=${role}]`);
  }

  async ensureVehicleAccessOrThrow(vehicleId: string, actor: ActorLike) {
    const v = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true, patente: true, empresa: true as any, activo: true as any },
    });

    if (!v) throw new NotFoundException("Vehículo no encontrado");
    if ((v as any).activo === false) throw new NotFoundException("Vehículo no encontrado");

    const emp = ((v as any).empresa === "INSPROTEL" ? "INSPROTEL" : "GRUAS_THOMAS") as Empresa;
    this.assertEmpresaAccess(actor ?? null, emp);

    return v;
  }

  async ensureDocAccessOrThrow(docId: string, actor: ActorLike) {
    const doc = await this.prisma.vehicleDocument.findUnique({
      where: { id: docId },
      select: {
        id: true,
        vehicleId: true,
        vehicle: { select: { id: true, empresa: true as any, activo: true as any } },
      },
    });

    if (!doc) throw new NotFoundException("Documento no existe");
    if ((doc.vehicle as any)?.activo === false) throw new NotFoundException("Documento no existe");

    const emp =
      ((doc.vehicle as any)?.empresa === "INSPROTEL" ? "INSPROTEL" : "GRUAS_THOMAS") as Empresa;
    this.assertEmpresaAccess(actor ?? null, emp);

    return doc;
  }

  async ensureMaintenanceAccessOrThrow(maintenanceId: string, actor: ActorLike) {
    const m = await this.prisma.vehicleMaintenance.findUnique({
      where: { id: maintenanceId },
      select: {
        id: true,
        vehicleId: true,
        vehicle: { select: { id: true, empresa: true as any, activo: true as any } },
      },
    });

    if (!m) throw new NotFoundException("Mantención no existe");
    if ((m.vehicle as any)?.activo === false) throw new NotFoundException("Mantención no existe");

    const emp =
      ((m.vehicle as any)?.empresa === "INSPROTEL" ? "INSPROTEL" : "GRUAS_THOMAS") as Empresa;
    this.assertEmpresaAccess(actor ?? null, emp);

    return m;
  }

  async listWorkerVehicles(empresa: Empresa) {
    return this.prisma.vehicle.findMany({
      where: { empresa: empresa as any, activo: true as any },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        patente: true,
        marcaModelo: true,
        conductor: true,
        type: true,
        tipoVehiculo: true as any,
        year: true as any,
        empresa: true as any,
        estadoOperativo: true as any,
        activo: true as any,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  private normalizeEmpresaFilter(empresa?: EmpresaFilter): EmpresaFilter {
    if (!empresa || empresa === "ALL") return "ALL";
    if (empresa !== "GRUAS_THOMAS" && empresa !== "INSPROTEL") {
      throw new BadRequestException("empresa debe ser ALL, GRUAS_THOMAS o INSPROTEL");
    }
    return empresa;
  }

  private whereByEmpresa(empresa?: EmpresaFilter) {
    const emp = this.normalizeEmpresaFilter(empresa);
    if (emp === "ALL") return {};
    return { empresa: emp as any };
  }

  private whereOperativosOnly() {
    return { estadoOperativo: VehicleOperationalStatus.OPERATIVO as any };
  }

  private whereActivosOnly() {
    return { activo: true as any };
  }

  async searchSimple(params: { empresa: string; query: string; limit: number }) {
    const empresa = String(params?.empresa || "").toUpperCase();
    const query = String(params?.query || "").trim();
    const limit = Math.min(Math.max(Number(params?.limit || 8) || 8, 1), 30);

    if (empresa !== "GRUAS_THOMAS" && empresa !== "INSPROTEL") {
      throw new BadRequestException("empresa inválida");
    }
    if (!query) return [];

    return this.prisma.vehicle.findMany({
      where: {
        empresa: empresa as any,
        activo: true as any,
        patente: { contains: query, mode: "insensitive" },
      } as any,
      take: limit,
      orderBy: { patente: "asc" },
      select: {
        id: true,
        patente: true,
        empresa: true as any,
        marcaModelo: true,
        type: true,
        tipoVehiculo: true as any,
        year: true as any,
        estadoOperativo: true as any,
      },
    });
  }

  // ✅ FIX:
  // - SUPERADMIN / CONTROL_FLOTA => ven todo
  // - JEFE_TALLER / SUPERVISOR => ven todo para incidentes/taller
  // - resto => solo su empresa
  async list(actor: ActorLike = null) {
    if (this.isGlobalFleetRole(actor)) {
      return this.listInternalAll();
    }

    if (this.isWorkshopCrossCompanyViewer(actor)) {
      return this.listInternalAll();
    }

    if (this.isScopedFleetViewer(actor)) {
      const emp = await this.empresaFromActorOrThrow(actor);
      return this.listInternalByEmpresa(emp);
    }

    throw new ForbiddenException("No tienes permisos.");
  }

  private async listInternalAll() {
    const vehicles = await this.prisma.vehicle.findMany({
      where: { ...this.whereActivosOnly() } as any,
      orderBy: { createdAt: "desc" },
      include: {
        maintenances: {
          where: { fechaProxima: { not: null } },
          orderBy: { fechaProxima: "asc" },
          select: { id: true, fechaProxima: true },
        },
        documents: {
          orderBy: { fechaVencimiento: "asc" },
          select: { id: true, fechaVencimiento: true },
        },
      },
    });

    return this.mapVehiclesWithEstados(vehicles);
  }

  private async listInternalByEmpresa(empresa: Empresa) {
    const vehicles = await this.prisma.vehicle.findMany({
      where: { empresa: empresa as any, ...this.whereActivosOnly() } as any,
      orderBy: { createdAt: "desc" },
      include: {
        maintenances: {
          where: { fechaProxima: { not: null } },
          orderBy: { fechaProxima: "asc" },
          select: { id: true, fechaProxima: true },
        },
        documents: {
          orderBy: { fechaVencimiento: "asc" },
          select: { id: true, fechaVencimiento: true },
        },
      },
    });

    return this.mapVehiclesWithEstados(vehicles);
  }

  private mapVehiclesWithEstados(vehicles: any[]) {
    return vehicles.map((v) => {
      const next = v.maintenances?.[0] || null;
      const fechaProxima = next?.fechaProxima ?? null;
      const { estado: estadoMantenciones, detalle: detalleMantenciones } =
        calcEstadoByFechaProxima(fechaProxima);

      let docsCriticos = 0;
      let docsPorVencer = 0;

      for (const d of v.documents || []) {
        const est = calcEstadoByFechaVencimiento(d.fechaVencimiento ?? null);
        if (est === "VENCIDO") docsCriticos++;
        else if (est === "POR_VENCER") docsPorVencer++;
      }

      const estadoDocumentos = calcEstadoFromCounts(docsCriticos, docsPorVencer);
      const detalleDocumentos =
        estadoDocumentos === "VENCIDO"
          ? `Documentos vencidos: ${docsCriticos}`
          : estadoDocumentos === "POR_VENCER"
          ? `Documentos por vencer: ${docsPorVencer} (≤ 30 días)`
          : "Documentos al día";

      let maintCriticos = 0;
      let maintPorVencer = 0;

      for (const m of v.maintenances || []) {
        const est = calcEstadoByFechaProxima(m.fechaProxima ?? null).estado;
        if (est === "VENCIDO") maintCriticos++;
        else if (est === "POR_VENCER") maintPorVencer++;
      }

      const estadoGeneral = calcEstadoGeneral(estadoDocumentos, estadoMantenciones);

      const detalleGeneralParts: string[] = [];
      if (estadoGeneral === "VIGENTE") {
        detalleGeneralParts.push("Todo al día");
      } else {
        if (estadoDocumentos !== "VIGENTE") detalleGeneralParts.push(detalleDocumentos);
        if (estadoMantenciones !== "VIGENTE") detalleGeneralParts.push(detalleMantenciones);
        if (!detalleGeneralParts.length) detalleGeneralParts.push("Revisar vencimientos");
      }
      const detalleGeneral = detalleGeneralParts.join(" • ");

      return {
        id: v.id,
        empresa: (v as any).empresa ?? "GRUAS_THOMAS",
        patente: v.patente,
        marcaModelo: v.marcaModelo,
        conductor: v.conductor,
        type: v.type,
        tipoVehiculo: (v as any).tipoVehiculo ?? null,
        year: (v as any).year ?? null,
        activo: v.activo,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,

        estadoOperativo: (v as any).estadoOperativo ?? "OPERATIVO",

        estadoMantenciones,
        detalleMantenciones,
        estadoDocumentos,
        detalleDocumentos,

        estadoGeneral,
        detalleGeneral,

        estado: estadoGeneral,
        detalle: detalleGeneral,

        proximaMantencionISO: fechaProxima ? fechaProxima.toISOString() : null,

        docsCriticos,
        docsPorVencer,
        maintCriticos,
        maintPorVencer,
      };
    });
  }

  private empresaFilterByActor(actor: ActorLike, empresa: EmpresaFilter): EmpresaFilter {
    if (!this.isGlobalFleetRole(actor)) throw new ForbiddenException("No tienes permisos.");
    return this.normalizeEmpresaFilter(empresa);
  }

  async exportVehicles(actor: ActorLike, empresa: EmpresaFilter = "ALL") {
    const empFinal = this.empresaFilterByActor(actor, empresa);

    const vehicles = await this.prisma.vehicle.findMany({
      where: { ...this.whereByEmpresa(empFinal), ...this.whereActivosOnly() } as any,
      orderBy: { createdAt: "desc" },
      include: {
        maintenances: {
          where: { fechaProxima: { not: null } },
          orderBy: { fechaProxima: "asc" },
          select: { fechaProxima: true },
        },
        documents: {
          orderBy: { fechaVencimiento: "asc" },
          select: { fechaVencimiento: true },
        },
      },
    });

    return vehicles.map((v) => {
      const empresaCode: Empresa =
        ((v as any).empresa === "INSPROTEL" ? "INSPROTEL" : "GRUAS_THOMAS") as Empresa;

      const next = v.maintenances?.[0] || null;
      const fechaProxima = next?.fechaProxima ?? null;
      const { estado: estadoMantenciones, detalle: detalleMantenciones } =
        calcEstadoByFechaProxima(fechaProxima);

      let docsCriticos = 0;
      let docsPorVencer = 0;
      for (const d of v.documents || []) {
        const est = calcEstadoByFechaVencimiento(d.fechaVencimiento ?? null);
        if (est === "VENCIDO") docsCriticos++;
        else if (est === "POR_VENCER") docsPorVencer++;
      }
      const estadoDocumentos = calcEstadoFromCounts(docsCriticos, docsPorVencer);
      const detalleDocumentos =
        estadoDocumentos === "VENCIDO"
          ? `Documentos vencidos: ${docsCriticos}`
          : estadoDocumentos === "POR_VENCER"
          ? `Documentos por vencer: ${docsPorVencer} (≤ 30 días)`
          : "Documentos al día";

      let maintCriticos = 0;
      let maintPorVencer = 0;
      for (const m of v.maintenances || []) {
        const est = calcEstadoByFechaProxima(m.fechaProxima ?? null).estado;
        if (est === "VENCIDO") maintCriticos++;
        else if (est === "POR_VENCER") maintPorVencer++;
      }

      const estadoGeneral = calcEstadoGeneral(estadoDocumentos, estadoMantenciones);
      const detalleGeneralParts: string[] = [];
      if (estadoGeneral === "VIGENTE") {
        detalleGeneralParts.push("Todo al día");
      } else {
        if (estadoDocumentos !== "VIGENTE") detalleGeneralParts.push(detalleDocumentos);
        if (estadoMantenciones !== "VIGENTE") detalleGeneralParts.push(detalleMantenciones);
        if (!detalleGeneralParts.length) detalleGeneralParts.push("Revisar vencimientos");
      }
      const detalleGeneral = detalleGeneralParts.join(" • ");

      return {
        Empresa: empresaLabel(empresaCode),
        Patente: v.patente || "",
        MarcaModelo: v.marcaModelo || "",
        TipoVehiculo: (v as any).tipoVehiculo ?? "",
        Año: (v as any).year ?? "",
        EstadoOperativo: (v as any).estadoOperativo ?? "OPERATIVO",
        EstadoDocumentos: estadoLabel(estadoDocumentos),
        EstadoMantenciones: estadoLabel(estadoMantenciones),
        EstadoGeneral: estadoLabel(estadoGeneral),
        DetalleDocumentos: detalleDocumentos,
        DetalleMantenciones: detalleMantenciones,
        DetalleGeneral: detalleGeneral,
        Docs_Criticos: docsCriticos,
        Docs_Por_Vencer: docsPorVencer,
        Mant_Criticos: maintCriticos,
        Mant_Por_Vencer: maintPorVencer,
        Creado: v.createdAt ? v.createdAt.toISOString().slice(0, 10) : "",
      };
    });
  }

  async exportDocuments(actor: ActorLike, empresa: EmpresaFilter = "ALL") {
    const empFinal = this.empresaFilterByActor(actor, empresa);

    const docs = await this.prisma.vehicleDocument.findMany({
      where:
        empFinal === "ALL"
          ? ({ vehicle: { ...this.whereActivosOnly() } } as any)
          : ({ vehicle: { empresa: empFinal as any, ...this.whereActivosOnly() } } as any),
      include: {
        vehicle: {
          select: {
            patente: true,
            marcaModelo: true,
            empresa: true as any,
            estadoOperativo: true as any,
            activo: true as any,
          },
        },
      },
      orderBy: [{ fechaVencimiento: "asc" }, { createdAt: "desc" }],
    });

    return docs.map((d) => {
      const empresaCode: Empresa =
        ((d.vehicle as any)?.empresa === "INSPROTEL" ? "INSPROTEL" : "GRUAS_THOMAS") as Empresa;

      const fecha = d.fechaVencimiento ?? null;

      return {
        Empresa: empresaLabel(empresaCode),
        Patente: d.vehicle?.patente || "",
        MarcaModelo: d.vehicle?.marcaModelo || "",
        EstadoOperativo: (d.vehicle as any)?.estadoOperativo ?? "OPERATIVO",
        NombreDocumento: d.nombre || "",
        FechaVencimiento: fecha ? fecha.toISOString().slice(0, 10) : "",
        NombreArchivo: (d as any).originalName ?? "",
        Creado: d.createdAt ? d.createdAt.toISOString().slice(0, 10) : "",
      };
    });
  }

  async exportMaintenances(actor: ActorLike, empresa: EmpresaFilter = "ALL") {
    const empFinal = this.empresaFilterByActor(actor, empresa);

    const maints = await this.prisma.vehicleMaintenance.findMany({
      where:
        empFinal === "ALL"
          ? ({ vehicle: { ...this.whereActivosOnly() } } as any)
          : ({ vehicle: { empresa: empFinal as any, ...this.whereActivosOnly() } } as any),
      include: {
        vehicle: {
          select: {
            patente: true,
            marcaModelo: true,
            empresa: true as any,
            estadoOperativo: true as any,
            activo: true as any,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    });

    return maints.map((m) => {
      const empresaCode: Empresa =
        ((m.vehicle as any)?.empresa === "INSPROTEL" ? "INSPROTEL" : "GRUAS_THOMAS") as Empresa;

      return {
        Empresa: empresaLabel(empresaCode),
        Patente: m.vehicle?.patente || "",
        MarcaModelo: m.vehicle?.marcaModelo || "",
        EstadoOperativo: (m.vehicle as any)?.estadoOperativo ?? "OPERATIVO",
        NombreMantencion: m.nombre || "",
        FechaRealizada: m.fechaRealizada ? m.fechaRealizada.toISOString().slice(0, 10) : "",
        NombreArchivo: (m as any).originalName ?? "",
        Creado: m.createdAt ? m.createdAt.toISOString().slice(0, 10) : "",
      };
    });
  }

  async listDocsExpirations(
    actor: ActorLike,
    status: "VENCIDO" | "POR_VENCER",
    empresa: EmpresaFilter = "ALL"
  ) {
    this.empresaFilterByActor(actor, empresa);

    const empFinal = this.normalizeEmpresaFilter(empresa);

    const docs = await this.prisma.vehicleDocument.findMany({
      where: {
        vehicle: {
          ...(empFinal === "ALL" ? {} : { empresa: empFinal as any }),
          ...this.whereOperativosOnly(),
          ...this.whereActivosOnly(),
        },
      } as any,
      include: {
        vehicle: {
          select: {
            id: true,
            patente: true,
            marcaModelo: true,
            empresa: true as any,
            estadoOperativo: true as any,
            activo: true as any,
          },
        },
      },
      orderBy: { fechaVencimiento: "asc" },
    });

    const filtered = docs
      .map((d) => {
        const est = calcEstadoByFechaVencimiento(d.fechaVencimiento ?? null);
        const diff = d.fechaVencimiento ? diffDaysFromToday(d.fechaVencimiento) : null;

        return {
          kind: "DOCUMENT",
          estado: est,
          diffDays: diff,
          id: d.id,
          vehicleId: d.vehicleId,
          type: d.type,
          nombre: d.nombre,
          fechaVencimiento: d.fechaVencimiento,
          observacion: d.observacion,
          archivoUrl: d.archivoUrl,
          vehicle: {
            id: d.vehicle?.id,
            patente: d.vehicle?.patente,
            marcaModelo: d.vehicle?.marcaModelo,
            empresa: (d.vehicle as any)?.empresa ?? "GRUAS_THOMAS",
            estadoOperativo: (d.vehicle as any)?.estadoOperativo ?? "OPERATIVO",
          },
        };
      })
      .filter((x) => x.estado === status);

    filtered.sort((a, b) => (a.diffDays ?? 999999) - (b.diffDays ?? 999999));
    return filtered;
  }

  async listMaintExpirations(
    actor: ActorLike,
    status: "VENCIDO" | "POR_VENCER",
    empresa: EmpresaFilter = "ALL"
  ) {
    this.empresaFilterByActor(actor, empresa);

    const empFinal = this.normalizeEmpresaFilter(empresa);

    const maints = await this.prisma.vehicleMaintenance.findMany({
      where: {
        fechaProxima: { not: null },
        vehicle: {
          ...(empFinal === "ALL" ? {} : { empresa: empFinal as any }),
          ...this.whereOperativosOnly(),
          ...this.whereActivosOnly(),
        },
      } as any,
      include: {
        vehicle: {
          select: {
            id: true,
            patente: true,
            marcaModelo: true,
            empresa: true as any,
            estadoOperativo: true as any,
            activo: true as any,
          },
        },
      },
      orderBy: { fechaProxima: "asc" },
    });

    const filtered = maints
      .map((m) => {
        const { estado } = calcEstadoByFechaProxima(m.fechaProxima ?? null);
        const diff = m.fechaProxima ? diffDaysFromToday(m.fechaProxima) : null;

        return {
          kind: "MAINTENANCE",
          estado,
          diffDays: diff,
          id: m.id,
          vehicleId: m.vehicleId,
          type: m.type,
          nombre: m.nombre,
          fechaRealizada: m.fechaRealizada,
          fechaProxima: m.fechaProxima,
          observacion: m.observacion,
          archivoUrl: m.archivoUrl,
          vehicle: {
            id: m.vehicle?.id,
            patente: m.vehicle?.patente,
            marcaModelo: m.vehicle?.marcaModelo,
            empresa: (m.vehicle as any)?.empresa ?? "GRUAS_THOMAS",
            estadoOperativo: (m.vehicle as any)?.estadoOperativo ?? "OPERATIVO",
          },
        };
      })
      .filter((x) => x.estado === status);

    filtered.sort((a, b) => (a.diffDays ?? 999999) - (b.diffDays ?? 999999));
    return filtered;
  }

  async summary(actor: ActorLike) {
    if (!this.isGlobalFleetRole(actor)) throw new ForbiddenException("No tienes permisos.");

    const vehicles = await this.prisma.vehicle.findMany({
      where: { ...this.whereOperativosOnly(), ...this.whereActivosOnly() } as any,
      select: {
        id: true,
        maintenances: {
          where: { fechaProxima: { not: null } },
          orderBy: { fechaProxima: "asc" },
          take: 1,
          select: { fechaProxima: true },
        },
      },
    });

    let criticos = 0;
    let porVencer = 0;
    let vigentes = 0;

    for (const v of vehicles) {
      const next = v.maintenances?.[0] || null;
      const { estado } = calcEstadoByFechaProxima(next?.fechaProxima ?? null);
      if (estado === "VENCIDO") criticos++;
      else if (estado === "POR_VENCER") porVencer++;
      else vigentes++;
    }

    return { total: vehicles.length, criticos, porVencer, vigentes };
  }

  async setOperationalStatus(
    vehicleId: string,
    status: VehicleOperationalStatus,
    actor?: ActorLike
  ) {
    if (!this.isGlobalFleetRole(actor ?? null)) {
      throw new ForbiddenException("No tienes permisos.");
    }

    if (
      status !== VehicleOperationalStatus.OPERATIVO &&
      status !== VehicleOperationalStatus.EN_PANA &&
      status !== VehicleOperationalStatus.PARADO
    ) {
      throw new BadRequestException("status debe ser OPERATIVO, EN_PANA o PARADO");
    }

    const current = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!current) throw new NotFoundException("Vehículo no encontrado");
    if ((current as any).activo === false) {
      throw new BadRequestException("Este vehículo está eliminado (inactivo).");
    }

    const updated = await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: { estadoOperativo: status } as any,
    });

    await this.audit.log({
      entity: AuditEntity.VEHICLE,
      entityId: vehicleId,
      action: AuditAction.UPDATE,
      actor: safeActor(actor),
      meta: {
        title: "Cambió estado operativo",
        targetLabel: current.patente,
        before: { estadoOperativo: (current as any).estadoOperativo ?? "OPERATIVO" },
        after: { estadoOperativo: (updated as any).estadoOperativo ?? "OPERATIVO" },
      },
    });

    return updated;
  }

  async create(dto: CreateVehicleDto, actor?: ActorLike) {
    if (!this.isGlobalFleetRole(actor ?? null)) {
      throw new ForbiddenException("No tienes permisos.");
    }

    const patente = sTrim(dto.patente).toUpperCase();
    if (!patente) throw new BadRequestException("Patente es obligatoria");

    const mm1 = sTrim(dto.marcaModelo);
    const marca = sTrim(dto.marca);
    const modelo = sTrim(dto.modelo);
    const marcaModeloFinal = (mm1 || `${marca} ${modelo}`.trim() || "SIN MARCA/MODELO").trim();

    const exists = await this.prisma.vehicle.findUnique({ where: { patente } });
    if (exists && (exists as any).activo !== false) {
      throw new BadRequestException("Ya existe un vehículo con esa patente");
    }
    if (exists && (exists as any).activo === false) {
      throw new BadRequestException(
        "Existe un vehículo eliminado (inactivo) con esa patente. Contacta al SUPERADMIN."
      );
    }

    const emp: Empresa = dto.empresa === "INSPROTEL" ? "INSPROTEL" : "GRUAS_THOMAS";
    const estadoOperativo = dto.estadoOperativo ?? VehicleOperationalStatus.OPERATIVO;

    const created = await this.prisma.vehicle.create({
      data: {
        empresa: emp as any,
        patente,
        marcaModelo: marcaModeloFinal,
        conductor: sTrim(dto.conductor) || null,
        type: dto.type || VehicleType.CAMION,
        tipoVehiculo: sTrim(dto.tipoVehiculo) || null,
        year: dto.year ?? null,
        estadoOperativo: estadoOperativo as any,
        activo: true as any,
      } as any,
    });

    await this.audit.log({
      entity: AuditEntity.VEHICLE,
      entityId: created.id,
      action: AuditAction.CREATE,
      actor: safeActor(actor),
      meta: { title: "Creó Camión", targetLabel: created.patente },
    });

    return created;
  }

  async update(id: string, dto: UpdateVehicleDto, actor?: ActorLike) {
    if (!this.isGlobalFleetRole(actor ?? null)) {
      throw new ForbiddenException("No tienes permisos.");
    }

    const current = await this.prisma.vehicle.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Vehículo no encontrado");
    if ((current as any).activo === false) {
      throw new BadRequestException("Este vehículo está eliminado (inactivo).");
    }

    const nextPatente = dto.patente ? sTrim(dto.patente).toUpperCase() : current.patente;

    const mmIncoming = dto.marcaModelo !== undefined ? sTrim(dto.marcaModelo) : undefined;
    const marcaIncoming = dto.marca !== undefined ? sTrim(dto.marca) : undefined;
    const modeloIncoming = dto.modelo !== undefined ? sTrim(dto.modelo) : undefined;

    let nextMarcaModelo = current.marcaModelo;

    if (mmIncoming !== undefined) {
      if (mmIncoming) nextMarcaModelo = mmIncoming;
    } else if (marcaIncoming !== undefined || modeloIncoming !== undefined) {
      const marca = marcaIncoming ?? "";
      const modelo = modeloIncoming ?? "";
      const built = `${marca} ${modelo}`.trim();
      if (built) nextMarcaModelo = built;
    }

    const nextConductor =
      dto.conductor !== undefined ? sTrim(dto.conductor) || null : current.conductor;

    const nextType = dto.type || current.type;

    const nextTipoVehiculo =
      dto.tipoVehiculo !== undefined
        ? dto.tipoVehiculo
          ? dto.tipoVehiculo.trim()
          : null
        : (current as any).tipoVehiculo;

    const nextYear = dto.year === undefined ? (current as any).year : dto.year;

    let nextEmpresa: Empresa =
      (current as any).empresa === "INSPROTEL" ? "INSPROTEL" : "GRUAS_THOMAS";
    if (dto.empresa !== undefined) {
      nextEmpresa = dto.empresa === "INSPROTEL" ? "INSPROTEL" : "GRUAS_THOMAS";
    }

    const nextEstadoOperativo =
      dto.estadoOperativo !== undefined
        ? dto.estadoOperativo
        : ((current as any).estadoOperativo ?? VehicleOperationalStatus.OPERATIVO);

    if (nextPatente !== current.patente) {
      const exists = await this.prisma.vehicle.findUnique({ where: { patente: nextPatente } });
      if (exists) throw new BadRequestException("Ya existe un vehículo con esa patente");
    }

    const updated = await this.prisma.vehicle.update({
      where: { id },
      data: {
        empresa: nextEmpresa as any,
        patente: nextPatente,
        marcaModelo: nextMarcaModelo,
        conductor: nextConductor,
        type: nextType,
        tipoVehiculo: nextTipoVehiculo,
        year: nextYear,
        estadoOperativo: nextEstadoOperativo as any,
      } as any,
    });

    await this.audit.log({
      entity: AuditEntity.VEHICLE,
      entityId: updated.id,
      action: AuditAction.UPDATE,
      actor: safeActor(actor),
      meta: { title: "Editó Camión", targetLabel: updated.patente },
    });

    return updated;
  }

  async remove(id: string, actor?: ActorLike) {
    if (!this.isGlobalFleetRole(actor ?? null)) {
      throw new ForbiddenException("No tienes permisos.");
    }

    const current = await this.prisma.vehicle.findUnique({
      where: { id },
      include: {
        documents: { select: { id: true, type: true, nombre: true, fechaVencimiento: true } },
        maintenances: {
          select: { id: true, type: true, nombre: true, fechaRealizada: true, fechaProxima: true },
        },
      },
    });

    if (!current) throw new NotFoundException("Vehículo no encontrado");

    if ((current as any).activo === false) {
      return { ok: true, message: "Vehículo ya estaba eliminado (inactivo)." };
    }

    const updated = await this.prisma.vehicle.update({
      where: { id },
      data: { activo: false as any } as any,
    });

    await this.audit.log({
      entity: AuditEntity.VEHICLE,
      entityId: id,
      action: AuditAction.DELETE,
      actor: safeActor(actor),
      meta: {
        title: "Eliminó Camión (respaldo)",
        targetLabel: current.patente,
        before: {
          id: current.id,
          empresa: (current as any).empresa ?? null,
          patente: current.patente,
          marcaModelo: current.marcaModelo,
          conductor: current.conductor ?? null,
          type: current.type ?? null,
          tipoVehiculo: (current as any).tipoVehiculo ?? null,
          year: (current as any).year ?? null,
          estadoOperativo: (current as any).estadoOperativo ?? null,
          activo: (current as any).activo ?? null,
          documents: (current as any).documents ?? [],
          maintenances: (current as any).maintenances ?? [],
        },
        after: {
          id: updated.id,
          activo: (updated as any).activo ?? false,
        },
      },
    });

    return { ok: true };
  }

  async listDeleted(actor?: ActorLike) {
    if (!this.isGlobalFleetRole(actor ?? null)) {
      throw new ForbiddenException("No tienes permisos.");
    }

    const items = await this.prisma.vehicle.findMany({
      where: { activo: false as any },
      orderBy: { updatedAt: "desc" },
      include: {
        documents: {
          orderBy: { createdAt: "desc" },
          select: { id: true, type: true, nombre: true, fechaVencimiento: true },
        },
        maintenances: {
          orderBy: { createdAt: "desc" },
          select: { id: true, type: true, nombre: true, fechaRealizada: true, fechaProxima: true },
        },
      },
    });

    return { items };
  }

  async restore(id: string, actor?: ActorLike) {
    if (!this.isGlobalFleetRole(actor ?? null)) {
      throw new ForbiddenException("No tienes permisos.");
    }

    const current = await this.prisma.vehicle.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Vehículo no encontrado");

    if ((current as any).activo === true) {
      return { ok: true, message: "Vehículo ya estaba activo." };
    }

    const updated = await this.prisma.vehicle.update({
      where: { id },
      data: { activo: true as any } as any,
    });

    await this.audit.log({
      entity: AuditEntity.VEHICLE,
      entityId: id,
      action: AuditAction.UPDATE,
      actor: safeActor(actor),
      meta: {
        title: "Restauró Camión",
        targetLabel: current.patente,
        before: { activo: false },
        after: { activo: true },
      },
    });

    return { ok: true, vehicle: updated };
  }
}































