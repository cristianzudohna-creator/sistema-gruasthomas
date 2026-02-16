// ✅ Archivo: src/alerts/alerts.service.ts (COMPLETO)
import { Injectable } from "@nestjs/common";
import {
  PrismaService,
} from "../prisma/prisma.service";
import {
  VehicleOperationalStatus,
  AlertKind, // ✅ IMPORTANTE: enum Prisma
} from "@prisma/client";

export type ExpirationItem = {
  id: string; // ✅ id del doc/mantención para dedupe
  kind: AlertKind; // ✅ enum (DOCUMENT | MAINTENANCE)
  empresa: string;
  patente: string;
  type: string; // enum string (SOAP, REVISION_TECNICA, CAMBIO_ACEITE, etc.)
  nombre?: string | null;
  dueDate: Date;
  daysLeft: number;
};

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function calcDaysLeft(today: Date, due: Date) {
  const t = startOfDay(today).getTime();
  const v = startOfDay(due).getTime();
  return Math.round((v - t) / (1000 * 60 * 60 * 24));
}

function fmtDateCL(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear());
  return `${dd}/${mm}/${yy}`;
}

function cleanStr(v: any): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

/** Si el prefix viene técnico tipo "[ALERTA ...]" lo ignoramos y usamos uno corporativo */
function normalizeSubjectPrefix(v: string | null) {
  const s = cleanStr(v);
  if (!s) return null;
  const looksTechnical = s.startsWith("[") && s.includes("]");
  return looksTechnical ? null : s;
}

