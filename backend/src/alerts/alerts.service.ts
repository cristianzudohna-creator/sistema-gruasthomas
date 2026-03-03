import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { VehicleOperationalStatus, AlertKind } from "@prisma/client";

export type ExpirationItem = {
  id: string; // ✅ id para dedupe (doc/mant) o "vehicleId:target" para horómetro
  kind: AlertKind; // ✅ DOCUMENT | MAINTENANCE | HOROMETER

  empresa: string;
  patente: string;

  type: string;
  nombre?: string | null;

  // ✅ Docs/Mants:
  dueDate?: Date | null;
  daysLeft?: number | null;

  // ✅ Horómetro:
  currentHours?: number | null;
  targetHours?: number | null;
  hoursLeft?: number | null;
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

function urgencyMetaDays(daysLeft: number) {
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

function urgencyMetaHours(hoursLeft: number) {
  if (hoursLeft <= 10) {
    return {
      label: "Crítico",
      badgeBg: "#FEE2E2",
      badgeBd: "#FCA5A5",
      badgeTx: "#991B1B",
      rowBg: "#FFF5F5",
    };
  }
  if (hoursLeft <= 25) {
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

function nextMultiple(n: number, step: number) {
  if (step <= 0) return n;
  // si está exacto en múltiplo, el siguiente es step más
  if (n % step === 0) return n + step;
  return Math.ceil(n / step) * step;
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

  buildSubject(daysBefore: number) {
    const envPrefix = normalizeSubjectPrefix(process.env.ALERT_SUBJECT_PREFIX || null);
    const base = envPrefix || "Aviso de vencimientos próximos – Sistema Control de Flota";
    return `${base} (próximos ${daysBefore} días)`;
  }

  buildHorometerSubject(hoursBefore: number) {
    const envPrefix = normalizeSubjectPrefix(process.env.ALERT_SUBJECT_PREFIX || null);
    const base = envPrefix || "Aviso de horómetro – Sistema Control de Flota";
    const step = Number(process.env.HOROMETER_STEP_HOURS || 500) || 500;
    return `${base} (faltan ${hoursBefore} horas para ${step})`;
  }

  // ======================================================
  // ✅ VENCIMIENTOS EXACTOS A N DÍAS (Docs + Mantenciones)
  // ======================================================
  async getExpirationsExact(
    thresholdDays: number
  ): Promise<{ from: Date; to: Date; items: ExpirationItem[] }> {
    const today = startOfDay(new Date());

    const target = addDays(today, thresholdDays);
    const targetEndExclusive = addDays(today, thresholdDays + 1);

    const docs = await this.prisma.vehicleDocument.findMany({
      where: {
        fechaVencimiento: { not: null, gte: target, lt: targetEndExclusive },
        vehicle: { activo: true, estadoOperativo: VehicleOperationalStatus.OPERATIVO },
      },
      include: { vehicle: { select: { patente: true, empresa: true } } },
      orderBy: { fechaVencimiento: "asc" },
      take: 500,
    });

    const maints = await this.prisma.vehicleMaintenance.findMany({
      where: {
        fechaProxima: { not: null, gte: target, lt: targetEndExclusive },
        vehicle: { activo: true, estadoOperativo: VehicleOperationalStatus.OPERATIVO },
      },
      include: { vehicle: { select: { patente: true, empresa: true } } },
      orderBy: { fechaProxima: "asc" },
      take: 500,
    });

    const docItems: ExpirationItem[] = docs
      .filter((d) => d.fechaVencimiento)
      .map((d) => ({
        id: d.id,
        kind: AlertKind.DOCUMENT,
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
        kind: AlertKind.MAINTENANCE,
        empresa: String(m.vehicle?.empresa || "—"),
        patente: String(m.vehicle?.patente || "—"),
        type: String(m.type),
        nombre: m.nombre ?? null,
        dueDate: m.fechaProxima as Date,
        daysLeft: calcDaysLeft(today, m.fechaProxima as Date),
      }));

    const items = [...docItems, ...maintItems].sort((a, b) => {
      const da = (a.dueDate ?? today).getTime();
      const db = (b.dueDate ?? today).getTime();
      if (da !== db) return da - db;
      return a.patente.localeCompare(b.patente);
    });

    return { from: target, to: addDays(target, 1), items };
  }

  // ======================================================
  // ✅ HORÓMETRO: alertas por horas antes de múltiplo 500
  // ======================================================
  async getHorometerExact(
    thresholdHours: number
  ): Promise<{ items: ExpirationItem[] }> {
    const step = Number(process.env.HOROMETER_STEP_HOURS || 500) || 500;

    // ✅ último registro por vehículo (distinct)
    const last = await this.prisma.horometerRecord.findMany({
      where: {
        vehicle: { activo: true, estadoOperativo: VehicleOperationalStatus.OPERATIVO },
      },
      orderBy: { createdAt: "desc" },
      distinct: ["vehicleId"],
      include: { vehicle: { select: { id: true, patente: true, empresa: true } } },
      take: 2000,
    });

    const items: ExpirationItem[] = [];

    for (const r of last) {
      const h = Number((r as any).horas ?? 0);
      const target = nextMultiple(h, step);
      const left = target - h;

      if (left === thresholdHours) {
        const vehicleId = (r as any).vehicleId || (r as any)?.vehicle?.id;
        const dedupeId = `${vehicleId}:${target}`;

        items.push({
          id: dedupeId,
          kind: AlertKind.HOROMETER,
          empresa: String((r as any)?.vehicle?.empresa || "—"),
          patente: String((r as any)?.vehicle?.patente || "—"),
          type: `HOROMETER_${step}`,
          nombre: "Horómetro",
          dueDate: null,
          daysLeft: null,
          currentHours: h,
          targetHours: target,
          hoursLeft: left,
        });
      }
    }

    items.sort((a, b) => a.patente.localeCompare(b.patente));
    return { items };
  }

  /**
   * ✅ Filtra items que YA fueron enviados para threshold (días u horas)
   * Nota: reutilizamos thresholdDays para horas también
   */
  private async filterAlreadyDispatched(items: ExpirationItem[], threshold: number) {
    if (!items.length) return [];

    const byKind = (k: AlertKind) => items.filter((i) => i.kind === k).map((i) => i.id);

    const docIds = byKind(AlertKind.DOCUMENT);
    const maintIds = byKind(AlertKind.MAINTENANCE);
    const horIds = byKind(AlertKind.HOROMETER);

    const logs = await this.prisma.alertDispatchLog.findMany({
      where: {
        thresholdDays: threshold,
        OR: [
          ...(docIds.length ? [{ kind: AlertKind.DOCUMENT, entityId: { in: docIds } }] : []),
          ...(maintIds.length ? [{ kind: AlertKind.MAINTENANCE, entityId: { in: maintIds } }] : []),
          ...(horIds.length ? [{ kind: AlertKind.HOROMETER, entityId: { in: horIds } }] : []),
        ],
      },
      select: { kind: true, entityId: true },
      take: 10000,
    });

    const sentSet = new Set(logs.map((l) => `${l.kind}:${l.entityId}`));
    return items.filter((i) => !sentSet.has(`${i.kind}:${i.id}`));
  }

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
      kind: i.kind,
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
  // ✅ HTML (Docs+Mants o Horómetro)
  // ======================================================
  buildEmailHtml(payload: {
    from?: Date;
    to?: Date;
    daysBefore?: number;
    hoursBefore?: number;
    items: ExpirationItem[];
  }) {
    const { from, daysBefore, hoursBefore, items } = payload;

    const docs = items.filter((x) => x.kind === AlertKind.DOCUMENT);
    const maints = items.filter((x) => x.kind === AlertKind.MAINTENANCE);
    const horos = items.filter((x) => x.kind === AlertKind.HOROMETER);

    const displayName = (i: ExpirationItem) => cleanStr(i.nombre) || cleanStr(i.type) || "—";

    const rowExp = (i: ExpirationItem) => {
      const dl = Number(i.daysLeft ?? 0);
      const u = urgencyMetaDays(dl);
      return `
        <tr style="background:${u.rowBg}">
          <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;font-weight:700;color:#111827;">
            ${i.patente}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;color:#111827;">
            ${displayName(i)}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;color:#111827;white-space:nowrap;">
            ${i.dueDate ? fmtDateCL(new Date(i.dueDate)) : "—"}
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
            <span style="font-weight:800;color:#111827;">${dl}</span>
            <span style="color:#6B7280;font-weight:600;"> días</span>
          </td>
        </tr>
      `;
    };

    const tableExp = (title: string, list: ExpirationItem[]) => `
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
                <th style="text-align:left;padding:10px 12px;border-bottom:1px solid #E5E7EB;color:#374151;font-size:13px;">Fecha</th>
                <th style="text-align:right;padding:10px 12px;border-bottom:1px solid #E5E7EB;color:#374151;font-size:13px;">Días restantes</th>
              </tr>
            </thead>
            <tbody>
              ${list.map(rowExp).join("")}
            </tbody>
          </table>
        `
        }
      </div>
    `;

    const rowH = (i: ExpirationItem) => {
      const left = Number(i.hoursLeft ?? 0);
      const u = urgencyMetaHours(left);
      return `
        <tr style="background:${u.rowBg}">
          <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;font-weight:700;color:#111827;">
            ${i.patente}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;color:#111827;text-align:right;white-space:nowrap;">
            <b>${Number(i.currentHours ?? 0)}</b> h
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;color:#111827;text-align:right;white-space:nowrap;">
            <b>${Number(i.targetHours ?? 0)}</b> h
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
            <span style="font-weight:900;color:#111827;">${left}</span>
            <span style="color:#6B7280;font-weight:600;"> h</span>
          </td>
        </tr>
      `;
    };

    const tableH = (title: string, list: ExpirationItem[]) => `
      <div style="margin-top:18px;">
        <div style="font-size:16px;font-weight:800;color:#111827;margin:0 0 10px;">
          ${title} (${list.length})
        </div>

        ${
          list.length === 0
            ? `<div style="color:#6B7280;font-size:14px;">No hay camiones en el umbral indicado.</div>`
            : `
          <table style="width:100%;border-collapse:separate;border-spacing:0;overflow:hidden;border:1px solid #E5E7EB;border-radius:12px;">
            <thead>
              <tr style="background:#F9FAFB;">
                <th style="text-align:left;padding:10px 12px;border-bottom:1px solid #E5E7EB;color:#374151;font-size:13px;">Patente</th>
                <th style="text-align:right;padding:10px 12px;border-bottom:1px solid #E5E7EB;color:#374151;font-size:13px;">Horómetro actual</th>
                <th style="text-align:right;padding:10px 12px;border-bottom:1px solid #E5E7EB;color:#374151;font-size:13px;">Próximo objetivo</th>
                <th style="text-align:right;padding:10px 12px;border-bottom:1px solid #E5E7EB;color:#374151;font-size:13px;">Horas restantes</th>
              </tr>
            </thead>
            <tbody>
              ${list.map(rowH).join("")}
            </tbody>
          </table>
        `
        }
      </div>
    `;

    const isHorometerMail = typeof hoursBefore === "number";
    const step = Number(process.env.HOROMETER_STEP_HOURS || 500) || 500;

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
                ${isHorometerMail ? "Aviso de horómetro" : "Aviso de vencimientos próximos"}
              </div>
            </div>

            ${
              isHorometerMail
                ? `
                  <div style="margin-top:10px;color:#374151;font-size:14px;line-height:1.5;">
                    Este informe muestra vehículos a los que les faltan exactamente <b>${hoursBefore}</b> horas para completar <b>${step}</b> horas.
                  </div>
                  ${tableH("Horómetros", horos)}
                `
                : `
                  <div style="margin-top:10px;color:#374151;font-size:14px;line-height:1.5;">
                    Este informe muestra documentos y mantenciones que vencen en el día correspondiente a <b>${daysBefore}</b> días desde hoy.
                    <div style="margin-top:6px;color:#6B7280;">
                      <b>Fecha evaluada:</b> ${from ? fmtDateCL(from) : "—"}
                    </div>
                  </div>
                  ${tableExp("Documentos", docs)}
                  ${tableExp("Mantenciones", maints)}
                `
            }

            <div style="margin-top:18px;color:#6B7280;font-size:12px;line-height:1.4;">
              * No se incluyen vehículos EN_PANA/PARADO ni inactivos.
            </div>
          </div>

          <div style="padding:14px 22px;background:#F9FAFB;border-top:1px solid #E5E7EB;color:#9CA3AF;font-size:12px;">
            Este correo fue generado automáticamente por el Sistema de Control de Flota.
          </div>
        </div>
      </div>
    `;
  }

  async getExactAndUnsent(thresholdDays: number) {
    const data = await this.getExpirationsExact(thresholdDays);
    const unsent = await this.filterAlreadyDispatched(data.items, thresholdDays);
    return { ...data, items: unsent };
  }

  async getHorometerExactAndUnsent(thresholdHours: number) {
    const data = await this.getHorometerExact(thresholdHours);
    const unsent = await this.filterAlreadyDispatched(data.items, thresholdHours);
    return { ...data, items: unsent };
  }
}