function urgencyMeta(daysLeft: number) {
  // 0..7 crítico, 8..15 próximo, >15 normal
  if (daysLeft <= 7) {
    return {
      label: "Crítico",
      badgeBg: "#FEE2E2",
      badgeBd: "#FCA5A5",
      badgeTx: "#991B1B",
      rowBg: "#FFF5F5",
    };
  }
  if (daysLeft <= 15) {
    return {
      label: "Próximo",
      badgeBg: "#FFEDD5",
      badgeBd: "#FDBA74",
      badgeTx: "#9A3412",
      rowBg: "#FFFBF5",
    };
  }
  return {
    label: "Normal",
    badgeBg: "#E5E7EB",
    badgeBd: "#D1D5DB",
    badgeTx: "#111827",
    rowBg: "#FFFFFF",
  };
}

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * ✅ Decide destinatario según modo:
   * - prod  -> ALERT_TO
   * - test  -> ALERT_TEST_TO (fallback: SMTP_TEST_TO, SMTP_USER)
   */
  resolveRecipient(mode: "prod" | "test"): string {
    const prodTo = cleanStr(process.env.ALERT_TO) || "controlflota@gruasthomas.cl";

    const testTo =
      cleanStr(process.env.ALERT_TEST_TO) ||
      cleanStr(process.env.SMTP_TEST_TO) ||
      cleanStr(process.env.SMTP_USER) ||
      prodTo;

    return mode === "test" ? testTo : prodTo;
  }

  /**
   * ✅ Subject formal
   * ✅ (próximos X días) en vez de <= X
   */
  buildSubject(daysBefore: number) {
    const envPrefix = normalizeSubjectPrefix(process.env.ALERT_SUBJECT_PREFIX || null);

    const base = envPrefix || "Aviso de vencimientos próximos – Sistema Control de Flota";

    return `${base} (próximos ${daysBefore} días)`;
  }

  // ======================================================
  // ✅ SOLO VENCIMIENTOS EXACTOS A N DÍAS
  // ======================================================

  /**
   * Devuelve items cuya fecha de vencimiento sea EXACTAMENTE hoy + thresholdDays.
   * Ej: thresholdDays=30 => vencen el día (hoy+30).
   */
  async getExpirationsExact(
    thresholdDays: number
  ): Promise<{ from: Date; to: Date; items: ExpirationItem[] }> {
    const today = startOfDay(new Date());

    // ventana exacta: [targetDay, targetDay + 1 día)
    const target = addDays(today, thresholdDays);
    const targetEndExclusive = addDays(today, thresholdDays + 1);

    const docs = await this.prisma.vehicleDocument.findMany({
      where: {
        fechaVencimiento: { not: null, gte: target, lt: targetEndExclusive },
        vehicle: {
          activo: true,
          estadoOperativo: VehicleOperationalStatus.OPERATIVO,
        },
      },
      include: {
        vehicle: { select: { patente: true, empresa: true } },
      },
      orderBy: { fechaVencimiento: "asc" },
      take: 500,
    });

    const maints = await this.prisma.vehicleMaintenance.findMany({
      where: {
        fechaProxima: { not: null, gte: target, lt: targetEndExclusive },
        vehicle: {
          activo: true,
          estadoOperativo: VehicleOperationalStatus.OPERATIVO,
        },
      },
      include: {
        vehicle: { select: { patente: true, empresa: true } },
      },
      orderBy: { fechaProxima: "asc" },
      take: 500,
    });

    const docItems: ExpirationItem[] = docs
      .filter((d) => d.fechaVencimiento)
      .map((d) => ({
        id: d.id,
        kind: AlertKind.DOCUMENT, // ✅ enum
        empresa: String(d.vehicle?.empresa || "—"),
        patente: String(d.vehicle?.patente || "—"),
        type: String(d.type),
        nombre: d.nombre ?? null,
        dueDate: d.fechaVencimiento as Date,
        daysLeft: calcDaysLeft(today, d.fechaVencimiento as Date),
      }));

    const maintItems: ExpirationItem[] = maints
      .filter((m) => m.fechaProxima)
      .map((m) => ({
        id: m.id,
        kind: AlertKind.MAINTENANCE, // ✅ enum
        empresa: String(m.vehicle?.empresa || "—"),
        patente: String(m.vehicle?.patente || "—"),
        type: String(m.type),
        nombre: m.nombre ?? null,
        dueDate: m.fechaProxima as Date,
        daysLeft: calcDaysLeft(today, m.fechaProxima as Date),
      }));

    const items = [...docItems, ...maintItems].sort((a, b) => {
      const da = a.dueDate.getTime();
      const db = b.dueDate.getTime();
      if (da !== db) return da - db;
      return a.patente.localeCompare(b.patente);
    });

    return { from: target, to: addDays(target, 1), items };
  }

  /**
   * ✅ Filtra items que YA fueron enviados para thresholdDays
   */
  private async filterAlreadyDispatched(items: ExpirationItem[], thresholdDays: number) {
    if (!items.length) return [];

    const docIds = items.filter((i) => i.kind === AlertKind.DOCUMENT).map((i) => i.id);
    const maintIds = items.filter((i) => i.kind === AlertKind.MAINTENANCE).map((i) => i.id);

    const logs = await this.prisma.alertDispatchLog.findMany({
      where: {
        thresholdDays,
        OR: [
          ...(docIds.length
            ? [{ kind: AlertKind.DOCUMENT, entityId: { in: docIds } }]
            : []),
          ...(maintIds.length
            ? [{ kind: AlertKind.MAINTENANCE, entityId: { in: maintIds } }]
            : []),
        ],
      },
      select: { kind: true, entityId: true },
      take: 5000,
    });

    const sentSet = new Set(logs.map((l) => `${l.kind}:${l.entityId}`));

    return items.filter((i) => !sentSet.has(`${i.kind}:${i.id}`));
  }

  /**
   * ✅ Marca como enviados (skipDuplicates evita choques)
   */
  async markDispatched(params: {
    items: ExpirationItem[];
    thresholdDays: number;
    recipient: string;
    subject: string;
    messageId?: string | null;
  }) {
    const { items, thresholdDays, recipient, subject, messageId } = params;
    if (!items.length) return { ok: true, created: 0 };

    const data = items.map((i) => ({
      kind: i.kind, // ✅ enum directo
      entityId: i.id,
      thresholdDays,
      recipient,
      subject,
      messageId: messageId || null,
    }));

    const r = await this.prisma.alertDispatchLog.createMany({
      data,
      skipDuplicates: true,
    });

    return { ok: true, created: r.count };
  }

  // ======================================================
  // ✅ HTML FORMAL
  // ======================================================

  buildEmailHtml(payload: {
    from: Date;
    to: Date;
    daysBefore: number;
    items: ExpirationItem[];
  }) {
    const { from, to, daysBefore, items } = payload;

    const docs = items.filter((x) => x.kind === AlertKind.DOCUMENT);
    const maints = items.filter((x) => x.kind === AlertKind.MAINTENANCE);

    const displayName = (i: ExpirationItem) => cleanStr(i.nombre) || cleanStr(i.type) || "—";

    const row = (i: ExpirationItem) => {
      const u = urgencyMeta(i.daysLeft);
      return `
        <tr style="background:${u.rowBg}">
          <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;font-weight:700;color:#111827;">
            ${i.patente}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;color:#111827;">
            ${displayName(i)}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;color:#111827;white-space:nowrap;">
            ${fmtDateCL(new Date(i.dueDate))}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;text-align:right;white-space:nowrap;">
            <span style="
              display:inline-block;
              padding:2px 8px;
              border-radius:999px;
              background:${u.badgeBg};
              border:1px solid ${u.badgeBd};
              color:${u.badgeTx};
              font-size:12px;
              font-weight:700;
              margin-right:8px;
              vertical-align:middle;
            ">${u.label}</span>
            <span style="font-weight:800;color:#111827;">${i.daysLeft}</span>
            <span style="color:#6B7280;font-weight:600;"> días</span>
          </td>
        </tr>
      `;
    };

    const table = (title: string, list: ExpirationItem[]) => `
      <div style="margin-top:18px;">
        <div style="font-size:16px;font-weight:800;color:#111827;margin:0 0 10px;">
          ${title} (${list.length})
        </div>

        ${
          list.length === 0
            ? `<div style="color:#6B7280;font-size:14px;">No hay vencimientos dentro del rango indicado.</div>`
            : `
          <table style="width:100%;border-collapse:separate;border-spacing:0;overflow:hidden;border:1px solid #E5E7EB;border-radius:12px;">
            <thead>
              <tr style="background:#F9FAFB;">
                <th style="text-align:left;padding:10px 12px;border-bottom:1px solid #E5E7EB;color:#374151;font-size:13px;">Patente</th>
                <th style="text-align:left;padding:10px 12px;border-bottom:1px solid #E5E7EB;color:#374151;font-size:13px;">Documento / Mantención</th>
                <th style="text-align:left;padding:10px 12px;border-bottom:1px solid #E5E7EB;color:#374151;font-size:13px;">Fecha de vencimiento</th>
                <th style="text-align:right;padding:10px 12px;border-bottom:1px solid #E5E7EB;color:#374151;font-size:13px;">Días restantes</th>
              </tr>
            </thead>
            <tbody>
              ${list.map(row).join("")}
            </tbody>
          </table>
        `
        }
      </div>
    `;

    return `
      <div style="background:#F3F4F6;padding:24px;">
        <div style="max-width:900px;margin:0 auto;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:16px;overflow:hidden;">
          <div style="padding:22px 22px 16px;">
            <div style="font-size:22px;font-weight:900;color:#111827;line-height:1.2;">
              Grúas Thomas
            </div>
            <div style="font-size:13px;color:#6B7280;margin-top:2px;">
              Sistema de Control de Flota
            </div>
            <div style="height:1px;background:#E5E7EB;margin:16px 0;"></div>

            <div style="display:flex;gap:10px;align-items:center;">
              <div style="font-size:20px;">⚠️</div>
              <div style="font-size:20px;font-weight:900;color:#111827;">
                Aviso de vencimientos próximos
              </div>
            </div>

            <div style="margin-top:10px;color:#374151;font-size:14px;line-height:1.5;">
              Este informe muestra documentos y mantenciones que vencen en el día correspondiente a <b>${daysBefore}</b> días desde hoy.
              <div style="margin-top:6px;color:#6B7280;">
                <b>Fecha evaluada:</b> ${fmtDateCL(from)}
              </div>
            </div>

            ${table("Documentos", docs)}
            ${table("Mantenciones", maints)}

            <div style="margin-top:18px;color:#6B7280;font-size:12px;line-height:1.4;">
              * No se incluyen vehículos EN_PANA/PARADO ni inactivos.<br/>
              * Prioridad: <b>Crítico</b> (0–7 días), <b>Próximo</b> (8–15 días), <b>Normal</b> (&gt; 15 días).
            </div>
          </div>

          <div style="padding:14px 22px;background:#F9FAFB;border-top:1px solid #E5E7EB;color:#9CA3AF;font-size:12px;">
            Este correo fue generado automáticamente por el Sistema de Control de Flota.
          </div>
        </div>
      </div>
    `;
  }

  /**
   * ✅ Método “listo para enviar”:
   * - toma thresholdDays (30/15/7)
   * - trae vencimientos EXACTOS
   * - quita los ya enviados
   */
  async getExactAndUnsent(thresholdDays: number) {
    const data = await this.getExpirationsExact(thresholdDays);
    const unsent = await this.filterAlreadyDispatched(data.items, thresholdDays);
    return { ...data, items: unsent };
  }
}







